import { describe, expect, it } from "vitest";

import { normalizeProviderPlan } from "../src/agent/plan-normalizer.js";

const context = {
  taskId: "task-normalizer",
  provider: "ollama" as const,
  model: "test-model"
};

describe("plan normalizer", () => {
  it("fills missing step ids deterministically", () => {
    const result = normalizeProviderPlan(
      {
        steps: [
          { tool: "list_files", input: { path: "." }, description: "List files." },
          { tool: "git_status", input: {}, description: "Inspect status." }
        ]
      },
      context
    );

    expect(result.normalizedPlan.steps.map((step) => step.id)).toEqual(["step-1", "step-2"]);
    expect(result.changes).toContain("added missing step id for step index 0");
    expect(result.changes).toContain("added missing step id for step index 1");
  });

  it("preserves existing step ids", () => {
    const result = normalizeProviderPlan(
      {
        steps: [
          { id: "custom-id", tool: "list_files", input: { path: "." }, description: "List files." }
        ]
      },
      context
    );

    expect(result.normalizedPlan.steps[0]?.id).toBe("custom-id");
    expect(result.changes).not.toContain("added missing step id for step index 0");
  });

  it("does not rewrite unknown tools", () => {
    const result = normalizeProviderPlan(
      {
        steps: [{ tool: "invented_tool", input: {}, description: "Invented." }]
      },
      context
    );

    expect(result.normalizedPlan.steps[0]?.tool).toBe("invented_tool");
  });

  it("does not rewrite unsafe paths", () => {
    const result = normalizeProviderPlan(
      {
        steps: [{ tool: "read_file", input: { path: ".env" }, description: "Read env." }]
      },
      context
    );

    expect(result.normalizedPlan.steps[0]?.input).toEqual({ path: ".env" });
  });

  it("does not remove destructive commands", () => {
    const result = normalizeProviderPlan(
      {
        steps: [
          { tool: "run_command", input: { command: "rm -rf ." }, description: "Destructive." }
        ]
      },
      context
    );

    expect(result.normalizedPlan.steps[0]?.input).toEqual({ command: "rm -rf ." });
  });

  it("normalizes missing optional arrays and reports changes", () => {
    const result = normalizeProviderPlan({ steps: [] }, context);

    expect(result.normalizedPlan.risk_notes).toEqual([]);
    expect(result.normalizedPlan.expected_outputs).toContain("final-report.md");
    expect(result.normalizedPlan.expected_outputs).toContain("evidence-manifest.json");
    expect(result.normalizedPlan.expected_outputs).toContain("evidence-pack.json");
    expect(result.changes).toContain("normalized missing risk_notes");
    expect(result.changes).toContain("normalized missing expected_outputs");
    expect(result.normalizedPlan.provider_diagnostics?.normalization_applied).toBe(true);
  });

  it("fills planner provider and model metadata from selected provider context", () => {
    const result = normalizeProviderPlan(
      {
        planner: "openai",
        provider: "deepseek",
        model: "<model-name>",
        steps: []
      },
      context
    );

    expect(result.normalizedPlan.planner).toBe("ollama");
    expect(result.normalizedPlan.provider).toBe("ollama");
    expect(result.normalizedPlan.model).toBe("test-model");
    expect(result.changes).toContain("filled planner metadata from selected provider");
    expect(result.changes).toContain("filled provider metadata from selected provider");
    expect(result.changes).toContain("filled model metadata from selected provider model");
  });

  it("preserves matching planner provider and model metadata", () => {
    const result = normalizeProviderPlan(
      {
        planner: "ollama",
        provider: "ollama",
        model: "test-model",
        steps: []
      },
      context
    );

    expect(result.normalizedPlan.planner).toBe("ollama");
    expect(result.normalizedPlan.provider).toBe("ollama");
    expect(result.normalizedPlan.model).toBe("test-model");
    expect(result.changes).not.toContain("filled planner metadata from selected provider");
    expect(result.changes).not.toContain("filled provider metadata from selected provider");
    expect(result.changes).not.toContain("filled model metadata from selected provider model");
  });

  it("adds empty input only for tools whose schema allows it", () => {
    const result = normalizeProviderPlan(
      {
        steps: [
          { tool: "git_status", description: "Inspect status." },
          { tool: "read_file", description: "Missing input should remain invalid." }
        ]
      },
      context
    );

    expect(result.normalizedPlan.steps[0]?.input).toEqual({});
    expect(result.normalizedPlan.steps[1]?.input).toBeUndefined();
    expect(result.changes).toContain("added empty input for git_status at step index 0");
  });
});
