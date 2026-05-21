import { describe, expect, it } from "vitest";

import { validatePlan } from "../src/agent/plan-validator.js";
import { createMockPlan } from "../src/agent/planner.js";
import type { PlanEvidence } from "../src/evidence/schema.js";

describe("plan validator", () => {
  it("accepts a valid mock plan", () => {
    const result = validatePlan(
      createMockPlan("task-valid", "Create a safe README update proposal")
    );

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
    expect(result.errors).toContain('Step step-1 uses unknown tool "missing_tool".');
  });

  it("rejects missing step ids", () => {
    const plan = basePlan([
      { id: "", tool: "list_files", input: { path: "." }, description: "Missing id." }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step 1 must include a string id.");
  });

  it("rejects non-object input", () => {
    const plan = basePlan([
      {
        id: "step-1",
        tool: "list_files",
        input: ["not", "object"] as unknown as Record<string, unknown>,
        description: "Bad input."
      }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Step step-1 for tool list_files must use input object shape {"path":"workspace-relative directory path string"}.'
    );
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
    expect(result.errors).toContain(
      "Step step-1 includes direct command input outside the run_command tool."
    );
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

  it("rejects string input for read_file with a clear shape error", () => {
    const plan = basePlan([
      {
        id: "step-1",
        tool: "read_file",
        input: "README.md" as unknown as Record<string, unknown>,
        description: "Bad input shape."
      }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Step step-1 for tool read_file must use input object shape {"path":"workspace-relative file path string"}.'
    );
  });

  it("rejects missing path for read_file", () => {
    const result = validatePlan(
      basePlan([{ id: "step-1", tool: "read_file", input: {}, description: "Missing path." }])
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Step step-1 for tool read_file is missing required input field "path".'
    );
  });

  it("rejects missing content for write_file", () => {
    const result = validatePlan(
      basePlan([
        {
          id: "step-1",
          tool: "write_file",
          input: { path: "out.md" },
          description: "Missing content."
        }
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Step step-1 for tool write_file is missing required input field "content".'
    );
  });

  it("rejects non-empty input for git_status", () => {
    const result = validatePlan(
      basePlan([
        { id: "step-1", tool: "git_status", input: { path: "." }, description: "Unexpected input." }
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step step-1 for tool git_status expects empty input object.");
  });

  it("accepts valid input shapes", () => {
    const result = validatePlan(
      basePlan([
        { id: "step-1", tool: "list_files", input: { path: "." }, description: "List." },
        { id: "step-2", tool: "read_file", input: { path: "README.md" }, description: "Read." },
        {
          id: "step-3",
          tool: "write_file",
          input: { path: "examples/out.md", content: "hello" },
          description: "Write."
        },
        { id: "step-4", tool: "git_status", input: {}, description: "Status." },
        { id: "step-5", tool: "git_diff", input: {}, description: "Diff." },
        {
          id: "step-6",
          tool: "create_report",
          input: { title: "T", content: "C" },
          description: "Report."
        },
        {
          id: "step-7",
          tool: "run_command",
          input: { command: "git status --short" },
          description: "Command."
        }
      ])
    );

    expect(result.valid).toBe(true);
  });

  it("does not rewrite unsafe .env paths during validation", () => {
    const plan = basePlan([
      { id: "step-1", tool: "read_file", input: { path: ".env" }, description: "Unsafe path." }
    ]);

    const result = validatePlan(plan);

    expect(result.valid).toBe(true);
    expect(plan.steps[0]?.input).toEqual({ path: ".env" });
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
