/* global console */
import { spawn } from "node:child_process";
import process from "node:process";

async function main() {
  const auditCommand = getNpmAuditCommand();
  const result = await runCommand(auditCommand.executable, auditCommand.args, process.cwd(), {
    allowFailure: true
  });
  const output = result.stdout.trim();

  if (!output) {
    throw new Error(`npm audit did not return JSON output.\n${result.stderr.trim()}`);
  }

  const audit = JSON.parse(output);
  if (audit.error) {
    throw new Error(`npm audit returned an error: ${audit.error.summary || audit.message || "unknown error"}`);
  }

  const counts = audit.metadata?.vulnerabilities ?? {};
  const vulnerabilities = audit.vulnerabilities ?? {};

  console.log("Dependency audit summary:");
  console.log("");
  console.log(`Total: ${counts.total ?? 0}`);
  console.log(`Low: ${counts.low ?? 0}`);
  console.log(`Moderate: ${counts.moderate ?? 0}`);
  console.log(`High: ${counts.high ?? 0}`);
  console.log(`Critical: ${counts.critical ?? 0}`);
  console.log("");
  console.log("Affected packages:");

  for (const vulnerability of Object.values(vulnerabilities).sort(compareVulnerabilities)) {
    console.log(
      `- ${vulnerability.name}: severity=${vulnerability.severity}, direct=${Boolean(
        vulnerability.isDirect
      )}, fixAvailable=${formatFixAvailable(vulnerability.fixAvailable)}`
    );
  }
}

function getNpmAuditCommand() {
  if (process.env.npm_execpath) {
    return {
      executable: process.execPath,
      args: [process.env.npm_execpath, "audit", "--json"]
    };
  }

  return {
    executable: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["audit", "--json"]
  };
}

function compareVulnerabilities(left, right) {
  return String(left.name).localeCompare(String(right.name));
}

function formatFixAvailable(fixAvailable) {
  if (fixAvailable === false || fixAvailable === undefined) {
    return "false";
  }

  if (fixAvailable === true) {
    return "true";
  }

  const packageName = fixAvailable.name ?? "unknown";
  const version = fixAvailable.version ?? "unknown";
  const force = Boolean(fixAvailable.isSemVerMajor);
  return `${packageName}@${version}, forceRequired=${force}`;
}

function runCommand(executable, args, cwd, options = {}) {
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
      if (exitCode !== 0 && !options.allowFailure) {
        reject(new Error(`Command failed: ${executable} ${args.join(" ")}\n${stderr.trim()}`));
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}

main().catch((error) => {
  console.error("Dependency audit summary failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
