import { createDefaultToolRegistry } from "../tools/registry.js";
import { normalizeProviderPlan } from "./plan-normalizer.js";
import { validatePlan } from "./plan-validator.js";
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
      const requestTimeoutMs = normalizeTimeoutMs(context.requestedTimeoutMs, timeoutMs);

      if (!model) {
        throw new OllamaPlannerError("Ollama planner requires --model <model-name> in PR 10B.");
      }

      const response = await requestOllamaPlan({
        endpoint,
        timeoutMs: requestTimeoutMs,
        fetchFn,
        model,
        prompt: buildOllamaPlannerPrompt(context.userPrompt)
      });
      const parsed = parseOllamaPlanResponse(response);
      const {
        normalizedPlan: plan,
        changes,
        warnings
      } = normalizeProviderPlan(parsed, {
        taskId: context.taskId,
        provider: "ollama",
        model
      });
      const validation = validatePlan(plan);

      if (!validation.valid) {
        throw new OllamaPlannerError(
          [
            "Ollama planner returned a plan that failed validation after normalization.",
            "No plan steps were executed.",
            `Provider: ollama.`,
            `Model: ${model}.`,
            `Normalization attempted: yes.`,
            `Normalization changes: ${changes.length > 0 ? changes.join("; ") : "none"}.`,
            `Validator errors: ${validation.errors.join("; ")}`
          ].join(" ")
        );
      }

      if (plan.provider_diagnostics) {
        plan.provider_diagnostics.plan_validated = true;
      }

      return {
        provider: "ollama",
        model,
        plan,
        rawProviderMetadata: {
          provider: "ollama",
          model,
          response_json_valid: true,
          normalization_applied: changes.length > 0,
          normalization_changes: changes,
          normalization_warnings: warnings
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
      throw new OllamaPlannerError(
        `Ollama planner request timed out after ${input.timeoutMs}ms for model ${input.model} at ${input.endpoint}.`
      );
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

function buildOllamaPlannerPrompt(userPrompt: string): string {
  const toolMetadata = createDefaultToolRegistry().list();
  const toolNames = toolMetadata.map((metadata) => metadata.name).join(", ");

  return [
    "You are the planner for Guard-native Agent Harness.",
    "Output JSON only. Do not include markdown, comments, prose, code fences, or explanations outside JSON.",
    `User task: ${userPrompt}`,
    `Allowed tool names: ${toolNames}`,
    "Use only registered tool names. Do not invent tools.",
    "Each step must include id, tool, input, and description.",
    "Step ids must be step-1, step-2, step-3, and so on in order.",
    "Each tool must be one of the allowed tool names.",
    "Each input must be a JSON object.",
    "Available tools and required input shapes:",
    ...toolMetadata.flatMap((metadata) => [
      `- ${metadata.name}`,
      `  input: ${JSON.stringify(metadata.inputSchemaHint)}`,
      `  example: ${JSON.stringify(metadata.inputExample)}`
    ]),
    "Use exactly these input object shapes.",
    "Do not provide input as a string.",
    "Do not invent fields.",
    "Invalid input shapes fail validation and do not execute.",
    "Do not execute tools. Do not read files directly. Do not run commands directly.",
    "Do not include shell commands unless using the run_command tool.",
    "Do not request .env files, secrets, keys, tokens, private keys, git push, or destructive commands.",
    "Propose safe local plan steps only.",
    "Return a JSON object with planner, provider, model, steps, risk_notes, and expected_outputs.",
    "Example JSON:",
    JSON.stringify({
      planner: "ollama",
      provider: "ollama",
      model: "<model-name>",
      steps: [
        {
          id: "step-1",
          tool: "list_files",
          input: {
            path: "."
          },
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
    })
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

function normalizeTimeoutMs(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}
