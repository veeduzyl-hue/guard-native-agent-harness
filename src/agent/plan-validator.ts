import type { PlanEvidence } from "../evidence/schema.js";
import { createDefaultToolRegistry, type ToolRegistry } from "../tools/registry.js";
import type { ToolMetadata } from "../tools/types.js";

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
  const registeredToolMetadata = new Map<string, ToolMetadata>(
    registry.list().map((metadata) => [metadata.name, metadata])
  );

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
    const label = stepLabel(step.id, index);

    if (!step.id || typeof step.id !== "string") {
      errors.push(`${label} must include a string id.`);
    }

    if (!step.tool || typeof step.tool !== "string") {
      errors.push(`${label} must include a registered tool name.`);
    } else if (!registeredToolMetadata.has(step.tool)) {
      errors.push(`${label} uses unknown tool "${step.tool}".`);
    }

    const metadata =
      typeof step.tool === "string" ? registeredToolMetadata.get(step.tool) : undefined;

    if (metadata) {
      validateInputShape(step.input, metadata, label, errors);
    } else if (!isPlainObject(step.input)) {
      errors.push(`${label} input must be an object.`);
    }

    if (
      step.tool !== "run_command" &&
      isPlainObject(step.input) &&
      typeof step.input.command === "string"
    ) {
      errors.push(`${label} includes direct command input outside the run_command tool.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateInputShape(
  input: Record<string, unknown> | undefined,
  metadata: ToolMetadata,
  label: string,
  errors: string[]
): void {
  const shape = metadata.inputSchemaHint;
  const expectedKeys = Object.keys(shape);

  if (!isPlainObject(input)) {
    errors.push(
      `${label} for tool ${metadata.name} must use input object shape ${JSON.stringify(shape)}.`
    );
    return;
  }

  const actualKeys = Object.keys(input);

  if (expectedKeys.length === 0) {
    if (actualKeys.length > 0) {
      errors.push(`${label} for tool ${metadata.name} expects empty input object.`);
    }

    return;
  }

  for (const key of expectedKeys) {
    if (!(key in input)) {
      errors.push(`${label} for tool ${metadata.name} is missing required input field "${key}".`);
    } else if (typeof input[key] !== "string") {
      errors.push(`${label} for tool ${metadata.name} input field "${key}" must be a string.`);
    }
  }

  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      errors.push(`${label} for tool ${metadata.name} includes unsupported input field "${key}".`);
    }
  }
}

function stepLabel(id: unknown, index: number): string {
  return typeof id === "string" && id.trim() !== "" ? `Step ${id}` : `Step ${index + 1}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
