import type { ExecutionSummary, PlanEvidence, PlanStep } from "../evidence/schema.js";
import type { ToolName } from "../tools/types.js";

export interface MockPlanStep extends PlanStep {
  tool: ToolName;
  input: Record<string, unknown>;
}

export interface MockPlanEvidence extends PlanEvidence {
  planner: "mock";
  provider: "mock";
  model: null;
  steps: MockPlanStep[];
}

export type { ExecutionSummary };
