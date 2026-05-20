import path from "node:path";

import { isAllowlistedCommand } from "../sandbox/command.js";
import { resolveWorkspacePath, WorkspaceBoundaryError } from "../sandbox/workspace.js";
import type { PolicyDecision, PolicyRequest } from "./types.js";

const allowDecision: PolicyDecision = {
  decision: "allow",
  reason: "Tool request is within the policy boundary.",
  matchedRule: null,
  severity: "none"
};

const credentialPathTerms = [
  "secret",
  "secrets",
  "token",
  "tokens",
  "private_key",
  "private-key",
  "id_rsa",
  "credentials",
  "credential",
  "apikey",
  "api_key"
];

const protectedWriteTerms = [
  "license",
  "licenses",
  "pricing",
  "checkout",
  "entitlement",
  "entitlements",
  "billing",
  "payment",
  "payments",
  "paddle",
  "deployment",
  "deploy",
  "vercel",
  "production",
  "prod"
];

const destructiveCommandPatterns = [
  "rm -rf",
  "rm -r",
  "del /s",
  "rmdir /s",
  "format",
  "mkfs",
  "sudo rm",
  "remove-item -recurse"
];

export function evaluatePolicyRules(request: PolicyRequest): PolicyDecision {
  const command = getStringInput(request, "command");
  if (request.toolName === "run_command") {
    if (!command) {
      return {
        decision: "deny",
        reason: "Command is not in the PR 5 allowlist.",
        matchedRule: "block-command-not-allowlisted",
        severity: "medium"
      };
    }

    const normalizedCommand = command.toLowerCase();

    if (destructiveCommandPatterns.some((pattern) => normalizedCommand.includes(pattern))) {
      return deny("Destructive command requests are blocked.", "block-destructive-command");
    }

    if (normalizedCommand.includes("git push")) {
      return deny("Git push command requests are blocked.", "block-git-push");
    }

    if (!isAllowlistedCommand(command)) {
      return {
        decision: "deny",
        reason: "Command is not in the PR 5 allowlist.",
        matchedRule: "block-command-not-allowlisted",
        severity: "medium"
      };
    }
  }

  const requestedPath = getStringInput(request, "path");
  if (requestedPath && shouldCheckWorkspacePath(request.toolName)) {
    try {
      resolveWorkspacePath(request.workspaceRoot, requestedPath);
    } catch (error) {
      if (error instanceof WorkspaceBoundaryError) {
        return deny("Workspace escape is blocked.", "block-workspace-escape");
      }

      throw error;
    }
  }

  if (request.toolName === "read_file" && requestedPath) {
    const normalizedPath = normalizePolicyPath(requestedPath);

    if (hasEnvFileSegment(normalizedPath)) {
      return deny("Reading .env files is blocked.", "block-env-read");
    }

    if (credentialPathTerms.some((term) => normalizedPath.includes(term))) {
      return deny("Reading credential-like files is blocked.", "block-sensitive-file-read");
    }
  }

  if (request.toolName === "write_file" && requestedPath) {
    const normalizedPath = normalizePolicyPath(requestedPath);

    if (
      protectedWriteTerms.some((term) => normalizedPath.includes(term)) ||
      normalizedPath.startsWith("apps/license-hub/") ||
      hasEnvFileSegment(normalizedPath) ||
      normalizedPath === "vercel.json" ||
      normalizedPath.endsWith("/vercel.json")
    ) {
      return deny(
        "Writes to protected commercial, production, or deployment-sensitive paths are blocked.",
        "block-protected-commercial-write"
      );
    }
  }

  return allowDecision;
}

function shouldCheckWorkspacePath(toolName: string): boolean {
  return ["read_file", "write_file", "list_files", "create_report"].includes(toolName);
}

function getStringInput(request: PolicyRequest, key: string): string | null {
  const value = request.input[key];

  return typeof value === "string" ? value : null;
}

function normalizePolicyPath(value: string): string {
  return value.split(path.sep).join("/").replaceAll("\\", "/").toLowerCase();
}

function hasEnvFileSegment(normalizedPath: string): boolean {
  return normalizedPath.split("/").some((segment) => segment === ".env" || segment.startsWith(".env."));
}

function deny(reason: string, matchedRule: string): PolicyDecision {
  return {
    decision: "deny",
    reason,
    matchedRule,
    severity: "high"
  };
}
