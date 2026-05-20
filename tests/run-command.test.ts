import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COMMAND_OUTPUT_SUMMARY_MAX_LENGTH, summarizeCommandOutput } from "../src/sandbox/command.js";
import { runTask } from "../src/task/runner.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";
import type { ToolExecutionContext } from "../src/tools/types.js";

async function createCommandHarness(prefix: string): Promise<{
  workspaceRoot: string;
  context: ToolExecutionContext;
}> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), prefix));
  const pack = await runTask("test run command", {
    workspaceRoot,
    now: new Date("2026-05-20T03:02:03.000Z"),
    randomId: "command123",
    executePlan: false
  });

  return {
    workspaceRoot,
    context: {
      taskId: pack.task.task_id,
      workspaceRoot,
      evidenceDirectory: pack.evidenceDirectory,
      relativeEvidenceDirectory: pack.relativeEvidenceDirectory
    }
  };
}

async function readJsonl(filePath: string): Promise<Record<string, unknown>[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("run_command tool", () => {
  it("executes allowlisted node --version successfully", async () => {
    const { context } = await createCommandHarness("guard-agent-run-command-");
    const registry = createDefaultToolRegistry();

    const result = await registry.execute(
      "run_command",
      context,
      { command: "node --version" },
      { now: new Date("2026-05-20T03:03:00.000Z"), eventId: "event-node-version" }
    );

    expect(result.status).toBe("success");
    expect(result.output).toMatchObject({
      command: "node --version",
      exit_code: 0,
      status: "success"
    });
  });

  it("appends command-results.jsonl and tool-calls.jsonl for an allowed command", async () => {
    const { context } = await createCommandHarness("guard-agent-command-evidence-");
    const registry = createDefaultToolRegistry();

    await registry.execute(
      "run_command",
      context,
      { command: "node -v" },
      { now: new Date("2026-05-20T03:03:00.000Z"), eventId: "event-node-v" }
    );

    const commandEvents = await readJsonl(path.join(context.evidenceDirectory, "command-results.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));

    expect(blockedEvents).toEqual([]);
    expect(commandEvents).toHaveLength(1);
    expect(commandEvents[0]).toMatchObject({
      event_id: "event-node-v",
      task_id: context.taskId,
      timestamp: "2026-05-20T03:03:00.000Z",
      command: "node -v",
      cwd: context.workspaceRoot,
      exit_code: 0,
      stderr_summary: "",
      status: "success"
    });
    expect(String(commandEvents[0].stdout_summary)).toMatch(/^v\d+\./);
    expect(typeof commandEvents[0].duration_ms).toBe("number");

    expect(toolEvents).toHaveLength(1);
    expect(toolEvents[0]).toMatchObject({
      event_id: "event-node-v",
      task_id: context.taskId,
      timestamp: "2026-05-20T03:03:00.000Z",
      tool_name: "run_command",
      input: { command: "node -v" },
      risk_level: "medium",
      policy_decision: "allow",
      status: "success",
      output_summary: {
        command: "node -v",
        exit_code: 0,
        stderr_bytes: 0
      }
    });
  });

  it("denies destructive commands before execution", async () => {
    const { context } = await createCommandHarness("guard-agent-command-deny-destructive-");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "run_command",
        context,
        { command: "rm -rf ." },
        { now: new Date("2026-05-20T03:03:00.000Z"), eventId: "event-deny-rm" }
      )
    ).rejects.toThrow("Destructive command requests are blocked.");

    const commandEvents = await readJsonl(path.join(context.evidenceDirectory, "command-results.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));

    expect(commandEvents).toEqual([]);
    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      event_id: "event-deny-rm",
      requested_tool: "run_command",
      requested_input: { command: "rm -rf ." },
      block_reason: "Destructive command requests are blocked.",
      matched_rule: "block-destructive-command",
      severity: "high"
    });
  });

  it("denies non-allowlisted commands and does not create command output files", async () => {
    const { context, workspaceRoot } = await createCommandHarness("guard-agent-command-deny-nonallow-");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "run_command",
        context,
        { command: "node -e \"require('fs').writeFileSync('should-not-exist.txt', 'nope')\"" },
        { now: new Date("2026-05-20T03:03:00.000Z"), eventId: "event-deny-node-e" }
      )
    ).rejects.toThrow("Command is not in the PR 5 allowlist.");

    await expect(stat(path.join(workspaceRoot, "should-not-exist.txt"))).rejects.toThrow();
    await expect(readJsonl(path.join(context.evidenceDirectory, "command-results.jsonl"))).resolves.toEqual([]);
    await expect(readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"))).resolves.toEqual([]);
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));

    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "run_command",
      matched_rule: "block-command-not-allowlisted",
      severity: "medium"
    });
  });

  it("records workspace root as command cwd", async () => {
    const { context } = await createCommandHarness("guard-agent-command-cwd-");
    const registry = createDefaultToolRegistry();

    await registry.execute(
      "run_command",
      context,
      { command: "node --version" },
      { now: new Date("2026-05-20T03:03:00.000Z"), eventId: "event-cwd" }
    );

    const [commandEvent] = await readJsonl(path.join(context.evidenceDirectory, "command-results.jsonl"));

    expect(commandEvent.cwd).toBe(context.workspaceRoot);
  });

  it("bounds stdout and stderr evidence summaries", () => {
    const longOutput = "x".repeat(COMMAND_OUTPUT_SUMMARY_MAX_LENGTH + 100);
    const summary = summarizeCommandOutput(longOutput);

    expect(summary.length).toBeLessThanOrEqual(COMMAND_OUTPUT_SUMMARY_MAX_LENGTH);
    expect(summary.length).toBeLessThan(longOutput.length);
    expect(summary).toContain("[truncated]");
  });
});
