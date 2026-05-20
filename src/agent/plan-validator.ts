import type { PlanEvidence } from "../evidence/schema.js";
import { createDefaultToolRegistry, type ToolRegistry } from "../tools/registry.js";

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class PlanValidationError extends Error {
  constructor(readonly result: PlanValidationResult) {
    super(`Plan validation failed: ${result.errors.join("; ")}`);
    this.name = "PlanValidationError";
  }
}

export function validatePlan(
  plan: PlanEvidence,
  registry: ToolRegistry = createDefaultToolRegistry()
): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registeredTools = new Set<string>(registry.list().map((metadata) => metadata.name));

  if (!plan.planner) {
    errors.push("Plan must include a planner.");
  }

  if (!Array.isArray(plan.steps)) {
    errors.push("Plan steps must be an array.");
    return { valid: false, errors, warnings };
  }

  if (plan.steps.length === 0) {
    warnings.push("Plan contains no steps.");
  }

  plan.steps.forEach((step, index) => {
    const label = `Step ${index + 1}`;

    if (!step.id || typeof step.id !== "string") {
      errors.push(`${label} must include a string id.`);
    }

    if (!step.tool || typeof step.tool !== "string") {
      errors.push(`${label} must include a registered tool name.`);
    } else if (!registeredTools.has(step.tool)) {
      errors.push(`${label} uses unknown tool "${step.tool}".`);
    }

    if (!isPlainObject(step.input)) {
      errors.push(`${label} input must be an object.`);
    }

    if (step.tool !== "run_command" && isPlainObject(step.input) && typeof step.input.command === "string") {
      errors.push(`${label} includes direct command input outside the run_command tool.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
