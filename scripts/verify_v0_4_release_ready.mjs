/* global console */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.4.0";
const requiredDocs = [
  "docs/RELEASE_NOTES_v0.4.md",
  "docs/V0_4_FINAL_RELEASE_GATE.md",
  "docs/V0_4_TAG_PREP.md"
];
const requiredFiles = [
  ".github/workflows/verification.yml",
  "scripts/verify_v0_4_ci_workflow.mjs",
  "scripts/verify_v0_4_ci_evidence_artifact_smoke.mjs"
];
const requiredScripts = {
  "verify:v0.4:ci-workflow": "node scripts/verify_v0_4_ci_workflow.mjs",
  "verify:v0.4:ci-evidence-artifact": "node scripts/verify_v0_4_ci_evidence_artifact_smoke.mjs",
  "verify:v0.4:release": "node scripts/verify_v0_4_release_ready.mjs"
};
const expectedDependencies = {
  commander: "13.0.0"
};
const expectedDevDependencies = {
  "@eslint/js": "9.39.4",
  "@types/node": "22.10.2",
  eslint: "9.39.4",
  prettier: "3.4.2",
  typescript: "5.7.2",
  "typescript-eslint": "8.18.2",
  vite: "6.4.2",
  vitest: "4.1.7"
};
const requiredBoundaryLanguage = [
  "not approval",
  "not enforcement",
  "not autonomous execution",
  "not a runtime control plane",
  "no authority grant"
];
const requiredReleaseLanguage = [
  "evidence-first",
  "local",
  "deterministic",
  "CI-verifiable",
  "review artifact",
  "No provider output can authorize execution",
  "no Guard runtime semantic change"
];
const forbiddenReleaseClaims = [
  "app" + "roved",
  "cert" + "ified",
  "compl" + "iant",
  ["safe", "to", "deploy"].join(" "),
  ["safe", "to", "merge"].join(" "),
  ["production", "ready"].join(" "),
  ["authorization", "granted"].join(" ")
];
const forbiddenWorkflowFragments = [
  "secrets.",
  "secrets:",
  ["OPENAI", "API", "KEY"].join("_"),
  ["DEEPSEEK", "API", "KEY"].join("_"),
  ["API", "KEY"].join("_"),
  "OPENAI",
  "DEEPSEEK",
  "OLLAMA",
  "openai",
  "deepseek",
  "ollama",
  ["git", "tag"].join(" "),
  ["git", "push"].join(" "),
  "refs/tags",
  ["gh", "release"].join(" "),
  "create-release",
  "action-gh-release",
  ["npm", "publish"].join(" ")
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageLockPath = path.join(repoRoot, "package-lock.json");
  const packageLock = existsSync(packageLockPath) ? JSON.parse(await readFile(packageLockPath, "utf8")) : null;
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/verification.yml"), "utf8");

  verifyPackageVersion(packageJson, packageLock);
  verifyFiles(repoRoot, requiredDocs, "v0.4 release doc");
  verifyFiles(repoRoot, requiredFiles, "v0.4 release surface");
  verifyScripts(packageJson);
  verifyDependencies(packageJson, packageLock);
  verifyWorkflow(workflow);
  await verifyReleaseDocs(repoRoot);
  await verifyNoEnvLoadingText(repoRoot);
  await verifyReleaseVerifierBoundary(repoRoot);

  console.log("v0.4 release readiness verification passed.");
  console.log("");
  console.log("- package root metadata pinned to 0.4.0");
  console.log("- v0.4 release docs present");
  console.log("- v0.4 workflow, workflow verifier, and smoke verifier present");
  console.log("- v0.4 package scripts present");
  console.log("- workflow boundary and bounded artifact upload confirmed");
  console.log("- boundary language preserved");
  console.log("- no new dependency versions detected");
  console.log("- no provider, Guard CLI, network, .env, tag, release, or publish action required");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(packageJson.version === releaseVersion, "package.json version must be 0.4.0.");
  if (!packageLock) {
    return;
  }

  assert(packageLock.version === releaseVersion, "package-lock.json top-level version must be 0.4.0.");
  assert(
    packageLock.packages?.[""]?.version === releaseVersion,
    "package-lock.json root package version must be 0.4.0."
  );
}

