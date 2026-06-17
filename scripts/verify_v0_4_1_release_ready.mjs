/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const releaseVersion = "0.4.1";
const expectedDependencies = {
  commander: "13.0.0"
};
const expectedDevDependencies = {
  "@eslint/js": "9.39.4",
  "@types/node": "22.10.2",
  eslint: "9.39.4",
  prettier: "3.4.2",
  typescript: "5.7.2",
  "typescript-eslint": "8.18.2",
  vite: "6.4.3",
  vitest: "4.1.7"
};
const requiredDocs = [
  "docs/RELEASE_NOTES_v0.4.1.md",
  "docs/V0_4_1_FINAL_RELEASE_GATE.md",
  "docs/V0_4_1_TAG_PREP.md",
  "docs/security/POST_V0_4_DEPENDENCY_REMEDIATION.md"
];
const requiredScripts = {
  "verify:post-v0.4:dependencies": "node scripts/verify_post_v0_4_dependency_remediation.mjs",
  "verify:v0.4.1:release": "node scripts/verify_v0_4_1_release_ready.mjs"
};
const requiredAdvisories = [
  "GHSA-h67p-54hq-rp68",
  "GHSA-v6wh-96g9-6wx3",
  "GHSA-fx2h-pf6j-xcff"
];
const requiredBoundaryLanguage = [
  "dependency-remediation-only",
  "no runtime semantic change",
  "no provider semantic change",
  "no Guard runtime semantic change"
];
const forbiddenDependencyNames = [
  "dotenv",
  "openai",
  "deepseek",
  "ollama",
  "@openai/sdk",
  "@ai-sdk/openai",
  "@deepseek/sdk"
];
const forbiddenTextFragments = [
  ["npm", "audit", "fix", "--force"].join(" "),
  ["npm", "publish"].join(" "),
  ["gh", "release", "create"].join(" "),
  ["GitHub", "Release", "publication", "in", "this", "release-prep", "PR"].join(" "),
  `readFileSync("${[".", "env"].join("")}"`,
  `readFile("${[".", "env"].join("")}"`,
  ["dotenv", "config"].join(".")
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));

  verifyPackageVersion(packageJson, packageLock);
  verifyScripts(packageJson);
  verifyDependencies(packageJson, packageLock);
  await verifyDocs(repoRoot);
  await verifyNoReleaseTag(repoRoot);

  console.log("v0.4.1 release readiness verification passed.");
  console.log("");
  console.log("- package root metadata pinned to 0.4.1");
  console.log("- v0.4.1 release docs present");
  console.log("- remediation record present");
  console.log("- dependency baseline remains vite 6.4.3, js-yaml 4.2.0, vitest 4.1.7");
  console.log("- no Vite 7 or Vite 8 dependency detected");
  console.log("- no dotenv or provider SDK dependency detected");
  console.log("- boundary language preserved");
  console.log("- no tag, release, publish, provider call, or .env action required");
}

function verifyPackageVersion(packageJson, packageLock) {
  assert(packageJson.version === releaseVersion, "package.json version must be 0.4.1.");
  assert(packageLock.version === releaseVersion, "package-lock.json top-level version must be 0.4.1.");
  assert(
    packageLock.packages?.[""]?.version === releaseVersion,
    "package-lock.json root package version must be 0.4.1."
  );
}

function verifyScripts(packageJson) {
  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    assert(packageJson.scripts?.[scriptName] === expectedCommand, `${scriptName} must run ${expectedCommand}.`);
  }
}

function verifyDependencies(packageJson, packageLock) {
  assertExactVersions(packageJson.dependencies ?? {}, expectedDependencies, "dependencies");
  assertExactVersions(packageJson.devDependencies ?? {}, expectedDevDependencies, "devDependencies");

  const rootPackage = packageLock.packages?.[""] ?? {};
  assertExactVersions(rootPackage.dependencies ?? {}, expectedDependencies, "package-lock.json root dependencies");
  assertExactVersions(rootPackage.devDependencies ?? {}, expectedDevDependencies, "package-lock.json root devDependencies");

  const packageEntries = Object.entries(packageLock.packages ?? {});
  const viteVersions = versionsForPackage(packageEntries, "vite");
  assert(viteVersions.has("6.4.3"), "package-lock.json must contain vite 6.4.3.");
  assert(!viteVersions.has("6.4.2"), "package-lock.json must not contain vulnerable vite 6.4.2.");
  for (const version of viteVersions) {
    assert(!version.startsWith("7."), `Vite 7 must not be introduced: ${version}.`);
    assert(!version.startsWith("8."), `Vite 8 must not be introduced: ${version}.`);
  }

  const jsYamlVersions = versionsForPackage(packageEntries, "js-yaml");
  assert(jsYamlVersions.has("4.2.0"), "package-lock.json must contain js-yaml 4.2.0.");
  assert(!jsYamlVersions.has("4.1.1"), "package-lock.json must not contain vulnerable js-yaml 4.1.1.");

  const dependencyNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...packageEntries.map(([entryPath, entry]) => packageNameFromLockPath(entryPath, entry)).filter(Boolean)
  ]);

  for (const packageName of dependencyNames) {
    assert(!isForbiddenDependencyName(packageName), `Forbidden dependency detected: ${packageName}`);
  }
}

