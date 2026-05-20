import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { executePlan } from "../src/agent/orchestrator.js";
import type { PlanEvidence, TaskEvidence } from "../src/evidence/schema.js";
import { writeEvidencePack } from "../src/evidence/writer.js";

async function createContext(plan: PlanEvidence): Promise<{
  workspaceRoot: string;
  evidenceDirectory: string;
  context: {
    taskId: string;
    workspaceRoot: string;
    evidenceDirectory: string;
    relativeEvidenceDirectory: string;
  };
}> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-orchestrator-"));
  const task: TaskEvidence = {
    task_id: plan.task_id,
    created_at: "2026-05-20T05:00:00.000Z",
    user_prompt: "orchestrator test",
    workspace_root: workspaceRoot,
    harness_version: "0.0.0",
    mode: "local",
    planner_type: "mock"
  };
  const pack = await writeEvidencePack(workspaceRoot, task, plan);

  return {
    workspaceRoot,
    evidenceDirectory: pack.evidenceDirectory,
    context: {
      taskId: task.task_id,
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

describe("orchestrator", () => {
  it("executes safe plan steps through the Tool Registry", async () => {
    const plan: PlanEvidence = {
      task_id: "task-safe",
      planner: "mock",
      steps: [
        { id: "step-1", tool: "list_files", input: { path: "." }, description: "List files." },
        {
          id: "step-2",
          tool: "create_report",
          input: { title: "Safe Report", content: "Created through the registry." },
          description: "Create report."
        }
      ],
      risk_notes: [],
      expected_outputs: []
    };
    const { context, evidenceDirectory } = await createContext(plan);

    const summary = await executePlan(plan, context);

    expect(summary).toEqual({
      steps_planned: 2,
      steps_completed: 2,
      steps_blocked: 0,
      steps_failed: 0
    });
    const toolEvents = await readJsonl(path.join(evidenceDirectory, "tool-calls.jsonl"));
    expect(toolEvents.map((event) => event.tool_name)).toEqual(["list_files", "create_report"]);
    expect(toolEvents.every((event) => event.policy_decision === "allow")).toBe(true);
  });

  it("records blocked steps and continues execution", async () => {
    const plan: PlanEvidence = {
      task_id: "task-blocked",
      planner: "mock",
      steps: [
        { id: "step-1", tool: "read_file", input: { path: ".env" }, description: "Blocked env read." },
        { id: "step-2", tool: "list_files", input: { path: "." }, description: "Continue after block." }
      ],
      risk_notes: [],
      expected_outputs: []
    };
    const { context, evidenceDirectory } = await createContext(plan);

    const summary = await executePlan(plan, context);

    expect(summary).toEqual({
      steps_planned: 2,
      steps_completed: 1,
      steps_blocked: 1,
      steps_failed: 0
    });
    const blockedEvents = await readJsonl(path.join(evidenceDirectory, "blocked-actions.jsonl"));
    const toolEvents = await readJsonl(path.join(evidenceDirectory, "tool-calls.jsonl"));
    expect(blockedEvents[0]).toMatchObject({
      requested_tool: "read_file",
      matched_rule: "block-env-read"
    });
    expect(toolEvents.map((event) => event.tool_name)).toEqual(["list_files"]);
  });

  it("records unknown tool steps as controlled failures", async () => {
    const plan: PlanEvidence = {
      task_id: "task-unknown",
      planner: "mock",
      steps: [{ id: "step-1", tool: "missing_tool", input: {}, description: "Unknown tool." }],
      risk_notes: [],
      expected_outputs: []
    };
    const { context, evidenceDirectory } = await createContext(plan);

    const summary = await executePlan(plan, context);

    expect(summary).toEqual({
      steps_planned: 1,
      steps_completed: 0,
      steps_blocked: 0,
      steps_failed: 1
    });
    await expect(readJsonl(path.join(evidenceDirectory, "tool-calls.jsonl"))).resolves.toEqual([]);
    await expect(readJsonl(path.join(evidenceDirectory, "blocked-actions.jsonl"))).resolves.toEqual([]);
  });
});
