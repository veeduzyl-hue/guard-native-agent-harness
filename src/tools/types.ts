import type { ToolRiskLevel } from "../evidence/schema.js";

export type ToolPathPolicy = "workspace_only" | "none";
export type ToolName =
  | "list_files"
  | "read_file"
  | "write_file"
  | "git_status"
  | "git_diff"
  | "create_report";

export interface ToolMetadata {
  name: ToolName;
  description: string;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  pathPolicy?: ToolPathPolicy;
  evidenceRequired: true;
}

export interface ToolExecutionContext {
  taskId: string;
  workspaceRoot: string;
  evidenceDirectory: string;
  relativeEvidenceDirectory: string;
}

export interface ToolExecutionOptions {
  now?: Date;
  eventId?: string;
}

export interface ToolExecutionResult {
  output: unknown;
  outputSummary: Record<string, unknown>;
}

export interface ToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> {
  metadata: ToolMetadata;
  execute(context: ToolExecutionContext, input: TInput): Promise<ToolExecutionResult>;
}

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
