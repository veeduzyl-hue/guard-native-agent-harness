/* global console */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const validProfileIds = ["local-dev", "ci-pr", "release-prep", "audit-review"];
const evidenceFixture = "fixtures/v0.3/evidence-pack-valid-basic";
const authorityClaimPatterns = [
  /"?approval"?\s*:\s*true/i,
  /"?enforcement"?\s*:\s*true/i,
  /"?authority_grant"?\s*:\s*true/i,
  /"?runtime_control_plane"?\s*:\s*true/i,
  /"?provider_output_authorizes_execution"?\s*:\s*true/i,
  /\bis approval\b/i,
  /\bis enforcement\b/i,
  /\bblocks deployment\b/i,
  /\bdeployment approved\b/i,
  /\bauthorizes? deployment\b/i,
  /\bauthorizes? merges?\b/i,
  /\bgrants? authority\b/i,
  /\bruntime control plane enabled\b/i,
  /\bprovider output authorizes execution\b/i
];

async function main() {
  const repoRoot = process.cwd();
  const cliPath = path.join(repoRoot, "dist", "cli.js");
  const evidenceDirectory = path.join(repoRoot, evidenceFixture);

  await runPackageScript(repoRoot, "build");
  await runPackageScript(repoRoot, "verify:v0.5:profiles");

  const defaultJson = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--json"
  ]);
  const defaultInspection = JSON.parse(defaultJson.stdout);
  assert(defaultInspection.review_profile === null, "Default inspection must not infer a review profile.");

  const profileJsonOutputs = new Map();
  for (const profileId of validProfileIds) {
    const profileJson = await runCli(repoRoot, [
      cliPath,
      "inspect-evidence",
      "--evidence-dir",
      evidenceDirectory,
      "--profile",
      profileId,
      "--json"
    ]);
    const inspection = JSON.parse(profileJson.stdout);
    verifyProfileMetadata(inspection, profileId);
    assertNoAuthorityClaims(profileJson.stdout, `${profileId} JSON output`);
    profileJsonOutputs.set(profileId, profileJson.stdout);
  }

  const localDevJson = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--profile",
    "local-dev",
    "--json"
  ]);
  assert(
    localDevJson.stdout === profileJsonOutputs.get("local-dev"),
    "Profile JSON inspection output must be deterministic."
  );
  const secondLocalDevJson = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--profile",
    "local-dev",
    "--json"
  ]);
  assert(localDevJson.stdout === secondLocalDevJson.stdout, "Profile JSON inspection output must be deterministic.");

  const localDevInspection = JSON.parse(localDevJson.stdout);
  assert(
    localDevInspection.review_profile.expected_verifiers.includes("npm run verify:v0.3:inspect-evidence"),
    "local-dev profile metadata must include inspect-evidence verifier reference."
  );

  const markdown = await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--profile",
    "audit-review",
    "--markdown"
  ]);
  assert(markdown.stdout.includes("## Review Profile"), "Markdown output must include review profile section.");
  assert(markdown.stdout.includes("- Selected: audit-review"), "Markdown output must include selected profile ID.");
  assert(
    markdown.stdout.includes("Expected verifiers are declarative references only"),
    "Markdown output must state that verifier references are declarative only."
  );
  assert(
    markdown.stdout.includes("not approval, not enforcement, not blocking, not deployment authority"),
    "Markdown output must preserve review-profile boundary language."
  );
  assertNoAuthorityClaims(markdown.stdout, "profile markdown output");
  assertNoAuthorityClaims(localDevJson.stdout, "profile JSON output");

  const unknownProfile = await runCliExpectFailure(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--profile",
    "production-deploy",
    "--json"
  ]);
  assert(
    unknownProfile.stderr.includes(
      "Unknown review profile: production-deploy. Expected one of: local-dev, ci-pr, release-prep, audit-review."
    ),
    "Unknown profile must fail with stable error wording."
  );
  assert(unknownProfile.stdout === "", "Unknown profile failure must not emit inspection output.");

  const manifestBefore = await readFile(path.join(evidenceDirectory, "evidence-manifest.json"), "utf8");
  await runCli(repoRoot, [
    cliPath,
    "inspect-evidence",
    "--evidence-dir",
    evidenceDirectory,
    "--profile",
    "ci-pr",
    "--json"
  ]);
  const manifestAfter = await readFile(path.join(evidenceDirectory, "evidence-manifest.json"), "utf8");
  assert(manifestBefore === manifestAfter, "Profile inspection must not mutate evidence files.");

  console.log("v0.5 inspect-evidence profile verification passed.");
  console.log("");
  console.log(`- valid profiles accepted: ${validProfileIds.join(", ")}`);
  console.log("- selected profile metadata appears in JSON and Markdown inspection output");
  console.log("- unknown profile rejected deterministically");
  console.log("- profile verifier baseline still passes");
  console.log("- expected verifier references are declarative only");
  console.log("- no profile command was executed");
  console.log("- not approval");
  console.log("- not enforcement");
  console.log("- not blocking");
  console.log("- not deployment authority");
  console.log("- not a runtime control plane");
  console.log("- no authority grant");
  console.log("- no provider output can authorize execution");
}