function verifyFiles(repoRoot, filePaths, label) {
  for (const filePath of filePaths) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required ${label}: ${filePath}`);
  }
}

function verifyScripts(packageJson) {
  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    assert(packageJson.scripts?.[scriptName] === expectedCommand, `${scriptName} must run ${expectedCommand}.`);
  }
}

function verifyDependencies(packageJson, packageLock) {
  assertExactVersions(packageJson.dependencies ?? {}, expectedDependencies, "dependencies");
  assertExactVersions(packageJson.devDependencies ?? {}, expectedDevDependencies, "devDependencies");

  if (!packageLock) {
    return;
  }

  const rootPackage = packageLock.packages?.[""] ?? {};
  assertExactVersions(rootPackage.dependencies ?? {}, expectedDependencies, "package-lock.json root dependencies");
  assertExactVersions(rootPackage.devDependencies ?? {}, expectedDevDependencies, "package-lock.json root devDependencies");

  for (const [packageName, expectedVersion] of Object.entries({
    ...expectedDependencies,
    ...expectedDevDependencies
  })) {
    const lockEntry = packageLock.packages?.[`node_modules/${packageName}`];
    assert(lockEntry?.version === expectedVersion, `${packageName} lock entry must be ${expectedVersion}.`);
  }
}

function verifyWorkflow(workflow) {
  assert(/^\s{2}contents: read\s*$/m.test(workflow), "workflow must set contents: read.");
  assert(
    /^\s{10}fetch-depth: 0\s*$/m.test(workflow) || workflow.includes("git fetch --force --tags"),
    "workflow must prevent shallow checkout tag loss."
  );
  assert(workflow.includes("npm run verify:v0.4:ci-workflow"), "workflow must run verify:v0.4:ci-workflow.");
  assert(
    workflow.includes("npm run verify:v0.4:ci-evidence-artifact"),
    "workflow must run verify:v0.4:ci-evidence-artifact."
  );

  for (const fragment of forbiddenWorkflowFragments) {
    assert(!workflow.includes(fragment), `workflow must not contain forbidden fragment: ${fragment}`);
  }

  if (workflow.includes("actions/upload-artifact")) {
    assert(workflow.includes("name: v0.4-ci-evidence-smoke"), "workflow artifact name must be bounded.");
    assert(
      workflow.includes("path: .artifacts/v0.4-ci-evidence-smoke/"),
      "workflow artifact path must be bounded."
    );
    assert(workflow.includes("retention-days: 7"), "workflow artifact retention must be 7 days.");
    assert(!/^\s{10}path: \.\s*$/m.test(workflow), "workflow must not upload the full repository.");
    assert(!workflow.includes("node_modules"), "workflow must not upload node_modules.");
  }
}

async function verifyReleaseDocs(repoRoot) {
  const docs = await Promise.all(
    requiredDocs.map(async (filePath) => ({
      filePath,
      content: await readFile(path.join(repoRoot, filePath), "utf8")
    }))
  );

  for (const { filePath, content } of docs) {
    for (const phrase of requiredBoundaryLanguage) {
      assert(content.includes(phrase), `${filePath} must include boundary phrase: ${phrase}`);
    }

    for (const phrase of forbiddenReleaseClaims) {
      assert(!content.toLowerCase().includes(phrase), `${filePath} contains forbidden release claim: ${phrase}`);
    }
  }

  const combined = docs.map((doc) => doc.content).join("\n");
  for (const phrase of requiredReleaseLanguage) {
    assert(combined.includes(phrase), `v0.4 release docs must include: ${phrase}`);
  }
  assert(combined.includes("SaaS"), "v0.4 release docs must preserve the SaaS boundary.");
  assert(combined.includes("dashboard"), "v0.4 release docs must preserve the dashboard boundary.");
  assert(combined.includes("OAuth"), "v0.4 release docs must preserve the OAuth boundary.");
  assert(combined.includes("pricing"), "v0.4 release docs must preserve the pricing boundary.");
  assert(combined.includes("license"), "v0.4 release docs must preserve the license boundary.");
  assert(combined.includes("checkout"), "v0.4 release docs must preserve the checkout boundary.");
  assert(combined.includes("Paddle"), "v0.4 release docs must preserve the Paddle boundary.");
}

async function verifyNoEnvLoadingText(repoRoot) {
  const filesToScan = [
    "scripts/verify_v0_4_release_ready.mjs",
    "docs/RELEASE_NOTES_v0.4.md",
    "docs/V0_4_FINAL_RELEASE_GATE.md",
    "docs/V0_4_TAG_PREP.md",
    "package.json"
  ];

  for (const filePath of filesToScan) {
    const content = await readFile(path.join(repoRoot, filePath), "utf8");
    assert(!content.includes(["dotenv", "config"].join(".")), `${filePath} must not load dotenv.`);
    assert(!content.includes(`readFileSync("${[".", "env"].join("")}"`), `${filePath} must not load .env.`);
    assert(!content.includes(`readFile("${[".", "env"].join("")}"`), `${filePath} must not load .env.`);
  }
}

async function verifyReleaseVerifierBoundary(repoRoot) {
  const script = await readFile(path.join(repoRoot, "scripts/verify_v0_4_release_ready.mjs"), "utf8");
  const forbiddenFragments = [
    "sp" + "awn(",
    "exec" + "File(",
    ["guard", "audit"].join(" "),
    ["guard", "status"].join(" "),
    ["guard", "drift"].join(" "),
    ["OPENAI", "API", "KEY"].join("_"),
    ["DEEPSEEK", "API", "KEY"].join("_"),
    "fet" + "ch(",
    "write" + "File(",
    "append" + "File(",
    ["npm", "publish"].join(" ")
  ];

  for (const fragment of forbiddenFragments) {
    assert(!script.includes(fragment), `v0.4 release verifier boundary violation: ${fragment}`);
  }
}

function assertExactVersions(actual, expected, label) {
  assert(
    JSON.stringify(sortRecord(actual)) === JSON.stringify(sortRecord(expected)),
    `${label} must match the v0.4 release baseline.`
  );
}

function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.4 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
