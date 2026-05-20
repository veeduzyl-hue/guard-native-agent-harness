import { randomBytes } from "node:crypto";

import { executePlan } from "../agent/orchestrator.js";
import { validatePlan, PlanValidationError } from "../agent/plan-validator.js";
import { createDefaultPlannerProviderRegistry, type PlannerProviderRegistry } from "../agent/provider-registry.js";
import { HARNESS_VERSION } from "../index.js";
import { renderFinalReportFromEvidence } from "../evidence/report.js";
import { writeEvidencePack, writeFinalReport, writeGuardResults } from "../evidence/writer.js";
import { createDefaultGuardAdapter, type GuardAdapter } from "../guard/adapter.js";
import { resolveWorkspaceRoot } from "../sandbox/workspace.js";
import type { EvidencePack, TaskEvidence } from "../evidence/schema.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface RunTaskOptions {
  workspaceRoot?: string;
  now?: Date;
  randomId?: string;
  harnessVersion?: string;
  guardAdapter?: GuardAdapter;
  toolRegistry?: ToolRegistry;
  executePlan?: boolean;
  plannerProvider?: string;
  plannerModel?: string | null;
  plannerRegistry?: PlannerProviderRegistry;
}

export async function runTask(userPrompt: string, options: RunTaskOptions = {}): Promise<EvidencePack> {
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const createdAt = options.now ?? new Date();
  const taskId = createTaskId(createdAt, options.randomId);
  const harnessVersion = options.harnessVersion ?? HARNESS_VERSION;
  const plannerRegistry = options.plannerRegistry ?? createDefaultPlannerProviderRegistry();
  const plannerProvider = options.plannerProvider
    ? plannerRegistry.get(options.plannerProvider)
    : plannerRegistry.defaultProvider();
  const plannerResult = await plannerProvider.createPlan({
    taskId,
    userPrompt,
    workspaceRoot,
    harnessVersion,
    requestedModel: options.plannerModel ?? null
  });
  const planValidation = validatePlan(plannerResult.plan, options.toolRegistry);

  if (!planValidation.valid) {
    throw new PlanValidationError(planValidation);
  }

  const task: TaskEvidence = {
    task_id: taskId,
    created_at: createdAt.toISOString(),
    user_prompt: userPrompt,
    workspace_root: workspaceRoot,
    harness_version: harnessVersion,
    mode: "local",
    planner_type: plannerResult.provider,
    planner_provider: plannerResult.provider,
    planner_model: plannerResult.model ?? null
  };

  const plan = plannerResult.plan;

  const evidencePack = await writeEvidencePack(workspaceRoot, task, plan);
  const executionSummary =
    options.executePlan === false
      ? evidencePack.executionSummary
      : await executePlan(
          plan,
          {
            taskId,
            workspaceRoot,
            evidenceDirectory: evidencePack.evidenceDirectory,
            relativeEvidenceDirectory: evidencePack.relativeEvidenceDirectory
          },
          { registry: options.toolRegistry }
        );
  const guardResult = await (options.guardAdapter ?? createDefaultGuardAdapter()).collect();
  await writeGuardResults(evidencePack.evidenceDirectory, guardResult);
  await writeFinalReport(evidencePack.evidenceDirectory, await renderFinalReportFromEvidence(evidencePack.evidenceDirectory));

  return {
    ...evidencePack,
    guardAvailable: guardResult.guard_available,
    executionSummary
  };
}

export function createTaskId(now = new Date(), randomId = randomBytes(4).toString("hex")): string {
  return `task-${formatTaskTimestamp(now)}-${randomId}`;
}

function formatTaskTimestamp(now: Date): string {
  const year = now.getUTCFullYear();
  const month = pad2(now.getUTCMonth() + 1);
  const day = pad2(now.getUTCDate());
  const hour = pad2(now.getUTCHours());
  const minute = pad2(now.getUTCMinutes());
  const second = pad2(now.getUTCSeconds());

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
