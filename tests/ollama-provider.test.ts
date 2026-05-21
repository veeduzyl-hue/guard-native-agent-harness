import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createOllamaPlannerProvider } from "../src/agent/ollama-provider.js";
import { PlanValidationError, validatePlan } from "../src/agent/plan-validator.js";
import { mockPlannerProvider } from "../src/agent/planner.js";
import { PlannerProviderRegistry } from "../src/agent/provider-registry.js";
import { GuardAdapter } from "../src/guard/adapter.js";
import { runTask } from "../src/task/runner.js";

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

describe("ollama planner provider", () => {
  it("creates a valid plan from a mocked Ollama JSON response", async () => {
    const provider = createOllamaPlannerProvider({
      fetchFn: createOllamaFetch({
        steps: [
          {
            id: "step-1",
            tool: "list_files",
            input: { path: "." },
            description: "List workspace files."
          }
        ],
        risk_notes: ["Model-generated plan must be validated before execution."],
        expected_outputs: ["tool-calls.jsonl", "final-report.md"]
      })
    });

    const result = await provider.createPlan({
      taskId: "task-ollama",
      userPrompt: "Create a safe README update proposal",
      workspaceRoot: "workspace",
      harnessVersion: "0.1.0",
      requestedModel: "test-model"
    });

    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("test-model");
    expect(result.plan).toMatchObject({
      task_id: "task-ollama",
      planner: "ollama",
      provider: "ollama",
      model: "test-model"
    });
    expect(validatePlan(result.plan).valid).toBe(true);
  });

  it("fails before execution when Ollama returns malformed JSON", async () => {
    const provider = createOllamaPlannerProvider({
      fetchFn: createRawOllamaFetch("not-json")
    });

    await expect(
      provider.createPlan({
        taskId: "task-bad-json",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0",
        requestedModel: "test-model"
      })
    ).rejects.toThrow("Ollama planner returned malformed JSON.");
  });

  it("fails validation before execution when response contains an unknown tool", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-ollama-unknown-tool-"));
    const registry = createOllamaRegistry(
      createOllamaFetch({
        steps: [
          {
            id: "step-1",
            tool: "invented_tool",
            input: {},
            description: "Invented tool should be rejected."
          }
        ]
      })
    );

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "ollama",
        plannerModel: "test-model",
        plannerRegistry: registry,
        guardAdapter: unavailableGuardAdapter
      })
    ).rejects.toThrow(PlanValidationError);
    await expect(stat(path.join(workspaceRoot, ".evidence"))).rejects.toThrow();
  });

  it("requires an explicit model", async () => {
    const provider = createOllamaPlannerProvider({
      fetchFn: createOllamaFetch({ steps: [] })
    });

    await expect(
      provider.createPlan({
        taskId: "task-no-model",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0"
      })
    ).rejects.toThrow("Ollama planner requires --model <model-name> in PR 10B.");
  });

  it("returns a controlled unavailable error when local Ollama is unavailable", async () => {
    const provider = createOllamaPlannerProvider({
      fetchFn: async () => {
        throw new Error("ECONNREFUSED");
      }
    });

    await expect(
      provider.createPlan({
        taskId: "task-unavailable",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0",
        requestedModel: "test-model"
      })
    ).rejects.toThrow(
      "Ollama planner provider is selected, but local Ollama is unavailable at http://localhost:11434."
    );
  });

  it("returns a controlled timeout error", async () => {
    const provider = createOllamaPlannerProvider({
      timeoutMs: 1,
      fetchFn: async (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    });

    await expect(
      provider.createPlan({
        taskId: "task-timeout",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0",
        requestedModel: "test-model"
      })
    ).rejects.toThrow(
      "Ollama planner request timed out after 1ms for model test-model at http://localhost:11434."
    );
  });

  it("uses the requested timeout from provider context", async () => {
    const provider = createOllamaPlannerProvider({
      timeoutMs: 5000,
      fetchFn: async (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    });

    await expect(
      provider.createPlan({
        taskId: "task-custom-timeout",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0",
        requestedModel: "test-model",
        requestedTimeoutMs: 1
      })
    ).rejects.toThrow(
      "Ollama planner request timed out after 1ms for model test-model at http://localhost:11434."
    );
  });

  it("returns a controlled HTTP error for a missing local model response", async () => {
    const provider = createOllamaPlannerProvider({
      fetchFn: async () => ({
        ok: false,
        status: 404,
        async json() {
          return {};
        },
        async text() {
          return "model not found";
        }
      })
    });

    await expect(
      provider.createPlan({
        taskId: "task-model-missing",
        userPrompt: "Create a safe README update proposal",
        workspaceRoot: "workspace",
        harnessVersion: "0.1.0",
        requestedModel: "missing-model"
      })
    ).rejects.toThrow("Ollama planner provider returned HTTP 404: model not found");
  });

  it("runs through task runner with mocked Ollama response and records provider metadata", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-ollama-runner-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");
    const registry = createOllamaRegistry(
      createOllamaFetch({
        steps: [
          {
            id: "step-1",
            tool: "list_files",
            input: { path: "." },
            description: "List workspace files."
          }
        ]
      })
    );

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      plannerProvider: "ollama",
      plannerModel: "test-model",
      plannerTimeoutMs: 120000,
      plannerRegistry: registry,
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    expect(result.task.planner_provider).toBe("ollama");
    expect(result.task.planner_model).toBe("test-model");
    expect(result.plan.provider).toBe("ollama");
    expect(result.plan.model).toBe("test-model");
  });
});

function createOllamaRegistry(
  fetchFn: Parameters<typeof createOllamaPlannerProvider>[0]["fetchFn"]
): PlannerProviderRegistry {
  const registry = new PlannerProviderRegistry();
  registry.register(mockPlannerProvider);
  registry.register(createOllamaPlannerProvider({ fetchFn }));

  return registry;
}

function createOllamaFetch(
  plan: Partial<Record<string, unknown>>
): Parameters<typeof createOllamaPlannerProvider>[0]["fetchFn"] {
  return createRawOllamaFetch(JSON.stringify(plan));
}

function createRawOllamaFetch(
  response: string
): Parameters<typeof createOllamaPlannerProvider>[0]["fetchFn"] {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return { response };
    },
    async text() {
      return "";
    }
  });
}
