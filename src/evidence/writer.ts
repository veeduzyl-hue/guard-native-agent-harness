import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GuardAdapterResult } from "../guard/types.js";
import { evidenceManifestFileName, writeEvidenceManifest } from "./manifest.js";
import type {
  BlockedActionEvidenceEvent,
  CommandResultEvidenceEvent,
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

  const finalReportPath = path.join(evidenceDirectory, "final-report.md");
  await writeFile(finalReportPath, "", { encoding: "utf8", flag: "a" });
  const toolCallsPath = path.join(evidenceDirectory, "tool-calls.jsonl");
  await writeFile(toolCallsPath, "", { encoding: "utf8", flag: "a" });
  const blockedActionsPath = path.join(evidenceDirectory, "blocked-actions.jsonl");
  await writeFile(blockedActionsPath, "", { encoding: "utf8", flag: "a" });
  const commandResultsPath = path.join(evidenceDirectory, "command-results.jsonl");
  await writeFile(commandResultsPath, "", { encoding: "utf8", flag: "a" });
  const guardResultsPath = path.join(evidenceDirectory, "guard-results.json");
  const manifestPath = path.join(evidenceDirectory, evidenceManifestFileName);

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
    relativeBlockedActionsPath: `${relativeEvidenceDirectory}/blocked-actions.jsonl`,
    commandResultsPath,
    relativeCommandResultsPath: `${relativeEvidenceDirectory}/command-results.jsonl`,
    guardResultsPath,
    relativeGuardResultsPath: `${relativeEvidenceDirectory}/guard-results.json`,
    manifestPath,
    relativeManifestPath: `${relativeEvidenceDirectory}/${evidenceManifestFileName}`,
    guardAvailable: false,
    executionSummary: {
      steps_planned: 0,
      steps_completed: 0,
      steps_blocked: 0,
      steps_failed: 0
    }
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

export async function appendCommandResultEvent(
  evidenceDirectory: string,
  event: CommandResultEvidenceEvent
): Promise<void> {
  await appendFile(path.join(evidenceDirectory, "command-results.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

export async function writeGuardResults(
  evidenceDirectory: string,
  result: GuardAdapterResult
): Promise<void> {
  await writeFile(path.join(evidenceDirectory, "guard-results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export async function writeFinalReport(evidenceDirectory: string, report: string): Promise<void> {
  await writeFile(path.join(evidenceDirectory, "final-report.md"), report, "utf8");
}

export { writeEvidenceManifest };
