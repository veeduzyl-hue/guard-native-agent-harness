import { randomBytes } from "node:crypto";

import { appendBlockedActionEvent, appendToolCallEvent } from "../evidence/writer.js";
import type { ToolCallEvidenceEvent } from "../evidence/schema.js";
import { createDefaultPolicyGate, type PolicyGate } from "../policy/gate.js";
import { createReportTool } from "./create-report.js";
import { gitDiffTool } from "./git-diff.js";
import { gitStatusTool } from "./git-status.js";
import { listFilesTool } from "./list-files.js";
import { readFileTool } from "./read-file.js";
import { runCommandTool } from "./run-command.js";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionOptions,
  ToolExecutionResult,
  ToolMetadata,
  ToolName
} from "./types.js";
import { ToolBlockedError, ToolExecutionError } from "./types.js";
import { writeFileTool } from "./write-file.js";

export class ToolRegistry {
  private readonly tools = new Map<ToolName, ToolDefinition>();

  constructor(private readonly policyGate: PolicyGate = createDefaultPolicyGate()) {}

  register(tool: ToolDefinition): void {
    this.tools.set(tool.metadata.name, tool);
  }

  get(name: ToolName): ToolDefinition {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new ToolExecutionError(`Unknown tool: ${name}`);
    }

    return tool;
  }

  list(): ToolMetadata[] {
    return [...this.tools.values()].map((tool) => tool.metadata);
  }

  async execute(
    name: ToolName,
    context: ToolExecutionContext,
    input: Record<string, unknown> = {},
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.get(name);
    const startedAt = Date.now();
    const timestamp = options.now ?? new Date();
    const eventId = options.eventId ?? `event-${randomBytes(4).toString("hex")}`;
    const evidenceInput = summarizeToolInput(name, input);
    const policyDecision = this.policyGate.evaluate({
      taskId: context.taskId,
      toolName: name,
      input,
      workspaceRoot: context.workspaceRoot
    });

    if (policyDecision.decision === "deny") {
      await appendBlockedActionEvent(context.evidenceDirectory, {
        event_id: eventId,
        task_id: context.taskId,
        timestamp: timestamp.toISOString(),
        requested_tool: name,
        requested_input: evidenceInput,
        block_reason: policyDecision.reason,
        matched_rule: policyDecision.matchedRule ?? "unknown-policy-rule",
        severity: policyDecision.severity === "none" ? "low" : policyDecision.severity
      });

      throw new ToolBlockedError(policyDecision.reason);
    }

    try {
      const result = await tool.execute(context, input, {
        eventId,
        timestamp
      });
      await appendToolCallEvent(context.evidenceDirectory, {
        event_id: eventId,
        task_id: context.taskId,
        timestamp: timestamp.toISOString(),
        tool_name: tool.metadata.name,
        input: evidenceInput,
        risk_level: tool.metadata.riskLevel,
        policy_decision: "allow",
        status: result.status ?? "success",
        output_summary: result.outputSummary,
        duration_ms: Date.now() - startedAt
      });

      return result;
    } catch (error) {
      const event: ToolCallEvidenceEvent = {
        event_id: eventId,
        task_id: context.taskId,
        timestamp: timestamp.toISOString(),
        tool_name: tool.metadata.name,
        input: evidenceInput,
        risk_level: tool.metadata.riskLevel,
        policy_decision: "allow",
        status: "error",
        error_summary: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startedAt
      };
      await appendToolCallEvent(context.evidenceDirectory, event);

      throw error instanceof Error ? error : new ToolExecutionError(String(error));
    }
  }
}

function summarizeToolInput(name: ToolName, input: Record<string, unknown>): Record<string, unknown> {
  if (name === "write_file" && typeof input.content === "string") {
    return {
      path: input.path,
      content_bytes: Buffer.byteLength(input.content, "utf8"),
      content_characters: input.content.length
    };
  }

  if (name === "create_report" && typeof input.content === "string") {
    return {
      title: input.title,
      content_bytes: Buffer.byteLength(input.content, "utf8"),
      content_characters: input.content.length
    };
  }

  return input;
}

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(listFilesTool);
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(gitStatusTool);
  registry.register(gitDiffTool);
  registry.register(createReportTool);
  registry.register(runCommandTool);

  return registry;
}
