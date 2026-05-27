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
    omitEnvironmentVariables: ["OPENAI_API_KEY"]
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
  const toolCalls = await readJsonl(path.join(evidenceDirectory, "tool-calls.jsonl"));
  const finalReport = await readFile(path.join(evidenceDirectory, "final-report.md"), "utf8");

  if (toolCalls.length < 1) {
    throw new Error("Safe demo did not record any tool-call evidence.");
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
  const blockedActions = await readJsonl(path.join(evidenceDirectory, "blocked-actions.jsonl"));
  const commandResults = await readJsonl(path.join(evidenceDirectory, "command-results.jsonl"));
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
  const forbiddenPackages = ["openai", "dotenv", "@anthropic-ai/sdk", "@google/generative-ai"];

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

  checks.push("mock verification requires no API key, OpenAI SDK, or dotenv dependency");
}

async function grepSourceForForbiddenModelRequirements(repoRoot) {
  const result = await runCommand(
    "git",
    [
      "grep",
      "-n",
      "-E",
      "from ['\"]openai['\"]|from ['\"]dotenv['\"]|@anthropic-ai|generative-ai",
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
