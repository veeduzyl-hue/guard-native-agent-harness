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
  guardCompatibilityPackPath: string;
  relativeGuardCompatibilityPackPath: string;
  guardAvailable: boolean;
  executionSummary: ExecutionSummary;
}

export interface ExecutionSummary {
  steps_planned: number;
  steps_completed: number;
  steps_blocked: number;
  steps_failed: number;
}

export interface GuardCompatibilityEvidencePack {
  schema_version: string;
  pack_id: string;
  pack_type: "execution_facts";
  created_at: string;
  producer: {
    id: string;
    version: string;
    role: "evidence_producer";
  };
  workflow: {
    task_id: string;
    mode: "local";
    planner: PlannerType;
    planner_provider: PlannerType;
    planner_model: string | null;
    step_count: number;
    expected_outputs: string[];
  };
  authority: {
    boundary: "producer_only";
    consumer_authority: "mindforge-guard-core";
    governance_outputs_emitted: false;
    local_safety_controls_only: true;
    execution_authority_granted: false;
  };
  runtime: {
    workspace_root: string;
    evidence_directory: string;
    guard_available: boolean;
    execution_summary: ExecutionSummary;
  };
  intent: {
    user_prompt: string;
  };
  scope: {
    local_only: true;
    policy_gated: true;
    registered_tools_only: true;
    command_allowlist_only: true;
  };
  actions: GuardCompatibilityAction[];
  tool_calls: GuardCompatibilityToolCall[];
  blocked_actions: GuardCompatibilityBlockedAction[];
  artifacts: GuardCompatibilityArtifact[];
  verification: {
    tool_call_count: number;
    blocked_action_count: number;
    command_result_count: number;
    final_report_path: string;
    guard_results_path: string;
    manifest_path: string;
  };
  risk_signals: GuardCompatibilityRiskSignal[];
  provenance: {
    evidence_directory: string;
    source_files: string[];
    generated_from_local_files_only: true;
    generated_by: "guard-native-agent-harness";
  };
  manifest: {
    path: string;
    schema_version: string;
    created_by: string;
  };
}

export interface GuardCompatibilityAction {
  action_id: string;
  description: string;
  requested_tool: string | null;
  requested_input: Record<string, unknown>;
  status: "completed" | "failed" | "blocked" | "not_recorded";
  event_id: string | null;
  timestamp: string | null;
  command_result?: CommandResultEvidenceEvent;
}

export interface GuardCompatibilityToolCall extends ToolCallEvidenceEvent {
  command_result?: CommandResultEvidenceEvent;
}

export interface GuardCompatibilityBlockedAction extends BlockedActionEvidenceEvent {}

export interface GuardCompatibilityArtifact {
  path: string;
  kind: "workspace_output" | "evidence_output";
  produced_by: string;
  bytes?: number;
  characters?: number;
}

export interface GuardCompatibilityRiskSignal {
  signal_type: "tool_risk_level" | "blocked_action_severity";
  source_path: "tool-calls.jsonl" | "blocked-actions.jsonl";
  event_id: string;
  tool_name: string;
  observed_level: string;
  matched_rule?: string;
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
