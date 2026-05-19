import type { PlanEvidence } from "../evidence/schema.js";

export function createPlaceholderPlan(taskId: string): PlanEvidence {
  return {
    task_id: taskId,
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
  };
}
