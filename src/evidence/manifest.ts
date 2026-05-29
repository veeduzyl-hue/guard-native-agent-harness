import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const evidenceManifestFileName = "evidence-manifest.json";
export const evidenceManifestSchemaVersion = "guard-native-evidence-pack-manifest.v1";
export const evidencePackVersion = "v0.3";
export const evidenceManifestCreatedBy = "guard-native-agent-harness";

const manifestFileRoles = new Map<string, string>([
  ["blocked-actions.jsonl", "blocked_actions"],
  ["command-results.jsonl", "command_results"],
  ["file-changes.diff", "file_changes"],
  ["final-report.md", "final_report"],
  ["guard-results.json", "guard_results"],
  ["plan.json", "plan"],
  ["policy-decisions.jsonl", "policy_decisions"],
  ["task.json", "task"],
  ["tool-calls.jsonl", "tool_calls"]
]);

const requiredManifestFiles = [
  "task.json",
  "plan.json",
  "final-report.md",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json"
];

const optionalManifestFiles = ["file-changes.diff", "policy-decisions.jsonl"];

export interface EvidenceManifest {
  schema_version: typeof evidenceManifestSchemaVersion;
  evidence_pack_version: typeof evidencePackVersion;
  created_by: typeof evidenceManifestCreatedBy;
  task_id: string;
  files: EvidenceManifestFileEntry[];
}

export interface EvidenceManifestFileEntry {
  path: string;
  size_bytes: number;
  sha256: string;
  role: string;
}

export async function writeEvidenceManifest(
  evidenceDirectory: string,
  taskId: string
): Promise<EvidenceManifest> {
  const manifest = await createEvidenceManifest(evidenceDirectory, taskId);
  await writeFile(
    path.join(evidenceDirectory, evidenceManifestFileName),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  return manifest;
}

export async function createEvidenceManifest(
  evidenceDirectory: string,
  taskId: string
): Promise<EvidenceManifest> {
  const files = [...requiredManifestFiles];

  for (const optionalFile of optionalManifestFiles) {
    if (existsSync(path.join(evidenceDirectory, optionalFile))) {
      files.push(optionalFile);
    }
  }

  const entries = await Promise.all(
    files.sort((left, right) => left.localeCompare(right)).map(async (filePath) => {
      const absolutePath = path.join(evidenceDirectory, filePath);
      const fileBytes = await readFile(absolutePath);
      const fileStat = await stat(absolutePath);

      return {
        path: filePath,
        size_bytes: fileStat.size,
        sha256: createHash("sha256").update(fileBytes).digest("hex"),
        role: manifestFileRoles.get(filePath) ?? "review_artifact"
      };
    })
  );

  return {
    schema_version: evidenceManifestSchemaVersion,
    evidence_pack_version: evidencePackVersion,
    created_by: evidenceManifestCreatedBy,
    task_id: taskId,
    files: entries
  };
}
