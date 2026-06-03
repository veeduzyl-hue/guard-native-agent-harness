/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const requiredDocs = [
  "docs/RELEASE_NOTES_v0.1.md",
  "docs/V0_1_TAG_PREP.md",
  "docs/V0_1_ACCEPTANCE.md",
  "docs/V0_1_BASELINE.md",
  "docs/ROADMAP.md"
];

async function main() {
  const repoRoot = process.cwd();
  const checks = [];

  for (const filePath of requiredDocs) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required release document: ${filePath}`);
  }
  checks.push("required v0.1 release documents exist");

  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert(
    ["0.1.0", "0.2.0", "0.2.1", "0.3.0"].includes(packageJson.version),
    "package.json version must be a supported release-prep version"
  );
  assert(packageJson.scripts?.["verify:v0.1"], "package.json must include npm run verify:v0.1");
  assert(packageJson.scripts?.["verify:v0.1:release"], "package.json must include npm run verify:v0.1:release");
  checks.push("package metadata and v0.1 scripts are present");

  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  for (const filePath of requiredDocs) {
    assert(readme.includes(filePath), `README should link to ${filePath}`);
  }
  assert(readme.includes("v0.1 Release Readiness"), "README should include v0.1 release readiness section");
  checks.push("README links release readiness documents");

  const ignoredEvidence = await runCommand("git", ["check-ignore", ".evidence/"], repoRoot, {
    allowFailure: true
  });
  assert(ignoredEvidence.exitCode === 0, ".evidence/ must be ignored by git");

  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git");
  checks.push(".evidence/ is ignored and no generated evidence is tracked");

  const existingTag = await runCommand("git", ["tag", "--list", "v0.1.0"], repoRoot);
  checks.push(existingTag.stdout.trim() === "v0.1.0" ? "v0.1.0 tag exists locally" : "v0.1.0 tag is not present locally");

  console.log("v0.1 release readiness verification passed.");
  console.log("");
  for (const check of checks) {
    console.log(`- ${check}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCommand(executable, args, cwd, options = {}) {
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
      if (exitCode !== 0 && !options.allowFailure) {
        reject(new Error(`Command failed: ${executable} ${args.join(" ")}\n${stderr.trim()}`));
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}

main().catch((error) => {
  console.error("v0.1 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
