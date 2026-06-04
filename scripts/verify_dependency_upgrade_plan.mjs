/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const requiredDocs = [
  "docs/DEPENDENCY_UPGRADE_SANDBOX_PLAN.md",
  "docs/DEPENDENCY_AUDIT_REVIEW.md",
  "docs/DEPENDENCY_REMEDIATION_DECISION.md"
];
const forbiddenDependencyNames = [
  "dotenv",
  "openai",
  "deepseek",
  "@openai/sdk",
  "@ai-sdk/openai",
  "@deepseek/sdk"
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  verifyDocs(repoRoot);
  verifyScripts(packageJson);
  verifyPackageMetadata(repoRoot, packageJson);
  verifyDependencies(packageJson);
  await verifyEvidenceNotTracked(repoRoot);

  console.log("dependency upgrade sandbox plan verification passed.");
  console.log("");
  console.log("- sandbox plan docs present");
  console.log("- remediation decision docs present");
  console.log("- dependency upgrade plan boundary checks passed");
  console.log("- no provider SDK / dotenv dependency detected");
  console.log(`- package version remains ${packageJson.version}`);
}

function verifyDocs(repoRoot) {
  for (const filePath of requiredDocs) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required dependency upgrade doc: ${filePath}`);
  }
}

function verifyScripts(packageJson) {
  assert(packageJson.scripts?.["audit:summary"], "package.json must include audit:summary.");
  assert(packageJson.scripts?.["verify:post-v0.2"], "package.json must include verify:post-v0.2.");
  assert(
    packageJson.scripts?.["verify:dependency-upgrade-plan"] ===
      "node scripts/verify_dependency_upgrade_plan.mjs",
    "package.json must include verify:dependency-upgrade-plan."
  );
}

function verifyPackageMetadata(repoRoot, packageJson) {
  assert(
    ["0.2.0", "0.2.1", "0.3.0", "0.4.0"].includes(packageJson.version),
    "package.json version must remain in a supported post-v0.2 release-prep line."
  );
  assert(existsSync(path.join(repoRoot, "package-lock.json")), "package-lock.json must exist.");
}

function verifyDependencies(packageJson) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  for (const packageName of forbiddenDependencyNames) {
    assert(!dependencies[packageName], `Forbidden dependency detected: ${packageName}`);
  }

  for (const packageName of Object.keys(dependencies)) {
    assert(!/^@?openai(?:\/|$)/.test(packageName), `OpenAI SDK dependency detected: ${packageName}`);
    assert(!/deepseek/i.test(packageName), `DeepSeek SDK dependency detected: ${packageName}`);
  }
}

async function verifyEvidenceNotTracked(repoRoot) {
  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCommand(executable, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
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
        reject(new Error(`Command failed: ${executable} ${args.join(" ")}\n${stderr.trim()}`));
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}

main().catch((error) => {
  console.error("dependency upgrade sandbox plan verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
