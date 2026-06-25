/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const requiredEvidenceFiles = [
  "task.json",
  "plan.json",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json",
  "evidence-manifest.json",
  "evidence-pack.json",
  "final-report.md"
];

const checks = [];

async function main() {
  const repoRoot = process.cwd();

  const cliPath = path.join(repoRoot, "dist", "cli.js");
  if (!existsSync(cliPath)) {
    throw new Error("dist/cli.js was not found. Run npm run build before npm run verify:v0.1.");
  }

  const safe = await runDemo(repoRoot, "Create a safe README update proposal");
  const unsafe = await runDemo(repoRoot, "Show a policy demo with blocked action");

  await verifyEvidencePack(repoRoot, safe.evidencePack, "safe demo");
  await verifyEvidencePack(repoRoot, unsafe.evidencePack, "unsafe demo");
  await verifySafeDemo(repoRoot, safe.evidencePack);
  await verifyUnsafeDemo(repoRoot, unsafe.evidencePack);
  await verifyNoExternalModelRequirement(repoRoot);

  console.log("v0.1 acceptance verification passed.");
  console.log("");
  for (const check of checks) {
    console.log(`- ${check}`);
  }
  console.log("");
  console.log(`Safe Evidence Pack: ${safe.evidencePack}`);
  console.log(`Unsafe Evidence Pack: ${unsafe.evidencePack}`);
}

async function runDemo(repoRoot, prompt) {
  const result = await runCommand(process.execPath, ["dist/cli.js", "run", prompt], repoRoot, {
    omitEnvironmentVariables: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"]
  });
  const evidencePack = parseEvidencePackPath(result.stdout);

  if (!evidencePack) {
    throw new Error(`Could not locate Evidence Pack path in CLI output for prompt: ${prompt}`);
  }

  return { evidencePack };
}

async function verifyEvidencePack(repoRoot, relativeEvidencePack, label) {
  const evidenceDirectory = path.resolve(repoRoot, relativeEvidencePack);

  for (const fileName of requiredEvidenceFiles) {
    const filePath = path.join(evidenceDirectory, fileName);
    if (!existsSync(filePath)) {
      throw new Error(`${label} is missing required evidence file: ${fileName}`);
    }
  }

  checks.push(`${label} contains all required evidence files`);
}

async function verifySafeDemo(repoRoot, relativeEvidencePack) {
  const evidenceDirectory = path.resolve(repoRoot, relativeEvidencePack);
  const task = JSON.parse(await readFile(path.join(evidenceDirectory, "task.json"), "utf8"));
  const plan = JSON.parse(await readFile(path.join(evidenceDirectory, "plan.json"), "utf8"));
  const toolCalls = await readJsonl(path.join(evidenceDirectory, "tool-calls.jsonl"));
  const compatibilityPack = JSON.parse(
    await readFile(path.join(evidenceDirectory, "evidence-pack.json"), "utf8")
  );
  const finalReport = await readFile(path.join(evidenceDirectory, "final-report.md"), "utf8");

  if (toolCalls.length < 1) {
    throw new Error("Safe demo did not record any tool-call evidence.");
  }

  verifyCompatibilityEnvelope(compatibilityPack, task, plan, "safe demo");
  const artifactPaths = compatibilityPack.artifacts.map((artifact) => artifact.path);
  if (
    !artifactPaths.includes("examples/readme-update/README_UPDATE_PROPOSAL.md") ||
    !artifactPaths.some((artifactPath) => artifactPath.endsWith("/tool-report.md"))
  ) {
    throw new Error("Safe demo compatibility envelope did not record the expected proposal and tool report artifacts.");
  }

  assertIncludes(finalReport, "Tool Calls", "Safe final report should include Tool Calls.");
  assertIncludes(finalReport, "Guard Results", "Safe final report should include Guard Results.");
  assertIncludes(
    finalReport,
    "Guard results are recorded as evidence only. They do not grant execution authority.",
    "Safe final report should include Guard evidence-only boundary statement."
  );

  checks.push("safe demo has tool-call evidence and final report governance sections");
}

