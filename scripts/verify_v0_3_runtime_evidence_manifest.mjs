/* global console */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { verifyEvidencePack } from "./verify_v0_3_evidence_pack_contract.mjs";

async function main() {
  const repoRoot = process.cwd();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-v0-3-runtime-"));
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(path.join(workspaceRoot, "README.md"), "# Runtime Evidence Fixture\n", "utf8");

  const { GuardAdapter } = await import(pathToFileURL(path.join(repoRoot, "dist/guard/adapter.js")));
  const { runTask } = await import(pathToFileURL(path.join(repoRoot, "dist/task/runner.js")));
  const { writeEvidenceManifest } = await import(
    pathToFileURL(path.join(repoRoot, "dist/evidence/manifest.js"))
  );

  const unavailableGuardAdapter = new GuardAdapter(async () => {
    throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
  });

  const result = await runTask("Show a policy demo with blocked action", {
    workspaceRoot,
    now: new Date("2026-05-28T00:00:00.000Z"),
    randomId: "v03runtime",
    guardAdapter: unavailableGuardAdapter
  });

  const manifestPath = path.join(result.evidenceDirectory, "evidence-manifest.json");
  const firstManifest = await readFile(manifestPath, "utf8");
  await writeEvidenceManifest(result.evidenceDirectory, result.task.task_id);
  const secondManifest = await readFile(manifestPath, "utf8");

  if (firstManifest !== secondManifest) {
    throw new Error("runtime evidence manifest is not deterministic when regenerated.");
  }

  const verification = await verifyEvidencePack(result.evidenceDirectory);
  if (!verification.valid) {
    throw new Error(
      `runtime-generated v0.3 evidence pack failed verification:\n${verification.errors.join("\n")}`
    );
  }

  console.log("v0.3 runtime evidence manifest verification passed.");
  console.log("");
  console.log(`- Evidence Pack: ${result.relativeEvidenceDirectory}`);
  console.log("- runtime task evidence includes evidence-manifest.json");
  console.log("- generated evidence pack passes v0.3 local verification");
  console.log("- deterministic manifest regeneration confirmed");
  console.log("- not approval, not enforcement, not autonomous execution");
  console.log("- not a runtime control plane; no authority grant");
  console.log("- no provider output can authorize execution");
  console.log("- no Guard runtime semantic change");
}

main().catch((error) => {
  console.error("v0.3 runtime evidence manifest verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
