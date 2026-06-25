import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GuardAdapter } from "../src/guard/adapter.js";
import type { GuardCompatibilityEvidencePack } from "../src/evidence/schema.js";
import { HARNESS_VERSION } from "../src/index.js";
import { runTask } from "../src/task/runner.js";

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

async function readJsonl(filePath: string): Promise<Record<string, unknown>[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("end-to-end mock planner demo", () => {
  it("generates a complete Evidence Pack for the README proposal workflow", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-e2e-readme-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T06:00:00.000Z"),
      randomId: "e2ereadme",
      guardAdapter: unavailableGuardAdapter
    });

    for (const fileName of [
      "task.json",
      "plan.json",
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json",
      "evidence-manifest.json",
      "evidence-pack.json",
      "final-report.md"
    ]) {
      await expect(stat(path.join(result.evidenceDirectory, fileName))).resolves.toBeDefined();
    }

    const toolEvents = await readJsonl(result.toolCallsPath);
    const compatibilityPack = JSON.parse(
      await readFile(path.join(result.evidenceDirectory, "evidence-pack.json"), "utf8")
    ) as GuardCompatibilityEvidencePack;
    const report = await readFile(result.finalReportPath, "utf8");
    const proposal = await readFile(
      path.join(workspaceRoot, "examples", "readme-update", "README_UPDATE_PROPOSAL.md"),
      "utf8"
    );

    expect(result.executionSummary.steps_planned).toBe(6);
    expect(toolEvents.length).toBeGreaterThan(0);
    expect(toolEvents.map((event) => event.tool_name)).toContain("write_file");
    expect(proposal).toContain("# README Update Proposal");
    expect(report).toContain("## 4. Tool Calls");
    expect(report).toContain("- Total tool calls:");
    expect(report).toContain("## 7. Guard Results");
    expect(report).toContain("Guard CLI was not available. The run completed with graceful fallback.");
    expect(compatibilityPack.actions).toHaveLength(6);
    expect(compatibilityPack.blocked_actions).toEqual([]);
    expect(compatibilityPack.producer.version).toBe(HARNESS_VERSION);
    expect(compatibilityPack.artifacts.map((artifact) => artifact.path)).toEqual([
      ".evidence/task-20260520-060000-e2ereadme/tool-report.md",
      "examples/readme-update/README_UPDATE_PROPOSAL.md"
    ]);
    expect(compatibilityPack.tool_calls.length).toBe(toolEvents.length);
    expect(report).toContain("| evidence-manifest.json | present |");
    expect(report).toContain("| evidence-pack.json | present |");
    expect(report).toContain("- tool-report.md: present");
  });

  it("generates blocked-action evidence for the unsafe demo workflow", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-e2e-unsafe-"));

    const result = await runTask("Show a policy demo with blocked action", {
      workspaceRoot,
      now: new Date("2026-05-20T06:10:00.000Z"),
      randomId: "e2eunsafe",
      guardAdapter: unavailableGuardAdapter
    });

    const blockedEvents = await readJsonl(result.blockedActionsPath);
    const commandEvents = await readJsonl(result.commandResultsPath);
    const compatibilityPack = JSON.parse(
      await readFile(path.join(result.evidenceDirectory, "evidence-pack.json"), "utf8")
    ) as GuardCompatibilityEvidencePack;
    const report = await readFile(result.finalReportPath, "utf8");

    expect(result.executionSummary).toEqual({
      steps_planned: 2,
      steps_completed: 0,
      steps_blocked: 2,
      steps_failed: 0
    });
    expect(blockedEvents.map((event) => event.matched_rule)).toEqual(["block-env-read", "block-git-push"]);
    expect(commandEvents).toEqual([]);
    expect(report).toContain("## 5. Blocked Actions");
    expect(report).toContain("- Total blocked actions: 2");
    expect(report).toContain("block-env-read");
    expect(report).toContain("block-git-push");
    expect(compatibilityPack.tool_calls).toEqual([]);
    expect(compatibilityPack.blocked_actions.map((event) => event.matched_rule)).toEqual([
      "block-env-read",
      "block-git-push"
    ]);
    expect(compatibilityPack.actions.map((action) => action.status)).toEqual([
      "blocked",
      "blocked"
    ]);
  });
});
