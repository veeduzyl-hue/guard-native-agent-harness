import { readdir } from "node:fs/promises";

import { resolveWorkspacePath, toWorkspaceRelativePath } from "../sandbox/workspace.js";
import type { ToolDefinition } from "./types.js";

interface ListFilesInput extends Record<string, unknown> {
  path?: string;
}

export const listFilesTool: ToolDefinition<ListFilesInput> = {
  metadata: {
    name: "list_files",
    description: "List files within the workspace.",
    riskLevel: "low",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true
  },
  async execute(context, input) {
    const requestedPath = input.path ?? ".";
    const absolutePath = resolveWorkspacePath(context.workspaceRoot, requestedPath);
    const entries = await readdir(absolutePath, { withFileTypes: true });

    const outputEntries = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file"
    }));

    return {
      output: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        entries: outputEntries
      },
      outputSummary: {
        path: toWorkspaceRelativePath(context.workspaceRoot, absolutePath),
        entries_count: outputEntries.length
      }
    };
  }
};
