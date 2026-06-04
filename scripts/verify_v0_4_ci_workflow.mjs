/* global console */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workflowPath = ".github/workflows/verification.yml";

const requiredCommands = [
  "npm run build",
  "npm test",
  "npm run lint",
  "npm run verify:v0.3:evidence",
  "npm run verify:v0.3:runtime-evidence",
  "npm run verify:v0.3:inspect-evidence",
  "npm run verify:v0.3:release",
  "npm run audit:summary",
  "npm run verify:v0.4:ci-workflow",
  "npm run verify:v0.4:ci-evidence-artifact"
];

const forbiddenFragments = [
  "secrets.",
  "secrets:",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "API_KEY",
  "OPENAI",
  "DEEPSEEK",
  "OLLAMA",
  "openai",
  "deepseek",
  "ollama",
  "git tag",
  "git push",
  "git push origin",
  "git push --tags",
  "refs/tags",
  "gh release",
  "gh release create",
  "gh release upload",
  "create-release",
  "action-gh-release",
  "npm publish"
];

async function main() {
  const repoRoot = process.cwd();
  const absoluteWorkflowPath = path.join(repoRoot, workflowPath);

  assert(existsSync(absoluteWorkflowPath), `${workflowPath} must exist.`);

  const workflow = await readFile(absoluteWorkflowPath, "utf8");
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  verifyPackageScript(packageJson);
  verifyTriggers(workflow);
  verifyPermissions(workflow);
  verifyTagAvailability(workflow);
  verifyForbiddenFragments(workflow);
  verifyCommands(workflow);
  verifyArtifactUploadBoundary(workflow);

  console.log("v0.4 CI workflow verification passed.");
  console.log("");
  console.log("- workflow exists: .github/workflows/verification.yml");
  console.log("- pull_request and main push triggers present");
  console.log("- contents: read permission confirmed");
  console.log("- checkout fetches full history and tags for historical baseline checks");
  console.log("- deterministic local verification commands present");
  console.log("- bounded v0.4 CI evidence artifact smoke command present");
  console.log("- no secrets, provider calls, release actions, tag pushes, or npm publish commands detected");
  console.log("- evidence-first local deterministic CI-verifiable review artifact boundary preserved");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
  console.log("- no provider output can authorize execution");
}

function verifyPackageScript(packageJson) {
  assert(
    packageJson.scripts?.["verify:v0.4:ci-workflow"] === "node scripts/verify_v0_4_ci_workflow.mjs",
    "package.json must include verify:v0.4:ci-workflow."
  );
}

function verifyTriggers(workflow) {
  assert(/^on:\s*$/m.test(workflow), "workflow must define triggers with on.");
  assert(/^\s{2}pull_request:\s*$/m.test(workflow), "workflow must include pull_request trigger.");
  assert(/^\s{2}push:\s*$/m.test(workflow), "workflow must include push trigger.");
  assert(/^\s{4}branches:\s*$/m.test(workflow), "workflow push trigger must define branches.");
  assert(/^\s{6}- main\s*$/m.test(workflow), "workflow push trigger must include main branch.");
}

function verifyPermissions(workflow) {
  assert(/^permissions:\s*$/m.test(workflow), "workflow must define permissions.");
  assert(/^\s{2}contents: read\s*$/m.test(workflow), "workflow must set contents: read.");
}

function verifyTagAvailability(workflow) {
  const fetchDepthZero = /^\s{10}fetch-depth: 0\s*$/m.test(workflow);
  const readOnlyTagFetch = workflow.includes("git fetch --force --tags");

  assert(
    fetchDepthZero || readOnlyTagFetch,
    "workflow must prevent shallow checkout tag loss with fetch-depth: 0 or git fetch --force --tags."
  );
}

function verifyForbiddenFragments(workflow) {
  for (const fragment of forbiddenFragments) {
    assert(!workflow.includes(fragment), `workflow must not contain forbidden fragment: ${fragment}`);
  }
}

function verifyCommands(workflow) {
  assert(workflow.includes("npm ci"), "workflow must install dependencies with npm ci.");

  for (const command of requiredCommands) {
    assert(workflow.includes(command), `workflow must include deterministic command: ${command}`);
  }
}

function verifyArtifactUploadBoundary(workflow) {
  if (!workflow.includes("actions/upload-artifact")) {
    return;
  }

  assert(
    workflow.includes("name: v0.4-ci-evidence-smoke"),
    "workflow artifact upload must use v0.4-ci-evidence-smoke as artifact name."
  );
  assert(
    workflow.includes("path: .artifacts/v0.4-ci-evidence-smoke/"),
    "workflow artifact upload path must be restricted to .artifacts/v0.4-ci-evidence-smoke/."
  );
  assert(workflow.includes("retention-days: 7"), "workflow artifact upload retention must be 7 days.");
  assert(!/^\s{10}path: \.\s*$/m.test(workflow), "workflow must not upload the full repository.");
  assert(!workflow.includes("node_modules"), "workflow must not upload node_modules.");
  assert(!workflow.includes("HOME"), "workflow must not upload hidden home directories.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.4 CI workflow verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
