/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.5.0";
const expectedProfileIds = ["local-dev", "ci-pr", "release-prep", "audit-review"];
const requiredDocs = [
  "docs/RELEASE_NOTES_v0.5.md",
  "docs/V0_5_FINAL_RELEASE_GATE.md",
  "docs/V0_5_TAG_PREP.md",
  "docs/ROADMAP.md",
  "docs/evidence/REVIEW_PROFILE_SCHEMA.md",
  "docs/planning/v0.5-evidence-review-profiles.md",
  "README.md"
];
const requiredFiles = [
  "schemas/v0.5/evidence-review-profile.schema.json",
  "scripts/verify_v0_5_review_profiles.mjs",
  "scripts/verify_v0_5_inspect_evidence_profile.mjs",
  "scripts/verify_v0_5_release_gate.mjs"
];
const requiredScripts = {
  "verify:v0.5:profiles": "node scripts/verify_v0_5_review_profiles.mjs",
  "verify:v0.5:inspect-profile": "node scripts/verify_v0_5_inspect_evidence_profile.mjs",
  "verify:v0.5:release": "node scripts/verify_v0_5_release_gate.mjs"
};
const requiredDocPhrases = [
  "review profile schema",
  "profile fixtures",
  "deterministic review profile verifier",
  "inspect-evidence --profile",
  "local-dev",
  "ci-pr",
  "release-prep",
  "audit-review",
  "review artifacts only",
  "No provider output can authorize execution",
  "Expected verifier references",
  "declarative only",
  "pre-tag",
  "post-tag",
  "Post-tag sanity"
];
const forbiddenPositiveClaimPatterns = [
  /review profiles? (?:can |may |must |will )?approves?\b/i,
  /review profiles? (?:can |may |must |will )?enforces?\b/i,
  /review profiles? (?:can |may |must |will )?blocks?\b/i,
  /review profiles? (?:can |may |must |will )?deploys?\b/i,
  /review profiles? (?:can |may |must |will )?grants? authority\b/i,
  /review profiles? (?:can |may |must |will )?controls? runtime execution\b/i,
  /review profiles? (?:can |may |must |will )?acts? as a runtime control plane\b/i,
  /\bis approval\b/i,
  /\bis enforcement\b/i,
  /\bis deployment authority\b/i,
  /\bis a runtime control plane\b/i,
  /\bauthority_grant"?\s*:\s*true\b/i,
  /\bruntime_control_plane"?\s*:\s*true\b/i,
  /\bprovider_output_authorizes_execution"?\s*:\s*true\b/i
];
const forbiddenVerifierFragments = [
  ["git", "tag", "v0.5.0"].join(" "),
  ["git", "push", "origin", "v0.5.0"].join(" "),
  ["gh", "release", "create"].join(" "),
  ["npm", "publish"].join(" "),
  ["npm", "pack"].join(" "),
  ["OPENAI", "API", "KEY"].join("_"),
  ["DEEPSEEK", "API", "KEY"].join("_"),
  ["process", "env"].join("."),
  ["dotenv", "config"].join(".")
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = await readJson(path.join(repoRoot, "package.json"));
  const packageLock = await readJson(path.join(repoRoot, "package-lock.json"));

  verifyPackageVersion(packageJson, packageLock);
  verifyScripts(packageJson);
  verifyFiles(repoRoot, requiredFiles, "v0.5 release surface");
  await verifyProfileFixtures(repoRoot);
  await verifyDocs(repoRoot);
  await verifyReleaseVerifierBoundary(repoRoot);
  await verifyNoReleaseTag(repoRoot);

  console.log("v0.5 release gate verification passed.");
  console.log("");
  console.log("- package root metadata pinned to 0.5.0");
  console.log("- v0.5 release docs present");
  console.log("- v0.5 profile schema and fixtures present");
  console.log("- v0.5 profile, inspect-profile, and release verifier scripts present");
  console.log("- v0.5 package scripts present");
  console.log("- pre-tag and post-tag behavior documented separately");
  console.log("- review profile expected verifier references are declarative only");
  console.log("- review profiles remain review artifacts only");
  console.log("- no approval, enforcement, blocking, deployment authority, runtime control-plane, or authority grant claim detected");
  console.log("- no provider output can authorize execution");
  console.log("- no v0.5.0 tag detected");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(packageJson.version === releaseVersion, "package.json version must be 0.5.0.");
  assert(packageLock.version === releaseVersion, "package-lock.json top-level version must be 0.5.0.");
  assert(
    packageLock.packages?.[""]?.version === releaseVersion,
    "package-lock.json root package version must be 0.5.0."
  );
}

