import { describe, expect, it } from "vitest";

import { createDefaultToolRegistry } from "../src/tools/registry.js";
import type { ToolName } from "../src/tools/types.js";

const expectedToolNames: ToolName[] = [
  "list_files",
  "read_file",
  "write_file",
  "git_status",
  "git_diff",
  "create_report",
  "run_command"
];

describe("tool registry", () => {
  it("contains all PR 3 safe tools", () => {
    const registry = createDefaultToolRegistry();
    const names = registry.list().map((metadata) => metadata.name);

    expect(names).toEqual(expectedToolNames);
  });

  it("returns a clear error for unknown tools", () => {
    const registry = createDefaultToolRegistry();

    expect(() => registry.get("missing_tool" as ToolName)).toThrow("Unknown tool: missing_tool");
  });

  it("exposes metadata for every registered tool", () => {
    const registry = createDefaultToolRegistry();

    for (const name of expectedToolNames) {
      const metadata = registry.get(name).metadata;

      expect(metadata.name).toBe(name);
      expect(metadata.description.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(metadata.riskLevel);
      expect(typeof metadata.requiresApproval).toBe("boolean");
      expect(metadata.evidenceRequired).toBe(true);
    }
  });

  it("marks every registered tool as requiring evidence", () => {
    const registry = createDefaultToolRegistry();

    expect(registry.list().every((metadata) => metadata.evidenceRequired === true)).toBe(true);
  });
});
