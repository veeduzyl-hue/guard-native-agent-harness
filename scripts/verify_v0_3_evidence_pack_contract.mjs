/* global console */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const manifestFileName = "evidence-manifest.json";
const schemaVersion = "guard-native-evidence-pack-manifest.v1";
const evidencePackVersion = "v0.3";
const createdBy = "guard-native-agent-harness";

const requiredFiles = [
  manifestFileName,
  "task.json",
  "plan.json",
  "final-report.md",
  "tool-calls.jsonl",
  "blocked-actions.jsonl",
  "command-results.jsonl",
  "guard-results.json"
];

const requiredManifestFiles = requiredFiles.filter((fileName) => fileName !== manifestFileName);
const jsonFiles = [manifestFileName, "task.json", "plan.json", "guard-results.json"];
const jsonlFiles = ["tool-calls.jsonl", "blocked-actions.jsonl", "command-results.jsonl"];
const optionalJsonlFiles = ["policy-decisions.jsonl"];
const optionalManifestFiles = ["file-changes.diff", ...optionalJsonlFiles];
const defaultFixtureChecks = [
  {
    label: "valid basic v0.3 evidence pack",
    relativePath: "fixtures/v0.3/evidence-pack-valid-basic",
    expectedValid: true
  },
  {
    label: "invalid missing required file v0.3 evidence pack",
    relativePath: "fixtures/v0.3/evidence-pack-invalid-missing-required-file",
    expectedValid: false,
    expectedMessage: "missing required evidence file: plan.json"
  },
  {
    label: "invalid malformed JSONL v0.3 evidence pack",
    relativePath: "fixtures/v0.3/evidence-pack-invalid-jsonl",
    expectedValid: false,
    expectedMessage: "tool-calls.jsonl contains malformed JSONL at line 2"
  }
];

const forbiddenReviewClaims = [
  ["safe", "to", "deploy"].join(" "),
  "app" + "roved",
  "cert" + "ified",
  "compl" + "iant",
  ["production", "ready"].join(" "),
  ["enforcement", "action"].join(" "),
  ["authorization", "granted"].join(" ")
];

export async function main() {
  const repoRoot = process.cwd();
  const requestedPacks = process.argv.slice(2);

  if (requestedPacks.length > 0) {
    await verifyRequestedPacks(repoRoot, requestedPacks);
    return;
  }

  await verifyFixtureContract(repoRoot);
}

async function verifyRequestedPacks(repoRoot, requestedPacks) {
  const results = [];

  for (const requestedPack of requestedPacks) {
    const evidenceDirectory = path.resolve(repoRoot, requestedPack);
    const result = await verifyEvidencePack(evidenceDirectory);
    results.push({ requestedPack, result });
  }

  const failures = results.filter(({ result }) => !result.valid);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${failure.requestedPack}: v0.3 evidence pack verification failed.`);
      for (const error of failure.result.errors) {
        console.error(`- ${error}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log("v0.3 evidence pack contract verification passed.");
  console.log("");
  console.log("- evidence-first local review artifact");
  console.log("- deterministic manifest ordering and hashes verified");
  console.log("- read-only verification only");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
  console.log("- no provider output can authorize execution");
  console.log("- no Guard runtime semantic change");
}

async function verifyFixtureContract(repoRoot) {
  const checks = [];

  for (const fixture of defaultFixtureChecks) {
    const evidenceDirectory = path.join(repoRoot, fixture.relativePath);
    const result = await verifyEvidencePack(evidenceDirectory);

    if (fixture.expectedValid && !result.valid) {
      throw new Error(`${fixture.label} should be valid:\n${result.errors.join("\n")}`);
    }

    if (!fixture.expectedValid && result.valid) {
      throw new Error(`${fixture.label} should be invalid.`);
    }

    if (
      fixture.expectedMessage &&
      !result.errors.some((error) => error.includes(fixture.expectedMessage))
    ) {
      throw new Error(
        `${fixture.label} did not report expected deterministic error: ${fixture.expectedMessage}`
      );
    }

    checks.push(`${fixture.label}: ${fixture.expectedValid ? "valid" : "invalid as expected"}`);
  }

  await verifyVerifierBoundary(repoRoot);

  console.log("v0.3 evidence pack contract verification passed.");
  console.log("");
  for (const check of checks) {
    console.log(`- ${check}`);
  }
  console.log("- evidence-first local review artifact");
  console.log("- deterministic manifest ordering and hashes verified");
  console.log("- read-only verification only");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
  console.log("- no provider output can authorize execution");
  console.log("- no Guard runtime semantic change");
}

