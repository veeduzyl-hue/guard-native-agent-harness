/* global AbortController, clearTimeout, console, fetch, setTimeout */
import process from "node:process";

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const TIMEOUT_MS = 5000;

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_TAGS_URL, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      console.log(`Ollama local check: reachable, but /api/tags returned HTTP ${response.status}.`);
      console.log("The harness will not install Ollama or pull models automatically.");
      return;
    }

    const body = await response.json();
    const modelNames = extractModelNames(body);

    console.log("Ollama local check: reachable at http://localhost:11434.");

    if (modelNames.length === 0) {
      console.log("No local models were reported by /api/tags.");
      console.log("Install and pull models outside this harness before using --planner ollama.");
      return;
    }

    console.log("Available local models:");
    for (const modelName of modelNames) {
      console.log(`- ${modelName}`);
    }
    console.log("");
    console.log("Example command:");
    console.log(
      `npx guard-agent run "Create a safe README update proposal" --planner ollama --model ${modelNames[0]}`
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("Ollama local check: timed out while checking http://localhost:11434.");
    } else {
      console.log("Ollama local check: unavailable at http://localhost:11434.");
    }

    console.log("This is informational only. CI validation does not require local Ollama.");
    console.log("The harness does not install Ollama, pull models, or run shell commands to manage Ollama.");
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

main().catch((error) => {
  console.error("Ollama local check failed unexpectedly.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
