import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GuardAdapter } from "../src/guard/adapter.js";
import type { GuardCommandRunner, GuardRawCommandResult } from "../src/guard/types.js";
import { runTask } from "../src/task/runner.js";

function rawResult(
  command: string,
  overrides: Partial<GuardRawCommandResult> = {}
): GuardRawCommandResult {
  return {
    command,
    exitCode: 0,
    stdout: "{}",
    stderr: "",
    durationMs: 12,
    status: "success",
    ...overrides
  };
}

describe("guard adapter", () => {
  it("returns unavailable fallback when Guard CLI is missing", async () => {
    const adapter = new GuardAdapter(async () => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    });

    await expect(adapter.collect()).resolves.toEqual({
      guard_available: false,
      reason: "Guard CLI not found",
      commands_attempted: [],
      status_result: null,
      audit_result: null,
      drift_result: null,
      errors: []
    });
  });

  it("task runner completes and writes guard-results.json when Guard is unavailable", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-no-guard-"));
    const adapter = new GuardAdapter(async () => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    });

    const pack = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      now: new Date("2026-05-20T04:02:03.000Z"),
      randomId: "guard123",
      guardAdapter: adapter
    });

    const guardResults = JSON.parse(await readFile(pack.guardResultsPath, "utf8")) as Record<string, unknown>;

    expect(pack.guardAvailable).toBe(false);
    expect(guardResults).toMatchObject({
      guard_available: false,
      reason: "Guard CLI not found",
      commands_attempted: [],
      status_result: null,
      audit_result: null,
      drift_result: null,
      errors: []
    });
  });

  it("runs status, audit, and drift commands when Guard is available", async () => {
    const commands: string[] = [];
    const runner: GuardCommandRunner = async (command) => {
      commands.push(command.command);

      return rawResult(command.command, {
        stdout: JSON.stringify({ command: command.command, ok: true })
      });
    };
    const adapter = new GuardAdapter(runner);

    const result = await adapter.collect();

    expect(commands).toEqual([
      "guard --version",
      "guard status --json",
      "guard audit --json",
      "guard drift status --json"
    ]);
    expect(result.guard_available).toBe(true);
    expect(result.commands_attempted).toEqual([
      "guard status --json",
      "guard audit --json",
      "guard drift status --json"
    ]);
    expect(result.status_result?.stdout_json).toEqual({ command: "guard status --json", ok: true });
    expect(result.audit_result?.stdout_json).toEqual({ command: "guard audit --json", ok: true });
    expect(result.drift_result?.stdout_json).toEqual({ command: "guard drift status --json", ok: true });
  });

  it("records one Guard command failure while preserving other results", async () => {
    const runner: GuardCommandRunner = async (command) => {
      if (command.command === "guard audit --json") {
        return rawResult(command.command, {
          exitCode: 1,
          stdout: "{\"audit\":false}",
          stderr: "audit failed",
          status: "error"
        });
      }

      return rawResult(command.command, { stdout: "{\"ok\":true}" });
    };
    const adapter = new GuardAdapter(runner);

    const result = await adapter.collect();

    expect(result.guard_available).toBe(true);
    expect(result.status_result?.status).toBe("success");
    expect(result.audit_result).toMatchObject({
      command: "guard audit --json",
      exit_code: 1,
      stdout_json: { audit: false },
      stderr_summary: "audit failed",
      status: "error"
    });
    expect(result.drift_result?.status).toBe("success");
  });

  it("records timeout and invalid JSON without crashing", async () => {
    const runner: GuardCommandRunner = async (command) => {
      if (command.command === "guard audit --json") {
        return rawResult(command.command, {
          exitCode: null,
          stdout: "not json",
          stderr: "Guard command timed out.",
          durationMs: 15000,
          status: "timeout"
        });
      }

      return rawResult(command.command, { stdout: "{\"ok\":true}" });
    };
    const adapter = new GuardAdapter(runner);

    const result = await adapter.collect();

    expect(result.audit_result).toMatchObject({
      command: "guard audit --json",
      exit_code: null,
      duration_ms: 15000,
      stdout_json: null,
      stdout_summary: "not json",
      stderr_summary: "Guard command timed out.",
      status: "timeout"
    });
  });

  it("records Guard output as evidence only", async () => {
    const adapter = new GuardAdapter(async (command) =>
      rawResult(command.command, {
        stdout: JSON.stringify({ recommendation: "review", execution_authority_granted: false })
      })
    );

    const result = await adapter.collect();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("\"execution_authority_granted\":true");
    expect(result.guard_available).toBe(true);
  });
});
