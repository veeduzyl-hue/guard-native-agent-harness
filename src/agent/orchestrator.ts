import type { ExecutionSummary, PlanEvidence } from "../evidence/schema.js";
import { createDefaultToolRegistry, type ToolRegistry } from "../tools/registry.js";
import { ToolBlockedError } from "../tools/types.js";
import type { ToolExecutionContext, ToolName } from "../tools/types.js";

export interface OrchestratorOptions {
  registry?: ToolRegistry;
}

export async function executePlan(
  plan: PlanEvidence,
  context: ToolExecutionContext,
  options: OrchestratorOptions = {}
): Promise<ExecutionSummary> {
  const registry = options.registry ?? createDefaultToolRegistry();
  const summary: ExecutionSummary = {
    steps_planned: plan.steps.length,
    steps_completed: 0,
    steps_blocked: 0,
    steps_failed: 0
  };

  for (const step of plan.steps) {
    if (!step.tool) {
      summary.steps_failed += 1;
      continue;
    }

    try {
      await registry.execute(step.tool as ToolName, context, step.input ?? {});
      summary.steps_completed += 1;
    } catch (error) {
      if (error instanceof ToolBlockedError) {
        summary.steps_blocked += 1;
      } else {
        summary.steps_failed += 1;
      }
    }
  }

  return summary;
}
