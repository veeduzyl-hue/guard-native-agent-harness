/* global AbortController, clearTimeout, console, fetch, setTimeout */
import process from "node:process";

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const TIMEOUT_MS = 5000;

async function main() {
  const requestedModel = parseRequestedModel(process.argv.slice(2));
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

    if (requestedModel) {
      console.log("");
      if (modelNames.includes(requestedModel)) {
        console.log(`Requested model check: ${requestedModel} is available locally.`);
      } else {
        console.log(`Requested model check: ${requestedModel} was not reported by /api/tags.`);
        console.log("The harness will not pull models automatically.");
      }
    }

    console.log("");
    console.log("Example command:");
    const exampleModel =
      requestedModel && modelNames.includes(requestedModel) ? requestedModel : modelNames[0];
    console.log(
      `npx guard-agent run "Create a safe README update proposal" --planner ollama --model ${exampleModel} --planner-timeout-ms 120000`
    );
    console.log("");
    console.log(
      "Large local models can need a longer planner timeout while loading or generating."
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("Ollama local check: timed out while checking http://localhost:11434.");
    } else {
      console.log("Ollama local check: unavailable at http://localhost:11434.");
    }

    console.log("This is informational only. CI validation does not require local Ollama.");
    console.log(
      "The harness does not install Ollama, pull models, or run shell commands to manage Ollama."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseRequestedModel(args) {
  const modelFlagIndex = args.indexOf("--model");
  if (modelFlagIndex >= 0) {
    return normalizeModelName(args[modelFlagIndex + 1]);
  }

  if (args.length === 1 && !args[0].startsWith("-")) {
    return normalizeModelName(args[0]);
  }

  return null;
}

function normalizeModelName(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
