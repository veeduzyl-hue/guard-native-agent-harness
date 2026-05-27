import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeepSeekPlannerProvider } from "../src/agent/deepseek-provider.js";
import { validatePlan } from "../src/agent/plan-validator.js";
import { mockPlannerProvider } from "../src/agent/planner.js";
import { PlannerProviderRegistry } from "../src/agent/provider-registry.js";
import { GuardAdapter } from "../src/guard/adapter.js";
import { runTask } from "../src/task/runner.js";

const apiKey = "test-deepseek-key-never-write-to-evidence";
const hiddenReasoning = "private reasoning must never reach evidence";

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deepseek planner provider", () => {
  it("requires DEEPSEEK_API_KEY from the process environment", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createDeepSeekFetch({ steps: [] })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("DeepSeek planner requires DEEPSEEK_API_KEY in the process environment.");
  });

  it("requires an explicit model", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createDeepSeekFetch({ steps: [] })
    });

    await expect(provider.createPlan(createContext())).rejects.toThrow(
      "DeepSeek planner requires --model <model-name> in PR 10D."
    );
  });

  it("requests JSON output and creates a valid plan from a mocked response", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    let requestedUrl = "";
    let requestHeaders: Record<string, string> | null = null;
    let requestBody: Record<string, unknown> | null = null;
    const provider = createDeepSeekPlannerProvider({
      fetchFn: async (url, init) => {
        requestedUrl = url;
        requestHeaders = init.headers;
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        return successfulResponse(validPlan());
      }
    });

    const result = await provider.createPlan(
      createContext({ taskId: "task-deepseek", requestedModel: "test-model" })
    );
    const messages = requestBody?.messages as Array<{ content: string }>;

    expect(requestedUrl).toBe("https://api.deepseek.com/chat/completions");
    expect(requestHeaders?.authorization).toBe(`Bearer ${apiKey}`);
    expect(requestBody).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
      tools: [],
      tool_choice: "none",
      stream: false
    });
    expect(messages[0]?.content).toContain("Output valid json only.");
    expect(messages[0]?.content).toContain("Use only registered tool names.");
    expect(messages[0]?.content).toContain(
      "Do not request .env files, secrets, keys, tokens, private keys, git push"
    );
    expect(messages[0]?.content).not.toContain(apiKey);
    expect(result).toMatchObject({
      provider: "deepseek",
      model: "test-model",
      plan: {
        task_id: "task-deepseek",
        planner: "deepseek",
        provider: "deepseek",
        model: "test-model"
      }
    });
    expect(result.plan.provider_diagnostics).toMatchObject({
      provider: "deepseek",
      model: "test-model",
      normalization_applied: true,
      plan_validated: true
    });
    expect(validatePlan(result.plan).valid).toBe(true);
  });

  it("normalizes missing step ids before validation", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createDeepSeekFetch({
        planner: "deepseek",
        provider: "deepseek",
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
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-deepseek-unknown-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "deepseek",
        plannerModel: "test-model",
        plannerRegistry: createDeepSeekRegistry(
          createDeepSeekFetch({
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
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-deepseek-input-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "deepseek",
        plannerModel: "test-model",
        plannerRegistry: createDeepSeekRegistry(
          createDeepSeekFetch({
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
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-deepseek-env-"));
    const result = await runTask("Show a policy demo with blocked action", {
      workspaceRoot,
      plannerProvider: "deepseek",
      plannerModel: "test-model",
      plannerRegistry: createDeepSeekRegistry(
        createDeepSeekFetch({
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

  it("fails on malformed JSON output before execution", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-deepseek-malformed-"));

    await expect(
      runTask("Create a safe README update proposal", {
        workspaceRoot,
        plannerProvider: "deepseek",
        plannerModel: "test-model",
        plannerRegistry: createDeepSeekRegistry(createRawDeepSeekFetch("not-json")),
        guardAdapter: unavailableGuardAdapter
      })
    ).rejects.toThrow("DeepSeek planner returned malformed JSON plan content.");
    await expect(stat(path.join(workspaceRoot, ".evidence"))).rejects.toThrow();
  });

  it("fails cleanly on empty content", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createRawDeepSeekFetch("")
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("DeepSeek planner returned empty JSON plan content.");
  });

  it("fails cleanly on markdown-wrapped JSON content", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createRawDeepSeekFetch(`\`\`\`json\n${JSON.stringify(validPlan())}\n\`\`\``)
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("DeepSeek planner returned malformed JSON plan content.");
  });

  it("fails cleanly on JSON content that is not a plan", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: createDeepSeekFetch({ refusal: "Cannot propose a plan." })
    });

    await expect(
      provider.createPlan(createContext({ requestedModel: "test-model" }))
    ).rejects.toThrow("DeepSeek planner returned a non-plan JSON response.");
  });

  it.each([401, 429])("reports HTTP %i without returning response content", async (status) => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
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
    ).rejects.toThrow(`DeepSeek planner request failed with HTTP ${status}.`);
  });

  it("returns a controlled network failure without exposing the API key", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
      fetchFn: async () => {
        throw new Error(`failed with bearer token ${apiKey}`);
      }
    });

    const error = await provider
      .createPlan(createContext({ requestedModel: "test-model" }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "DeepSeek planner request failed due to a network error for model test-model."
    );
    expect((error as Error).message).not.toContain(apiKey);
  });

  it("uses requested timeout and reports timeout cleanly", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const provider = createDeepSeekPlannerProvider({
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
    ).rejects.toThrow("DeepSeek planner request timed out after 1ms for model test-model.");
  });

  it("writes bounded evidence without API key or provider reasoning content", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", apiKey);
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-deepseek-evidence-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");
    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      plannerProvider: "deepseek",
      plannerModel: "test-model",
      plannerTimeoutMs: 120000,
      plannerRegistry: createDeepSeekRegistry(createDeepSeekFetch(validPlan(), hiddenReasoning)),
      guardAdapter: unavailableGuardAdapter
    });

    const fileNames = [
      "task.json",
      "plan.json",
      "final-report.md",
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json"
    ];
    const evidenceContents = await Promise.all(
      fileNames.map((fileName) => readFile(path.join(result.evidenceDirectory, fileName), "utf8"))
    );
    const taskJson = evidenceContents[0] ?? "";
    const planJson = evidenceContents[1] ?? "";
    const report = evidenceContents[2] ?? "";
    const toolCalls = evidenceContents[3] ?? "";
    const writtenEvidence = evidenceContents.join("\n");
    const parsedPlan = JSON.parse(planJson) as {
      provider_diagnostics: Record<string, unknown>;
    };

    expect(result.executionSummary.steps_completed).toBe(1);
    expect(JSON.parse(taskJson)).toMatchObject({
      planner_provider: "deepseek",
      planner_model: "test-model"
    });
    expect(parsedPlan).toMatchObject({
      provider: "deepseek",
      model: "test-model",
      provider_diagnostics: {
        provider: "deepseek",
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
    expect(report).toContain("- Provider: deepseek");
    expect(report).toContain("- Model: test-model");
    expect(writtenEvidence).not.toContain(apiKey);
    expect(writtenEvidence).not.toContain(hiddenReasoning);
  });
});

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "task-deepseek-test",
    userPrompt: "Create a safe README update proposal",
    workspaceRoot: "workspace",
    harnessVersion: "0.1.0",
    ...overrides
  };
}

