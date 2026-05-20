import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runTask } from "../src/task/runner.js";
import type { PlanEvidence, TaskEvidence } from "../src/evidence/schema.js";
import { GuardAdapter } from "../src/guard/adapter.js";
import type { GuardAdapterResult } from "../src/guard/types.js";

const unavailableGuardResult: GuardAdapterResult = {
  guard_available: false,
  reason: "Guard CLI not found",
  commands_attempted: [],
  status_result: null,
  audit_result: null,
  drift_result: null,
  errors: []
};

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

describe("task runner evidence initialization", () => {
  it("creates the evidence directory and required files", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-runner-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter
    });

    expect(result.relativeEvidenceDirectory).toBe(".evidence/task-20260520-010203-abc123");
    expect(await readdir(result.evidenceDirectory)).toEqual([
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "final-report.md",
      "guard-results.json",
      "plan.json",
      "task.json",
      "tool-calls.jsonl"
    ]);
  });

  it("writes task.json with local placeholder task metadata", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-task-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter
    });

    const task = JSON.parse(await readFile(path.join(result.evidenceDirectory, "task.json"), "utf8")) as TaskEvidence;

    expect(task).toEqual({
      task_id: "task-20260520-010203-abc123",
      created_at: "2026-05-20T01:02:03.000Z",
      user_prompt: "Create a safe README update proposal",
      workspace_root: workspaceRoot,
      harness_version: "0.0.0",
      mode: "local",
      planner_type: "placeholder"
    });
  });

  it("writes plan.json with a placeholder-only plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-plan-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter
    });

    const plan = JSON.parse(await readFile(path.join(result.evidenceDirectory, "plan.json"), "utf8")) as PlanEvidence;

    expect(plan).toEqual({
      task_id: "task-20260520-010203-abc123",
      planner: "placeholder",
      steps: [
        {
          id: "step-1",
          type: "placeholder",
          description: "No real agent or tool execution is implemented in PR 2."
        }
      ],
      risk_notes: [
        "PR 2 initializes evidence only. No files are read, written, or modified by agent tools."
      ],
      expected_outputs: ["task.json", "plan.json", "final-report.md"]
    });
  });

  it("writes a human-readable final report with runtime boundaries", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-report-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter
    });

    const report = await readFile(path.join(result.evidenceDirectory, "final-report.md"), "utf8");

    expect(report).toContain("# Guard-native Agent Harness Report");
    expect(report).toContain("## Task Summary");
    expect(report).toContain("## Plan Summary");
    expect(report).toContain("## Evidence Files Created");
    expect(report).toContain("## Runtime Boundary");
    expect(report).toContain("## Limitations");
    expect(report).toContain("No real agent execution happened");
    expect(report).toContain("no autonomous tool calls happened");
    expect(report).toContain("Guard output does not grant execution authority");
    expect(report).toContain("no external API was called");
  });

  it("initializes tool call evidence without implying real tool or Guard execution", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-boundary-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter
    });

    const files = await readdir(result.evidenceDirectory);
    const blockedActions = await readFile(path.join(result.evidenceDirectory, "blocked-actions.jsonl"), "utf8");
    const commandResults = await readFile(path.join(result.evidenceDirectory, "command-results.jsonl"), "utf8");
    const guardResults = JSON.parse(
      await readFile(path.join(result.evidenceDirectory, "guard-results.json"), "utf8")
    ) as GuardAdapterResult;
    const toolCalls = await readFile(path.join(result.evidenceDirectory, "tool-calls.jsonl"), "utf8");

    expect(files).toContain("blocked-actions.jsonl");
    expect(blockedActions).toBe("");
    expect(files).toContain("command-results.jsonl");
    expect(commandResults).toBe("");
    expect(files).toContain("guard-results.json");
    expect(guardResults).toEqual(unavailableGuardResult);
    expect(files).toContain("tool-calls.jsonl");
    expect(toolCalls).toBe("");
  });
});
