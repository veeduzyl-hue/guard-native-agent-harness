import { spawn } from "node:child_process";

import { summarizeCommandOutput } from "../sandbox/command.js";
import type {
  GuardAdapterResult,
  GuardCommandResult,
  GuardCommandRunner,
  GuardCommandSpec,
  GuardRawCommandResult
} from "./types.js";

const guardTimeoutMs = 15000;

const guardVersionCommand: GuardCommandSpec = {
  command: "guard --version",
  executable: "guard",
  args: ["--version"]
};

const guardCommands = {
  status_result: {
    command: "guard status --json",
    executable: "guard",
    args: ["status", "--json"]
  },
  audit_result: {
    command: "guard audit --json",
    executable: "guard",
    args: ["audit", "--json"]
  },
  drift_result: {
    command: "guard drift status --json",
    executable: "guard",
    args: ["drift", "status", "--json"]
  }
} satisfies Record<"status_result" | "audit_result" | "drift_result", GuardCommandSpec>;

export class GuardAdapter {
  constructor(private readonly runner: GuardCommandRunner = runGuardCommand) {}

  async collect(): Promise<GuardAdapterResult> {
    const errors: string[] = [];
    const available = await this.detectGuard(errors);

    if (!available) {
      return {
        guard_available: false,
        reason: "Guard CLI not found",
        commands_attempted: [],
        status_result: null,
        audit_result: null,
        drift_result: null,
        errors
      };
    }

    const result: GuardAdapterResult = {
      guard_available: true,
      commands_attempted: Object.values(guardCommands).map((command) => command.command),
      status_result: null,
      audit_result: null,
      drift_result: null,
      errors
    };

    for (const [key, command] of Object.entries(guardCommands) as Array<
      [keyof Pick<GuardAdapterResult, "status_result" | "audit_result" | "drift_result">, GuardCommandSpec]
    >) {
      try {
        result[key] = toGuardCommandResult(await this.runner(command, guardTimeoutMs));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${command.command}: ${message}`);
        result[key] = {
          command: command.command,
          exit_code: null,
          duration_ms: 0,
          stdout_json: null,
          stdout_summary: "",
          stderr_summary: summarizeCommandOutput(message),
          status: "error"
        };
      }
    }

    return result;
  }

  private async detectGuard(errors: string[]): Promise<boolean> {
    try {
      const result = await this.runner(guardVersionCommand, guardTimeoutMs);
      if (result.status === "success" && result.exitCode === 0) {
        return true;
      }

      errors.push(`guard --version exited with status ${result.status}`);
      return false;
    } catch (error) {
      if (isCommandNotFound(error)) {
        return false;
      }

      errors.push(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

export function createDefaultGuardAdapter(): GuardAdapter {
  return new GuardAdapter();
}

export async function runGuardCommand(
  command: GuardCommandSpec,
  timeoutMs = guardTimeoutMs
): Promise<GuardRawCommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const timeout = setTimeout(() => {
      didTimeout = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startedAt;

      if (didTimeout) {
        resolve({
          command: command.command,
          exitCode: null,
          stdout,
          stderr: appendStderr(stderr, "Guard command timed out."),
          durationMs,
          status: "timeout"
        });
        return;
      }

      resolve({
        command: command.command,
        exitCode: code,
        stdout,
        stderr,
        durationMs,
        status: code === 0 ? "success" : "error"
      });
    });
  });
}

function toGuardCommandResult(result: GuardRawCommandResult): GuardCommandResult {
  return {
    command: result.command,
    exit_code: result.exitCode,
    duration_ms: result.durationMs,
    stdout_json: parseJsonOrNull(result.stdout),
    stdout_summary: summarizeCommandOutput(result.stdout),
    stderr_summary: summarizeCommandOutput(result.stderr),
    status: result.status
  };
}

function parseJsonOrNull(value: string): unknown | null {
  if (value.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function appendStderr(stderr: string, message: string): string {
  return stderr.trim() === "" ? message : `${stderr}\n${message}`;
}

function isCommandNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    ("code" in error ? (error as NodeJS.ErrnoException).code === "ENOENT" : false)
  );
}
