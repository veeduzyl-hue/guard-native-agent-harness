import { evidenceFileStatus, readJsonFile, readJsonlFile, readTextFile } from "./reader.js";
import type {
  BlockedActionEvidenceEvent,
  CommandResultEvidenceEvent,
  PlanEvidence,
  TaskEvidence,
  ToolCallEvidenceEvent
} from "./schema.js";
import type { GuardAdapterResult } from "../guard/types.js";

const requiredEvidenceFiles = [
  "task.json",
  "plan.json",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json",
  "evidence-manifest.json",
  "evidence-pack.json",
  "final-report.md"
];

const optionalEvidenceFiles = ["tool-report.md", "file-changes.diff"];

const diffMaxLength = 8000;

export async function renderFinalReportFromEvidence(evidenceDirectory: string): Promise<string> {
  const task = await readJsonFile<TaskEvidence>(evidenceDirectory, "task.json");
  const plan = await readJsonFile<PlanEvidence>(evidenceDirectory, "plan.json");
  const toolCalls = await readJsonlFile<ToolCallEvidenceEvent>(
    evidenceDirectory,
    "tool-calls.jsonl"
  );
  const blockedActions = await readJsonlFile<BlockedActionEvidenceEvent>(
    evidenceDirectory,
    "blocked-actions.jsonl"
  );
  const commandResults = await readJsonlFile<CommandResultEvidenceEvent>(
    evidenceDirectory,
    "command-results.jsonl"
  );
  const guardResults = await readJsonFile<GuardAdapterResult>(
    evidenceDirectory,
    "guard-results.json"
  );
  const fileChanges = await readTextFile(evidenceDirectory, "file-changes.diff");
  const requiredFileStatuses = await Promise.all(
    requiredEvidenceFiles.map(
      async (fileName) => [fileName, await evidenceFileStatus(evidenceDirectory, fileName)] as const
    )
  );
  const optionalFileStatuses = await Promise.all(
    optionalEvidenceFiles.map(
      async (fileName) => [fileName, await evidenceFileStatus(evidenceDirectory, fileName)] as const
    )
  );

  const warnings = [
    ...task.warnings,
    ...plan.warnings,
    ...toolCalls.warnings,
    ...blockedActions.warnings,
    ...commandResults.warnings,
    ...guardResults.warnings,
    ...fileChanges.warnings
  ];

  return `# Guard-native Agent Harness Report

## 1. Task Summary

${renderTaskSummary(task.value)}

## 2. Plan Summary

${renderPlanSummary(plan.value, plan.status)}

## 3. Evidence Pack Contents

${renderEvidenceContents(requiredFileStatuses, optionalFileStatuses)}

## 4. Tool Calls

${renderToolCalls(toolCalls.value ?? [], toolCalls.malformedLines)}

## 5. Blocked Actions

${renderBlockedActions(blockedActions.value ?? [], blockedActions.malformedLines)}

## 6. Command Results

${renderCommandResults(commandResults.value ?? [], commandResults.malformedLines)}

## 7. Guard Results

${renderGuardResults(guardResults.value, guardResults.status)}

Guard results are recorded as evidence only. They do not grant execution authority.

## 8. File Changes

${renderFileChanges(fileChanges.value, fileChanges.status)}

## 9. Governance Notes

${renderGovernanceNotes({
  blockedActions: blockedActions.value ?? [],
  commandResults: commandResults.value ?? [],
  guardResults: guardResults.value,
  fileStatuses: requiredFileStatuses,
  warnings
})}

## 10. Runtime Boundary

- Local-first execution and evidence capture.
- Registered tools only.
- Policy-gated tool execution.
- Command allowlist only.
- Guard Adapter output is evidence-only.
- Optional model providers propose plans only and do not grant execution authority.
- No SaaS, dashboard, OAuth, or background-agent behavior.

## 11. Limitations

- This report is based only on local evidence files.
- Missing evidence files reduce report completeness.
- Guard CLI may be unavailable.
- This report does not prove full compliance.
- This report does not grant execution authority.
- This report does not replace human review.
`;
}

function renderTaskSummary(task: TaskEvidence | null): string {
  if (!task) {
    return "Task metadata is missing or malformed.";
  }

  return [
    `- Task ID: ${task.task_id}`,
    `- Created at: ${task.created_at}`,
    `- User prompt: ${task.user_prompt}`,
    `- Workspace root: ${task.workspace_root}`,
    `- Harness version: ${task.harness_version}`,
    `- Mode: ${task.mode}`,
    `- Planner type: ${task.planner_type}`,
    `- Planner provider: ${task.planner_provider ?? task.planner_type}`,
    `- Planner model: ${task.planner_model ?? "none"}`
  ].join("\n");
}

