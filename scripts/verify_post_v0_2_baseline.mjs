/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const supportedReleaseVersions = ["0.2.0", "0.2.1", "0.3.0", "0.4.0", "0.4.1"];
const v02Docs = [
  "docs/RELEASE_NOTES_v0.2.md",
  "docs/V0_2_FINAL_RELEASE_GATE.md",
  "docs/V0_2_TAG_PREP.md",
  "docs/V0_2_PROVIDER_BASELINE.md",
  "docs/V0_2_RELEASE_PREP.md"
];
const postReleaseDocs = [
  "docs/POST_V0_2_MAINTENANCE.md",
  "docs/DEPENDENCY_AUDIT_TRIAGE.md"
];
const requiredScripts = [
  "verify:v0.1",
  "verify:v0.1:release",
  "verify:v0.2:providers",
  "verify:v0.2:release",
  "verify:post-v0.2"
];
const optionalProviders = ["ollama", "openai", "deepseek"];
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
  const registry = await readFile(path.join(repoRoot, "src/agent/provider-registry.ts"), "utf8");
  const cli = await readFile(path.join(repoRoot, "src/cli.ts"), "utf8");

  verifyPackageVersion(packageJson);
  verifyDocs(repoRoot, v02Docs, "v0.2 release doc");
  verifyDocs(repoRoot, postReleaseDocs, "post-v0.2 maintenance doc");
  verifyScripts(packageJson);
  verifyDefaultProvider(registry, cli);
  verifyOptionalProviders(registry);
  verifyDependencies(packageJson);
  await verifyNoEnvLoading(repoRoot);
  await verifyEvidenceNotTracked(repoRoot);
  await verifyLocalReleaseTag(repoRoot);
  await verifyPostReleaseVerifierDoesNotRequireKeys(repoRoot);

  console.log("post-v0.2 baseline verification passed.");
  console.log("");
  console.log(`- package version: ${packageJson.version}`);
  console.log("- v0.2 release docs present");
  console.log("- post-v0.2 maintenance docs present");
  console.log("- mock remains default");
  console.log("- optional providers remain registered");
  console.log("- no .env / dotenv / provider SDK dependency detected");
  console.log("- no real provider call required");
}

function verifyPackageVersion(packageJson) {
  assert(
    supportedReleaseVersions.includes(packageJson.version),
    "package.json version must be a supported post-v0.2 or later release-prep version."
  );
}

function verifyDocs(repoRoot, filePaths, label) {
  for (const filePath of filePaths) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required ${label}: ${filePath}`);
  }
}

function verifyScripts(packageJson) {
  for (const scriptName of requiredScripts) {
    assert(packageJson.scripts?.[scriptName], `package.json must include ${scriptName}.`);
  }

  assert(
    packageJson.scripts?.["verify:post-v0.2"] ===
      "node scripts/verify_post_v0_2_baseline.mjs",
    "package.json verify:post-v0.2 must run scripts/verify_post_v0_2_baseline.mjs."
  );
}

function verifyDefaultProvider(registry, cli) {
  assert(
    registry.includes('return this.get("mock")'),
    "Provider registry defaultProvider() must return mock."
  );
  assert(
    cli.includes('.option("--planner <provider>", "planner provider to use", "mock")'),
    "CLI --planner default must remain mock."
  );
}

function verifyOptionalProviders(registry) {
  assert(registry.includes("registry.register(mockPlannerProvider)"), "Mock provider is not registered.");

  for (const provider of optionalProviders) {
    assert(
      registry.includes(`"${provider}"`) || registry.includes(`'${provider}'`),
      `Provider registry does not include optional provider name: ${provider}`
    );
  }

  assert(
    registry.includes("registry.register(createOllamaPlannerProvider())"),
    "Ollama provider is not registered."
  );
  assert(
    registry.includes("registry.register(createOpenAIPlannerProvider())"),
    "OpenAI provider is not registered."
  );
  assert(
    registry.includes("registry.register(createDeepSeekPlannerProvider())"),
    "DeepSeek provider is not registered."
  );
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

async function verifyNoEnvLoading(repoRoot) {
  const forbiddenMatches = await runCommand(
    "git",
    [
      "grep",
      "-n",
      "-E",
      "from ['\"]dotenv['\"]|require\\(['\"]dotenv['\"]\\)|dotenv\\.config|config\\(\\).*dotenv|readFile(Sync)?\\([^)]*['\"]\\.env",
      "--",
      "src",
      "scripts",
      "package.json"
    ],
    repoRoot,
    { allowFailure: true }
  );

  const matches = forbiddenMatches.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.includes("scripts/verify_v0_2_provider_baseline.mjs"))
    .filter((line) => !line.includes("scripts/verify_v0_2_release_ready.mjs"))
    .filter((line) => !line.includes("scripts/verify_post_v0_2_baseline.mjs"));

  assert(matches.length === 0, `.env loading or dotenv usage detected:\n${matches.join("\n")}`);
}

async function verifyEvidenceNotTracked(repoRoot) {
  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git.");
}

async function verifyLocalReleaseTag(repoRoot) {
  const tag = await runCommand("git", ["tag", "--list", "v0.2.0"], repoRoot, {
    allowFailure: true
  });
  assert(tag.stdout.trim() === "v0.2.0", "local v0.2.0 tag should exist for post-v0.2 baseline verification.");
}

async function verifyPostReleaseVerifierDoesNotRequireKeys(repoRoot) {
  const script = await readFile(
    path.join(repoRoot, "scripts/verify_post_v0_2_baseline.mjs"),
    "utf8"
  );
  const processEnvPrefix = "process.env.";

  assert(
    !script.includes(`${processEnvPrefix}OPENAI_API_KEY`),
    "post-v0.2 baseline verification must not read OPENAI_API_KEY."
  );
  assert(
    !script.includes(`${processEnvPrefix}DEEPSEEK_API_KEY`),
    "post-v0.2 baseline verification must not read DEEPSEEK_API_KEY."
  );
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
  console.error("post-v0.2 baseline verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
