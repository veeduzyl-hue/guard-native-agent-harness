import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolDefinition } from "./types.js";

const execFileAsync = promisify(execFile);

export const gitStatusTool: ToolDefinition = {
  metadata: {
    name: "git_status",
    description: "Inspect git status using a read-only command.",
    riskLevel: "low",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true,
    inputSchemaHint: {},
    inputExample: {}
  },
  async execute(context) {
    const { stdout } = await execFileAsync("git", ["status", "--short"], {
      cwd: context.workspaceRoot,
      windowsHide: true
    });
    const lines = stdout.trim() === "" ? 0 : stdout.trimEnd().split(/\r?\n/).length;

    return {
      output: {
        command: "git status --short",
        stdout
      },
      outputSummary: {
        command: "git status --short",
        lines
      }
    };
  }
};
