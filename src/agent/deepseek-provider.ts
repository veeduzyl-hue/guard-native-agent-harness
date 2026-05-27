import { createDefaultToolRegistry } from "../tools/registry.js";
import { normalizeProviderPlan, PlanNormalizationError } from "./plan-normalizer.js";
import { validatePlan } from "./plan-validator.js";
import type { PlannerProvider } from "./provider.js";

export const DEFAULT_DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEFAULT_DEEPSEEK_TIMEOUT_MS = 30000;

interface DeepSeekProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: DeepSeekFetch;
}

interface DeepSeekFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type DeepSeekFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<DeepSeekFetchResponse>;

export class DeepSeekPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekPlannerError";
  }
}

export function createDeepSeekPlannerProvider(
  options: DeepSeekProviderOptions = {}
): PlannerProvider {
  const endpoint = options.endpoint ?? DEFAULT_DEEPSEEK_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DEEPSEEK_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  return {
    name: "deepseek",
    kind: "remote-model",
    available: true,
    async createPlan(context) {
      const model = normalizeModel(context.requestedModel);

      if (!model) {
        throw new DeepSeekPlannerError("DeepSeek planner requires --model <model-name> in PR 10D.");
      }

      const apiKey = process.env.DEEPSEEK_API_KEY;

      if (!apiKey || apiKey.trim() === "") {
        throw new DeepSeekPlannerError(
          "DeepSeek planner requires DEEPSEEK_API_KEY in the process environment."
        );
      }

      const requestTimeoutMs = normalizeTimeoutMs(context.requestedTimeoutMs, timeoutMs);
      const response = await requestDeepSeekPlan({
        endpoint,
        timeoutMs: requestTimeoutMs,
        fetchFn,
        apiKey,
        model,
        prompt: buildDeepSeekPlannerPrompt(context.userPrompt, model)
      });
      const parsed = parseDeepSeekPlanResponse(response);

      let normalized;

      try {
        normalized = normalizeProviderPlan(parsed, {
          taskId: context.taskId,
          provider: "deepseek",
          model
        });
      } catch (error) {
        if (error instanceof PlanNormalizationError) {
          throw new DeepSeekPlannerError(
            "DeepSeek planner returned a response that was not a structured JSON plan."
          );
        }

        throw error;
      }

      const { normalizedPlan: plan, changes, warnings } = normalized;
      const validation = validatePlan(plan);

      if (!validation.valid) {
        throw new DeepSeekPlannerError(
          [
            "DeepSeek planner returned a plan that failed validation after normalization.",
            "No plan steps were executed.",
            "Provider: deepseek.",
            `Model: ${model}.`,
            "Normalization attempted: yes.",
            `Normalization changes: ${changes.length > 0 ? changes.join("; ") : "none"}.`,
            `Validator errors: ${validation.errors.join("; ")}`
          ].join(" ")
        );
      }

      if (plan.provider_diagnostics) {
        plan.provider_diagnostics.provider = "deepseek";
        plan.provider_diagnostics.model = model;
        plan.provider_diagnostics.normalization_applied = true;
        plan.provider_diagnostics.plan_validated = true;
      }

      return {
        provider: "deepseek",
        model,
        plan,
        rawProviderMetadata: {
          provider: "deepseek",
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

async function requestDeepSeekPlan(input: {
  endpoint: string;
  timeoutMs: number;
  fetchFn: DeepSeekFetch;
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
        messages: [
          {
            role: "system",
            content: input.prompt
          }
        ],
        response_format: {
          type: "json_object"
        },
        tools: [],
        tool_choice: "none",
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new DeepSeekPlannerError(
        `DeepSeek planner request failed with HTTP ${response.status}.`
      );
    }

    return response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw new DeepSeekPlannerError(
        `DeepSeek planner request timed out after ${input.timeoutMs}ms for model ${input.model}.`
      );
    }

    if (error instanceof DeepSeekPlannerError) {
      throw error;
    }

    throw new DeepSeekPlannerError(
      `DeepSeek planner request failed due to a network error for model ${input.model}.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseDeepSeekPlanResponse(response: unknown): unknown {
  if (!isRecord(response) || !Array.isArray(response.choices)) {
    throw new DeepSeekPlannerError("DeepSeek planner returned a non-plan response.");
  }

  const choice = response.choices[0];
  const message = isRecord(choice) ? choice.message : undefined;

  if (!isRecord(message) || (Array.isArray(message.tool_calls) && message.tool_calls.length > 0)) {
    throw new DeepSeekPlannerError("DeepSeek planner returned a non-plan response.");
  }

  if (typeof message.content !== "string" || message.content.trim() === "") {
    throw new DeepSeekPlannerError("DeepSeek planner returned empty JSON plan content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(message.content) as unknown;
  } catch {
    throw new DeepSeekPlannerError("DeepSeek planner returned malformed JSON plan content.");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.steps)) {
    throw new DeepSeekPlannerError("DeepSeek planner returned a non-plan JSON response.");
  }

  return parsed;
}

function buildDeepSeekPlannerPrompt(userPrompt: string, model: string): string {
  const toolMetadata = createDefaultToolRegistry().list();
  const toolNames = toolMetadata.map((metadata) => metadata.name).join(", ");

  return [
    "You are the planner for Guard-native Agent Harness.",
    "Output valid json only.",
    "Do not include markdown, comments, code fences, or explanations outside the JSON object.",
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
    "Return a JSON object with planner, provider, model, steps, risk_notes, and expected_outputs.",
    "Use planner and provider value deepseek and the selected model metadata.",
    "Example JSON:",
    JSON.stringify({
      planner: "deepseek",
      provider: "deepseek",
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