async function verifyUnsafeDemo(repoRoot, relativeEvidencePack) {
  const evidenceDirectory = path.resolve(repoRoot, relativeEvidencePack);
  const task = JSON.parse(await readFile(path.join(evidenceDirectory, "task.json"), "utf8"));
  const plan = JSON.parse(await readFile(path.join(evidenceDirectory, "plan.json"), "utf8"));
  const blockedActions = await readJsonl(path.join(evidenceDirectory, "blocked-actions.jsonl"));
  const commandResults = await readJsonl(path.join(evidenceDirectory, "command-results.jsonl"));
  const compatibilityPack = JSON.parse(
    await readFile(path.join(evidenceDirectory, "evidence-pack.json"), "utf8")
  );
  const finalReport = await readFile(path.join(evidenceDirectory, "final-report.md"), "utf8");

  if (blockedActions.length < 1) {
    throw new Error("Unsafe demo did not record any blocked-action evidence.");
  }

  if (commandResults.length !== 0) {
    throw new Error(
      "Unsafe demo recorded command results, which would imply a blocked command executed."
    );
  }

  const rules = new Set(blockedActions.map((event) => event.matched_rule));
  if (!rules.has("block-env-read") || !rules.has("block-git-push")) {
    throw new Error(
      "Unsafe demo did not record the expected blocked .env read and git push request."
    );
  }

  verifyCompatibilityEnvelope(compatibilityPack, task, plan, "unsafe demo");
  if (compatibilityPack.tool_calls.length !== 0) {
    throw new Error("Unsafe demo compatibility envelope should not record tool call events.");
  }
  if (
    JSON.stringify(compatibilityPack.blocked_actions.map((event) => event.matched_rule)) !==
    JSON.stringify(["block-env-read", "block-git-push"])
  ) {
    throw new Error("Unsafe demo compatibility envelope did not preserve blocked action facts.");
  }

  assertIncludes(
    finalReport,
    "Blocked Actions",
    "Unsafe final report should include Blocked Actions."
  );
  assertIncludes(
    finalReport,
    "Total blocked actions",
    "Unsafe final report should include blocked action summary."
  );

  checks.push("unsafe demo has blocked-action evidence and no command execution results");
}

async function verifyNoExternalModelRequirement(repoRoot) {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const forbiddenPackages = [
    "openai",
    "deepseek",
    "dotenv",
    "@anthropic-ai/sdk",
    "@google/generative-ai"
  ];

  for (const packageName of forbiddenPackages) {
    if (dependencies[packageName]) {
      throw new Error(
        `External model package is present but v0.1 acceptance must remain no-LLM: ${packageName}`
      );
    }
  }

  const sourceMatches = await grepSourceForForbiddenModelRequirements(repoRoot);
  if (sourceMatches.length > 0) {
    throw new Error(`External model requirement found in source: ${sourceMatches.join(", ")}`);
  }

  checks.push("mock verification requires no provider API key, SDK, or dotenv dependency");
}

async function grepSourceForForbiddenModelRequirements(repoRoot) {
  const result = await runCommand(
    "git",
    [
      "grep",
      "-n",
      "-E",
      "from ['\"]openai['\"]|from ['\"]deepseek['\"]|from ['\"]dotenv['\"]|@anthropic-ai|generative-ai",
      "--",
      "src"
    ],
    repoRoot,
    { allowFailure: true }
  );

  return result.exitCode === 0 ? result.stdout.trim().split(/\r?\n/).filter(Boolean) : [];
}

async function readJsonl(filePath) {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseEvidencePackPath(stdout) {
  const match = stdout.match(/^Evidence Pack:\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
}

function verifyCompatibilityEnvelope(compatibilityPack, task, plan, label) {
  assertEqual(compatibilityPack.schema_version, "mindforge-guard-evidence.v1", `${label} schema_version`);
  assertEqual(compatibilityPack.pack_id, task.task_id, `${label} pack_id`);
  assertEqual(compatibilityPack.pack_type, "execution_facts", `${label} pack_type`);
  assertEqual(
    compatibilityPack.producer?.id,
    "guard-native-agent-harness",
    `${label} producer.id`
  );
  assertEqual(
    compatibilityPack.producer?.role,
    "evidence_producer",
    `${label} producer.role`
  );
  assertEqual(
    compatibilityPack.workflow?.task_id,
    task.task_id,
    `${label} workflow.task_id`
  );
  assertEqual(
    compatibilityPack.workflow?.step_count,
    plan.steps.length,
    `${label} workflow.step_count`
  );
  assertEqual(
    compatibilityPack.authority?.boundary,
    "producer_only",
    `${label} authority.boundary`
  );
  assertEqual(
    compatibilityPack.authority?.consumer_authority,
    "mindforge-guard-core",
    `${label} authority.consumer_authority`
  );
  assertEqual(
    compatibilityPack.authority?.governance_outputs_emitted,
    false,
    `${label} authority.governance_outputs_emitted`
  );
  assertEqual(
    compatibilityPack.authority?.execution_authority_granted,
    false,
    `${label} authority.execution_authority_granted`
  );
  assertEqual(
    compatibilityPack.manifest?.path,
    "evidence-manifest.json",
    `${label} manifest.path`
  );

  const serialized = JSON.stringify(compatibilityPack);
  for (const forbiddenFragment of [
    "\"verdict\"",
    "\"reason_codes\"",
    "\"risk_summary\"",
    "\"evidence_coverage\"",
    "GovernanceReportModel",
    "generateGovernanceReport",
    "generateEvidenceIndex"
  ]) {
    if (serialized.includes(forbiddenFragment)) {
      throw new Error(`${label} compatibility envelope must not emit forbidden governance output: ${forbiddenFragment}`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
  }
}

function runCommand(executable, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const variableName of options.omitEnvironmentVariables ?? []) {
      delete env[variableName];
    }

    const child = spawn(executable, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env
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
        reject(
          new Error(
            `Command failed: ${executable} ${args.join(" ")}\nExit code: ${exitCode}\n${stderr.trim()}`
          )
        );
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}

main().catch((error) => {
  console.error("v0.1 acceptance verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
