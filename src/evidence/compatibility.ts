import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GuardAdapterResult } from "../guard/types.js";
import {
  evidenceManifestCreatedBy,
  evidenceManifestFileName,
  evidenceManifestSchemaVersion
} from "./manifest.js";
import type {
  BlockedActionEvidenceEvent,
  CommandResultEvidenceEvent,
  ExecutionSummary,
  GuardCompatibilityAction,
  GuardCompatibilityArtifact,
  GuardCompatibilityEvidencePack,
  GuardCompatibilityRiskSignal,
  GuardCompatibilityToolCall,
  PlanEvidence,
  TaskEvidence,
  ToolCallEvidenceEvent
} from "./schema.js";

export const guardCompatibilityPackFileName = "evidence-pack.json";
export const guardCompatibilityPackSchemaVersion = "mindforge-guard-evidence.v1";

const compatibilitySourceFiles = [
  "task.json",
  "plan.json",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json",
  "final-report.md"
] as const;

interface WriteGuardCompatibilityEvidencePackInput {
  evidenceDirectory: string;
  relativeEvidenceDirectory: string;
  task: TaskEvidence;
  plan: PlanEvidence;
  guardResult: GuardAdapterResult;
  executionSummary: ExecutionSummary;
}

type AttemptEvent =
  | {
      type: "tool_call";
      event_id: string;
      timestamp: string;
      tool_name: string;
      input: Record<string, unknown>;
      event: ToolCallEvidenceEvent;
    }
  | {
      type: "blocked_action";
      event_id: string;
      timestamp: string;
      tool_name: string;
      input: Record<string, unknown>;
      event: BlockedActionEvidenceEvent;
    };

export async function writeGuardCompatibilityEvidencePack(
  input: WriteGuardCompatibilityEvidencePackInput
): Promise<GuardCompatibilityEvidencePack> {
  const toolCalls = await readJsonlFile<ToolCallEvidenceEvent>(
    path.join(input.evidenceDirectory, "tool-calls.jsonl")
  );
  const blockedActions = await readJsonlFile<BlockedActionEvidenceEvent>(
    path.join(input.evidenceDirectory, "blocked-actions.jsonl")
  );
  const commandResults = await readJsonlFile<CommandResultEvidenceEvent>(
    path.join(input.evidenceDirectory, "command-results.jsonl")
  );

  const compatibilityPack = createGuardCompatibilityEvidencePack({
    ...input,
    toolCalls,
    blockedActions,
    commandResults
  });

  await writeFile(
    path.join(input.evidenceDirectory, guardCompatibilityPackFileName),
    `${JSON.stringify(compatibilityPack, null, 2)}\n`,
    "utf8"
  );

  return compatibilityPack;
}

function createGuardCompatibilityEvidencePack(input: {
  evidenceDirectory: string;
  relativeEvidenceDirectory: string;
  task: TaskEvidence;
  plan: PlanEvidence;
  guardResult: GuardAdapterResult;
  executionSummary: ExecutionSummary;
  toolCalls: ToolCallEvidenceEvent[];
  blockedActions: BlockedActionEvidenceEvent[];
  commandResults: CommandResultEvidenceEvent[];
}): GuardCompatibilityEvidencePack {
  const commandResultsByEventId = new Map(
    input.commandResults.map((event) => [event.event_id, event] as const)
  );
  const toolCalls: GuardCompatibilityToolCall[] = input.toolCalls.map((event) => ({
    ...event,
    ...(commandResultsByEventId.has(event.event_id)
      ? { command_result: commandResultsByEventId.get(event.event_id) }
      : {})
  }));

  return {
    schema_version: guardCompatibilityPackSchemaVersion,
    pack_id: input.task.task_id,
    pack_type: "execution_facts",
    created_at: input.task.created_at,
    producer: {
      id: "guard-native-agent-harness",
      version: input.task.harness_version,
      role: "evidence_producer"
    },
    workflow: {
      task_id: input.task.task_id,
      mode: input.task.mode,
      planner: input.task.planner_type,
      planner_provider: input.task.planner_provider ?? input.task.planner_type,
      planner_model: input.task.planner_model ?? null,
      step_count: input.plan.steps.length,
      expected_outputs: [...input.plan.expected_outputs]
    },
    authority: {
      boundary: "producer_only",
      consumer_authority: "mindforge-guard-core",
      governance_outputs_emitted: false,
      local_safety_controls_only: true,
      execution_authority_granted: false
    },
    runtime: {
      workspace_root: input.task.workspace_root,
      evidence_directory: input.relativeEvidenceDirectory,
      guard_available: input.guardResult.guard_available,
      execution_summary: input.executionSummary
    },
    intent: {
      user_prompt: input.task.user_prompt
    },
    scope: {
      local_only: true,
      policy_gated: true,
      registered_tools_only: true,
      command_allowlist_only: true
    },
    actions: createActions(
      input.plan,
      input.toolCalls,
      input.blockedActions,
      commandResultsByEventId
    ),
    tool_calls: toolCalls,
    blocked_actions: input.blockedActions,
    artifacts: createArtifacts(input.relativeEvidenceDirectory, input.toolCalls),
    verification: {
      tool_call_count: input.toolCalls.length,
      blocked_action_count: input.blockedActions.length,
      command_result_count: input.commandResults.length,
      final_report_path: "final-report.md",
      guard_results_path: "guard-results.json",
      manifest_path: evidenceManifestFileName
    },
    risk_signals: createRiskSignals(input.toolCalls, input.blockedActions),
    provenance: {
      evidence_directory: input.relativeEvidenceDirectory,
      source_files: [...compatibilitySourceFiles],
      generated_from_local_files_only: true,
      generated_by: "guard-native-agent-harness"
    },
    manifest: {
      path: evidenceManifestFileName,
      schema_version: evidenceManifestSchemaVersion,
      created_by: evidenceManifestCreatedBy
    }
  };
}

