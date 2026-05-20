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
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
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

  it("writes task.json with local mock task metadata", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-task-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    const task = JSON.parse(await readFile(path.join(result.evidenceDirectory, "task.json"), "utf8")) as TaskEvidence;

    expect(task).toEqual({
      task_id: "task-20260520-010203-abc123",
      created_at: "2026-05-20T01:02:03.000Z",
      user_prompt: "Create a safe README update proposal",
      workspace_root: workspaceRoot,
      harness_version: "0.0.0",
      mode: "local",
      planner_type: "mock",
      planner_provider: "mock",
      planner_model: null
    });
  });

  it("writes plan.json with a deterministic mock plan", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-plan-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    const plan = JSON.parse(await readFile(path.join(result.evidenceDirectory, "plan.json"), "utf8")) as PlanEvidence;

    expect(plan.task_id).toBe("task-20260520-010203-abc123");
    expect(plan.planner).toBe("mock");
    expect(plan.provider).toBe("mock");
    expect(plan.model).toBeNull();
    expect(plan.steps.map((step) => step.tool)).toEqual([
      "list_files",
      "read_file",
      "git_status",
      "git_diff",
      "write_file",
      "create_report"
    ]);
    expect(plan.risk_notes).toContain("Mock planner uses deterministic templates only.");
    expect(plan.expected_outputs).toContain("final-report.md");
  });

  it("writes a human-readable final report with runtime boundaries", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-report-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    const report = await readFile(path.join(result.evidenceDirectory, "final-report.md"), "utf8");

    expect(report).toContain("# Guard-native Agent Harness Report");
    expect(report).toContain("## 1. Task Summary");
    expect(report).toContain("## 2. Plan Summary");
    expect(report).toContain("## 3. Evidence Pack Contents");
    expect(report).toContain("## 10. Runtime Boundary");
    expect(report).toContain("## 11. Limitations");
    expect(report).toContain("Guard results are recorded as evidence only. They do not grant execution authority.");
    expect(report).toContain("- No OpenAI or external LLM integration in the current phase.");
  });

  it("can initialize evidence without executing the mock plan when requested", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-boundary-"));

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T01:02:03.000Z"),
      randomId: "abc123",
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
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