export async function verifyEvidencePack(evidenceDirectory) {
  const errors = [];

  if (!existsSync(evidenceDirectory)) {
    return { valid: false, errors: [`evidence pack directory does not exist: ${evidenceDirectory}`] };
  }

  await verifyRequiredFiles(evidenceDirectory, errors);
  const parsedJson = await verifyJsonFiles(evidenceDirectory, errors);
  await verifyJsonlFiles(evidenceDirectory, errors);
  await verifyReviewBoundaryLanguage(evidenceDirectory, errors);

  const manifest = parsedJson.get(manifestFileName);
  const task = parsedJson.get("task.json");
  if (manifest && isRecord(manifest)) {
    await verifyManifest(evidenceDirectory, manifest, isRecord(task) ? task : null, errors);
  }

  return { valid: errors.length === 0, errors };
}

async function verifyRequiredFiles(evidenceDirectory, errors) {
  for (const fileName of requiredFiles) {
    if (!existsSync(path.join(evidenceDirectory, fileName))) {
      errors.push(`missing required evidence file: ${fileName}`);
    }
  }
}

async function verifyJsonFiles(evidenceDirectory, errors) {
  const parsed = new Map();

  for (const fileName of jsonFiles) {
    const filePath = path.join(evidenceDirectory, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    if (content.trim() === "") {
      errors.push(`${fileName} is empty JSON.`);
      continue;
    }

    try {
      parsed.set(fileName, JSON.parse(content));
    } catch {
      errors.push(`${fileName} is malformed JSON.`);
    }
  }

  return parsed;
}

async function verifyJsonlFiles(evidenceDirectory, errors) {
  const fileNames = [...jsonlFiles];

  for (const optionalFileName of optionalJsonlFiles) {
    if (existsSync(path.join(evidenceDirectory, optionalFileName))) {
      fileNames.push(optionalFileName);
    }
  }

  for (const fileName of fileNames) {
    const filePath = path.join(evidenceDirectory, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    if (content.trim() === "") {
      continue;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.trim() === "") {
        return;
      }

      try {
        JSON.parse(line);
      } catch {
        errors.push(`${fileName} contains malformed JSONL at line ${index + 1}.`);
      }
    });
  }
}

async function verifyReviewBoundaryLanguage(evidenceDirectory, errors) {
  const finalReportPath = path.join(evidenceDirectory, "final-report.md");
  if (!existsSync(finalReportPath)) {
    return;
  }

  const finalReport = (await readFile(finalReportPath, "utf8")).toLowerCase();
  for (const forbiddenClaim of forbiddenReviewClaims) {
    if (finalReport.includes(forbiddenClaim)) {
      errors.push(`final-report.md contains forbidden review claim: ${forbiddenClaim}`);
    }
  }
}

async function verifyManifest(evidenceDirectory, manifest, task, errors) {
  if (manifest.schema_version !== schemaVersion) {
    errors.push(`evidence-manifest.json schema_version must be ${schemaVersion}.`);
  }
  if (manifest.evidence_pack_version !== evidencePackVersion) {
    errors.push(`evidence-manifest.json evidence_pack_version must be ${evidencePackVersion}.`);
  }
  if (manifest.created_by !== createdBy) {
    errors.push(`evidence-manifest.json created_by must be ${createdBy}.`);
  }
  if (!Array.isArray(manifest.files)) {
    errors.push("evidence-manifest.json files must be an array.");
    return;
  }
  if (task && manifest.task_id !== task.task_id) {
    errors.push("evidence-manifest.json task_id must match task.json task_id.");
  }

  verifyManifestOrdering(manifest.files, errors);
  await verifyManifestEntries(evidenceDirectory, manifest.files, errors);
}

function verifyManifestOrdering(files, errors) {
  const paths = files.map((entry) => (isRecord(entry) ? entry.path : undefined));
  const sortedPaths = [...paths].sort((left, right) => String(left).localeCompare(String(right)));

  if (JSON.stringify(paths) !== JSON.stringify(sortedPaths)) {
    errors.push("evidence-manifest.json files must be sorted by path.");
  }
}

