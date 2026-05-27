import { createDefaultToolRegistry } from "../tools/registry.js";
import { normalizeProviderPlan, PlanNormalizationError } from "./plan-normalizer.js";
import { validatePlan } from "./plan-validator.js";
import type { PlannerProvider } from "./provider.js";

export const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
export const DEFAULT_OPENAI_TIMEOUT_MS = 30000;

interface OpenAIProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: OpenAIFetch;
}

interface OpenAIFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type OpenAIFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<OpenAIFetchResponse>;

export class OpenAIPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIPlannerError";
  }
}

export function createOpenAIPlannerProvider(options: OpenAIProviderOptions = {}): PlannerProvider {
  const endpoint = options.endpoint ?? DEFAULT_OPENAI_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  return {
    name: "openai",
    kind: "remote-model",
    available: true,
    async createPlan(context) {
      const model = normalizeModel(context.requestedModel);

      if (!model) {
        throw new OpenAIPlannerError("OpenAI planner requires --model <model-name> in PR 10C.");
      }

      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey || apiKey.trim() === "") {
        throw new OpenAIPlannerError(
          "OpenAI planner requires OPENAI_API_KEY in the process environment."
        );
      }

      const requestTimeoutMs = normalizeTimeoutMs(context.requestedTimeoutMs, timeoutMs);
      const response = await requestOpenAIPlan({
        endpoint,
        timeoutMs: requestTimeoutMs,
        fetchFn,
        apiKey,
        model,
        prompt: buildOpenAIPlannerPrompt(context.userPrompt, model)
      });
      const parsed = parseOpenAIPlanResponse(response);

      let normalized;

      try {
        normalized = normalizeProviderPlan(parsed, {
          taskId: context.taskId,
          provider: "openai",
          model
        });
      } catch (error) {
        if (error instanceof PlanNormalizationError) {
          throw new OpenAIPlannerError(
            "OpenAI planner returned a response that was not a structured JSON plan."
          );
        }

        throw error;
      }

      const { normalizedPlan: plan, changes, warnings } = normalized;
      const validation = validatePlan(plan);

      if (!validation.valid) {
        throw new OpenAIPlannerError(
          [
            "OpenAI planner returned a plan that failed validation after normalization.",
            "No plan steps were executed.",
            "Provider: openai.",
            `Model: ${model}.`,
            "Normalization attempted: yes.",
            `Normalization changes: ${changes.length > 0 ? changes.join("; ") : "none"}.`,
            `Validator errors: ${validation.errors.join("; ")}`
          ].join(" ")
        );
      }

      if (plan.provider_diagnostics) {
        plan.provider_diagnostics.provider = "openai";
        plan.provider_diagnostics.model = model;
        plan.provider_diagnostics.normalization_applied = true;
        plan.provider_diagnostics.plan_validated = true;
      }

      return {
        provider: "openai",
        model,
        plan,
        rawProviderMetadata: {
          provider: "openai",
          model,
          response_json_valid: true,
          normalization_applied: true,
          normalization_changes: changes,
          normalization_warnings: warnings
        }
      };
    }
  };
}

