/* global console */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

async function main() {
  const repoRoot = process.cwd();
  const cliPath = path.join(repoRoot, "dist", "cli.js");
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-v0-3-inspect-"));
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, "README.md"), "# Inspect Evidence Fixture\n", "utf8");

  const evidencePack = await runCli(repoRoot, [
    cliPath,
    "run",
    "Show a policy demo with blocked action"
  ], workspaceRoot);
  const evidenceDirectory = parseEvidencePackPath(evidencePack.stdout);

  if (!evidenceDirectory) {
    throw new Error("Could not locate generated Evidence Pack path.");
  }

  const json = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    path.join(workspaceRoot, evidenceDirectory),
    "--json"
  ]);
  const markdown = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    path.join(workspaceRoot, evidenceDirectory),
    "--markdown"
  ]);
  const secondJson = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    path.join(workspaceRoot, evidenceDirectory),
    "--json"
  ]);

  if (json.stdout !== secondJson.stdout) {
    throw new Error("inspect-evidence JSON output is not deterministic.");
  }

  const parsed = JSON.parse(json.stdout);
  assert(parsed.schema_version === "v0.3", "JSON output must use v0.3 schema version.");
  assert(parsed.manifest.valid === true, "Generated evidence manifest must verify as valid.");
  assert(parsed.policy.blocked_action_count === 2, "Generated unsafe demo should report blocked actions.");
  assert(parsed.boundary.approval === false, "JSON boundary must not imply approval.");
  assert(markdown.stdout.includes("# Evidence Inspection Summary"), "Markdown summary heading missing.");
  assert(markdown.stdout.includes("## Review Posture"), "Markdown review posture missing.");
  assert(markdown.stdout.includes("Not approval."), "Markdown boundary language missing.");
  assert(
    markdown.stdout.includes("No provider output can authorize execution."),
    "Markdown provider boundary missing."
  );

  const manifestBefore = await readFile(
    path.join(workspaceRoot, evidenceDirectory, "evidence-manifest.json"),
    "utf8"
  );
  await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    path.join(workspaceRoot, evidenceDirectory),
    "--markdown"
  ]);
  const manifestAfter = await readFile(
    path.join(workspaceRoot, evidenceDirectory, "evidence-manifest.json"),
    "utf8"
  );
  assert(manifestBefore === manifestAfter, "Inspector must not mutate evidence files.");

  console.log("v0.3 inspect-evidence verification passed.");
  console.log("");
  console.log("- deterministic JSON output verified");
  console.log("- deterministic Markdown output verified");
  console.log("- generated evidence pack inspected without mutation");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
}

function parseEvidencePackPath(stdout) {
  return stdout.match(/^Evidence Pack:\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function runCli(repoRoot, args, cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
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
  console.error("v0.3 inspect-evidence verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
