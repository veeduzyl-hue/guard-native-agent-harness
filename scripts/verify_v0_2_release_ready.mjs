/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.2.0";
const requiredDocs = [
  "docs/RELEASE_NOTES_v0.2.md",
  "docs/V0_2_FINAL_RELEASE_GATE.md",
  "docs/V0_2_TAG_PREP.md",
  "docs/V0_2_PROVIDER_BASELINE.md",
  "docs/V0_2_RELEASE_PREP.md"
];
const requiredScripts = [
  "verify:v0.1",
  "verify:v0.1:release",
  "verify:v0.2:providers",
  "verify:v0.2:release"
];
const providerScripts = [
  "verify:ollama:e2e",
  "verify:openai:planner",
  "verify:deepseek:planner"
];
const requiredProviders = ["mock", "ollama", "openai", "deepseek"];
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
  const packageLock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
  const registry = await readFile(path.join(repoRoot, "src/agent/provider-registry.ts"), "utf8");
  const cli = await readFile(path.join(repoRoot, "src/cli.ts"), "utf8");

  verifyPackageVersion(packageJson, packageLock);
  verifyDocs(repoRoot);
  verifyScripts(packageJson);
  verifyDefaultPlanner(registry, cli);
  verifyProviders(registry);
  verifyDependencies(packageJson);
  await verifyNoEnvLoading(repoRoot);
  await verifyEvidenceNotTracked(repoRoot);
  await verifyTagAbsent(repoRoot);
  await verifyReadme(repoRoot);
  await verifyReleaseNotes(repoRoot);
  await verifyReleaseVerifierDoesNotRequireKeys(repoRoot);

  console.log("v0.2.0 release readiness verification passed.");
  console.log("");
  console.log("- package version: 0.2.0");
  console.log("- provider baseline docs present");
  console.log("- final release gate docs present");
  console.log("- mock remains default");
  console.log("- optional providers registered");
  console.log("- no .env / dotenv / provider SDK dependency detected");
  console.log("- no real provider call required");
  console.log("- v0.2.0 tag not present locally");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(packageJson.version === releaseVersion, "package.json version must be 0.2.0.");
  assert(packageLock.version === releaseVersion, "package-lock.json top-level version must be 0.2.0.");
  assert(
    packageLock.packages?.[""]?.version === releaseVersion,
    "package-lock.json root package version must be 0.2.0."
  );
}

function verifyDocs(repoRoot) {
  for (const filePath of requiredDocs) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required v0.2 release doc: ${filePath}`);
  }
}

function verifyScripts(packageJson) {
  for (const scriptName of requiredScripts) {
    assert(packageJson.scripts?.[scriptName], `package.json must include ${scriptName}.`);
  }

  assert(
    packageJson.scripts?.["verify:v0.2:release"] ===
      "node scripts/verify_v0_2_release_ready.mjs",
    "package.json verify:v0.2:release must run scripts/verify_v0_2_release_ready.mjs."
  );

  for (const scriptName of providerScripts) {
    assert(packageJson.scripts?.[scriptName], `package.json must include ${scriptName}.`);
  }
}

function verifyDefaultPlanner(registry, cli) {
  assert(
    registry.includes('return this.get("mock")'),
    "Provider registry defaultProvider() must return mock."
  );
  assert(
    cli.includes('.option("--planner <provider>", "planner provider to use", "mock")'),
    "CLI --planner default must remain mock."
  );
}

function verifyProviders(registry) {
  for (const provider of requiredProviders) {
    assert(
      registry.includes(`"${provider}"`) || registry.includes(`'${provider}'`),
      `Provider registry does not include provider name: ${provider}`
    );
  }

  assert(registry.includes("registry.register(mockPlannerProvider)"), "Mock provider is not registered.");
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
    .filter((line) => !line.includes("scripts/verify_v0_2_release_ready.mjs"));

  assert(matches.length === 0, `.env loading or dotenv usage detected:\n${matches.join("\n")}`);
}

async function verifyEvidenceNotTracked(repoRoot) {
  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git.");
}

async function verifyTagAbsent(repoRoot) {
  const tag = await runCommand("git", ["tag", "--list", "v0.2.0"], repoRoot);
  assert(tag.stdout.trim() === "", "v0.2.0 tag must not be created before the final release gate.");
}

async function verifyReadme(repoRoot) {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert(readme.includes("## v0.2.0 Release Gate"), "README must include v0.2.0 Release Gate section.");
  assert(readme.includes("npm run verify:v0.2:release"), "README must mention verify:v0.2:release.");
  assert(readme.includes("docs/V0_2_TAG_PREP.md"), "README must link to docs/V0_2_TAG_PREP.md.");
}

async function verifyReleaseNotes(repoRoot) {
  const releaseNotes = await readFile(path.join(repoRoot, "docs/RELEASE_NOTES_v0.2.md"), "utf8");
  assert(
    releaseNotes.includes("provider baseline release"),
    "Release notes must state that v0.2.0 is a provider baseline release."
  );
  assert(
    releaseNotes.includes("not an autonomous agent release"),
    "Release notes must state that v0.2.0 is not an autonomous-agent release."
  );
}

async function verifyReleaseVerifierDoesNotRequireKeys(repoRoot) {
  const script = await readFile(
    path.join(repoRoot, "scripts/verify_v0_2_release_ready.mjs"),
    "utf8"
  );
  const processEnvPrefix = "process.env.";

  assert(
    !script.includes(`${processEnvPrefix}OPENAI_API_KEY`),
    "v0.2 release verification must not read OPENAI_API_KEY."
  );
  assert(
    !script.includes(`${processEnvPrefix}DEEPSEEK_API_KEY`),
    "v0.2 release verification must not read DEEPSEEK_API_KEY."
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
  console.error("v0.2.0 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
