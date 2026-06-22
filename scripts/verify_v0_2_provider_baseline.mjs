/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const requiredProviders = ["mock", "ollama", "openai", "deepseek"];
const requiredProviderFiles = {
  mock: "src/agent/planner.ts",
  ollama: "src/agent/ollama-provider.ts",
  openai: "src/agent/openai-provider.ts",
  deepseek: "src/agent/deepseek-provider.ts"
};
const requiredScripts = [
  "verify:ollama:e2e",
  "verify:openai:planner",
  "verify:deepseek:planner"
];
const requiredDocs = [
  "docs/V0_2_PROVIDER_BASELINE.md",
  "docs/V0_2_RELEASE_PREP.md",
  "docs/OLLAMA_E2E_ACCEPTANCE.md",
  "docs/OPENAI_PLANNER_ACCEPTANCE.md",
  "docs/DEEPSEEK_PLANNER_ACCEPTANCE.md"
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
  const registry = await readFile(path.join(repoRoot, "src/agent/provider-registry.ts"), "utf8");
  const cli = await readFile(path.join(repoRoot, "src/cli.ts"), "utf8");

  verifyProviderRegistry(registry);
  await verifyProviderImplementations(repoRoot);
  verifyDefaultProvider(registry, cli);
  verifyPackageScripts(packageJson);
  verifyDependencies(packageJson);
  await verifyNoEnvLoading(repoRoot);
  await verifyEvidenceNotTracked(repoRoot);
  await verifyDocs(repoRoot);
  await verifyReadme(repoRoot);
  await verifyBaselineVerifierDoesNotRequireKeys(repoRoot);

  console.log("v0.2 provider baseline verification passed.");
  console.log("");
  console.log("- mock default confirmed");
  console.log("- optional providers registered: ollama, openai, deepseek");
  console.log("- no provider API keys required");
  console.log("- no .env / dotenv / model SDK dependency detected");
  console.log("- optional provider verification scripts present");
  console.log("- provider baseline docs present");
}

function verifyProviderRegistry(registry) {
  for (const provider of requiredProviders) {
    assert(
      registry.includes(`"${provider}"`) || registry.includes(`'${provider}'`),
      `Provider registry does not include provider name: ${provider}`
    );
  }

  assert(
    registry.includes("registry.register(mockPlannerProvider)"),
    "Provider registry does not register mockPlannerProvider."
  );
  assert(
    registry.includes("registry.register(createOllamaPlannerProvider())"),
    "Provider registry does not register Ollama provider."
  );
  assert(
    registry.includes("registry.register(createOpenAIPlannerProvider())"),
    "Provider registry does not register OpenAI provider."
  );
  assert(
    registry.includes("registry.register(createDeepSeekPlannerProvider())"),
    "Provider registry does not register DeepSeek provider."
  );
}

async function verifyProviderImplementations(repoRoot) {
  for (const [provider, filePath] of Object.entries(requiredProviderFiles)) {
    const absolutePath = path.join(repoRoot, filePath);
    assert(existsSync(absolutePath), `Missing provider implementation file: ${filePath}`);

    const content = await readFile(absolutePath, "utf8");
    assert(
      content.includes(`name: "${provider}"`) || content.includes(`provider: "${provider}"`),
      `Provider implementation does not identify provider: ${provider}`
    );
  }
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

function verifyPackageScripts(packageJson) {
  assert(
    packageJson.scripts?.["verify:v0.2:providers"] ===
      "node scripts/verify_v0_2_provider_baseline.mjs",
    "package.json must include verify:v0.2:providers."
  );

  for (const scriptName of requiredScripts) {
    assert(packageJson.scripts?.[scriptName], `package.json must include ${scriptName}.`);
  }
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
    .filter((line) => !line.includes("scripts/verify_v0_2_provider_baseline.mjs"));

  assert(matches.length === 0, `.env loading or dotenv usage detected:\n${matches.join("\n")}`);
}

async function verifyEvidenceNotTracked(repoRoot) {
  const trackedEvidence = await runCommand("git", ["ls-files", ".evidence"], repoRoot);
  assert(trackedEvidence.stdout.trim() === "", ".evidence/ must not be tracked by git.");
}

async function verifyDocs(repoRoot) {
  for (const filePath of requiredDocs) {
    assert(existsSync(path.join(repoRoot, filePath)), `Missing required provider baseline doc: ${filePath}`);
  }
}

async function verifyReadme(repoRoot) {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert(
    readme.includes("Optional Planner Provider Baseline") || readme.includes("v0.2 Provider Baseline"),
    "README must mention the v0.2 provider baseline in its public release context."
  );
  assert(readme.includes("The default planner provider is `mock`"), "README must document mock as default.");
  for (const provider of ["Ollama", "OpenAI", "DeepSeek"]) {
    assert(readme.includes(provider), `README must mention optional provider: ${provider}.`);
  }
  assert(readme.includes("does not load `.env` files"), "README must document that .env files are not loaded.");
  assert(readme.includes("Providers propose plans only"), "README must document provider proposal-only boundary.");
  assert(
    readme.includes("they do not receive tools, call tools, or receive execution authority"),
    "README must document that providers do not receive tools or execution authority."
  );
}

async function verifyBaselineVerifierDoesNotRequireKeys(repoRoot) {
  const script = await readFile(
    path.join(repoRoot, "scripts/verify_v0_2_provider_baseline.mjs"),
    "utf8"
  );
  const processEnvPrefix = "process.env.";

  assert(
    !script.includes(`${processEnvPrefix}OPENAI_API_KEY`),
    "v0.2 provider baseline verification must not read OPENAI_API_KEY."
  );
  assert(
    !script.includes(`${processEnvPrefix}DEEPSEEK_API_KEY`),
    "v0.2 provider baseline verification must not read DEEPSEEK_API_KEY."
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
  console.error("v0.2 provider baseline verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
