/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { verifyEvidencePack } from "./verify_v0_3_evidence_pack_contract.mjs";

const artifactDirectory = ".artifacts/v0.4-ci-evidence-smoke";

async function main() {
  const repoRoot = process.cwd();
  const cliPath = path.join(repoRoot, "dist", "cli.js");
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-v0-4-ci-smoke-"));
  const absoluteArtifactDirectory = path.join(repoRoot, artifactDirectory);

  assert(existsSync(cliPath), "dist/cli.js must exist. Run npm run build before this verifier.");

  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, "README.md"), "# v0.4 CI Evidence Smoke\n", "utf8");
  await rm(absoluteArtifactDirectory, { recursive: true, force: true });
  await mkdir(absoluteArtifactDirectory, { recursive: true });

  const { GuardAdapter } = await import(pathToFileURL(path.join(repoRoot, "dist/guard/adapter.js")));
  const { runTask } = await import(pathToFileURL(path.join(repoRoot, "dist/task/runner.js")));

  const unavailableGuardAdapter = new GuardAdapter(async () => {
    throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
  });

  const result = await runTask("Run v0.4 CI evidence artifact smoke check", {
    workspaceRoot,
    now: new Date("2026-06-04T00:00:00.000Z"),
    randomId: "v04cismoke",
    guardAdapter: unavailableGuardAdapter
  });

  assert(result.task.planner_provider === "mock", "smoke check must use the default mock planner path.");
  assert(result.task.planner_model === null, "smoke check must not use a model.");
  assert(
    existsSync(path.join(result.evidenceDirectory, "evidence-manifest.json")),
    "generated evidence pack must include evidence-manifest.json."
  );

  const verification = await verifyEvidencePack(result.evidenceDirectory);
  if (!verification.valid) {
    throw new Error(`generated evidence pack failed v0.3 verification:\n${verification.errors.join("\n")}`);
  }

  const json = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    result.evidenceDirectory,
    "--json"
  ]);
  const markdown = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    result.evidenceDirectory,
    "--markdown"
  ]);
  const secondJson = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    result.evidenceDirectory,
    "--json"
  ]);

  assert(json.stdout === secondJson.stdout, "JSON inspection output must be deterministic.");

  const parsedInspection = JSON.parse(json.stdout);
  assert(parsedInspection.schema_version === "v0.3", "JSON inspection output must use v0.3 schema version.");
  assert(parsedInspection.manifest.valid === true, "JSON inspection output must report a valid manifest.");
  assert(parsedInspection.boundary.approval === false, "JSON inspection output must not imply approval.");
  assert(markdown.stdout.includes("# Evidence Inspection Summary"), "Markdown inspection output missing heading.");
  assert(markdown.stdout.includes("Not approval."), "Markdown inspection output must preserve review posture.");
  assert(
    markdown.stdout.includes("No provider output can authorize execution."),
    "Markdown inspection output must preserve provider authority boundary."
  );

  await writeFile(path.join(absoluteArtifactDirectory, "evidence-inspection.json"), json.stdout, "utf8");
  await writeFile(path.join(absoluteArtifactDirectory, "evidence-inspection.md"), markdown.stdout, "utf8");

  console.log("v0.4 CI evidence artifact smoke verification passed.");
  console.log("");
  console.log(`- Evidence Pack: ${result.relativeEvidenceDirectory}`);
  console.log(`- Review artifact directory: ${artifactDirectory}`);
  console.log("- generated evidence pack includes evidence-manifest.json");
  console.log("- generated evidence pack passes v0.3 local verification");
  console.log("- deterministic JSON inspection output written");
  console.log("- deterministic Markdown inspection output written");
  console.log("- evidence-first local deterministic CI-verifiable review artifact");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
  console.log("- no provider output can authorize execution");
}

function runCli(repoRoot, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(`Command failed: ${process.execPath} ${args.join(" ")}\n${stderr.trim()}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.4 CI evidence artifact smoke verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
