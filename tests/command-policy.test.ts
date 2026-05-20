import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDefaultPolicyGate } from "../src/policy/gate.js";
import type { PolicyRequest } from "../src/policy/types.js";

async function workspaceRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "guard-agent-command-policy-"));
}

async function evaluateCommand(command: string) {
  const gate = createDefaultPolicyGate();
  const request: PolicyRequest = {
    taskId: "command-policy-test",
    toolName: "run_command",
    input: { command },
    workspaceRoot: await workspaceRoot()
  };

  return gate.evaluate(request);
}

describe("command policy", () => {
  it.each(["node --version", "node -v", "git status --short", "git diff", "npm test", "npm run build"])(
    "allows allowlisted command %s",
    async (command) => {
      const decision = await evaluateCommand(command);

      expect(decision).toMatchObject({
        decision: "allow",
        matchedRule: null,
        severity: "none"
      });
    }
  );

  it.each([
    ["rm -rf .", "block-destructive-command", "high"],
    ["git push origin main", "block-git-push", "high"],
    ["npm install", "block-command-not-allowlisted", "medium"],
    ["curl https://example.com", "block-command-not-allowlisted", "medium"],
    ["vercel deploy", "block-command-not-allowlisted", "medium"],
    ["git checkout main", "block-command-not-allowlisted", "medium"],
    ["npm publish", "block-command-not-allowlisted", "medium"]
  ])("denies command %s", async (command, expectedRule, expectedSeverity) => {
    const decision = await evaluateCommand(command);

    expect(decision).toMatchObject({
      decision: "deny",
      matchedRule: expectedRule,
      severity: expectedSeverity
    });
  });

  it.each(["unsafe-destructive-command.json", "unsafe-git-push-command.json", "unsafe-non-allowlisted-command.json"])(
    "matches command fixture %s",
    async (fixtureName) => {
      const fixture = JSON.parse(await readFile(path.join("fixtures", fixtureName), "utf8")) as {
        tool_name: string;
        input: Record<string, unknown>;
        expected_decision: "allow" | "deny";
        expected_rule: string;
      };
      const gate = createDefaultPolicyGate();
      const decision = gate.evaluate({
        taskId: "fixture-command-test",
        toolName: fixture.tool_name,
        input: fixture.input,
        workspaceRoot: await workspaceRoot()
      });

      expect(decision.decision).toBe(fixture.expected_decision);
      expect(decision.matchedRule).toBe(fixture.expected_rule);
    }
  );
});
