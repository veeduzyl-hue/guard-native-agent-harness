import { randomBytes } from "node:crypto";

import { createPlaceholderPlan } from "../agent/planner.js";
import { HARNESS_VERSION } from "../index.js";
import { writeEvidencePack, writeGuardResults } from "../evidence/writer.js";
import { createDefaultGuardAdapter, type GuardAdapter } from "../guard/adapter.js";
import { resolveWorkspaceRoot } from "../sandbox/workspace.js";
import type { EvidencePack, TaskEvidence } from "../evidence/schema.js";

export interface RunTaskOptions {
  workspaceRoot?: string;
  now?: Date;
  randomId?: string;
  harnessVersion?: string;
  guardAdapter?: GuardAdapter;
}

export async function runTask(userPrompt: string, options: RunTaskOptions = {}): Promise<EvidencePack> {
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const createdAt = options.now ?? new Date();
  const taskId = createTaskId(createdAt, options.randomId);

  const task: TaskEvidence = {
    task_id: taskId,
    created_at: createdAt.toISOString(),
    user_prompt: userPrompt,
    workspace_root: workspaceRoot,
    harness_version: options.harnessVersion ?? HARNESS_VERSION,
    mode: "local",
    planner_type: "placeholder"
  };

  const plan = createPlaceholderPlan(taskId);

  const evidencePack = await writeEvidencePack(workspaceRoot, task, plan);
  const guardResult = await (options.guardAdapter ?? createDefaultGuardAdapter()).collect();
  await writeGuardResults(evidencePack.evidenceDirectory, guardResult);

  return {
    ...evidencePack,
    guardAvailable: guardResult.guard_available
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