function createActions(
  plan: PlanEvidence,
  toolCalls: ToolCallEvidenceEvent[],
  blockedActions: BlockedActionEvidenceEvent[],
  commandResultsByEventId: Map<string, CommandResultEvidenceEvent>
): GuardCompatibilityAction[] {
  const attemptEvents = [
    ...toolCalls.map(
      (event) =>
        ({
          type: "tool_call",
          event_id: event.event_id,
          timestamp: event.timestamp,
          tool_name: event.tool_name,
          input: event.input,
          event
        }) satisfies AttemptEvent
    ),
    ...blockedActions.map(
      (event) =>
        ({
          type: "blocked_action",
          event_id: event.event_id,
          timestamp: event.timestamp,
          tool_name: event.requested_tool,
          input: event.requested_input,
          event
        }) satisfies AttemptEvent
    )
  ].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return plan.steps.map((step) => {
    const requestedTool = step.tool ?? null;
    const requestedInput = summarizePlannedInput(step.tool, step.input);
    const attemptIndex =
      requestedTool === null
        ? -1
        : attemptEvents.findIndex(
            (event) =>
              event.tool_name === requestedTool && sameRecord(event.input, requestedInput)
          );

    if (attemptIndex === -1) {
      return {
        action_id: step.id,
        description: step.description,
        requested_tool: requestedTool,
        requested_input: requestedInput,
        status: "not_recorded",
        event_id: null,
        timestamp: null
      };
    }

    const attempt = attemptEvents.splice(attemptIndex, 1)[0];
    const commandResult = commandResultsByEventId.get(attempt.event_id);

    return {
      action_id: step.id,
      description: step.description,
      requested_tool: requestedTool,
      requested_input: requestedInput,
      status:
        attempt.type === "blocked_action"
          ? "blocked"
          : attempt.event.status === "success"
            ? "completed"
            : "failed",
      event_id: attempt.event_id,
      timestamp: attempt.timestamp,
      ...(commandResult ? { command_result: commandResult } : {})
    };
  });
}

function createArtifacts(
  relativeEvidenceDirectory: string,
  toolCalls: ToolCallEvidenceEvent[]
): GuardCompatibilityArtifact[] {
  const artifacts = new Map<string, GuardCompatibilityArtifact>();
  const artifactProducingTools = new Set(["write_file", "create_report"]);

  for (const event of toolCalls) {
    if (!artifactProducingTools.has(event.tool_name)) {
      continue;
    }

    const outputSummary = event.output_summary;
    const outputPath = typeof outputSummary?.path === "string" ? outputSummary.path : null;

    if (!outputPath) {
      continue;
    }

    artifacts.set(outputPath, {
      path: outputPath,
      kind: outputPath.startsWith(`${relativeEvidenceDirectory}/`)
        ? "evidence_output"
        : "workspace_output",
      produced_by: event.tool_name,
      ...(typeof outputSummary?.bytes === "number" ? { bytes: outputSummary.bytes } : {}),
      ...(typeof outputSummary?.characters === "number"
        ? { characters: outputSummary.characters }
        : {})
    });
  }

  return [...artifacts.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function createRiskSignals(
  toolCalls: ToolCallEvidenceEvent[],
  blockedActions: BlockedActionEvidenceEvent[]
): GuardCompatibilityRiskSignal[] {
  return [
    ...toolCalls.map((event) => ({
      signal_type: "tool_risk_level" as const,
      source_path: "tool-calls.jsonl" as const,
      event_id: event.event_id,
      tool_name: event.tool_name,
      observed_level: event.risk_level
    })),
    ...blockedActions.map((event) => ({
      signal_type: "blocked_action_severity" as const,
      source_path: "blocked-actions.jsonl" as const,
      event_id: event.event_id,
      tool_name: event.requested_tool,
      observed_level: event.severity,
      matched_rule: event.matched_rule
    }))
  ];
}

function summarizePlannedInput(
  toolName: string | undefined,
  input: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!input) {
    return {};
  }

  if (toolName === "write_file" && typeof input.content === "string") {
    return {
      path: input.path,
      content_bytes: Buffer.byteLength(input.content, "utf8"),
      content_characters: input.content.length
    };
  }

  if (toolName === "create_report" && typeof input.content === "string") {
    return {
      title: input.title,
      content_bytes: Buffer.byteLength(input.content, "utf8"),
      content_characters: input.content.length
    };
  }

  return input;
}

function sameRecord(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  const content = await readFile(filePath, "utf8");

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}
