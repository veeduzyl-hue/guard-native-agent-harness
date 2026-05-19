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
  toolCallsPath: string;
  relativeToolCallsPath: string;
}

export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolCallStatus = "success" | "error";

export interface ToolCallEvidenceEvent {
  event_id: string;
  task_id: string;
  timestamp: string;
  tool_name: string;
  input: Record<string, unknown>;
  risk_level: ToolRiskLevel;
  policy_decision: "not_evaluated_in_pr3";
  status: ToolCallStatus;
  output_summary?: Record<string, unknown>;
  error_summary?: string;
  duration_ms: number;
}