function verifyProfileMetadata(inspection, profileId) {
  assert(inspection.schema_version === "v0.3", "Inspection schema version must remain v0.3.");
  assert(inspection.review_posture === "review_artifact_only", "Inspection must remain a review artifact.");
  assert(inspection.review_profile?.profile_id === profileId, "Selected profile ID must be present.");
  assert(inspection.review_profile, "Profile metadata must be present.");
  assert(typeof inspection.review_profile.display_name === "string", "Profile display name must be present.");
  assert(typeof inspection.review_profile.description === "string", "Profile description must be present.");
  assert(
    Array.isArray(inspection.review_profile.required_evidence_files),
    "Profile required evidence files must be present."
  );
  assert(Array.isArray(inspection.review_profile.review_sections), "Profile review sections must be present.");
  assertFalseBoundary(
    inspection.review_profile.boundary,
    [
      "approval",
      "enforcement",
      "autonomous_execution",
      "runtime_control_plane",
      "authority_grant",
      "provider_output_authorizes_execution"
    ],
    "review_profile.boundary"
  );
  assertFalseBoundary(
    inspection.boundary,
    ["approval", "enforcement", "autonomous_execution", "authority_grant", "runtime_control_plane"],
    "inspection.boundary"
  );
}

function assertFalseBoundary(boundary, fields, label) {
  for (const field of fields) {
    assert(boundary?.[field] === false, `${label}.${field} must be false.`);
  }
}

function assertNoAuthorityClaims(content, label) {
  for (const pattern of authorityClaimPatterns) {
    assert(!pattern.test(content), `${label} includes forbidden authority claim: ${pattern}`);
  }
}

function runPackageScript(repoRoot, scriptName) {
  if (process.platform === "win32") {
    return runProcess("cmd.exe", ["/d", "/s", "/c", `npm.cmd run ${scriptName}`], repoRoot);
  }

  return runProcess("npm", ["run", scriptName], repoRoot);
}

function runCli(repoRoot, args) {
  return runProcess(process.execPath, args, repoRoot);
}

async function runCliExpectFailure(repoRoot, args) {
  try {
    const result = await runCli(repoRoot, args);
    throw new Error(`Command unexpectedly passed:\n${result.stdout}`);
  } catch (error) {
    if (error instanceof CommandFailure) {
      return error.result;
    }
    throw error;
  }
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
      const result = { stdout, stderr, exitCode };
      if (exitCode !== 0) {
        reject(new CommandFailure(result));
        return;
      }
      resolve(result);
    });
  });
}

class CommandFailure extends Error {
  constructor(result) {
    super(`Command failed with exit code ${result.exitCode}:\n${result.stderr.trim()}`);
    this.result = result;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.5 inspect-evidence profile verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
