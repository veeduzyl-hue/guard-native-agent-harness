import path from "node:path";

export function resolveWorkspaceRoot(cwd = process.cwd()): string {
  return path.resolve(cwd);
}
