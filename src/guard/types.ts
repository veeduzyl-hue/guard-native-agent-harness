export type GuardCommandStatus = "success" | "error" | "timeout";

export interface GuardCommandSpec {
  command: string;
  executable: "guard";
  args: string[];
}

export interface GuardRawCommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: GuardCommandStatus;
}

export interface GuardCommandResult {
  command: string;
  exit_code: number | null;
  duration_ms: number;
  stdout_json: unknown | null;
  stdout_summary: string;
  stderr_summary: string;
  status: GuardCommandStatus;
}

export interface GuardAdapterResult {
  guard_available: boolean;
  reason?: string;
  commands_attempted: string[];
  status_result: GuardCommandResult | null;
  audit_result: GuardCommandResult | null;
  drift_result: GuardCommandResult | null;
  errors: string[];
}

export type GuardCommandRunner = (
  command: GuardCommandSpec,
  timeoutMs: number
) => Promise<GuardRawCommandResult>;
