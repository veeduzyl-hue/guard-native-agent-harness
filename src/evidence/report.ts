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

## Guard Results

Guard results are written to \`guard-results.json\`.

## Runtime Boundary

This run initializes local evidence. No real agent execution happened, no autonomous tool calls happened, no external API was called, and Guard output does not grant execution authority.

## Limitations

- The planner is a placeholder.
- No real agent planner is implemented.
- Tool and command execution remain bounded by the Tool Registry and Policy Gate.
- Guard Adapter output is recorded as evidence only.
- No external LLM or model API is connected.
`;
}
