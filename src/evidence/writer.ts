import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderFinalReport } from "./report.js";
import type {
  BlockedActionEvidenceEvent,
  EvidencePack,
  PlanEvidence,
  TaskEvidence,
  ToolCallEvidenceEvent
} from "./schema.js";

export async function writeEvidencePack(
  workspaceRoot: string,
  task: TaskEvidence,
  plan: PlanEvidence
): Promise<EvidencePack> {
  const relativeEvidenceDirectory = `.evidence/${task.task_id}`;
  const evidenceDirectory = path.join(workspaceRoot, ".evidence", task.task_id);

  await mkdir(evidenceDirectory, { recursive: true });

  await writeJsonFile(path.join(evidenceDirectory, "task.json"), task);
  await writeJsonFile(path.join(evidenceDirectory, "plan.json"), plan);

  const report = renderFinalReport(task, plan);
  const finalReportPath = path.join(evidenceDirectory, "final-report.md");
  await writeFile(finalReportPath, report, "utf8");
  const toolCallsPath = path.join(evidenceDirectory, "tool-calls.jsonl");
  await writeFile(toolCallsPath, "", { encoding: "utf8", flag: "a" });
  const blockedActionsPath = path.join(evidenceDirectory, "blocked-actions.jsonl");
  await writeFile(blockedActionsPath, "", { encoding: "utf8", flag: "a" });

  return {
    task,
    plan,
    evidenceDirectory,
    relativeEvidenceDirectory,
    finalReportPath,
    relativeFinalReportPath: `${relativeEvidenceDirectory}/final-report.md`,
    toolCallsPath,
    relativeToolCallsPath: `${relativeEvidenceDirectory}/tool-calls.jsonl`,
    blockedActionsPath,
    relativeBlockedActionsPath: `${relativeEvidenceDirectory}/blocked-actions.jsonl`
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendToolCallEvent(
  evidenceDirectory: string,
  event: ToolCallEvidenceEvent
): Promise<void> {
  await appendFile(path.join(evidenceDirectory, "tool-calls.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

export async function appendBlockedActionEvent(
  evidenceDirectory: string,
  event: BlockedActionEvidenceEvent
): Promise<void> {
  await appendFile(path.join(evidenceDirectory, "blocked-actions.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}
