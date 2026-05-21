import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { ToolDefinition } from "./types.js";

interface CreateReportInput extends Record<string, unknown> {
  title: string;
  content: string;
}

export const createReportTool: ToolDefinition<CreateReportInput> = {
  metadata: {
    name: "create_report",
    description:
      "Create or update a local markdown report artifact in the task evidence directory.",
    riskLevel: "low",
    requiresApproval: false,
    pathPolicy: "workspace_only",
    evidenceRequired: true,
    inputSchemaHint: {
      title: "short report title string",
      content: "markdown report content string"
    },
    inputExample: {
      title: "Report title",
      content: "markdown text"
    }
  },
  async execute(context, input) {
    const report = `# ${input.title}\n\n${input.content}\n`;
    const absolutePath = path.join(context.evidenceDirectory, "tool-report.md");
    const relativePath = `${context.relativeEvidenceDirectory}/tool-report.md`;

    await writeFile(absolutePath, report, "utf8");

    return {
      output: {
        path: relativePath
      },
      outputSummary: {
        path: relativePath,
        bytes: Buffer.byteLength(report, "utf8"),
        characters: report.length
      }
    };
  }
};