function renderPlanSummary(plan: PlanEvidence | null, status: string): string {
  if (!plan) {
    return `Plan evidence is ${status}.`;
  }

  return [
    `- Planner: ${plan.planner}`,
    `- Provider: ${plan.provider ?? plan.planner}`,
    `- Model: ${plan.model ?? "none"}`,
    `- Step count: ${plan.steps.length}`,
    "",
    "Steps:",
    ...plan.steps.map(
      (step) => `- ${step.id}${step.tool ? ` (${step.tool})` : ""}: ${step.description}`
    ),
    "",
    "Risk notes:",
    ...(plan.risk_notes.length > 0
      ? plan.risk_notes.map((note) => `- ${note}`)
      : ["- None recorded."]),
    "",
    "Expected outputs:",
    ...(plan.expected_outputs.length > 0
      ? plan.expected_outputs.map((output) => `- ${output}`)
      : ["- None recorded."]),
    "",
    "Provider diagnostics:",
    ...renderProviderDiagnostics(plan)
  ].join("\n");
}

function renderProviderDiagnostics(plan: PlanEvidence): string[] {
  if (!plan.provider_diagnostics) {
    return ["- None recorded."];
  }

  const diagnostics = plan.provider_diagnostics;
  return [
    ...(diagnostics.provider ? [`- Provider: ${diagnostics.provider}`] : []),
    ...(diagnostics.model !== undefined ? [`- Model: ${diagnostics.model ?? "none"}`] : []),
    `- Normalization applied: ${diagnostics.normalization_applied ? "yes" : "no"}`,
    `- Plan validated: ${diagnostics.plan_validated ? "yes" : "no"}`,
    `- Normalization changes: ${
      diagnostics.normalization_changes.length > 0
        ? diagnostics.normalization_changes.join("; ")
        : "none"
    }`,
    `- Normalization warnings: ${
      diagnostics.normalization_warnings.length > 0
        ? diagnostics.normalization_warnings.join("; ")
        : "none"
    }`
  ];
}

function renderEvidenceContents(
  requiredFileStatuses: Array<readonly [string, "present" | "missing"]>,
  optionalFileStatuses: Array<readonly [string, "present" | "missing"]>
): string {
  return [
    "Required evidence files:",
    "",
    "| File | Status |",
    "|---|---|",
    ...requiredFileStatuses.map(([fileName, status]) => `| ${fileName} | ${status} |`),
    "",
    "Optional/generated artifacts:",
    ...optionalFileStatuses.map(([fileName, status]) => `- ${fileName}: ${status}`)
  ].join("\n");
}

function renderToolCalls(events: ToolCallEvidenceEvent[], malformedLines: number[]): string {
  const lines = renderMalformedWarning("tool-calls.jsonl", malformedLines);
  if (events.length === 0) {
    return [...lines, "No tool calls were recorded."].join("\n");
  }

  const byTool = countBy(events, (event) => event.tool_name);
  const byStatus = countBy(events, (event) => event.status);
  const byPolicy = countBy(events, (event) => event.policy_decision);

  return [
    ...lines,
    `- Total tool calls: ${events.length}`,
    `- Tools used: ${Object.keys(byTool).join(", ")}`,
    `- Count by tool: ${renderCounts(byTool)}`,
    `- Count by status: ${renderCounts(byStatus)}`,
    `- Policy decisions observed: ${renderCounts(byPolicy)}`,
    "",
    "| Time | Tool | Policy | Status | Summary |",
    "|---|---|---|---|---|",
    ...events.map(
      (event) =>
        `| ${event.timestamp} | ${event.tool_name} | ${event.policy_decision} | ${event.status} | ${summarizeRecord(
          event.output_summary ?? event.error_summary ?? {}
        )} |`
    )
  ].join("\n");
}

function renderBlockedActions(
  events: BlockedActionEvidenceEvent[],
  malformedLines: number[]
): string {
  const lines = renderMalformedWarning("blocked-actions.jsonl", malformedLines);
  if (events.length === 0) {
    return [...lines, "No blocked actions were recorded."].join("\n");
  }

  return [
    ...lines,
    `- Total blocked actions: ${events.length}`,
    `- Matched rules: ${renderCounts(countBy(events, (event) => event.matched_rule))}`,
    `- Severity counts: ${renderCounts(countBy(events, (event) => event.severity))}`,
    "",
    "| Time | Requested Tool | Rule | Severity | Reason |",
    "|---|---|---|---|---|",
    ...events.map(
      (event) =>
        `| ${event.timestamp} | ${event.requested_tool} | ${event.matched_rule} | ${event.severity} | ${event.block_reason} |`
    )
  ].join("\n");
}

