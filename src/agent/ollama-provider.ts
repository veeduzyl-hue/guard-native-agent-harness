import type { PlanEvidence } from "../evidence/schema.js";
import { createDefaultToolRegistry } from "../tools/registry.js";
import type { PlannerProvider } from "./provider.js";

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
export const DEFAULT_OLLAMA_TIMEOUT_MS = 30000;

interface OllamaProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: OllamaFetch;
}

interface OllamaFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

type OllamaFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<OllamaFetchResponse>;

export class OllamaPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaPlannerError";
  }
}

export function createOllamaPlannerProvider(options: OllamaProviderOptions = {}): PlannerProvider {
  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_OLLAMA_ENDPOINT);
  const timeoutMs = options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  return {
    name: "ollama",
    kind: "local-model",
    available: true,
    async createPlan(context) {
      const model = normalizeModel(context.requestedModel);

      if (!model) {
        throw new OllamaPlannerError("Ollama planner requires --model <model-name> in PR 10B.");
      }

      const response = await requestOllamaPlan({
        endpoint,
        timeoutMs,
        fetchFn,
        model,
        prompt: buildOllamaPlannerPrompt(context.userPrompt)
      });
      const parsed = parseOllamaPlanResponse(response);
      const plan = normalizeOllamaPlan(parsed, context.taskId, model);

      return {
        provider: "ollama",
        model,
        plan,
        rawProviderMetadata: {
          provider: "ollama",
          model,
          response_json_valid: true
        }
      };
    }
  };
}

async function requestOllamaPlan(input: {
  endpoint: string;
  timeoutMs: number;
  fetchFn: OllamaFetch;
  model: string;
  prompt: string;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchFn(`${input.endpoint}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new OllamaPlannerError(
        `Ollama planner provider returned HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : "."}`
      );
    }

    return response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw new OllamaPlannerError("Ollama planner request timed out.");
    }

    if (error instanceof OllamaPlannerError) {
      throw error;
    }

    throw new OllamaPlannerError(
      `Ollama planner provider is selected, but local Ollama is unavailable at ${input.endpoint}.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseOllamaPlanResponse(response: unknown): unknown {
  if (!isRecord(response) || typeof response.response !== "string") {
    throw new OllamaPlannerError("Ollama planner response did not include a JSON response string.");
  }

  try {
    return JSON.parse(response.response) as unknown;
  } catch {
    throw new OllamaPlannerError("Ollama planner returned malformed JSON.");
  }
}

function normalizeOllamaPlan(value: unknown, taskId: string, model: string): PlanEvidence {
  if (!isRecord(value)) {
    throw new OllamaPlannerError("Ollama planner JSON must be an object.");
  }

  return {
    task_id: taskId,
    planner: "ollama",
    provider: "ollama",
    model,
    steps: Array.isArray(value.steps) ? value.steps.map(normalizeStep) : [],
    risk_notes: normalizeStringArray(value.risk_notes, ["Model-generated plan must be validated before execution."]),
    expected_outputs: normalizeStringArray(value.expected_outputs, [
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "guard-results.json",
      "final-report.md"
    ])
  };
}

function normalizeStep(value: unknown): PlanEvidence["steps"][number] {
  if (!isRecord(value)) {
    return {
      id: "",
      tool: "",
      input: {},
      description: ""
    };
  }

  return {
    id: typeof value.id === "string" ? value.id : "",
    tool: typeof value.tool === "string" ? value.tool : "",
    input: isRecord(value.input) ? value.input : {},
    description: typeof value.description === "string" ? value.description : ""
  };
}

function buildOllamaPlannerPrompt(userPrompt: string): string {
  const toolNames = createDefaultToolRegistry()
    .list()
    .map((metadata) => metadata.name)
    .join(", ");

  return [
    "You are the planner for Guard-native Agent Harness.",
    "Output JSON only. Do not include markdown, prose, or code fences.",
    `User task: ${userPrompt}`,
    `Allowed tool names: ${toolNames}`,
    "Use only registered tool names. Do not invent tools.",
    "Do not execute tools. Do not read files directly. Do not run commands directly.",
    "Do not include shell commands unless using the run_command tool.",
    "Do not request .env files, secrets, keys, tokens, private keys, git push, or destructive commands.",
    "Propose safe local plan steps only.",
    "Return a JSON object with planner, provider, model, steps, risk_notes, and expected_outputs."
  ].join("\n");
}

function normalizeEndpoint(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeModel(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}
