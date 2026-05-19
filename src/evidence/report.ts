import type { PlanEvidence, TaskEvidence } from "./schema.js";

export function renderFinalReport(task: TaskEvidence, plan: PlanEvidence): string {
  const steps = plan.steps.map((step) => `- ${step.id}: ${step.description}`).join("\n");
  const evidenceFiles = plan.expected_outputs.map((fileName) => `- ${fileName}`).join("\n");
  const riskNotes = plan.risk_notes.map((note) => `- ${note}`).join("\n");

  return `# Guard-native Agent Harness Report

## Task Summary

- Task ID: ${task.task_id}
- Created at: ${task.created_at}
- User prompt: ${task.user_prompt}
- Workspace root: ${task.workspace_root}
- Harness version: ${task.harness_version}
- Mode: ${task.mode}
- Planner type: ${task.planner_type}

## Plan Summary

${steps}

Risk notes:

${riskNotes}

## Evidence Files Created

${evidenceFiles}

## Runtime Boundary

PR 2 initializes evidence only. No real agent execution happened, no tool calls happened, no commands were executed, no Guard CLI commands were run, and no external API was called.

## Limitations

- The planner is a placeholder.
- No real agent planner is implemented.
- No tool registry is implemented.
- No Policy Gate is implemented.
- No Guard Adapter or Guard CLI integration is implemented.
- No external LLM or model API is connected.
`;
}
