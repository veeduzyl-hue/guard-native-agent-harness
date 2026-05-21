/* global AbortController, clearTimeout, console, fetch, setTimeout */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const OLLAMA_TIMEOUT_MS = 5000;
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
  const model = parseModel(process.argv.slice(2));

  if (!model) {
    fail("Missing required model. Usage: npm run verify:ollama:e2e -- --model <local-model-name>");
  }

  await assertOllamaReachable(model);
  await assertBuiltCliExists();

  const cli = await runCli(model);
  const evidencePack = parseEvidencePack(cli.stdout);

  if (!evidencePack) {
    fail(`Could not locate Evidence Pack path in CLI output.\n\n${cli.stdout}`);
  }

  await verifyEvidencePack(evidencePack, model);

  console.log("Ollama local E2E verification passed.");
  console.log("");
  console.log(`Model: ${model}`);
  console.log(`Evidence Pack: ${evidencePack}`);
  console.log("Verified files:");
  for (const fileName of REQUIRED_FILES) {
    console.log(`- ${fileName}`);
  }
}

function parseModel(args) {
  const modelIndex = args.indexOf("--model");
  if (modelIndex >= 0) {
    return normalizeModel(args[modelIndex + 1]);
  }

  return args.length === 1 ? normalizeModel(args[0]) : null;
}

function normalizeModel(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function assertOllamaReachable(model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_TAGS_URL, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      fail(`Local Ollama is reachable, but /api/tags returned HTTP ${response.status}.`);
    }

    const body = await response.json();
    const models = extractModelNames(body);

    if (!models.includes(model)) {
      fail(
        [
          `Model "${model}" was not reported by local Ollama.`,
          "The harness does not pull models automatically.",
          "Run npm run check:ollama to inspect local model names."
        ].join(" ")
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      fail("Timed out while checking local Ollama at http://localhost:11434.");
    }

    fail(
      "Local Ollama is unavailable at http://localhost:11434. Start Ollama outside this harness and retry."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function extractModelNames(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.models)) {
    return [];
  }

  return value.models
    .map((model) => (model && typeof model.name === "string" ? model.name : null))
    .filter((modelName) => typeof modelName === "string");
}

async function assertBuiltCliExists() {
  try {
    await access(path.join(process.cwd(), "dist", "cli.js"));
  } catch {
    fail("dist/cli.js was not found. Run npm run build before npm run verify:ollama:e2e.");
  }
}

async function runCli(model) {
  const args = [
    "dist/cli.js",
    "run",
    "Create a safe README update proposal",
    "--planner",
    "ollama",
    "--model",
    model,
    "--planner-timeout-ms",
    String(PLANNER_TIMEOUT_MS)
  ];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    windowsHide: true,
    shell: false
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

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    fail(
      [
        "Ollama E2E command failed.",
        "The model may have returned a plan that failed validation or local Ollama may need attention.",
        "",
        "stdout:",
        stdout.trim(),
        "",
        "stderr:",
        stderr.trim()
      ].join("\n")
    );
  }

  return { stdout, stderr };
}

function parseEvidencePack(stdout) {
  const match = stdout.match(/^Evidence Pack:\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

async function verifyEvidencePack(evidencePack, model) {
  for (const fileName of REQUIRED_FILES) {
    await assertFileExists(path.join(process.cwd(), evidencePack, fileName));
  }

  const task = JSON.parse(
    await readFile(path.join(process.cwd(), evidencePack, "task.json"), "utf8")
  );
  const plan = JSON.parse(
    await readFile(path.join(process.cwd(), evidencePack, "plan.json"), "utf8")
  );
  const report = await readFile(path.join(process.cwd(), evidencePack, "final-report.md"), "utf8");
  const toolCalls = await readFile(
    path.join(process.cwd(), evidencePack, "tool-calls.jsonl"),
    "utf8"
  );

  assertEqual(task.planner_provider, "ollama", "task.json planner_provider");
  assertEqual(task.planner_model, model, "task.json planner_model");
  assertEqual(plan.provider, "ollama", "plan.json provider");
  assertEqual(plan.model, model, "plan.json model");

  if (toolCalls.trim() === "") {
    fail("tool-calls.jsonl did not contain any tool-call evidence.");
  }

  for (const section of ["Tool Calls", "Guard Results", "Runtime Boundary"]) {
    if (!report.includes(section)) {
      fail(`final-report.md is missing expected section: ${section}`);
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
  console.error(`Ollama local E2E verification failed: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
