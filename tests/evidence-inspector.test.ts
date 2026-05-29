import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  EvidenceInspectionError,
  inspectEvidencePack,
  renderEvidenceInspectionJson,
  renderEvidenceInspectionMarkdown
} from "../src/evidence/inspector.js";

const validFixture = path.join(
  process.cwd(),
  "fixtures",
  "v0.3",
  "evidence-pack-valid-basic"
);

async function copyFixture(prefix: string): Promise<string> {
  const evidenceDirectory = await mkdtemp(path.join(tmpdir(), prefix));
  await cp(validFixture, evidenceDirectory, { recursive: true });
  return evidenceDirectory;
}

async function snapshotFiles(directory: string): Promise<Map<string, string>> {
  const files = [
    "blocked-actions.jsonl",
    "command-results.jsonl",
    "evidence-manifest.json",
    "final-report.md",
    "guard-results.json",
    "plan.json",
    "task.json",
    "tool-calls.jsonl"
  ];
  const snapshot = new Map<string, string>();

  for (const file of files) {
    snapshot.set(file, await readFile(path.join(directory, file), "utf8"));
  }

  return snapshot;
}

describe("v0.3 evidence inspector", () => {
  it("returns deterministic JSON output for a valid v0.3 evidence pack", async () => {
    const evidenceDirectory = await copyFixture("guard-agent-inspector-json-");

    const first = await inspectEvidencePack({
      evidenceDirectory,
      displayPath: "fixtures/v0.3/evidence-pack-valid-basic"
    });
    const second = await inspectEvidencePack({
      evidenceDirectory,
      displayPath: "fixtures/v0.3/evidence-pack-valid-basic"
    });
    const json = renderEvidenceInspectionJson(first);

    expect(json).toBe(renderEvidenceInspectionJson(second));
    expect(JSON.parse(json)).toMatchObject({
      schema_version: "v0.3",
      inspector_version: "v0.3",
      review_posture: "review_artifact_only",
      manifest: {
        present: true,
        valid: true,
        file_count: 7
      },
      task: {
        task_id: "task-v0-3-valid-basic",
        summary: "Review a local evidence pack."
      },
      plan: {
        present: true,
        step_count: 1,
        planner: "mock"
      },
      tools: {
        tool_call_count: 1,
        tool_names: ["list_files"]
      },
      policy: {
        policy_decision_count: 0,
        blocked_action_count: 0
      },
      boundary: {
        approval: false,
        enforcement: false,
        autonomous_execution: false,
        authority_grant: false,
        runtime_control_plane: false
      }
    });
  });

  it("returns deterministic Markdown output with review artifact boundary language", async () => {
    const evidenceDirectory = await copyFixture("guard-agent-inspector-markdown-");

    const inspection = await inspectEvidencePack({ evidenceDirectory });
    const markdown = renderEvidenceInspectionMarkdown(inspection);

    expect(markdown).toContain("# Evidence Inspection Summary");
    expect(markdown).toContain("## Review Posture");
    expect(markdown).toContain("## Manifest");
    expect(markdown).toContain("## Task");
    expect(markdown).toContain("## Plan");
    expect(markdown).toContain("## Tool Calls");
    expect(markdown).toContain("## Policy Decisions");
    expect(markdown).toContain("## Blocked Actions");
    expect(markdown).toContain("## Command Results");
    expect(markdown).toContain("## Guard Results");
    expect(markdown).toContain("## Final Report");
    expect(markdown).toContain("## Boundary");
    expect(markdown).toContain("Not approval.");
    expect(markdown).toContain("Not enforcement.");
    expect(markdown).toContain("Not autonomous execution.");
    expect(markdown).toContain("Not a runtime control plane.");
    expect(markdown).toContain("No authority grant.");
  });

  it("fails deterministically for a missing evidence directory", async () => {
    const missingDirectory = path.join(tmpdir(), "guard-agent-inspector-missing");
    await rm(missingDirectory, { force: true, recursive: true });

    await expect(
      inspectEvidencePack({
        evidenceDirectory: missingDirectory,
        displayPath: ".evidence/missing"
      })
    ).rejects.toThrow(EvidenceInspectionError);
    await expect(
      inspectEvidencePack({
        evidenceDirectory: missingDirectory,
        displayPath: ".evidence/missing"
      })
    ).rejects.toThrow("Evidence directory does not exist: .evidence/missing");
  });

  it("fails deterministically for a missing manifest", async () => {
    const evidenceDirectory = await mkdtemp(path.join(tmpdir(), "guard-agent-inspector-no-manifest-"));
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(path.join(evidenceDirectory, "task.json"), "{}\n", "utf8");

    await expect(inspectEvidencePack({ evidenceDirectory })).rejects.toThrow(
      "Missing v0.3 evidence manifest: evidence-manifest.json"
    );
  });

  it("does not mutate evidence files", async () => {
    const evidenceDirectory = await copyFixture("guard-agent-inspector-readonly-");
    const before = await snapshotFiles(evidenceDirectory);

    await inspectEvidencePack({ evidenceDirectory });
    renderEvidenceInspectionMarkdown(await inspectEvidencePack({ evidenceDirectory }));
    renderEvidenceInspectionJson(await inspectEvidencePack({ evidenceDirectory }));

    expect(await snapshotFiles(evidenceDirectory)).toEqual(before);
  });

  it("does not import task, provider, tool, Guard, environment, or credential surfaces", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "evidence", "inspector.ts"), "utf8");

    expect(source).not.toContain("../task/");
    expect(source).not.toContain("../agent/");
    expect(source).not.toContain("../tools/");
    expect(source).not.toContain("../guard/adapter");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("OPENAI_API_KEY");
    expect(source).not.toContain("DEEPSEEK_API_KEY");
    expect(source).not.toContain("reasoning_content");
    expect(source).not.toContain("chain-of-thought");
  });
});
