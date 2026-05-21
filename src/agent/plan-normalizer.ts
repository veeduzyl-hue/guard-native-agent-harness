import type { PlanEvidence, PlannerType, PlanStep } from "../evidence/schema.js";

const defaultExpectedOutputs = [
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "guard-results.json",
  "final-report.md"
];

const toolsAllowingMissingInput = new Set(["git_status", "git_diff"]);

export interface PlanNormalizerContext {
  taskId: string;
  provider: PlannerType;
  model: string | null;
}

export interface PlanNormalizationResult {
  normalizedPlan: PlanEvidence;
  changes: string[];
  warnings: string[];
}

export class PlanNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanNormalizationError";
  }
}

export function normalizeProviderPlan(
  value: unknown,
  context: PlanNormalizerContext
): PlanNormalizationResult {
  if (!isRecord(value)) {
    throw new PlanNormalizationError("Provider plan JSON must be an object.");
  }

  const changes: string[] = [];
  const warnings: string[] = [];
  const planner = normalizePlannerMetadata(value.planner, context.provider, "planner", changes);
  const provider = normalizePlannerMetadata(value.provider, context.provider, "provider", changes);
  const model = normalizeModelMetadata(value.model, context.model, changes);
  const steps = normalizeSteps(value.steps, changes, warnings);
  const riskNotes = normalizeStringArray(value.risk_notes, [], "risk_notes", changes);
  const expectedOutputs = normalizeStringArray(
    value.expected_outputs,
    defaultExpectedOutputs,
    "expected_outputs",
    changes
  );

  return {
    normalizedPlan: {
      task_id: context.taskId,
      planner,
      provider,
      model,
      steps,
      risk_notes: riskNotes,
      expected_outputs: expectedOutputs,
      provider_diagnostics: {
        normalization_applied: changes.length > 0,
        normalization_changes: changes,
        normalization_warnings: warnings,
        plan_validated: false
      }
    },
    changes,
    warnings
  };
}

function normalizeSteps(value: unknown, changes: string[], warnings: string[]): PlanStep[] {
  if (!Array.isArray(value)) {
    warnings.push("Provider plan steps were missing or not an array.");
    return [];
  }

  return value.map((entry, index) => normalizeStep(entry, index, changes, warnings));
}

function normalizeStep(
  value: unknown,
  index: number,
  changes: string[],
  warnings: string[]
): PlanStep {
  const fallbackId = `step-${index + 1}`;

  if (!isRecord(value)) {
    warnings.push(`Step ${index + 1} was not an object.`);
    return {
      id: fallbackId,
      tool: "",
      description: ""
    };
  }

  const tool = typeof value.tool === "string" ? value.tool : "";
  const step: PlanStep = {
    id: typeof value.id === "string" && value.id.trim() !== "" ? value.id : fallbackId,
    tool,
    description: typeof value.description === "string" ? value.description : ""
  };

  if (!("id" in value) || typeof value.id !== "string" || value.id.trim() === "") {
    changes.push(`added missing step id for step index ${index}`);
  }

  if (isRecord(value.input)) {
    step.input = value.input;
  } else if (!("input" in value) && toolsAllowingMissingInput.has(tool)) {
    step.input = {};
    changes.push(`added empty input for ${tool} at step index ${index}`);
  } else if ("input" in value) {
    warnings.push(`Step ${index + 1} input was not an object.`);
  }

  return step;
}

function normalizePlannerMetadata(
  value: unknown,
  fallback: PlannerType,
  fieldName: "planner" | "provider",
  changes: string[]
): PlannerType {
  if (isPlannerType(value) && value === fallback) {
    return value;
  }

  changes.push(`filled ${fieldName} metadata from selected provider`);
  return fallback;
}

function normalizeModelMetadata(
  value: unknown,
  fallback: string | null,
  changes: string[]
): string | null {
  if (typeof value === "string" && value === fallback) {
    return value;
  }

  if (value === null && fallback === null) {
    return null;
  }

  changes.push("filled model metadata from selected provider model");
  return fallback;
}

function normalizeStringArray(
  value: unknown,
  fallback: string[],
  fieldName: "risk_notes" | "expected_outputs",
  changes: string[]
): string[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }

  changes.push(`normalized missing ${fieldName}`);
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPlannerType(value: unknown): value is PlannerType {
  return ["placeholder", "mock", "ollama", "openai", "deepseek"].includes(String(value));
}
