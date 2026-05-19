import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderFinalReport } from "./report.js";
import type { EvidencePack, PlanEvidence, TaskEvidence } from "./schema.js";

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

  return {
    task,
    plan,
    evidenceDirectory,
    relativeEvidenceDirectory,
    finalReportPath,
    relativeFinalReportPath: `${relativeEvidenceDirectory}/final-report.md`
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
