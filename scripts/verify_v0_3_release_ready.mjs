/* global console */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.3.0";
const supportedPackageVersions = [releaseVersion, "0.4.0", "0.4.1"];
const requiredDocs = [
  "docs/RELEASE_NOTES_v0.3.md",
  "docs/V0_3_FINAL_RELEASE_GATE.md",
  "docs/V0_3_TAG_PREP.md"
];
const requiredV03Files = [
  "docs/evidence/EVIDENCE_PACK_CONTRACT.md",
  "src/evidence/manifest.ts",
  "src/evidence/inspector.ts",
  "scripts/verify_v0_3_evidence_pack_contract.mjs",
  "scripts/verify_v0_3_runtime_evidence_manifest.mjs",
  "scripts/verify_v0_3_inspect_evidence.mjs"
];
const requiredScripts = {
  "verify:v0.3:evidence": "node scripts/verify_v0_3_evidence_pack_contract.mjs",
  "verify:v0.3:runtime-evidence": "node scripts/verify_v0_3_runtime_evidence_manifest.mjs",
  "verify:v0.3:inspect-evidence": "node scripts/verify_v0_3_inspect_evidence.mjs",
  "verify:v0.3:release": "node scripts/verify_v0_3_release_ready.mjs"
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
  vite: "6.4.3",
  vitest: "4.1.7"
};
const forbiddenDependencyNames = [
  "dotenv",
  "openai",
  "deepseek",
  "@openai/sdk",
  "@ai-sdk/openai",
  "@deepseek/sdk"
];
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
  "replayable",
  "review-oriented",
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
async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageLockPath = path.join(repoRoot, "package-lock.json");
  const packageLock = existsSync(packageLockPath) ? JSON.parse(await readFile(packageLockPath, "utf8")) : null;

  verifyPackageVersion(packageJson, packageLock);
  verifyFiles(repoRoot, requiredDocs, "v0.3 release doc");
  verifyFiles(repoRoot, requiredV03Files, "v0.3 release surface");
  verifyScripts(packageJson);
  verifyDependencies(packageJson, packageLock);
  await verifyReleaseDocs(repoRoot);
  await verifyNoEnvLoadingText(repoRoot);
  await verifyReleaseVerifierBoundary(repoRoot);

  console.log("v0.3 release readiness verification passed.");
  console.log("");
  console.log("- v0.3 package scripts present");
  console.log("- v0.3 release docs present");
  console.log("- v0.3 evidence contract, manifest, and inspector surfaces present");
  console.log("- v0.3 verification scripts present");
  console.log(`- package root metadata accepted: ${packageJson.version}`);
  console.log("- boundary language preserved");
  console.log("- no new dependency versions detected");
  console.log("- no provider, Guard CLI, network, .env, tag, or publish action required");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(
    supportedPackageVersions.includes(packageJson.version),
    "package.json version must be 0.3.0 or a current v0.4 release-prep version."
  );
  if (!packageLock) {
    return;
  }
  assert(
    packageLock.version === packageJson.version,
    "package-lock.json top-level version must match package.json."
  );
  assert(
    packageLock.packages?.[""]?.version === packageJson.version,
    "package-lock.json root package version must match package.json."
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

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  for (const packageName of forbiddenDependencyNames) {
    assert(!dependencies[packageName], `Forbidden dependency detected: ${packageName}`);
  }

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

function assertExactVersions(actual, expected, label) {
  assert(
    JSON.stringify(sortRecord(actual)) === JSON.stringify(sortRecord(expected)),
    `${label} must match the v0.3 release baseline.`
  );
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
    assert(combined.includes(phrase), `v0.3 release docs must include: ${phrase}`);
  }
  assert(combined.includes("SaaS"), "v0.3 release docs must preserve the SaaS boundary.");
  assert(combined.includes("dashboard"), "v0.3 release docs must preserve the dashboard boundary.");
  assert(combined.includes("OAuth"), "v0.3 release docs must preserve the OAuth boundary.");
  assert(combined.includes("pricing"), "v0.3 release docs must preserve the pricing boundary.");
  assert(combined.includes("license"), "v0.3 release docs must preserve the license boundary.");
  assert(combined.includes("checkout"), "v0.3 release docs must preserve the checkout boundary.");
  assert(combined.includes("Paddle"), "v0.3 release docs must preserve the Paddle boundary.");
}

async function verifyNoEnvLoadingText(repoRoot) {
  const filesToScan = [
    "scripts/verify_v0_3_release_ready.mjs",
    "docs/RELEASE_NOTES_v0.3.md",
    "docs/V0_3_FINAL_RELEASE_GATE.md",
    "docs/V0_3_TAG_PREP.md",
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
  const script = await readFile(path.join(repoRoot, "scripts/verify_v0_3_release_ready.mjs"), "utf8");
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
    ["git", "tag"].join(" "),
    ["gh", "release"].join(" ")
  ];

  for (const fragment of forbiddenFragments) {
    assert(!script.includes(fragment), `v0.3 release verifier boundary violation: ${fragment}`);
  }
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
  console.error("v0.3 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
