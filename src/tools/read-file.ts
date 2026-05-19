import { readFile } from "node:fs/promises";

import { resolveWorkspacePath, toWorkspaceRelativePath } from "../sandbox/workspace.js";
import type { ToolDefinition } from "./types.js";

interface ReadFileInput extends Record<string, unknown> {
  path: string;
}

export const readFileTool: ToolDefinition<ReadFileInput> = {
  metadata: {
    name: "read_file",
    description: "Read a text file within the workspace.",
    riskLevel: "low",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true
  },
  async execute(context, input) {
    const absolutePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    const content = await readFile(absolutePath, "utf8");

    return {
      output: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        content
      },
      outputSummary: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        bytes: Buffer.byteLength(content, "utf8"),
        characters: content.length
      }
    };
  }
};
