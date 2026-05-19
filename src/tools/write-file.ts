import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveWorkspacePath, toWorkspaceRelativePath } from "../sandbox/workspace.js";
import type { ToolDefinition } from "./types.js";

interface WriteFileInput extends Record<string, unknown> {
  path: string;
  content: string;
}

export const writeFileTool: ToolDefinition<WriteFileInput> = {
  metadata: {
    name: "write_file",
    description: "Write a text file within the workspace.",
    riskLevel: "medium",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true
  },
  async execute(context, input) {
    const absolutePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content, "utf8");

    return {
      output: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        bytes: Buffer.byteLength(input.content, "utf8"),
        characters: input.content.length
      },
      outputSummary: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        bytes: Buffer.byteLength(input.content, "utf8"),
        characters: input.content.length
      }
    };
  }
};
