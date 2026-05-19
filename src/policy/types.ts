export type PolicyDecisionStatus = "allow" | "deny";
export type PolicySeverity = "none" | "low" | "medium" | "high";

export interface PolicyRequest {
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
  workspaceRoot: string;
}

export interface PolicyDecision {
  decision: PolicyDecisionStatus;
  reason: string;
  matchedRule: string | null;
  severity: PolicySeverity;
}
