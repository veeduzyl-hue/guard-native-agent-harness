import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDefaultPolicyGate } from "../src/policy/gate.js";
import type { PolicyDecision, PolicyRequest } from "../src/policy/types.js";

interface UnsafeFixture {
  task_id: string;
  tool_name: string;
  input: Record<string, unknown>;
  expected_decision: "allow" | "deny";
  expected_rule: string;
}

async function workspaceRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "guard-agent-policy-"));
}

function evaluate(request: Omit<PolicyRequest, "taskId" | "workspaceRoot"> & { workspaceRoot: string }): PolicyDecision {
  const gate = createDefaultPolicyGate();

  return gate.evaluate({
    taskId: "policy-test",
    ...request
  });
}

describe("policy gate", () => {
  it("allows safe read_file inside the workspace", async () => {
    const decision = evaluate({
      toolName: "read_file",
      input: { path: "README.md" },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision).toEqual({
      decision: "allow",
      reason: "Tool request is within the policy boundary.",
      matchedRule: null,
      severity: "none"
    });
  });

  it.each([
    [".env", "block-env-read"],
    [".env.local", "block-env-read"],
    ["config/.env", "block-env-read"],
    ["apps/server/.env.local", "block-env-read"],
    ["config/secret.txt", "block-sensitive-file-read"],
    ["tokens/api-token.txt", "block-sensitive-file-read"],
    ["keys/private_key.pem", "block-sensitive-file-read"]
  ])("denies sensitive read path %s", async (requestedPath, expectedRule) => {
    const decision = evaluate({
      toolName: "read_file",
      input: { path: requestedPath },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision.decision).toBe("deny");
    expect(decision.matchedRule).toBe(expectedRule);
    expect(decision.severity).toBe("high");
  });

  it("denies workspace escape reads", async () => {
    const decision = evaluate({
      toolName: "read_file",
      input: { path: "../outside.txt" },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision).toMatchObject({
      decision: "deny",
      matchedRule: "block-workspace-escape",
      severity: "high"
    });
  });

  it.each([
    "pricing/checkout.md",
    "apps/license-hub/config.json",
    "vercel.json",
    ".env.production",
    "src/deployment/prod-plan.md"
  ])("denies protected commercial or production write %s", async (requestedPath) => {
    const decision = evaluate({
      toolName: "write_file",
      input: { path: requestedPath, content: "blocked" },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision).toMatchObject({
      decision: "deny",
      matchedRule: "block-protected-commercial-write",
      severity: "high"
    });
  });

  it("denies destructive command requests without implementing command execution", async () => {
    const decision = evaluate({
      toolName: "run_command",
      input: { command: "rm -rf ." },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision).toMatchObject({
      decision: "deny",
      matchedRule: "block-destructive-command",
      severity: "high"
    });
  });

  it("denies git push command requests without implementing command execution", async () => {
    const decision = evaluate({
      toolName: "run_command",
      input: { command: "git push origin main" },
      workspaceRoot: await workspaceRoot()
    });

    expect(decision).toMatchObject({
      decision: "deny",
      matchedRule: "block-git-push",
      severity: "high"
    });
  });

  it.each([
    "unsafe-env-read.json",
    "unsafe-destructive-command.json",
    "unsafe-git-push-command.json",
    "unsafe-non-allowlisted-command.json",
    "unsafe-workspace-escape.json"
  ])("matches unsafe fixture %s", async (fixtureName) => {
    const fixture = JSON.parse(await readFile(path.join("fixtures", fixtureName), "utf8")) as UnsafeFixture;
    const decision = evaluate({
      toolName: fixture.tool_name,
      input: fixture.input,
      workspaceRoot: await workspaceRoot()
    });

    expect(decision.decision).toBe(fixture.expected_decision);
    expect(decision.matchedRule).toBe(fixture.expected_rule);
  });
});
