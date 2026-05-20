import { describe, expect, it } from "vitest";

import { validatePlan } from "../src/agent/plan-validator.js";
import { createMockPlan } from "../src/agent/planner.js";
import type { PlanEvidence } from "../src/evidence/schema.js";

describe("plan validator", () => {
  it("accepts a valid mock plan", () => {
    const result = validatePlan(createMockPlan("task-valid", "Create a safe README update proposal"));

    expect(result).toEqual({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  it("rejects unknown tools", () => {
    const plan = basePlan([
      { id: "step-1", tool: "missing_tool", input: {}, description: "Unknown tool." }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step 1 uses unknown tool "missing_tool".');
  });

  it("rejects missing step ids", () => {
    const plan = basePlan([{ id: "", tool: "list_files", input: { path: "." }, description: "Missing id." }]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step 1 must include a string id.");
  });

  it("rejects non-object input", () => {
    const plan = basePlan([
      { id: "step-1", tool: "list_files", input: ["not", "object"] as unknown as Record<string, unknown>, description: "Bad input." }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step 1 input must be an object.");
  });

  it("allows empty steps with a warning", () => {
    const result = validatePlan(basePlan([]));

    expect(result).toEqual({
      valid: true,
      errors: [],
      warnings: ["Plan contains no steps."]
    });
  });

  it("rejects direct command input outside run_command", () => {
    const plan = basePlan([
      {
        id: "step-1",
        tool: "create_report",
        input: { command: "git status --short" },
        description: "Command-shaped input on the wrong tool."
      }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step 1 includes direct command input outside the run_command tool.");
  });

  it("does not execute tools while validating", () => {
    const plan = basePlan([
      {
        id: "step-1",
        tool: "run_command",
        input: { command: "node --version" },
        description: "Validation should not execute this command."
      }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(true);
  });
});

function basePlan(steps: PlanEvidence["steps"]): PlanEvidence {
  return {
    task_id: "task-validator",
    planner: "mock",
    provider: "mock",
    model: null,
    steps,
    risk_notes: [],
    expected_outputs: []
  };
}