async function requestOpenAIPlan(input: {
  endpoint: string;
  timeoutMs: number;
  fetchFn: OpenAIFetch;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchFn(input.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        input: input.prompt,
        text: {
          format: {
            type: "json_schema",
            name: "agent_plan",
            strict: true,
            schema: createOpenAIPlanJsonSchema()
          }
        },
        tools: [],
        tool_choice: "none",
        store: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new OpenAIPlannerError(`OpenAI planner request failed with HTTP ${response.status}.`);
    }

    return response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw new OpenAIPlannerError(
        `OpenAI planner request timed out after ${input.timeoutMs}ms for model ${input.model}.`
      );
    }

    if (error instanceof OpenAIPlannerError) {
      throw error;
    }

    throw new OpenAIPlannerError(
      `OpenAI planner request failed due to a network error for model ${input.model}.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseOpenAIPlanResponse(response: unknown): unknown {
  if (!isRecord(response) || !Array.isArray(response.output)) {
    throw new OpenAIPlannerError("OpenAI planner returned a refusal or non-plan response.");
  }

  const outputText: string[] = [];
  let refused = false;

  for (const item of response.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!isRecord(content)) {
        continue;
      }

      if (content.type === "refusal") {
        refused = true;
      } else if (content.type === "output_text" && typeof content.text === "string") {
        outputText.push(content.text);
      }
    }
  }

  if (refused || outputText.length === 0) {
    throw new OpenAIPlannerError("OpenAI planner returned a refusal or non-plan response.");
  }

  try {
    return JSON.parse(outputText.join("")) as unknown;
  } catch {
    throw new OpenAIPlannerError("OpenAI planner returned malformed structured plan JSON.");
  }
}

function buildOpenAIPlannerPrompt(userPrompt: string, model: string): string {
  const toolMetadata = createDefaultToolRegistry().list();
  const toolNames = toolMetadata.map((metadata) => metadata.name).join(", ");

  return [
    "You are the planner for Guard-native Agent Harness.",
    "Output only the structured JSON plan requested by the response schema.",
    "Do not include markdown, comments, code fences, or explanations outside JSON.",
    `User task: ${userPrompt}`,
    `Selected model metadata: ${model}`,
    `Registered tool names: ${toolNames}`,
    "Use only registered tool names. Do not invent tools.",
    "Each step must include id, tool, input, and description.",
    "Step ids must be step-1, step-2, step-3, and so on in order.",
    "Each input must be a JSON object.",
    "Available tools and exact input object shapes:",
    ...toolMetadata.flatMap((metadata) => [
      `- ${metadata.name}`,
      `  input: ${JSON.stringify(metadata.inputSchemaHint)}`,
      `  example: ${JSON.stringify(metadata.inputExample)}`
    ]),
    "Use exactly the provided input object shapes. Do not invent input fields.",
    "Do not execute tools. Do not read files directly. Do not run commands directly.",
    "Do not request .env files, secrets, keys, tokens, private keys, git push, destructive commands, or non-allowlisted commands.",
    "Propose safe local plan steps only.",
    "The plan will be normalized structurally and validated before execution.",
    "Invalid plans will not execute.",
    "Return planner, provider, model, steps, risk_notes, and expected_outputs.",
    "Use planner and provider value openai and the selected model metadata.",
    "Example JSON:",
    JSON.stringify({
      planner: "openai",
      provider: "openai",
      model,
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
        "guard-results.json",
        "final-report.md"
      ]
    })
  ].join("\n");
}

function createOpenAIPlanJsonSchema(): Record<string, unknown> {
  const stepSchemas = createDefaultToolRegistry()
    .list()
    .map((metadata) => {
      const inputProperties = Object.fromEntries(
        Object.keys(metadata.inputSchemaHint).map((key) => [key, { type: "string" }])
      );
      const inputFields = Object.keys(metadata.inputSchemaHint);

      return {
        type: "object",
        additionalProperties: false,
        required: ["id", "tool", "input", "description"],
        properties: {
          id: { type: "string" },
          tool: { type: "string", const: metadata.name },
          input: {
            type: "object",
            additionalProperties: false,
            required: inputFields,
            properties: inputProperties
          },
          description: { type: "string" }
        }
      };
    });

  return {
    type: "object",
    additionalProperties: false,
    required: ["planner", "provider", "model", "steps", "risk_notes", "expected_outputs"],
    properties: {
      planner: { type: "string", const: "openai" },
      provider: { type: "string", const: "openai" },
      model: { type: "string" },
      steps: {
        type: "array",
        items: { anyOf: stepSchemas }
      },
      risk_notes: {
        type: "array",
        items: { type: "string" }
      },
      expected_outputs: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
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
