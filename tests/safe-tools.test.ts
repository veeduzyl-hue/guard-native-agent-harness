import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runTask } from "../src/task/runner.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";
import type { ToolExecutionContext, ToolName } from "../src/tools/types.js";

async function createToolHarness(prefix: string): Promise<{
  workspaceRoot: string;
  context: ToolExecutionContext;
}> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), prefix));
  const pack = await runTask("test safe tool execution", {
    workspaceRoot,
    now: new Date("2026-05-20T01:02:03.000Z"),
    randomId: "safe123",
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

async function readToolEvents(evidenceDirectory: string): Promise<Record<string, unknown>[]> {
  const content = await readFile(path.join(evidenceDirectory, "tool-calls.jsonl"), "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function readBlockedEvents(evidenceDirectory: string): Promise<Record<string, unknown>[]> {
  const content = await readFile(path.join(evidenceDirectory, "blocked-actions.jsonl"), "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("safe tools", () => {
  it("list_files lists files inside the workspace and appends success evidence", async () => {
    const { context } = await createToolHarness("guard-agent-list-");
    await writeFile(path.join(context.workspaceRoot, "README.md"), "hello", "utf8");
    const registry = createDefaultToolRegistry();

    const result = await registry.execute(
      "list_files",
      context,
      { path: "." },
      { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-list" }
    );

    expect(result.outputSummary).toMatchObject({ path: ".", entries_count: 2 });
    expect(result.output).toMatchObject({
      entries: expect.arrayContaining([
        { name: ".evidence", type: "directory" },
        { name: "README.md", type: "file" }
      ])
    });

    const events = await readToolEvents(context.evidenceDirectory);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_id: "event-list",
      task_id: context.taskId,
      timestamp: "2026-05-20T01:03:00.000Z",
      tool_name: "list_files",
      input: { path: "." },
      risk_level: "low",
      policy_decision: "allow",
      status: "success",
      output_summary: { path: ".", entries_count: 2 }
    });
  });

  it("read_file reads a safe file without writing full content to evidence", async () => {
    const { context } = await createToolHarness("guard-agent-read-");
    await writeFile(path.join(context.workspaceRoot, "README.md"), "safe content", "utf8");
    const registry = createDefaultToolRegistry();

    const result = await registry.execute(
      "read_file",
      context,
      { path: "README.md" },
      { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-read" }
    );

    expect(result.output).toMatchObject({ path: "README.md", content: "safe content" });
    expect(result.outputSummary).toMatchObject({
      path: "README.md",
      bytes: 12,
      characters: 12
    });

    const rawEvidence = await readFile(path.join(context.evidenceDirectory, "tool-calls.jsonl"), "utf8");
    expect(rawEvidence).not.toContain("safe content");
    expect(JSON.parse(rawEvidence)).toMatchObject({
      tool_name: "read_file",
      policy_decision: "allow",
      status: "success",
      output_summary: {
        path: "README.md",
        bytes: 12,
        characters: 12
      }
    });
  });

  it("write_file writes inside the workspace and appends success evidence", async () => {
    const { context } = await createToolHarness("guard-agent-write-");
    const registry = createDefaultToolRegistry();

    await registry.execute(
      "write_file",
      context,
      {
        path: "examples/readme-update/README_UPDATE_PROPOSAL.md",
        content: "# Proposal\nSafe update.\n"
      },
      { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-write" }
    );

    const written = await readFile(
      path.join(context.workspaceRoot, "examples", "readme-update", "README_UPDATE_PROPOSAL.md"),
      "utf8"
    );
    expect(written).toBe("# Proposal\nSafe update.\n");

    const events = await readToolEvents(context.evidenceDirectory);
    expect(events[0]).toMatchObject({
      tool_name: "write_file",
      risk_level: "medium",
      policy_decision: "allow",
      status: "success",
      output_summary: {
        path: "examples/readme-update/README_UPDATE_PROPOSAL.md",
        bytes: 24,
        characters: 24
      }
    });
    expect(JSON.stringify(events[0])).not.toContain("Safe update.");
  });

  it("write_file rejects workspace escape as a tool-level error", async () => {
    const { context } = await createToolHarness("guard-agent-write-escape-");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "write_file",
        context,
        { path: "../escape.md", content: "nope" },
        { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-write-escape" }
      )
    ).rejects.toThrow("Workspace escape is blocked.");

    const toolEvents = await readToolEvents(context.evidenceDirectory);
    const blockedEvents = await readBlockedEvents(context.evidenceDirectory);
    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "write_file",
      requested_input: {
        path: "../escape.md",
        content_bytes: 4,
        content_characters: 4
      },
      block_reason: "Workspace escape is blocked.",
      matched_rule: "block-workspace-escape",
      severity: "high"
    });
  });

  it("read_file rejects workspace escape as a tool-level error", async () => {
    const { context } = await createToolHarness("guard-agent-read-escape-");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "read_file",
        context,
        { path: "../outside.md" },
        { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-read-escape" }
      )
    ).rejects.toThrow("Workspace escape is blocked.");

    const toolEvents = await readToolEvents(context.evidenceDirectory);
    const blockedEvents = await readBlockedEvents(context.evidenceDirectory);
    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "read_file",
      requested_input: { path: "../outside.md" },
      block_reason: "Workspace escape is blocked.",
      matched_rule: "block-workspace-escape",
      severity: "high"
    });
  });

  it("git_status returns a controlled error in a non-git workspace without mutating files", async () => {
    const { context } = await createToolHarness("guard-agent-git-status-");
    await writeFile(path.join(context.workspaceRoot, "keep.txt"), "unchanged", "utf8");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "git_status",
        context,
        {},
        { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-git-status" }
      )
    ).rejects.toThrow();

    await expect(readFile(path.join(context.workspaceRoot, "keep.txt"), "utf8")).resolves.toBe("unchanged");
    const entries = await readdir(context.workspaceRoot);
    expect(entries.sort()).toEqual([".evidence", "keep.txt"]);

    const events = await readToolEvents(context.evidenceDirectory);
    expect(events[0]).toMatchObject({
      tool_name: "git_status",
      risk_level: "low",
      policy_decision: "allow",
      status: "error"
    });
  });

  it("git_diff returns a controlled error in a non-git workspace without mutating files", async () => {
    const { context } = await createToolHarness("guard-agent-git-diff-");
    await writeFile(path.join(context.workspaceRoot, "keep.txt"), "unchanged", "utf8");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "git_diff",
        context,
        {},
        { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-git-diff" }
      )
    ).rejects.toThrow();

    await expect(readFile(path.join(context.workspaceRoot, "keep.txt"), "utf8")).resolves.toBe("unchanged");
    const entries = await readdir(context.workspaceRoot);
    expect(entries.sort()).toEqual([".evidence", "keep.txt"]);

    const events = await readToolEvents(context.evidenceDirectory);
    expect(events[0]).toMatchObject({
      tool_name: "git_diff",
      risk_level: "low",
      policy_decision: "allow",
      status: "error"
    });
  });

  it("create_report creates a markdown artifact inside the task evidence directory", async () => {
    const { context } = await createToolHarness("guard-agent-report-");
    const registry = createDefaultToolRegistry();

    const result = await registry.execute(
      "create_report",
      context,
      { title: "Safe Tool Report", content: "Only a local evidence artifact." },
      { now: new Date("2026-05-20T01:03:00.000Z"), eventId: "event-report" }
    );

    const reportPath = path.join(context.evidenceDirectory, "tool-report.md");
    const reportStat = await stat(reportPath);
    expect(reportStat.isFile()).toBe(true);
    await expect(readFile(reportPath, "utf8")).resolves.toBe(
      "# Safe Tool Report\n\nOnly a local evidence artifact.\n"
    );
    expect(result.outputSummary).toMatchObject({
      path: `${context.relativeEvidenceDirectory}/tool-report.md`,
      bytes: 52,
      characters: 52
    });

    const events = await readToolEvents(context.evidenceDirectory);
    expect(events[0]).toMatchObject({
      tool_name: "create_report",
      policy_decision: "allow",
      status: "success",
      output_summary: {
        path: `${context.relativeEvidenceDirectory}/tool-report.md`,
        bytes: 52,
        characters: 52
      }
    });
    expect(JSON.stringify(events[0])).not.toContain("Only a local evidence artifact.");
  });

  it("registers run_command with medium risk and evidence requirements", () => {
    const registry = createDefaultToolRegistry();
    const metadata = registry.get("run_command").metadata;

    expect(metadata).toMatchObject({
      name: "run_command",
      riskLevel: "medium",
      requiresApproval: false,
      pathPolicy: "workspace_only",
      evidenceRequired: true
    });
  });

  it.each<ToolName>(["list_files", "read_file", "write_file"])(
    "%s has workspace-only path metadata",
    (toolName) => {
      const registry = createDefaultToolRegistry();

      expect(registry.get(toolName).metadata.pathPolicy).toBe("workspace_only");
    }
  );
});
