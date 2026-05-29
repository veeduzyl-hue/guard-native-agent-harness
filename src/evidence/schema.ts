export type PlannerType = "placeholder" | "mock" | "ollama" | "openai" | "deepseek";

export interface TaskEvidence {
  task_id: string;
  created_at: string;
  user_prompt: string;
  workspace_root: string;
  harness_version: string;
  mode: "local";
  planner_type: PlannerType;
  planner_provider?: PlannerType;
  planner_model?: string | null;
}

export interface PlanStep {
  id: string;
  type?: "placeholder";
  tool?: string;
  input?: Record<string, unknown>;
  description: string;
}

export interface PlanEvidence {
  task_id: string;
  planner: PlannerType;
  provider?: PlannerType;
  model?: string | null;
  steps: PlanStep[];
  risk_notes: string[];
  expected_outputs: string[];
  provider_diagnostics?: PlanProviderDiagnostics;
}

export interface PlanProviderDiagnostics {
  provider?: PlannerType;
  model?: string | null;
  normalization_applied: boolean;
  normalization_changes: string[];
  normalization_warnings: string[];
  plan_validated: boolean;
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
  blockedActionsPath: string;
  relativeBlockedActionsPath: string;
  commandResultsPath: string;
  relativeCommandResultsPath: string;
  guardResultsPath: string;
  relativeGuardResultsPath: string;
  manifestPath: string;
  relativeManifestPath: string;
  guardAvailable: boolean;
  executionSummary: ExecutionSummary;
}

export interface ExecutionSummary {
  steps_planned: number;
  steps_completed: number;
  steps_blocked: number;
  steps_failed: number;
}

export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolCallStatus = "success" | "error";
export type ToolPolicyDecision = "allow" | "not_evaluated_in_pr3";

export interface ToolCallEvidenceEvent {
  event_id: string;
  task_id: string;
  timestamp: string;
  tool_name: string;
  input: Record<string, unknown>;
  risk_level: ToolRiskLevel;
  policy_decision: ToolPolicyDecision;
  status: ToolCallStatus;
  output_summary?: Record<string, unknown>;
  error_summary?: string;
  duration_ms: number;
}

export interface BlockedActionEvidenceEvent {
  event_id: string;
  task_id: string;
  timestamp: string;
  requested_tool: string;
  requested_input: Record<string, unknown>;
  block_reason: string;
  matched_rule: string;
  severity: "low" | "medium" | "high";
}

export type CommandResultStatus = "success" | "error" | "timeout";

export interface CommandResultEvidenceEvent {
  event_id: string;
  task_id: string;
  timestamp: string;
  command: string;
  cwd: string;
  exit_code: number | null;
  stdout_summary: string;
  stderr_summary: string;
  duration_ms: number;
  status: CommandResultStatus;
}
