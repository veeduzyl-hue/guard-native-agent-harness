import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolDefinition } from "./types.js";

const execFileAsync = promisify(execFile);

export const gitDiffTool: ToolDefinition = {
  metadata: {
    name: "git_diff",
    description: "Inspect git diff using a read-only command.",
    riskLevel: "low",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true
  },
  async execute(context) {
    const { stdout } = await execFileAsync("git", ["diff"], {
      cwd: context.workspaceRoot,
      windowsHide: true
    });

    return {
      output: {
        command: "git diff",
        stdout
      },
      outputSummary: {
        command: "git diff",
        bytes: Buffer.byteLength(stdout, "utf8"),
        lines: stdout.trim() === "" ? 0 : stdout.trimEnd().split(/\r?\n/).length
      }
    };
  }
};
