/* global console */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const schemaPath = "schemas/v0.5/evidence-review-profile.schema.json";
const validProfileDir = "fixtures/v0.5/review-profiles";
const invalidProfileDir = "fixtures/v0.5/review-profiles-invalid";
const expectedSchemaVersion = "guard-native-evidence-review-profile.v0.5";
const expectedProfileIds = ["local-dev", "ci-pr", "release-prep", "audit-review"];
const requiredProfileFields = [
  "schema_version",
  "profile_id",
  "display_name",
  "description",
  "intended_context",
  "required_evidence_files",
  "expected_verifiers",
  "inspection_outputs",
  "review_sections",
  "boundary",
  "non_goals"
];
const boundaryFlags = [
  "approval",
  "enforcement",
  "autonomous_execution",
  "runtime_control_plane",
  "authority_grant",
  "provider_output_authorizes_execution"
];
const allowedInspectionFormats = new Set(["json", "markdown"]);
const forbiddenCommandFragments = [
  "git tag",
  "git push",
  "gh release",
  "npm publish",
  "npm audit fix",
  "curl",
  "wget",
  "powershell",
  "bash -c",
  "cmd /c",
  ".env",
  "openai_api_key",
  "deepseek_api_key",
  "ollama"
];
const expectedValidProfiles = {
  "local-dev": {
    expected_verifiers: [
      "npm run build",
      "npm test",
      "npm run lint",
      "npm run verify:v0.3:evidence",
      "npm run verify:v0.3:inspect-evidence"
    ],
    required_evidence_files: [
      "fixtures/v0.3/evidence-pack-valid-basic/evidence-manifest.json",
      "fixtures/v0.3/evidence-pack-valid-basic/final-report.md",
      "fixtures/v0.3/evidence-pack-valid-basic/guard-results.json"
    ],
    inspection_outputs: [".artifacts/inspect-evidence/local-dev.json", ".artifacts/inspect-evidence/local-dev.md"],
    review_sections: ["expected-verifiers", "evidence-files", "boundary"]
  },
  "ci-pr": {
    expected_verifiers: [
      "npm run verify:v0.4:ci-workflow",
      "npm run verify:v0.4:ci-evidence-artifact",
      "npm run audit:summary"
    ],
    required_evidence_files: [
      ".artifacts/v0.4/ci-evidence-artifact-smoke/evidence-manifest.json",
      ".artifacts/v0.4/ci-evidence-artifact-smoke/final-report.md",
      ".artifacts/v0.4/ci-evidence-artifact-smoke/guard-results.json"
    ],
    inspection_outputs: [
      ".artifacts/v0.4/ci-evidence-artifact-smoke/inspection.json",
      ".artifacts/v0.4/ci-evidence-artifact-smoke/inspection.md"
    ],
    review_sections: ["ci-verifiers", "review-artifacts", "boundary"]
  },
  "release-prep": {
    expected_verifiers: [
      "npm run build",
      "npm test",
      "npm run lint",
      "npm run verify:v0.3:release",
      "npm run verify:v0.4:release",
      "npm run audit:summary"
    ],
    required_evidence_files: [
      "docs/RELEASE_NOTES_v0.4.md",
      "docs/V0_4_TAG_PREP.md",
      "docs/V0_4_FINAL_RELEASE_GATE.md"
    ],
    inspection_outputs: [".artifacts/release-prep/inspection.json", ".artifacts/release-prep/inspection.md"],
    review_sections: ["release-verifiers", "release-artifacts", "boundary"]
  },
  "audit-review": {
    expected_verifiers: [
      "npm run verify:v0.3:evidence",
      "npm run verify:v0.3:runtime-evidence",
      "npm run verify:v0.3:inspect-evidence",
      "npm run verify:v0.4:ci-evidence-artifact"
    ],
    required_evidence_files: [
      "evidence-manifest.json",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json",
      "policy-decisions.jsonl"
    ],
    inspection_outputs: [".artifacts/audit-review/inspection.json", ".artifacts/audit-review/inspection.md"],
    review_sections: ["manifest", "event-streams", "inspection", "boundary"]
  }
};
const invalidExpectations = {
  "missing-required-field.profile.json": "Missing required profile field: description",
  "authority-grant-true.profile.json": "boundary.authority_grant must be boolean false",
  "forbidden-command.profile.json": "Forbidden verifier command fragment"
};
const requiredNonGoalGroups = [
  ["saas"],
  ["dashboard"],
  ["oauth"],
  ["database"],
  ["telemetry service"],
  ["api key persistence"],
  [".env loading"],
  ["autonomous execution expansion"],
  ["provider behavior changes", "provider semantic changes"],
  ["planner behavior changes", "planner semantic changes"],
  ["tool registry semantic changes"],
  ["policy gate semantic changes"],
  ["guard adapter semantic changes"],
  ["guard runtime semantic changes"],
  ["compliance certification"],
  ["deployment approval"],
  ["merge approval"]
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = await readJson(path.join(repoRoot, "package.json"));
  const schema = await readJson(path.join(repoRoot, schemaPath));
  const docs = await readText(path.join(repoRoot, "docs/evidence/REVIEW_PROFILE_SCHEMA.md"));

  verifySchema(schema);
  verifyNonGoals(docs, "docs/evidence/REVIEW_PROFILE_SCHEMA.md");

  const profiles = await readValidProfiles(repoRoot, packageJson);
  await verifyInvalidProfiles(repoRoot, packageJson);

  console.log("v0.5 review profile verification passed.");
  console.log("");
  console.log(`- schema parsed: ${schemaPath}`);
  console.log(`- four expected profiles validated: ${profiles.map((profile) => profile.profile_id).join(", ")}`);
  console.log("- invalid fixtures rejected as expected: missing required field, authority grant true, forbidden command");
  console.log("- expected verifier references are declarative only");
  console.log("- no profile command was executed");
  console.log("- not approval");
  console.log("- not enforcement");
  console.log("- not autonomous execution");
  console.log("- not a runtime control plane");
  console.log("- no authority grant");
  console.log("- no provider output can authorize execution");
}

