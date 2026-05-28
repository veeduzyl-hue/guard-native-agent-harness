/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.2.1";
const requiredV021Docs = [
  "docs/RELEASE_NOTES_v0.2.1.md",
  "docs/V0_2_1_FINAL_RELEASE_GATE.md",
  "docs/V0_2_1_TAG_PREP.md"
];
const requiredV02Docs = [
  "docs/RELEASE_NOTES_v0.2.md",
  "docs/V0_2_FINAL_RELEASE_GATE.md",
  "docs/V0_2_PROVIDER_BASELINE.md"
];
const requiredScripts = [
  "verify:v0.1",
  "verify:v0.1:release",
  "verify:v0.2:providers",
  "verify:v0.2:release",
  "verify:post-v0.2",
  "verify:dependency-upgrade-plan",
  "audit:summary",
  "verify:v0.2.1:release"
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
const expectedDevDependencies = {
  "@eslint/js": "9.39.4",
  eslint: "9.39.4",
  vite: "6.4.2",
  vitest: "4.1.7"
};

async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
  const registry = await readFile(path.join(repoRoot, "src/agent/provider-registry.ts"), "utf8");
  const cli = await readFile(path.join(repoRoot, "src/cli.ts"), "utf8");

  verifyPackageVersion(packageJson, packageLock);
  verifyDocs(repoRoot);
  verifyScripts(packageJson);
  verifyDefaultProvider(registry, cli);
  verifyOptionalProviders(registry);
  verifyDependencies(packageJson);
  verifyDependencyRemediation(packageJson, packageLock);
  await verifyNoEnvLoading(repoRoot);
  await verifyEvidenceNotTracked(repoRoot);
  await verifyTagState(repoRoot);
  await verifyReleaseNotes(repoRoot);
  await verifyReleaseVerifierDoesNotRequireKeys(repoRoot);

  console.log("v0.2.1 release readiness verification passed.");
  console.log("");
  console.log("- package version: 0.2.1");
  console.log("- v0.2.1 release docs present");
  console.log("- mock remains default");
  console.log("- optional providers registered");
  console.log("- no .env / dotenv / provider SDK dependency detected");
  console.log("- dependency remediation release boundary confirmed");
  console.log("- no real provider call required");
  console.log("- v0.2.1 tag not present locally");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(packageJson.version === releaseVersion, "package.json version must be 0.2.1.");
  assert(packageLock.version === releaseVersion, "package-lock.json top-level version must be 0.2.1.");
  assert(
    packageLock.packages?.[""]?.version === releaseVersion,
    "package-lock.json root package version must be 0.2.1."
  );
}

function verifyDocs(repoRoot) {
  for (const filePath of [...requiredV021Docs, ...requiredV02Docs]) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required release doc: ${filePath}`);
  }
}

function verifyScripts(packageJson) {
  for (const scriptName of requiredScripts) {
    assert(packageJson.scripts?.[scriptName], `package.json must include ${scriptName}.`);
  }

  assert(
    packageJson.scripts?.["verify:v0.2.1:release"] ===
      "node scripts/verify_v0_2_1_release_ready.mjs",
    "package.json verify:v0.2.1:release must run scripts/verify_v0_2_1_release_ready.mjs."
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

function verifyDependencyRemediation(packageJson, packageLock) {
  for (const [packageName, expectedVersion] of Object.entries(expectedDevDependencies)) {
    assert(
      packageJson.devDependencies?.[packageName] === expectedVersion,
      `${packageName} must be pinned to ${expectedVersion}.`
    );

    const lockEntry = packageLock.packages?.[`node_modules/${packageName}`];
    assert(lockEntry?.version === expectedVersion, `${packageName} lock entry must be ${expectedVersion}.`);
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
    .filter((line) => !line.includes("scripts/verify_post_v0_2_baseline.mjs"))
    .filter((line) => !line.includes("scripts/verify_v0_2_1_release_ready.mjs"));

  assert(matches.length === 0, `.env loading or dotenv usage detected:\n${matches.join("\n")}`);
}

async function verifyEvidenceNotTracked(repoRoot) {
  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git.");
}

async function verifyTagState(repoRoot) {
  const v020Tag = await runCommand("git", ["tag", "--list", "v0.2.0"], repoRoot, {
    allowFailure: true
  });
  assert(
    v020Tag.stdout.trim() === "" || v020Tag.stdout.trim() === "v0.2.0",
    "Unexpected local v0.2.0 tag state."
  );

  const v021Tag = await runCommand("git", ["tag", "--list", "v0.2.1"], repoRoot);
  assert(v021Tag.stdout.trim() === "", "v0.2.1 tag must not be created before the final release gate.");
}

async function verifyReleaseNotes(repoRoot) {
  const releaseNotes = await readFile(path.join(repoRoot, "docs/RELEASE_NOTES_v0.2.1.md"), "utf8");
  assert(
    releaseNotes.includes("patch release for dev-tooling dependency remediation"),
    "Release notes must state that v0.2.1 is dependency remediation only."
  );
  assert(
    releaseNotes.includes("It does not change runtime behavior"),
    "Release notes must state that runtime behavior is unchanged."
  );
}

async function verifyReleaseVerifierDoesNotRequireKeys(repoRoot) {
  const script = await readFile(
    path.join(repoRoot, "scripts/verify_v0_2_1_release_ready.mjs"),
    "utf8"
  );
  const processEnvPrefix = "process.env.";

  assert(
    !script.includes(`${processEnvPrefix}OPENAI_API_KEY`),
    "v0.2.1 release verification must not read OPENAI_API_KEY."
  );
  assert(
    !script.includes(`${processEnvPrefix}DEEPSEEK_API_KEY`),
    "v0.2.1 release verification must not read DEEPSEEK_API_KEY."
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
  console.error("v0.2.1 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
