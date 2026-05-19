import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runTask } from "../src/task/runner.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";
import type { ToolExecutionContext } from "../src/tools/types.js";

async function createBlockedHarness(prefix: string): Promise<{
  workspaceRoot: string;
  context: ToolExecutionContext;
}> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), prefix));
  const pack = await runTask("test blocked actions", {
    workspaceRoot,
    now: new Date("2026-05-20T02:02:03.000Z"),
    randomId: "blocked123"
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

describe("blocked action evidence", () => {
  it("denied read_file .env appends one blocked action and no tool call success", async () => {
    const { context } = await createBlockedHarness("guard-agent-block-env-");
    await writeFile(path.join(context.workspaceRoot, ".env"), "SECRET_VALUE=do-not-read", "utf8");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "read_file",
        context,
        { path: ".env" },
        { now: new Date("2026-05-20T02:03:00.000Z"), eventId: "event-block-env" }
      )
    ).rejects.toThrow("Reading .env files is blocked.");

    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));

    expect(blockedEvents).toHaveLength(1);
    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      event_id: "event-block-env",
      task_id: context.taskId,
      timestamp: "2026-05-20T02:03:00.000Z",
      requested_tool: "read_file",
      requested_input: { path: ".env" },
      block_reason: "Reading .env files is blocked.",
      matched_rule: "block-env-read",
      severity: "high"
    });
    expect(JSON.stringify(blockedEvents[0])).not.toContain("SECRET_VALUE");
  });

  it("safe read_file executes and writes tool-calls.jsonl with policy allow", async () => {
    const { context } = await createBlockedHarness("guard-agent-allow-read-");
    await writeFile(path.join(context.workspaceRoot, "README.md"), "safe content", "utf8");
    const registry = createDefaultToolRegistry();

    const result = await registry.execute(
      "read_file",
      context,
      { path: "README.md" },
      { now: new Date("2026-05-20T02:03:00.000Z"), eventId: "event-allow-read" }
    );

    expect(result.output).toMatchObject({ content: "safe content" });
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));

    expect(blockedEvents).toEqual([]);
    expect(toolEvents).toHaveLength(1);
    expect(toolEvents[0]).toMatchObject({
      event_id: "event-allow-read",
      tool_name: "read_file",
      policy_decision: "allow",
      status: "success"
    });
  });

  it("unsafe write_file to protected path does not write the file", async () => {
    const { context } = await createBlockedHarness("guard-agent-block-write-");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "write_file",
        context,
        { path: "pricing/checkout.md", content: "blocked pricing change" },
        { now: new Date("2026-05-20T02:03:00.000Z"), eventId: "event-block-write" }
      )
    ).rejects.toThrow("Writes to protected commercial, production, or deployment-sensitive paths are blocked.");

    await expect(stat(path.join(context.workspaceRoot, "pricing", "checkout.md"))).rejects.toThrow();
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));

    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "write_file",
      requested_input: {
        path: "pricing/checkout.md",
        content_bytes: 22,
        content_characters: 22
      },
      matched_rule: "block-protected-commercial-write",
      severity: "high"
    });
  });

  it("workspace escape does not execute or append successful tool evidence", async () => {
    const { context, workspaceRoot } = await createBlockedHarness("guard-agent-block-escape-");
    const outsidePath = path.resolve(workspaceRoot, "..", "outside.txt");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "write_file",
        context,
        { path: "../outside.txt", content: "blocked escape" },
        { now: new Date("2026-05-20T02:03:00.000Z"), eventId: "event-block-escape" }
      )
    ).rejects.toThrow("Workspace escape is blocked.");

    await expect(stat(outsidePath)).rejects.toThrow();
    const blockedEvents = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));
    const toolEvents = await readJsonl(path.join(context.evidenceDirectory, "tool-calls.jsonl"));

    expect(toolEvents).toEqual([]);
    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "write_file",
      matched_rule: "block-workspace-escape",
      severity: "high"
    });
  });

  it("denied request evidence contains the required blocked action fields", async () => {
    const { context } = await createBlockedHarness("guard-agent-block-fields-");
    await mkdir(path.join(context.workspaceRoot, "config"));
    await writeFile(path.join(context.workspaceRoot, "config", ".env.local"), "TOKEN=blocked", "utf8");
    const registry = createDefaultToolRegistry();

    await expect(
      registry.execute(
        "read_file",
        context,
        { path: "config/.env.local" },
        { now: new Date("2026-05-20T02:03:00.000Z"), eventId: "event-block-fields" }
      )
    ).rejects.toThrow("Reading .env files is blocked.");

    const [event] = await readJsonl(path.join(context.evidenceDirectory, "blocked-actions.jsonl"));

    expect(event).toEqual({
      event_id: "event-block-fields",
      task_id: context.taskId,
      timestamp: "2026-05-20T02:03:00.000Z",
      requested_tool: "read_file",
      requested_input: { path: "config/.env.local" },
      block_reason: "Reading .env files is blocked.",
      matched_rule: "block-env-read",
      severity: "high"
    });
  });
});
