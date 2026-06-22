import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { GuardAdapterResult } from "../guard/types.js";
import {
  evidenceManifestCreatedBy,
  evidenceManifestFileName,
  evidenceManifestSchemaVersion,
  evidencePackVersion,
  type EvidenceManifest
} from "./manifest.js";
import { readJsonFile, readJsonlFile, readTextFile } from "./reader.js";
import type {
  BlockedActionEvidenceEvent,
  CommandResultEvidenceEvent,
  PlanEvidence,
  TaskEvidence,
  ToolCallEvidenceEvent
} from "./schema.js";
import type { ReviewProfileMetadata } from "./review-profile.js";

export interface EvidenceInspection {
  schema_version: "v0.3";
  inspector_version: "v0.3";
  review_posture: "review_artifact_only";
  evidence_dir: string;
  review_profile: ReviewProfileMetadata | null;
  manifest: {
    present: boolean;
    valid: boolean;
    file_count: number;
    errors: string[];
  };
  task: {
    present: boolean;
    task_id: string | null;
    summary: string | null;
  };
  plan: {
    present: boolean;
    step_count: number;
    planner: string | null;
  };
  tools: {
    tool_call_count: number;
    tool_names: string[];
  };
  policy: {
    policy_decision_count: number;
    blocked_action_count: number;
  };
  commands: {
    command_result_count: number;
  };
  guard: {
    guard_results_present: boolean;
    guard_available: boolean | null;
  };
  final_report: {
    present: boolean;
  };
  boundary: {
    approval: false;
    enforcement: false;
    autonomous_execution: false;
    authority_grant: false;
    runtime_control_plane: false;
  };
}

export class EvidenceInspectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceInspectionError";
  }
}

export async function inspectEvidencePack(input: {
  evidenceDirectory: string;
  displayPath?: string;
  reviewProfile?: ReviewProfileMetadata | null;
}): Promise<EvidenceInspection> {
  const evidenceDirectory = path.resolve(input.evidenceDirectory);
  const displayPath = input.displayPath ?? input.evidenceDirectory;

  if (!existsSync(evidenceDirectory)) {
    throw new EvidenceInspectionError(`Evidence directory does not exist: ${displayPath}`);
  }

  const manifestPath = path.join(evidenceDirectory, evidenceManifestFileName);
  if (!existsSync(manifestPath)) {
    throw new EvidenceInspectionError(`Missing v0.3 evidence manifest: ${evidenceManifestFileName}`);
  }

  const manifestRead = await readJsonFile<EvidenceManifest>(
    evidenceDirectory,
    evidenceManifestFileName
  );
  if (!manifestRead.value) {
    throw new EvidenceInspectionError(
      `Unable to inspect evidence pack because ${evidenceManifestFileName} is ${manifestRead.status}.`
    );
  }

  const [
    task,
    plan,
    toolCalls,
    policyDecisions,
    blockedActions,
    commandResults,
    guardResults,
    finalReport
  ] = await Promise.all([
    readJsonFile<TaskEvidence>(evidenceDirectory, "task.json"),
    readJsonFile<PlanEvidence>(evidenceDirectory, "plan.json"),
    readJsonlFile<ToolCallEvidenceEvent>(evidenceDirectory, "tool-calls.jsonl"),
    readJsonlFile<Record<string, unknown>>(evidenceDirectory, "policy-decisions.jsonl"),
    readJsonlFile<BlockedActionEvidenceEvent>(evidenceDirectory, "blocked-actions.jsonl"),
    readJsonlFile<CommandResultEvidenceEvent>(evidenceDirectory, "command-results.jsonl"),
    readJsonFile<GuardAdapterResult>(evidenceDirectory, "guard-results.json"),
    readTextFile(evidenceDirectory, "final-report.md")
  ]);

  const manifestErrors = await verifyManifestForInspection(evidenceDirectory, manifestRead.value, task.value);
  const toolNames = Array.from(
    new Set((toolCalls.value ?? []).map((event) => event.tool_name))
  ).sort((left, right) => left.localeCompare(right));

  return {
    schema_version: "v0.3",
    inspector_version: "v0.3",
    review_posture: "review_artifact_only",
    evidence_dir: displayPath,
    review_profile: input.reviewProfile ?? null,
    manifest: {
      present: true,
      valid: manifestErrors.length === 0,
      file_count: manifestRead.value.files.length,
      errors: manifestErrors
    },
    task: {
      present: task.status === "present",
      task_id: task.value?.task_id ?? null,
      summary: task.value?.user_prompt ?? null
    },
    plan: {
      present: plan.status === "present",
      step_count: plan.value?.steps.length ?? 0,
      planner: plan.value?.planner ?? null
    },
    tools: {
      tool_call_count: toolCalls.value?.length ?? 0,
      tool_names: toolNames
    },
    policy: {
      policy_decision_count: policyDecisions.value?.length ?? 0,
      blocked_action_count: blockedActions.value?.length ?? 0
    },
    commands: {
      command_result_count: commandResults.value?.length ?? 0
    },
    guard: {
      guard_results_present: guardResults.status === "present",
      guard_available: guardResults.value?.guard_available ?? null
    },
    final_report: {
      present: finalReport.status === "present"
    },
    boundary: {
      approval: false,
      enforcement: false,
      autonomous_execution: false,
      authority_grant: false,
      runtime_control_plane: false
    }
  };
}

export function renderEvidenceInspectionJson(inspection: EvidenceInspection): string {
  return `${JSON.stringify(inspection, null, 2)}\n`;
}

