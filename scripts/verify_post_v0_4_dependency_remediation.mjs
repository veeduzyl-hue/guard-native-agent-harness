/* global console */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const packageVersion = "0.4.0";
const expectedViteVersion = "6.4.3";
const expectedJsYamlVersion = "4.2.0";
const remediationDocPath = "docs/security/POST_V0_4_DEPENDENCY_REMEDIATION.md";
const requiredAdvisories = [
  "GHSA-h67p-54hq-rp68",
  "GHSA-v6wh-96g9-6wx3",
  "GHSA-fx2h-pf6j-xcff"
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
const forbiddenRuntimeClaims = [
  ["runtime", "semantic", "change"].join(" "),
  ["production", "ready"].join(" "),
  ["safe", "to", "deploy"].join(" "),
  ["safe", "to", "merge"].join(" "),
  "certified",
  "complete security",
  ["authorization", "granted"].join(" ")
];

async function main() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
  const remediationDoc = await readFile(path.join(repoRoot, remediationDocPath), "utf8");

  verifyPackageMetadata(packageJson, packageLock);
  verifyDependencies(packageJson, packageLock);
  verifyRemediationDoc(repoRoot, remediationDoc);
  await verifyNoReleaseTag(repoRoot);

  console.log("post-v0.4 dependency remediation verification passed.");
  console.log("");
  console.log(`- package version remains ${packageVersion}`);
  console.log(`- direct Vite version is ${expectedViteVersion}`);
  console.log(`- lockfile contains js-yaml ${expectedJsYamlVersion}`);
  console.log("- no Vite 7 or Vite 8 dependency detected");
  console.log("- no dotenv or provider SDK dependency detected");
  console.log("- remediation document includes required advisory IDs");
  console.log("- no release tag detected on HEAD");
}

function verifyPackageMetadata(packageJson, packageLock) {
  assert(packageJson.version === packageVersion, "package.json version must remain 0.4.0.");
  assert(packageLock.version === packageVersion, "package-lock.json top-level version must remain 0.4.0.");
  assert(
    packageLock.packages?.[""]?.version === packageVersion,
    "package-lock.json root package version must remain 0.4.0."
  );
  assert(
    packageJson.devDependencies?.vite === expectedViteVersion,
    `package.json direct vite devDependency must be ${expectedViteVersion}.`
  );
  assert(!packageJson.dependencies?.vite, "vite must not be a runtime dependency.");
  assert(!packageJson.dependencies?.["js-yaml"], "js-yaml must not be a runtime dependency.");
  assert(!packageJson.devDependencies?.["js-yaml"], "js-yaml must not be added as a direct dev dependency.");
}

function verifyDependencies(packageJson, packageLock) {
  const packageEntries = Object.entries(packageLock.packages ?? {});
  const rootPackage = packageLock.packages?.[""] ?? {};

  assert(
    rootPackage.devDependencies?.vite === expectedViteVersion,
    `package-lock.json root vite devDependency must be ${expectedViteVersion}.`
  );

  const viteVersions = versionsForPackage(packageEntries, "vite");
  assert(viteVersions.has(expectedViteVersion), `package-lock.json must contain vite ${expectedViteVersion}.`);
  assert(!viteVersions.has("6.4.2"), "package-lock.json must not contain vulnerable vite 6.4.2.");
  for (const version of viteVersions) {
    assert(!version.startsWith("7."), `Vite 7 must not be introduced: ${version}.`);
    assert(!version.startsWith("8."), `Vite 8 must not be introduced: ${version}.`);
  }

  const jsYamlVersions = versionsForPackage(packageEntries, "js-yaml");
  assert(jsYamlVersions.has(expectedJsYamlVersion), `package-lock.json must contain js-yaml ${expectedJsYamlVersion}.`);
  assert(!jsYamlVersions.has("4.1.1"), "package-lock.json must not contain vulnerable js-yaml 4.1.1.");

  const declaredDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...rootPackage.dependencies,
    ...rootPackage.devDependencies
  };
  const lockDependencyNames = packageEntries
    .map(([entryPath, entry]) => packageNameFromLockPath(entryPath, entry))
    .filter(Boolean);
  const allDependencyNames = new Set([...Object.keys(declaredDependencies), ...lockDependencyNames]);

  for (const packageName of allDependencyNames) {
    assert(!isForbiddenDependencyName(packageName), `Forbidden dependency detected: ${packageName}`);
  }
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

function verifyRemediationDoc(repoRoot, remediationDoc) {
  assert(existsSync(path.join(repoRoot, remediationDocPath)), `Missing remediation document: ${remediationDocPath}`);
  for (const advisory of requiredAdvisories) {
    assert(remediationDoc.includes(advisory), `Remediation document must include ${advisory}.`);
  }
  assert(
    remediationDoc.includes("does not change runtime behavior"),
    "Remediation document must preserve runtime behavior boundary language."
  );
  assert(
    remediationDoc.includes("does not change runtime behavior") &&
      remediationDoc.includes("does not change runtime behavior, provider behavior"),
    "Remediation document must not introduce a runtime semantic change claim."
  );

  const lowerDoc = remediationDoc.toLowerCase();
  for (const claim of forbiddenRuntimeClaims) {
    assert(!lowerDoc.includes(claim), `Remediation document contains forbidden claim: ${claim}`);
  }
}

async function verifyNoReleaseTag(repoRoot) {
  const tags = await runCommand("git", ["tag", "--points-at", "HEAD"], repoRoot);
  assert(tags.stdout.trim() === "", "No release tag should point at HEAD.");
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
  console.error("post-v0.4 dependency remediation verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