function renderCommandResults(
  events: CommandResultEvidenceEvent[],
  malformedLines: number[]
): string {
  const lines = renderMalformedWarning("command-results.jsonl", malformedLines);
  if (events.length === 0) {
    return [...lines, "No command executions were recorded."].join("\n");
  }

  return [
    ...lines,
    `- Total command executions: ${events.length}`,
    `- Commands executed: ${[...new Set(events.map((event) => event.command))].join(", ")}`,
    `- Status counts: ${renderCounts(countBy(events, (event) => event.status))}`,
    `- Exit codes: ${renderCounts(countBy(events, (event) => String(event.exit_code)))}`,
    "",
    "| Time | Command | Exit Code | Status | Duration |",
    "|---|---|---:|---|---:|",
    ...events.map(
      (event) =>
        `| ${event.timestamp} | ${event.command} | ${event.exit_code ?? "null"} | ${event.status} | ${event.duration_ms} ms |`
    )
  ].join("\n");
}

function renderGuardResults(guard: GuardAdapterResult | null, status: string): string {
  if (!guard) {
    return `Guard results evidence is ${status}.`;
  }

  if (!guard.guard_available) {
    return [
      "Guard CLI was not available. The run completed with graceful fallback.",
      `- Reason: ${guard.reason ?? "not recorded"}`,
      `- Errors: ${guard.errors.length > 0 ? guard.errors.join("; ") : "none"}`
    ].join("\n");
  }

  return [
    "- Guard CLI available: true",
    `- Commands attempted: ${guard.commands_attempted.join(", ")}`,
    `- Status result: ${summarizeGuardCommand(guard.status_result)}`,
    `- Audit result: ${summarizeGuardCommand(guard.audit_result)}`,
    `- Drift result: ${summarizeGuardCommand(guard.drift_result)}`,
    `- Errors: ${guard.errors.length > 0 ? guard.errors.join("; ") : "none"}`
  ].join("\n");
}

function renderFileChanges(diff: string | null, status: string): string {
  if (!diff || status !== "present") {
    return "No file diff was recorded.";
  }

  if (diff.length <= diffMaxLength) {
    return ["File diff summary:", "", "```diff", diff.trimEnd(), "```"].join("\n");
  }

  return [
    "File diff summary (truncated):",
    "",
    "```diff",
    diff.slice(0, diffMaxLength).trimEnd(),
    "```",
    "",
    "Diff output was truncated."
  ].join("\n");
}

function renderGovernanceNotes(input: {
  blockedActions: BlockedActionEvidenceEvent[];
  commandResults: CommandResultEvidenceEvent[];
  guardResults: GuardAdapterResult | null;
  fileStatuses: Array<readonly [string, "present" | "missing"]>;
  warnings: string[];
}): string {
  const missingFiles = input.fileStatuses
    .filter(([, status]) => status === "missing")
    .map(([fileName]) => fileName);
  const highSeverityBlocks = input.blockedActions.filter(
    (event) => event.severity === "high"
  ).length;
  const failedCommands = input.commandResults.filter((event) => event.status !== "success").length;

  return [
    `- Policy gate produced blocked actions: ${input.blockedActions.length > 0 ? "yes" : "no"}`,
    `- Commands were executed: ${input.commandResults.length > 0 ? "yes" : "no"}`,
    `- Guard was available: ${input.guardResults?.guard_available === true ? "yes" : "no"}`,
    `- Evidence files complete: ${missingFiles.length === 0 ? "yes" : "no"}`,
    `- Missing evidence files: ${missingFiles.length > 0 ? missingFiles.join(", ") : "none"}`,
    `- Command failures or timeouts: ${failedCommands}`,
    `- High-severity blocks: ${highSeverityBlocks}`,
    `- Parse warnings: ${input.warnings.length > 0 ? input.warnings.join("; ") : "none"}`
  ].join("\n");
}

function renderMalformedWarning(fileName: string, malformedLines: number[]): string[] {
  return malformedLines.length > 0
    ? [`Warning: ${fileName} contains malformed JSONL lines: ${malformedLines.join(", ")}.`]
    : [];
}

function summarizeGuardCommand(command: GuardAdapterResult["status_result"]): string {
  if (!command) {
    return "not recorded";
  }

  return `${command.status}, exit ${command.exit_code ?? "null"}, ${command.duration_ms} ms`;
}

function summarizeRecord(value: unknown): string {
  if (typeof value === "string") {
    return sanitizeTableCell(value);
  }

  if (!value || typeof value !== "object") {
    return String(value);
  }

  return sanitizeTableCell(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join(", ")
  );
}

function countBy<T>(values: T[], keyFn: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? entries.map(([key, count]) => `${key}: ${count}`).join(", ") : "none";
}

function sanitizeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ").slice(0, 300);
}