function createDeepSeekRegistry(
  fetchFn: Parameters<typeof createDeepSeekPlannerProvider>[0]["fetchFn"]
): PlannerProviderRegistry {
  const registry = new PlannerProviderRegistry();
  registry.register(mockPlannerProvider);
  registry.register(createDeepSeekPlannerProvider({ fetchFn }));

  return registry;
}

function validPlan(): Record<string, unknown> {
  return {
    planner: "deepseek",
    provider: "deepseek",
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
    expected_outputs: ["tool-calls.jsonl", "blocked-actions.jsonl", "final-report.md"]
  };
}

function createDeepSeekFetch(
  plan: Partial<Record<string, unknown>>,
  reasoningContent?: string
): Parameters<typeof createDeepSeekPlannerProvider>[0]["fetchFn"] {
  return createRawDeepSeekFetch(JSON.stringify(plan), reasoningContent);
}

function createRawDeepSeekFetch(
  content: string,
  reasoningContent?: string
): Parameters<typeof createDeepSeekPlannerProvider>[0]["fetchFn"] {
  return async () => successfulResponseText(content, reasoningContent);
}

function successfulResponse(plan: Record<string, unknown>) {
  return successfulResponseText(JSON.stringify(plan));
}

function successfulResponseText(content: string, reasoningContent?: string) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: {
              content,
              reasoning_content: reasoningContent
            }
          }
        ]
      };
    }
  };
}
