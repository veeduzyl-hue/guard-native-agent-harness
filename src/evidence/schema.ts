export type PlannerType = "placeholder";

export interface TaskEvidence {
  task_id: string;
  created_at: string;
  user_prompt: string;
  workspace_root: string;
  harness_version: string;
  mode: "local";
  planner_type: PlannerType;
}

export interface PlanStep {
  id: string;
  type: "placeholder";
  description: string;
}

export interface PlanEvidence {
  task_id: string;
  planner: PlannerType;
  steps: PlanStep[];
  risk_notes: string[];
  expected_outputs: string[];
}

export interface EvidencePack {
  task: TaskEvidence;
  plan: PlanEvidence;
  evidenceDirectory: string;
  relativeEvidenceDirectory: string;
  finalReportPath: string;
  relativeFinalReportPath: string;
}
