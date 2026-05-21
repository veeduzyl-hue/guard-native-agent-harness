import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderFinalReportFromEvidence } from "../src/evidence/report.js";
import { writeFinalReport } from "../src/evidence/writer.js";

async function makeEvidenceDirectory(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeCompleteEvidence(evidenceDirectory: string): Promise<void> {
  await writeJson(path.join(evidenceDirectory, "task.json"), {
    task_id: "task-report-1",
    created_at: "2026-05-20T05:00:00.000Z",
    user_prompt: "Create a safe README update proposal",
    workspace_root: "D:\\AI project\\guard-native-agent-harness",
    harness_version: "0.0.0",
    mode: "local",
    planner_type: "placeholder"
  });
  await writeJson(path.join(evidenceDirectory, "plan.json"), {
    task_id: "task-report-1",
    planner: "placeholder",
    steps: [
      {
        id: "step-1",
        type: "placeholder",
        description: "Review evidence files."
      }
    ],
    risk_notes: ["No autonomous execution."],
    expected_outputs: ["task.json", "plan.json", "final-report.md"],
    provider_diagnostics: {
      normalization_applied: true,
      normalization_changes: ["added missing step id for step index 0"],
      normalization_warnings: [],
      plan_validated: true
    }
  });
  await writeFile(
    path.join(evidenceDirectory, "tool-calls.jsonl"),
    `${JSON.stringify({
      event_id: "event-tool",
      task_id: "task-report-1",
      timestamp: "2026-05-20T05:01:00.000Z",
      tool_name: "read_file",
      input: { path: "README.md" },
      risk_level: "low",
      policy_decision: "allow",
      status: "success",
      output_summary: { path: "README.md", bytes: 1200 },
      duration_ms: 12
    })}\n`,
    "utf8"
  );
  await writeFile(
    path.join(evidenceDirectory, "blocked-actions.jsonl"),
    `${JSON.stringify({
      event_id: "event-block",
      task_id: "task-report-1",
      timestamp: "2026-05-20T05:02:00.000Z",
      requested_tool: "read_file",
      requested_input: { path: ".env" },
      block_reason: "Reading .env files is blocked.",
      matched_rule: "block-env-read",
      severity: "high"
    })}\n`,
    "utf8"
  );
  await writeFile(
    path.join(evidenceDirectory, "command-results.jsonl"),
    `${JSON.stringify({
      event_id: "event-command",
      task_id: "task-report-1",
      timestamp: "2026-05-20T05:03:00.000Z",
      command: "node --version",
      cwd: "D:\\AI project\\guard-native-agent-harness",
      exit_code: 0,
      stdout_summary: "v24.14.0",
      stderr_summary: "",
      duration_ms: 42,
      status: "success"
    })}\n`,
    "utf8"
  );
  await writeJson(path.join(evidenceDirectory, "guard-results.json"), {
    guard_available: false,
    reason: "Guard CLI not found",
    commands_attempted: [],
    status_result: null,
    audit_result: null,
    drift_result: null,
    errors: []
  });
  await writeFile(
    path.join(evidenceDirectory, "file-changes.diff"),
    "diff --git a/README.md b/README.md\n",
    "utf8"
  );
  await writeFile(path.join(evidenceDirectory, "final-report.md"), "", "utf8");
}

describe("final report renderer", () => {
  it("renders a complete evidence pack into the required governance report sections", async () => {
    const evidenceDirectory = await makeEvidenceDirectory("guard-agent-report-complete-");
    await writeCompleteEvidence(evidenceDirectory);

    const report = await renderFinalReportFromEvidence(evidenceDirectory);

    expect(report).toContain("# Guard-native Agent Harness Report");
    expect(report).toContain("## 1. Task Summary");
    expect(report).toContain("## 2. Plan Summary");
    expect(report).toContain("## 3. Evidence Pack Contents");
    expect(report).toContain("## 4. Tool Calls");
    expect(report).toContain("## 5. Blocked Actions");
    expect(report).toContain("## 6. Command Results");
    expect(report).toContain("## 7. Guard Results");
    expect(report).toContain("## 8. File Changes");
    expect(report).toContain("## 9. Governance Notes");
    expect(report).toContain("## 10. Runtime Boundary");
    expect(report).toContain("## 11. Limitations");
    expect(report).toContain("- Task ID: task-report-1");
    expect(report).toContain("- Step count: 1");
    expect(report).toContain("Provider diagnostics:");
    expect(report).toContain("- Normalization applied: yes");
    expect(report).toContain("- Plan validated: yes");
    expect(report).toContain("- Total tool calls: 1");
    expect(report).toContain("- Total blocked actions: 1");
    expect(report).toContain("- Total command executions: 1");
    expect(report).toContain(
      "Guard CLI was not available. The run completed with graceful fallback."
    );
    expect(report).toContain("File diff summary:");
    expect(report).toContain(
      "Guard results are recorded as evidence only. They do not grant execution authority."
    );
  });

  it("reports empty JSONL files clearly", async () => {
    const evidenceDirectory = await makeEvidenceDirectory("guard-agent-report-empty-");
    await writeCompleteEvidence(evidenceDirectory);
    await writeFile(path.join(evidenceDirectory, "tool-calls.jsonl"), "", "utf8");
    await writeFile(path.join(evidenceDirectory, "blocked-actions.jsonl"), "", "utf8");
    await writeFile(path.join(evidenceDirectory, "command-results.jsonl"), "", "utf8");

    const report = await renderFinalReportFromEvidence(evidenceDirectory);

    expect(report).toContain("No tool calls were recorded.");
    expect(report).toContain("No blocked actions were recorded.");
    expect(report).toContain("No command executions were recorded.");
  });

  it("does not crash when optional evidence files are missing", async () => {
    const evidenceDirectory = await makeEvidenceDirectory("guard-agent-report-missing-");
    await mkdir(evidenceDirectory, { recursive: true });
    await writeJson(path.join(evidenceDirectory, "task.json"), {
      task_id: "task-missing",
      created_at: "2026-05-20T05:00:00.000Z",
      user_prompt: "Missing evidence test",
      workspace_root: "workspace",
      harness_version: "0.0.0",
      mode: "local",
      planner_type: "placeholder"
    });

    const report = await renderFinalReportFromEvidence(evidenceDirectory);

    expect(report).toContain("| plan.json | missing |");
    expect(report).toContain("| guard-results.json | missing |");
    expect(report).toContain("Plan evidence is missing.");
    expect(report).toContain("Guard results evidence is missing.");
    expect(report).toContain("Missing evidence files:");
  });

  it("records malformed JSONL line warnings without crashing", async () => {
    const evidenceDirectory = await makeEvidenceDirectory("guard-agent-report-malformed-");
    await writeCompleteEvidence(evidenceDirectory);
    await writeFile(
      path.join(evidenceDirectory, "tool-calls.jsonl"),
      `${JSON.stringify({
        event_id: "event-ok",
        task_id: "task-report-1",
        timestamp: "2026-05-20T05:01:00.000Z",
        tool_name: "list_files",
        input: { path: "." },
        risk_level: "low",
        policy_decision: "allow",
        status: "success",
        output_summary: { path: ".", entries_count: 3 },
        duration_ms: 4
      })}\nnot-json\n`,
      "utf8"
    );

    const report = await renderFinalReportFromEvidence(evidenceDirectory);

    expect(report).toContain("Warning: tool-calls.jsonl contains malformed JSONL lines: 2.");
    expect(report).toContain(
      "Parse warnings: tool-calls.jsonl contains malformed JSONL at line 2."
    );
  });

  it("writes final-report.md with the Guard evidence-only boundary statement", async () => {
    const evidenceDirectory = await makeEvidenceDirectory("guard-agent-report-write-");
    await writeCompleteEvidence(evidenceDirectory);

    await writeFinalReport(
      evidenceDirectory,
      await renderFinalReportFromEvidence(evidenceDirectory)
    );
    const report = await readFile(path.join(evidenceDirectory, "final-report.md"), "utf8");

    expect(report).toContain(
      "Guard results are recorded as evidence only. They do not grant execution authority."
    );
    expect(report).not.toContain("execution_authority_granted: true");
  });
});