function verifyScripts(packageJson) {
  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    assert(packageJson.scripts?.[scriptName] === expectedCommand, `${scriptName} must run ${expectedCommand}.`);
  }
}

function verifyFiles(repoRoot, filePaths, label) {
  for (const filePath of filePaths) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required ${label}: ${filePath}`);
  }
}

async function verifyProfileFixtures(repoRoot) {
  const validDir = path.join(repoRoot, "fixtures/v0.5/review-profiles");
  const invalidDir = path.join(repoRoot, "fixtures/v0.5/review-profiles-invalid");
  const validFiles = (await readdir(validDir)).filter((fileName) => fileName.endsWith(".profile.json")).sort();
  const invalidFiles = (await readdir(invalidDir)).filter((fileName) => fileName.endsWith(".profile.json")).sort();
  const expectedValidFiles = expectedProfileIds.map((profileId) => `${profileId}.profile.json`).sort();

  assertArrayEqual(validFiles, expectedValidFiles, "valid v0.5 profile fixture files");
  assert(invalidFiles.length > 0, "At least one invalid v0.5 profile fixture must exist.");
}

async function verifyDocs(repoRoot) {
  const docs = await Promise.all(
    requiredDocs.map(async (filePath) => {
      assert(existsSync(path.join(repoRoot, filePath)), `Missing required v0.5 release doc: ${filePath}`);
      return {
        filePath,
        content: await readFile(path.join(repoRoot, filePath), "utf8")
      };
    })
  );
  const combined = docs.map((doc) => doc.content).join("\n");
  const normalizedCombined = combined.toLowerCase();

  for (const phrase of requiredDocPhrases) {
    assert(normalizedCombined.includes(phrase.toLowerCase()), `v0.5 docs must include: ${phrase}`);
  }

  assert(
    normalizedCombined.includes("review profiles are review artifacts only"),
    "v0.5 docs must state the review artifact boundary."
  );
  assert(
    normalizedCombined.includes("do not approve, enforce, block, deploy, grant authority, control runtime execution"),
    "v0.5 docs must preserve explicit review-profile non-authority language."
  );
  assert(
    normalizedCombined.includes("authorize execution"),
    "v0.5 docs must explicitly address execution authorization."
  );

  for (const { filePath, content } of docs) {
    for (const pattern of forbiddenPositiveClaimPatterns) {
      assert(!pattern.test(content), `${filePath} contains forbidden authority claim: ${pattern}`);
    }
  }
}

async function verifyReleaseVerifierBoundary(repoRoot) {
  const script = await readFile(path.join(repoRoot, "scripts/verify_v0_5_release_gate.mjs"), "utf8");
  for (const fragment of forbiddenVerifierFragments) {
    assert(!script.includes(fragment), `v0.5 release verifier must not contain forbidden fragment: ${fragment}`);
  }
}

async function verifyNoReleaseTag(repoRoot) {
  const tagsAtHead = await runCommand("git", ["tag", "--points-at", "HEAD"], repoRoot);
  assert(tagsAtHead.stdout.trim() === "", "No release tag should point at HEAD.");
  const v050Tag = await runCommand("git", ["tag", "--list", "v0.5.0"], repoRoot);
  assert(v050Tag.stdout.trim() === "", "v0.5.0 tag must not exist before the final release gate.");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assertArrayEqual(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array.`);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} mismatch. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
  );
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.5 release gate verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
