/* global console */
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PLANNER_TIMEOUT_MS = 120000;
const REQUIRED_FILES = [
  "task.json",
  "plan.json",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json",
  "final-report.md"
];

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.error(
      "DEEPSEEK_API_KEY is not set. Set it in the process environment; this harness does not read .env files."
    );
    process.exitCode = 1;
    return;
  }

  const model = parseModel(process.argv.slice(2));

  if (!model) {
    fail("Missing required model. Usage: npm run verify:deepseek:planner -- --model <model-name>");
  }

  await assertBuiltCliExists();
  const cli = await runCli(model, apiKey);
  const evidencePack = parseEvidencePack(cli.stdout);

  if (!evidencePack) {
    fail("Could not locate Evidence Pack path in DeepSeek planner CLI output.");
  }

  await verifyEvidencePack(evidencePack, model, apiKey);

  console.log("DeepSeek planner local verification passed.");
  console.log("");
  console.log(`Model: ${model}`);
  console.log(`Evidence Pack: ${evidencePack}`);
  console.log("Verified:");
  console.log("- required evidence files are present");
  console.log("- provider and model metadata match the selected DeepSeek planner");
  console.log("- expected final report sections are present");
  console.log("- API key and reasoning-content fields do not appear in recorded evidence");
}

function parseModel(args) {
  const modelIndex = args.indexOf("--model");
  if (modelIndex >= 0) {
    return normalizeModel(args[modelIndex + 1]);
  }

  return null;
}

function normalizeModel(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function assertBuiltCliExists() {
  try {
    await access(path.join(process.cwd(), "dist", "cli.js"));
  } catch {
    fail("dist/cli.js was not found. Run npm run build before npm run verify:deepseek:planner.");
  }
}

async function runCli(model, apiKey) {
  const args = [
    "dist/cli.js",
    "run",
    "Create a safe README update proposal",
    "--planner",
    "deepseek",
    "--model",
    model,
    "--planner-timeout-ms",
    String(PLANNER_TIMEOUT_MS)
  ];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    windowsHide: true,
    shell: false,
    env: process.env
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

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    fail(
      [
        "DeepSeek planner command failed.",
        "Review the controlled provider error for authentication, rate limit, model, timeout, or plan validation failure.",
        "",
        "stdout:",
        redactApiKey(stdout.trim(), apiKey),
        "",
        "stderr:",
        redactApiKey(stderr.trim(), apiKey)
      ].join("\n")
    );
  }

  return { stdout };
}

function redactApiKey(value, apiKey) {
  return value.replaceAll(apiKey, "[redacted]");
}

function parseEvidencePack(stdout) {
  const match = stdout.match(/^Evidence Pack:\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

async function verifyEvidencePack(evidencePack, model, apiKey) {
  const evidenceDirectory = path.resolve(process.cwd(), evidencePack);
  const evidenceFiles = new Map();

  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(evidenceDirectory, fileName);
    await assertFileExists(filePath);
    evidenceFiles.set(fileName, await readFile(filePath, "utf8"));
  }

  const task = JSON.parse(evidenceFiles.get("task.json"));
  const plan = JSON.parse(evidenceFiles.get("plan.json"));
  const report = evidenceFiles.get("final-report.md");

  assertEqual(task.planner_provider, "deepseek", "task.json planner_provider");
  assertEqual(task.planner_model, model, "task.json planner_model");
  assertEqual(plan.provider, "deepseek", "plan.json provider");
  assertEqual(plan.model, model, "plan.json model");

  for (const section of ["Tool Calls", "Guard Results", "Runtime Boundary"]) {
    if (!report.includes(section)) {
      fail(`final-report.md is missing expected section: ${section}`);
    }
  }

  for (const [fileName, content] of evidenceFiles) {
    if (content.includes(apiKey)) {
      fail(`API key was found in evidence file: ${fileName}`);
    }

    if (content.includes("reasoning_content")) {
      fail(`Reasoning-content field was found in evidence file: ${fileName}`);
    }
  }
}

async function assertFileExists(filePath) {
  try {
    await access(filePath);
  } catch {
    fail(`Required evidence file is missing: ${filePath}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} expected ${JSON.stringify(expected)} but found ${JSON.stringify(actual)}.`);
  }
}

function fail(message) {
  console.error(`DeepSeek planner local verification failed: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
