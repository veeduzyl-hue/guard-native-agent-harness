import { appendCommandResultEvent } from "../evidence/writer.js";
import { runSandboxedCommand, summarizeCommandOutput } from "../sandbox/command.js";
import type { ToolDefinition } from "./types.js";

interface RunCommandInput extends Record<string, unknown> {
  command: string;
  timeout_ms?: number;
}

export const runCommandTool: ToolDefinition<RunCommandInput> = {
  metadata: {
    name: "run_command",
    description: "Run an explicitly allowlisted local command inside the workspace sandbox.",
    riskLevel: "medium",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true,
    inputSchemaHint: {
      command: "exact allowlisted command string only"
    },
    inputExample: {
      command: "git status --short"
    }
  },
  async execute(context, input, invocation) {
    const timeoutMs = normalizeTimeout(input.timeout_ms);
    const result = await runSandboxedCommand(input.command, context.workspaceRoot, timeoutMs);
    const stdoutSummary = summarizeCommandOutput(result.stdout);
    const stderrSummary = summarizeCommandOutput(result.stderr);

    await appendCommandResultEvent(context.evidenceDirectory, {
      event_id: invocation.eventId,
      task_id: context.taskId,
      timestamp: invocation.timestamp.toISOString(),
      command: result.command,
      cwd: result.cwd,
      exit_code: result.exitCode,
      stdout_summary: stdoutSummary,
      stderr_summary: stderrSummary,
      duration_ms: result.durationMs,
      status: result.status
    });

    return {
      output: {
        command: result.command,
        exit_code: result.exitCode,
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr
      },
      outputSummary: {
        command: result.command,
        exit_code: result.exitCode,
        stdout_bytes: Buffer.byteLength(result.stdout, "utf8"),
        stderr_bytes: Buffer.byteLength(result.stderr, "utf8")
      },
      status: result.status === "success" ? "success" : "error"
    };
  }
};

function normalizeTimeout(timeoutMs: unknown): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return 30000;
  }

  return Math.max(1, Math.min(Math.trunc(timeoutMs), 300000));
}
