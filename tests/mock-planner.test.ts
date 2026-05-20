import { describe, expect, it } from "vitest";

import { createMockPlan } from "../src/agent/planner.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";

describe("mock planner", () => {
  it("selects the README update proposal template", () => {
    const plan = createMockPlan("task-readme", "Create a safe README update proposal");

    expect(plan.planner).toBe("mock");
    expect(plan.steps.map((step) => step.tool)).toEqual([
      "list_files",
      "read_file",
      "git_status",
      "git_diff",
      "write_file",
      "create_report"
    ]);
    expect(plan.steps[4].input.path).toBe("examples/readme-update/README_UPDATE_PROPOSAL.md");
  });

  it("selects the repo review template", () => {
    const plan = createMockPlan("task-review", "Please do a repo review");

    expect(plan.steps.map((step) => step.tool)).toEqual([
      "list_files",
      "git_status",
      "git_diff",
      "create_report"
    ]);
  });

  it("selects the unsafe demo template", () => {
    const plan = createMockPlan("task-unsafe", "Show a policy demo with blocked action");

    expect(plan.steps.map((step) => step.tool)).toEqual(["read_file", "run_command"]);
    expect(plan.steps[0].input).toEqual({ path: ".env" });
    expect(plan.steps[1].input).toEqual({ command: "git push origin main" });
  });

  it("selects the safe default template for unknown prompts", () => {
    const plan = createMockPlan("task-default", "Summarize the workspace");

    expect(plan.steps.map((step) => step.tool)).toEqual(["list_files", "git_status", "create_report"]);
  });

  it("only generates registered tool names", () => {
    const registry = createDefaultToolRegistry();
    const registered = new Set(registry.list().map((metadata) => metadata.name));

    for (const prompt of [
      "Create a safe README update proposal",
      "repo review",
      "unsafe policy demo",
      "something else"
    ]) {
      const plan = createMockPlan("task-tools", prompt);
      expect(plan.steps.every((step) => registered.has(step.tool))).toBe(true);
    }
  });

  it("is deterministic for the same input", () => {
    const left = createMockPlan("task-deterministic", "Create a safe README update proposal");
    const right = createMockPlan("task-deterministic", "Create a safe README update proposal");

    expect(right).toEqual(left);
  });
});