async function verifyManifestEntries(evidenceDirectory, files, errors) {
  const manifestPaths = new Set();

  for (const entry of files) {
    if (!isRecord(entry)) {
      errors.push("evidence-manifest.json contains a non-object file entry.");
      continue;
    }

    const entryPath = typeof entry.path === "string" ? entry.path : "";
    manifestPaths.add(entryPath);
    verifyRelativeManifestPath(entryPath, errors);
    verifyManifestRole(entry, entryPath, errors);

    if (!entryPath || hasUnsafeManifestPath(entryPath)) {
      continue;
    }

    const absolutePath = path.join(evidenceDirectory, entryPath);
    if (!existsSync(absolutePath)) {
      errors.push(`manifest entry references missing file: ${entryPath}`);
      continue;
    }

    const fileBytes = await readFile(absolutePath);
    const fileStat = await stat(absolutePath);
    const expectedHash = createHash("sha256").update(fileBytes).digest("hex");

    if (entry.size_bytes !== fileStat.size) {
      errors.push(`manifest size mismatch for ${entryPath}.`);
    }
    if (entry.sha256 !== expectedHash) {
      errors.push(`manifest sha256 mismatch for ${entryPath}.`);
    }
  }

  for (const requiredFile of requiredManifestFiles) {
    if (!manifestPaths.has(requiredFile)) {
      errors.push(`manifest missing required file entry: ${requiredFile}`);
    }
  }

  for (const manifestPath of manifestPaths) {
    if (
      manifestPath &&
      !requiredManifestFiles.includes(manifestPath) &&
      !optionalManifestFiles.includes(manifestPath)
    ) {
      errors.push(`manifest contains unexpected file entry: ${manifestPath}`);
    }
  }
}

function verifyRelativeManifestPath(entryPath, errors) {
  if (!entryPath) {
    errors.push("manifest file entry path must be a non-empty string.");
    return;
  }

  if (hasUnsafeManifestPath(entryPath)) {
    errors.push(`manifest file entry path is not a local pack path: ${entryPath}`);
  }
}

function verifyManifestRole(entry, entryPath, errors) {
  if (typeof entry.role !== "string" || entry.role.trim() === "") {
    errors.push(`manifest entry role must be present for ${entryPath || "unknown path"}.`);
  }
  if (typeof entry.size_bytes !== "number" || !Number.isInteger(entry.size_bytes)) {
    errors.push(`manifest entry size_bytes must be an integer for ${entryPath || "unknown path"}.`);
  }
  if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    errors.push(`manifest entry sha256 must be lowercase SHA-256 for ${entryPath || "unknown path"}.`);
  }
}

function hasUnsafeManifestPath(entryPath) {
  return (
    path.isAbsolute(entryPath) ||
    entryPath.includes("\\") ||
    entryPath.split("/").includes("..") ||
    entryPath === manifestFileName
  );
}

async function verifyVerifierBoundary(repoRoot) {
  const scriptPath = path.join(repoRoot, "scripts", "verify_v0_3_evidence_pack_contract.mjs");
  const script = await readFile(scriptPath, "utf8");
  const forbiddenVerifierFragments = [
    "sp" + "awn(",
    "ex" + "ec(",
    "exec" + "File(",
    ["process", "env"].join("."),
    [".", "env"].join(""),
    ["OPENAI", "API", "KEY"].join("_"),
    ["DEEPSEEK", "API", "KEY"].join("_"),
    ["guard", "audit"].join(" "),
    ["guard", "status"].join(" "),
    ["guard", "drift"].join(" ")
  ];

  for (const fragment of forbiddenVerifierFragments) {
    if (script.includes(fragment)) {
      throw new Error(`v0.3 verifier boundary violation: ${fragment}`);
    }
  }

  await verifyNoFixtureSecrets(repoRoot);
}

async function verifyNoFixtureSecrets(repoRoot) {
  const fixtureRoot = path.join(repoRoot, "fixtures", "v0.3");
  const fixtureFiles = await listFiles(fixtureRoot);

  for (const filePath of fixtureFiles) {
    const content = await readFile(filePath, "utf8");
    if (/api[_-]?key|secret|token/i.test(content)) {
      throw new Error(`fixture must not persist API keys or credentials: ${filePath}`);
    }
    if (/chain.of.thought|reasoning trace|hidden reasoning/i.test(content)) {
      throw new Error(`fixture must not record model reasoning or chain-of-thought: ${filePath}`);
    }
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("v0.3 evidence pack contract verification failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
