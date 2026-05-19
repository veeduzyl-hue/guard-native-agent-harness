import path from "node:path";

export function resolveWorkspaceRoot(cwd = process.cwd()): string {
  return path.resolve(cwd);
}

export function resolveWorkspacePath(workspaceRoot: string, requestedPath = "."): string {
  const root = resolveWorkspaceRoot(workspaceRoot);
  const target = path.resolve(root, requestedPath);

  if (!isPathInsideWorkspace(root, target)) {
    throw new WorkspaceBoundaryError(`Path escapes workspace: ${requestedPath}`);
  }

  return target;
}

export function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = path.relative(resolveWorkspaceRoot(workspaceRoot), absolutePath);

  return relativePath === "" ? "." : normalizeRelativePath(relativePath);
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function isPathInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relativePath = path.relative(workspaceRoot, targetPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export class WorkspaceBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceBoundaryError";
  }
}