async function verifyDocs(repoRoot) {
  const docs = await Promise.all(
    requiredDocs.map(async (filePath) => {
      assert(existsSync(path.join(repoRoot, filePath)), `Missing required v0.4.1 release doc: ${filePath}`);
      return {
        filePath,
        content: await readFile(path.join(repoRoot, filePath), "utf8")
      };
    })
  );
  const combined = docs.map((doc) => doc.content).join("\n");

  for (const advisory of requiredAdvisories) {
    assert(combined.includes(advisory), `v0.4.1 docs must include ${advisory}.`);
  }
  for (const phrase of requiredBoundaryLanguage) {
    assert(combined.includes(phrase), `v0.4.1 docs must include boundary phrase: ${phrase}.`);
  }

  assert(combined.includes("vite`: `6.4.2` to `6.4.3"), "v0.4.1 docs must document the Vite remediation.");
  assert(combined.includes("js-yaml`: `4.1.1` to `4.2.0"), "v0.4.1 docs must document the js-yaml remediation.");
  assert(combined.includes("Full audit: 0 vulnerabilities"), "v0.4.1 docs must document full audit result.");
  assert(combined.includes("Runtime-only audit: 0 vulnerabilities"), "v0.4.1 docs must document runtime-only audit result.");

  for (const { filePath, content } of docs) {
    assert(!content.toLowerCase().includes("complete security"), `${filePath} must not claim complete security.`);
  }

  const script = await readFile(path.join(repoRoot, "scripts/verify_v0_4_1_release_ready.mjs"), "utf8");
  for (const fragment of forbiddenTextFragments) {
    assert(!script.includes(fragment), `v0.4.1 verifier must not contain forbidden fragment: ${fragment}`);
  }
}

async function verifyNoReleaseTag(repoRoot) {
  const tagsAtHead = await runCommand("git", ["tag", "--points-at", "HEAD"], repoRoot);
  assert(tagsAtHead.stdout.trim() === "", "No release tag should point at HEAD.");
  const v041Tag = await runCommand("git", ["tag", "--list", "v0.4.1"], repoRoot);
  assert(v041Tag.stdout.trim() === "", "v0.4.1 tag must not exist before the final release gate.");
}

function versionsForPackage(packageEntries, packageName) {
  const versions = new Set();
  for (const [entryPath, entry] of packageEntries) {
    if (packageNameFromLockPath(entryPath, entry) === packageName && entry.version) {
      versions.add(entry.version);
    }
  }
  return versions;
}

function packageNameFromLockPath(entryPath, entry) {
  if (entry?.name) {
    return entry.name;
  }
  if (!entryPath.startsWith("node_modules/") && !entryPath.includes("/node_modules/")) {
    return null;
  }
  const normalizedPath = entryPath.startsWith("node_modules/")
    ? entryPath.slice("node_modules/".length)
    : entryPath.split("/node_modules/").pop();
  const parts = normalizedPath.split("/");
  if (parts[0]?.startsWith("@")) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function isForbiddenDependencyName(packageName) {
  return (
    forbiddenDependencyNames.includes(packageName) ||
    /^@?openai(?:\/|$)/.test(packageName) ||
    /deepseek/i.test(packageName) ||
    /^@?ollama(?:\/|$)/i.test(packageName)
  );
}

function assertExactVersions(actual, expected, label) {
  assert(
    JSON.stringify(sortRecord(actual)) === JSON.stringify(sortRecord(expected)),
    `${label} must match the v0.4.1 release baseline.`
  );
}

function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function runCommand(executable, args, cwd) {
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
      if (exitCode !== 0) {
        reject(new Error(`Command failed: ${executable} ${args.join(" ")}\n${stderr.trim()}`));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error("v0.4.1 release readiness verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
