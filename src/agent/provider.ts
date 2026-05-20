import type { PlanEvidence } from "../evidence/schema.js";

export type PlannerProviderName = "mock" | "ollama" | "openai" | "deepseek";
export type PlannerProviderKind = "local-deterministic" | "local-model" | "remote-model";
export type AgentPlan = PlanEvidence;

export interface PlannerProviderContext {
  taskId: string;
  userPrompt: string;
  workspaceRoot: string;
  harnessVersion: string;
}

export interface PlannerProviderResult {
  provider: PlannerProviderName;
  model?: string | null;
  plan: AgentPlan;
  rawProviderMetadata?: Record<string, unknown>;
}

export interface PlannerProvider {
  name: PlannerProviderName;
  kind: PlannerProviderKind;
  available: boolean;
  createPlan(context: PlannerProviderContext): Promise<PlannerProviderResult>;
}