export function renderEvidenceInspectionMarkdown(inspection: EvidenceInspection): string {
  return `# Evidence Inspection Summary

## Review Posture

This summary is a local deterministic read-only review artifact. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and grants no authority.

No provider output can authorize execution. There is no Guard runtime semantic change.

${renderReviewProfileMarkdown(inspection)}

## Manifest

- Present: ${inspection.manifest.present ? "yes" : "no"}
- Valid: ${inspection.manifest.valid ? "yes" : "no"}
- File count: ${inspection.manifest.file_count}
- Errors: ${inspection.manifest.errors.length > 0 ? inspection.manifest.errors.join("; ") : "none"}

## Task

- Task ID: ${inspection.task.task_id ?? "not recorded"}
- Summary: ${inspection.task.summary ?? "not recorded"}

## Plan

- Present: ${inspection.plan.present ? "yes" : "no"}
- Planner: ${inspection.plan.planner ?? "not recorded"}
- Step count: ${inspection.plan.step_count}

## Tool Calls

- Total tool calls: ${inspection.tools.tool_call_count}
- Tool names: ${inspection.tools.tool_names.length > 0 ? inspection.tools.tool_names.join(", ") : "none"}

## Policy Decisions

- Policy decisions: ${inspection.policy.policy_decision_count}

## Blocked Actions

- Blocked actions: ${inspection.policy.blocked_action_count}

## Command Results

- Command results: ${inspection.commands.command_result_count}

## Guard Results

- Present: ${inspection.guard.guard_results_present ? "yes" : "no"}
- Guard available: ${inspection.guard.guard_available === null ? "not recorded" : inspection.guard.guard_available ? "yes" : "no"}

## Final Report

- Present: ${inspection.final_report.present ? "yes" : "no"}

## Boundary

- Evidence-first local read-only inspection.
- Review artifact only.
- Not approval.
- Not enforcement.
- Not autonomous execution.
- Not a runtime control plane.
- No authority grant.
- No provider output can authorize execution.
- No Guard runtime semantic change.
`;
}

function renderReviewProfileMarkdown(inspection: EvidenceInspection): string {
  const profile = inspection.review_profile;
  if (!profile) {
    return "## Review Profile\n\n- Selected: none";
  }

  const verifierList = profile.expected_verifiers.map((command) => `  - ${command}`).join("\n");
  const evidenceList = profile.required_evidence_files
    .map((entry) => `  - ${entry.path} (${entry.required ? "required" : "optional"}): ${entry.role}`)
    .join("\n");
  const sectionList = profile.review_sections
    .map((section) => `  - ${section.section_id}: ${section.focus}`)
    .join("\n");

  return `## Review Profile

- Selected: ${profile.profile_id}
- Display name: ${profile.display_name}
- Description: ${profile.description}
- Intended context: ${profile.intended_context}
- Expected verifiers are declarative references only and are not executed by inspection.
- Profile boundaries: not approval, not enforcement, not blocking, not deployment authority, not runtime execution control, not a runtime control plane, and no authority grant.

Expected verifiers:
${verifierList}

Required evidence files:
${evidenceList}

Review sections:
${sectionList}`;
}

async function verifyManifestForInspection(
  evidenceDirectory: string,
  manifest: EvidenceManifest,
  task: TaskEvidence | null
): Promise<string[]> {
  const errors: string[] = [];
  const requiredManifestFiles = [
    "blocked-actions.jsonl",
    "command-results.jsonl",
    "final-report.md",
    "guard-results.json",
    "plan.json",
    "task.json",
    "tool-calls.jsonl"
  ];

  if (manifest.schema_version !== evidenceManifestSchemaVersion) {
    errors.push(`manifest schema_version must be ${evidenceManifestSchemaVersion}`);
  }
  if (manifest.evidence_pack_version !== evidencePackVersion) {
    errors.push(`manifest evidence_pack_version must be ${evidencePackVersion}`);
  }
  if (manifest.created_by !== evidenceManifestCreatedBy) {
    errors.push(`manifest created_by must be ${evidenceManifestCreatedBy}`);
  }
  if (task && manifest.task_id !== task.task_id) {
    errors.push("manifest task_id must match task.json task_id");
  }

  const paths = manifest.files.map((entry) => entry.path);
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(paths) !== JSON.stringify(sortedPaths)) {
    errors.push("manifest files must be sorted by path");
  }

  for (const requiredFile of requiredManifestFiles) {
    if (!paths.includes(requiredFile)) {
      errors.push(`manifest missing required file entry: ${requiredFile}`);
    }
  }

  for (const entry of manifest.files) {
    if (path.isAbsolute(entry.path) || entry.path.includes("\\") || entry.path.split("/").includes("..")) {
      errors.push(`manifest path must be local and relative: ${entry.path}`);
      continue;
    }

    const filePath = path.join(evidenceDirectory, entry.path);
    if (!existsSync(filePath)) {
      errors.push(`manifest references missing file: ${entry.path}`);
      continue;
    }

    const fileStat = await stat(filePath);
    const fileBytes = await readFile(filePath);
    const expectedHash = createHash("sha256").update(fileBytes).digest("hex");
    if (entry.size_bytes !== fileStat.size) {
      errors.push(`manifest size mismatch for ${entry.path}`);
    }
    if (entry.sha256 !== expectedHash) {
      errors.push(`manifest sha256 mismatch for ${entry.path}`);
    }
  }

  return errors;
}
