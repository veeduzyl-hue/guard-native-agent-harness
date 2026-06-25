import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAIPlannerProvider } from "../src/agent/openai-provider.js";
import { validatePlan } from "../src/agent/plan-validator.js";
import { mockPlannerProvider } from "../src/agent/planner.js";
import { PlannerProviderRegistry } from "../src/agent/provider-registry.js";
import { GuardAdapter } from "../src/guard/adapter.js";
import { runTask } from "../src/task/runner.js";

const apiKey = "test-openai-key-never-write-to-evidence";

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("openai planner provider", () => {
  it("requires OPENAI_API_KEY from the process environment", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const provider = createOpenAIPlannerProvider({
      fetchFn: createOpenAIFetch({ steps: [] })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("OpenAI planner requires OPENAI_API_KEY in the process environment.");
  });

  it("requires an explicit model", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      fetchFn: createOpenAIFetch({ steps: [] })
    });

    await expect(provider.createPlan(createContext())).rejects.toThrow(
      "OpenAI planner requires --model <model-name> in PR 10C."
    );
  });

  it("requests structured output and creates a valid plan from a mocked response", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    let requestedUrl = "";
    let requestHeaders: Record<string, string> | null = null;
    let requestBody: Record<string, unknown> | null = null;
    const provider = createOpenAIPlannerProvider({
      fetchFn: async (url, init) => {
        requestedUrl = url;
        requestHeaders = init.headers;
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        return successfulResponse(validPlan());
      }
    });

    const result = await provider.createPlan(
      createContext({ taskId: "task-openai", requestedModel: "test-model" })
    );

    expect(requestedUrl).toBe("https://api.openai.com/v1/responses");
    expect(requestHeaders?.authorization).toBe(`Bearer ${apiKey}`);
    expect(requestBody).toMatchObject({
      model: "test-model",
      tools: [],
      tool_choice: "none",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "agent_plan",
          strict: true
        }
      }
    });
    expect(String(requestBody?.input)).toContain("Use only registered tool names.");
    expect(String(requestBody?.input)).toContain(
      "Do not request .env files, secrets, keys, tokens, private keys, git push"
    );
    expect(String(requestBody?.input)).not.toContain(apiKey);
    expect(result).toMatchObject({
      provider: "openai",
      model: "test-model",
      plan: {
        task_id: "task-openai",
        planner: "openai",
        provider: "openai",
        model: "test-model"
      }
    });
    expect(result.plan.provider_diagnostics).toMatchObject({
      provider: "openai",
      model: "test-model",
      normalization_applied: true,
      plan_validated: true
    });
    expect(validatePlan(result.plan).valid).toBe(true);
  });

  it("normalizes missing step ids before validation", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      fetchFn: createOpenAIFetch({
        planner: "openai",
        provider: "openai",
        model: "test-model",
        steps: [
          {
            tool: "list_files",
            input: { path: "." },
            description: "List files."
          }
        ],
        risk_notes: [],
        expected_outputs: []
      })
    });

    const result = await provider.createPlan(createContext({ requestedModel: "test-model" }));

    expect(result.plan.steps[0]?.id).toBe("step-1");
    expect(result.plan.provider_diagnostics?.normalization_changes).toContain(
      "added missing step id for step index 0"
    );
    expect(validatePlan(result.plan).valid).toBe(true);
  });

  it("fails validation on unknown tools without writing evidence", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-openai-unknown-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "openai",
        plannerModel: "test-model",
        plannerRegistry: createOpenAIRegistry(
          createOpenAIFetch({
            steps: [
              {
                id: "step-1",
                tool: "invented_tool",
                input: {},
                description: "Invented tool."
              }
            ]
          })
        ),
        guardAdapter: unavailableGuardAdapter
      })
    ).rejects.toThrow('Step step-1 uses unknown tool "invented_tool".');
    await expect(stat(path.join(workspaceRoot, ".evidence"))).rejects.toThrow();
  });

  it("fails validation on invalid tool input without writing evidence", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-openai-input-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "openai",
        plannerModel: "test-model",
        plannerRegistry: createOpenAIRegistry(
          createOpenAIFetch({
            steps: [
              {
                id: "step-1",
                tool: "read_file",
                input: {},
                description: "Invalid missing path."
              }
            ]
          })
        ),
        guardAdapter: unavailableGuardAdapter
      })
    ).rejects.toThrow('Step step-1 for tool read_file is missing required input field "path".');
    await expect(stat(path.join(workspaceRoot, ".evidence"))).rejects.toThrow();
  });

  it("preserves unsafe .env reads for the Policy Gate to block", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-openai-env-"));
    const result = await runTask("Show a policy demo with blocked action", {
      workspaceRoot,
      plannerProvider: "openai",
      plannerModel: "test-model",
      plannerRegistry: createOpenAIRegistry(
        createOpenAIFetch({
          steps: [
            {
              id: "step-1",
              tool: "read_file",
              input: { path: ".env" },
              description: "Attempt unsafe read."
            }
          ]
        })
      ),
      guardAdapter: unavailableGuardAdapter
    });

    const blockedActions = await readFile(
      path.join(result.evidenceDirectory, "blocked-actions.jsonl"),
      "utf8"
    );
    const toolCalls = await readFile(
      path.join(result.evidenceDirectory, "tool-calls.jsonl"),
      "utf8"
    );

    expect(result.plan.steps[0]?.input).toEqual({ path: ".env" });
    expect(result.executionSummary.steps_blocked).toBe(1);
    expect(blockedActions).toContain("block-env-read");
    expect(toolCalls.trim()).toBe("");
  });

  it("fails on malformed structured output before execution", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-openai-malformed-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "openai",
        plannerModel: "test-model",
        plannerRegistry: createOpenAIRegistry(createRawOpenAIFetch("not-json")),
        guardAdapter: unavailableGuardAdapter
      })
    ).rejects.toThrow("OpenAI planner returned malformed structured plan JSON.");
    await expect(stat(path.join(workspaceRoot, ".evidence"))).rejects.toThrow();
  });

  it("fails cleanly on a model refusal or non-plan response", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      fetchFn: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            output: [
              {
                type: "message",
                content: [{ type: "refusal", refusal: "Cannot comply." }]
              }
            ]
          };
        }
      })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("OpenAI planner returned a refusal or non-plan response.");
  });

  it.each([401, 429])("reports HTTP %i without returning response content", async (status) => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      fetchFn: async () => ({
        ok: false,
        status,
        async json() {
          return { error: { message: "sensitive upstream content" } };
        }
      })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow(`OpenAI planner request failed with HTTP ${status}.`);
  });

  it("returns a controlled network failure without exposing the API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      fetchFn: async () => {
        throw new Error(`failed with bearer token ${apiKey}`);
      }
    });

    const error = await provider
      .createPlan(createContext({ requestedModel: "test-model" }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "OpenAI planner request failed due to a network error for model test-model."
    );
    expect((error as Error).message).not.toContain(apiKey);
  });

  it("uses requested timeout and reports timeout cleanly", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const provider = createOpenAIPlannerProvider({
      timeoutMs: 5000,
      fetchFn: async (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model", requestedTimeoutMs: 1 }))
    ).rejects.toThrow("OpenAI planner request timed out after 1ms for model test-model.");
  });

  it("executes a safe mocked plan and writes bounded provider metadata without the API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-openai-evidence-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");
    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      plannerProvider: "openai",
      plannerModel: "test-model",
      plannerTimeoutMs: 120000,
      plannerRegistry: createOpenAIRegistry(createOpenAIFetch(validPlan())),
      guardAdapter: unavailableGuardAdapter
    });

    const taskJson = await readFile(path.join(result.evidenceDirectory, "task.json"), "utf8");
    const planJson = await readFile(path.join(result.evidenceDirectory, "plan.json"), "utf8");
    const report = await readFile(path.join(result.evidenceDirectory, "final-report.md"), "utf8");
    const toolCalls = await readFile(
      path.join(result.evidenceDirectory, "tool-calls.jsonl"),
      "utf8"
    );
    const writtenEvidence = `${taskJson}\n${planJson}\n${report}\n${toolCalls}`;
    const parsedPlan = JSON.parse(planJson) as {
      provider_diagnostics: Record<string, unknown>;
    };

    expect(result.executionSummary.steps_completed).toBe(1);
    expect(JSON.parse(taskJson)).toMatchObject({
      planner_provider: "openai",
      planner_model: "test-model"
    });
    expect(parsedPlan).toMatchObject({
      provider_diagnostics: {
        provider: "openai",
        model: "test-model",
        normalization_applied: true,
        plan_validated: true
      }
    });
    expect(Object.keys(parsedPlan.provider_diagnostics).sort()).toEqual([
      "model",
      "normalization_applied",
      "normalization_changes",
      "normalization_warnings",
      "plan_validated",
      "provider"
    ]);
    expect(toolCalls).toContain("list_files");
    expect(report).toContain("- Provider: openai");
    expect(report).toContain("- Model: test-model");
    expect(writtenEvidence).not.toContain(apiKey);
  });
});

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "task-openai-test",
    userPrompt: "Create a safe README update proposal",
    workspaceRoot: "workspace",
    harnessVersion: "0.1.0",
    ...overrides
  };
}

