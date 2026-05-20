import { spawn } from "node:child_process";

export const COMMAND_OUTPUT_SUMMARY_MAX_LENGTH = 4000;

export interface AllowedCommand {
  display: string;
  executable: string;
  args: string[];
}

export interface CommandExecutionResult {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: "success" | "error" | "timeout";
}

export function getAllowedCommand(command: string): AllowedCommand | null {
  return buildAllowedCommands().find((allowedCommand) => allowedCommand.display === command.trim()) ?? null;
}

export function isAllowlistedCommand(command: string): boolean {
  return getAllowedCommand(command) !== null;
}

export async function runSandboxedCommand(
  command: string,
  workspaceRoot: string,
  timeoutMs = 30000
): Promise<CommandExecutionResult> {
  const allowedCommand = getAllowedCommand(command);

  if (!allowedCommand) {
    throw new Error(`Command is not allowlisted: ${command}`);
  }

  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(allowedCommand.executable, allowedCommand.args, {
      cwd: workspaceRoot,
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
          command: allowedCommand.display,
          cwd: workspaceRoot,
          exitCode: null,
          stdout,
          stderr: appendStderr(stderr, "Command timed out."),
          durationMs,
          status: "timeout"
        });
        return;
      }

      resolve({
        command: allowedCommand.display,
        cwd: workspaceRoot,
        exitCode: code,
        stdout,
        stderr,
        durationMs,
        status: code === 0 ? "success" : "error"
      });
    });
  });
}

export function summarizeCommandOutput(output: string): string {
  if (output.length <= COMMAND_OUTPUT_SUMMARY_MAX_LENGTH) {
    return output;
  }

  const suffix = "\n[truncated]";
  return `${output.slice(0, COMMAND_OUTPUT_SUMMARY_MAX_LENGTH - suffix.length)}${suffix}`;
}

function buildAllowedCommands(): AllowedCommand[] {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

  return [
    {
      display: "git status --short",
      executable: "git",
      args: ["status", "--short"]
    },
    {
      display: "git diff",
      executable: "git",
      args: ["diff"]
    },
    {
      display: "npm test",
      executable: npmExecutable,
      args: ["test"]
    },
    {
      display: "npm run build",
      executable: npmExecutable,
      args: ["run", "build"]
    },
    {
      display: "node --version",
      executable: process.execPath,
      args: ["--version"]
    },
    {
      display: "node -v",
      executable: process.execPath,
      args: ["-v"]
    }
  ];
}

function appendStderr(stderr: string, message: string): string {
  return stderr.trim() === "" ? message : `${stderr}\n${message}`;
}