async function readValidProfiles(repoRoot, packageJson) {
  const profileFiles = (await readdir(path.join(repoRoot, validProfileDir)))
    .filter((fileName) => fileName.endsWith(".profile.json"))
    .sort((left, right) => left.localeCompare(right));
  const expectedFiles = expectedProfileIds.map((profileId) => `${profileId}.profile.json`).sort();
  assertArrayEqual(profileFiles, expectedFiles, "valid profile files");

  const profiles = [];
  const seenProfileIds = new Set();
  for (const fileName of profileFiles) {
    const filePath = path.join(repoRoot, validProfileDir, fileName);
    const profile = await readJson(filePath);
    validateProfile(profile, packageJson, {
      fileName,
      enforceFilename: true
    });
    assert(!seenProfileIds.has(profile.profile_id), `Duplicate profile_id: ${profile.profile_id}`);
    seenProfileIds.add(profile.profile_id);
    profiles.push(profile);
  }

  assertArrayEqual([...seenProfileIds].sort(), [...expectedProfileIds].sort(), "profile IDs");
  return profiles.sort((left, right) => expectedProfileIds.indexOf(left.profile_id) - expectedProfileIds.indexOf(right.profile_id));
}

async function verifyInvalidProfiles(repoRoot, packageJson) {
  const invalidFiles = (await readdir(path.join(repoRoot, invalidProfileDir)))
    .filter((fileName) => fileName.endsWith(".profile.json"))
    .sort((left, right) => left.localeCompare(right));
  assertArrayEqual(invalidFiles, Object.keys(invalidExpectations).sort(), "invalid profile files");

  for (const fileName of invalidFiles) {
    const profile = await readJson(path.join(repoRoot, invalidProfileDir, fileName));
    const expectedMessage = invalidExpectations[fileName];
    try {
      validateProfile(profile, packageJson, {
        fileName,
        enforceFilename: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(
        message.includes(expectedMessage),
        `${fileName} failed for unexpected reason. Expected "${expectedMessage}", received "${message}".`
      );
      continue;
    }
    throw new Error(`${fileName} unexpectedly passed validation.`);
  }
}

function verifySchema(schema) {
  assert(schema && typeof schema === "object" && !Array.isArray(schema), "Schema must parse as a JSON object.");
  assert(schema.properties?.schema_version?.const === expectedSchemaVersion, "Schema must declare the v0.5 schema version.");
  assertArrayEqual(schema.required ?? [], requiredProfileFields, "schema required fields");
  assertArrayEqual(schema.properties?.profile_id?.enum ?? [], expectedProfileIds, "schema profile_id enum");

  const boundary = schema.properties?.boundary;
  assert(boundary?.type === "object", "Schema boundary must be an object.");
  assert(boundary.additionalProperties === false, "Schema boundary must reject additional properties.");
  assertArrayEqual(boundary.required ?? [], boundaryFlags, "schema boundary required fields");
  for (const flag of boundaryFlags) {
    const property = boundary.properties?.[flag];
    assert(property?.type === "boolean", `Schema boundary.${flag} must be boolean.`);
    assert(property?.const === false, `Schema boundary.${flag} must be constrained to false.`);
  }
}

function validateProfile(profile, packageJson, options) {
  assert(profile && typeof profile === "object" && !Array.isArray(profile), `${options.fileName} must parse as an object.`);
  assertNoExtraKeys(profile, requiredProfileFields, "profile");
  for (const fieldName of requiredProfileFields) {
    assert(Object.hasOwn(profile, fieldName), `Missing required profile field: ${fieldName}`);
  }

  assert(profile.schema_version === expectedSchemaVersion, "schema_version must be the expected v0.5 value.");
  assert(expectedProfileIds.includes(profile.profile_id), `Unexpected profile_id: ${profile.profile_id}`);
  if (options.enforceFilename) {
    assert(options.fileName === `${profile.profile_id}.profile.json`, "filename must match profile_id.");
  }

  assertNonEmptyString(profile.display_name, "display_name");
  assertNonEmptyString(profile.description, "description");
  assertNonEmptyString(profile.intended_context, "intended_context");
  assertNoAuthorityClaims(profile);
  validateEvidenceFiles(profile.required_evidence_files);
  validateExpectedVerifiers(profile.expected_verifiers, packageJson);
  validateInspectionOutputs(profile.inspection_outputs);
  validateReviewSections(profile.review_sections);
  validateBoundary(profile.boundary);
  validateNonGoals(profile.non_goals);
  verifyExpectedProfileContents(profile);
}

function validateEvidenceFiles(evidenceFiles) {
  assertNonEmptyArray(evidenceFiles, "required_evidence_files");
  assertNoDuplicateObjects(evidenceFiles, "required_evidence_files");
  assertNoDuplicateValues(
    evidenceFiles.map((entry) => entry.path),
    "required_evidence_files paths"
  );
  for (const [index, evidenceFile] of evidenceFiles.entries()) {
    assertRecord(evidenceFile, `required_evidence_files[${index}]`);
    assertNoExtraKeys(evidenceFile, ["path", "role", "required"], `required_evidence_files[${index}]`);
    assertNonEmptyString(evidenceFile.path, `required_evidence_files[${index}].path`);
    assertNonEmptyString(evidenceFile.role, `required_evidence_files[${index}].role`);
    assert(typeof evidenceFile.required === "boolean", `required_evidence_files[${index}].required must be boolean.`);
  }
}

function validateExpectedVerifiers(expectedVerifiers, packageJson) {
  assertNonEmptyArray(expectedVerifiers, "expected_verifiers");
  assertNoDuplicateValues(expectedVerifiers, "expected_verifiers");
  for (const [index, command] of expectedVerifiers.entries()) {
    assertNonEmptyString(command, `expected_verifiers[${index}]`);
    validateVerifierCommand(command, packageJson);
  }
}

function validateVerifierCommand(command, packageJson) {
  const normalizedCommand = command.toLowerCase();
  for (const fragment of forbiddenCommandFragments) {
    assert(!normalizedCommand.includes(fragment), `Forbidden verifier command fragment "${fragment}" in: ${command}`);
  }

  const npmRunMatch = /^npm run ([a-z0-9:._-]+)$/.exec(command);
  if (npmRunMatch) {
    const scriptName = npmRunMatch[1];
    assert(Object.hasOwn(packageJson.scripts ?? {}, scriptName), `Referenced npm script does not exist: ${scriptName}`);
    assert(
      scriptName === "build" ||
        scriptName === "lint" ||
        scriptName === "audit:summary" ||
        scriptName.startsWith("verify:"),
      `npm run command is outside the bounded verifier allowlist: ${command}`
    );
    return;
  }

  assert(command === "npm test", `Unsupported verifier command form: ${command}`);
  assert(Object.hasOwn(packageJson.scripts ?? {}, "test"), "Referenced npm test script does not exist.");
}

function validateInspectionOutputs(inspectionOutputs) {
  assertNonEmptyArray(inspectionOutputs, "inspection_outputs");
  assertNoDuplicateObjects(inspectionOutputs, "inspection_outputs");
  assertNoDuplicateValues(
    inspectionOutputs.map((entry) => entry.path),
    "inspection_outputs paths"
  );
  for (const [index, output] of inspectionOutputs.entries()) {
    assertRecord(output, `inspection_outputs[${index}]`);
    assertNoExtraKeys(output, ["path", "format", "description"], `inspection_outputs[${index}]`);
    assertNonEmptyString(output.path, `inspection_outputs[${index}].path`);
    assert(allowedInspectionFormats.has(output.format), `inspection_outputs[${index}].format must be json or markdown.`);
    assertNonEmptyString(output.description, `inspection_outputs[${index}].description`);
  }
}

function validateReviewSections(reviewSections) {
  assertNonEmptyArray(reviewSections, "review_sections");
  assertNoDuplicateObjects(reviewSections, "review_sections");
  assertNoDuplicateValues(
    reviewSections.map((entry) => entry.section_id),
    "review_sections section IDs"
  );
  for (const [index, section] of reviewSections.entries()) {
    assertRecord(section, `review_sections[${index}]`);
    assertNoExtraKeys(section, ["section_id", "display_name", "focus"], `review_sections[${index}]`);
    assertNonEmptyString(section.section_id, `review_sections[${index}].section_id`);
    assertNonEmptyString(section.display_name, `review_sections[${index}].display_name`);
    assertNonEmptyString(section.focus, `review_sections[${index}].focus`);
  }
}

function validateBoundary(boundary) {
  assertRecord(boundary, "boundary");
  assertNoExtraKeys(boundary, boundaryFlags, "boundary");
  for (const flag of boundaryFlags) {
    assert(Object.hasOwn(boundary, flag), `Missing required boundary flag: ${flag}`);
    assert(boundary[flag] === false, `boundary.${flag} must be boolean false.`);
  }
}

function validateNonGoals(nonGoals) {
  assertNonEmptyArray(nonGoals, "non_goals");
  assertNoDuplicateValues(nonGoals, "non_goals");
  for (const [index, nonGoal] of nonGoals.entries()) {
    assertNonEmptyString(nonGoal, `non_goals[${index}]`);
  }
  verifyNonGoals(nonGoals.join("\n"), "profile non_goals");
}

function verifyExpectedProfileContents(profile) {
  const expectedProfile = expectedValidProfiles[profile.profile_id];
  assert(expectedProfile, `No expected fixture baseline for profile_id: ${profile.profile_id}`);
  assertArrayEqual(profile.expected_verifiers, expectedProfile.expected_verifiers, `${profile.profile_id} expected_verifiers`);
  assertArrayEqual(
    profile.required_evidence_files.map((entry) => entry.path),
    expectedProfile.required_evidence_files,
    `${profile.profile_id} required_evidence_files`
  );
  assertArrayEqual(
    profile.inspection_outputs.map((entry) => entry.path),
    expectedProfile.inspection_outputs,
    `${profile.profile_id} inspection_outputs`
  );
  assertArrayEqual(
    profile.review_sections.map((entry) => entry.section_id),
    expectedProfile.review_sections,
    `${profile.profile_id} review_sections`
  );
}

function verifyNonGoals(content, label) {
  const normalizedContent = normalizeText(content);
  for (const group of requiredNonGoalGroups) {
    assert(
      group.some((phrase) => normalizedContent.includes(normalizeText(phrase))),
      `${label} must preserve non-goal: ${group.join(" or ")}`
    );
  }
}

function assertNoAuthorityClaims(profile) {
  const reviewText = [
    profile.display_name,
    profile.description,
    profile.intended_context,
    ...profile.review_sections.map((section) => section.display_name),
    ...profile.review_sections.map((section) => section.focus)
  ]
    .join("\n")
    .toLowerCase();
  const forbiddenClaimPatterns = [
    /\bis approval\b/,
    /\bgrants? authority\b/,
    /\bauthorizes? deployment\b/,
    /\bauthorizes? merges?\b/,
    /\bcertifies? compliance\b/,
    /\bdeployment[- ]safe\b/,
    /\bmerge[- ]safe\b/,
    /\bdeployment ready\b/,
    /\bmerge ready\b/
  ];
  for (const pattern of forbiddenClaimPatterns) {
    assert(!pattern.test(reviewText), `Profile includes forbidden authority claim: ${pattern}`);
  }
}

function assertRecord(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
}

function assertNoExtraKeys(value, expectedKeys, label) {
  const expectedKeySet = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    assert(expectedKeySet.has(key), `${label} contains unexpected field: ${key}`);
  }
}

function assertNonEmptyArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  assert(value.length > 0, `${label} must be non-empty.`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string", `${label} must be a string.`);
  assert(value.length > 0, `${label} must be non-empty.`);
}

function assertNoDuplicateValues(values, label) {
  const seen = new Set();
  for (const value of values) {
    const key = String(value);
    assert(!seen.has(key), `${label} contains duplicate value: ${key}`);
    seen.add(key);
  }
}

function assertNoDuplicateObjects(values, label) {
  const seen = new Set();
  for (const value of values) {
    const key = JSON.stringify(value);
    assert(!seen.has(key), `${label} contains duplicate object: ${key}`);
    seen.add(key);
  }
}

function assertArrayEqual(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array.`);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} mismatch. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
  );
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[`*_]/gu, "").replace(/^no\s+/u, "").replace(/\s+/gu, " ").trim();
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.5 review profile verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