function createOpenAIRegistry(
  fetchFn: Parameters<typeof createOpenAIPlannerProvider>[0]["fetchFn"]
): PlannerProviderRegistry {
  const registry = new PlannerProviderRegistry();
  registry.register(mockPlannerProvider);
  registry.register(createOpenAIPlannerProvider({ fetchFn }));

  return registry;
}

function validPlan(): Record<string, unknown> {
  return {
    planner: "openai",
    provider: "openai",
    model: "test-model",
    steps: [
      {
        id: "step-1",
        tool: "list_files",
        input: { path: "." },
        description: "List workspace files."
      }
    ],
    risk_notes: ["Model-generated plan must be validated before execution."],
    expected_outputs: [
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json",
      "evidence-manifest.json",
      "evidence-pack.json",
      "final-report.md"
    ]
  };
}

function createOpenAIFetch(
  plan: Partial<Record<string, unknown>>
): Parameters<typeof createOpenAIPlannerProvider>[0]["fetchFn"] {
  return createRawOpenAIFetch(JSON.stringify(plan));
}

function createRawOpenAIFetch(
  outputText: string
): Parameters<typeof createOpenAIPlannerProvider>[0]["fetchFn"] {
  return async () => successfulResponseText(outputText);
}

function successfulResponse(plan: Record<string, unknown>) {
  return successfulResponseText(JSON.stringify(plan));
}

function successfulResponseText(outputText: string) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: outputText }]
          }
        ]
      };
    }
  };
}
