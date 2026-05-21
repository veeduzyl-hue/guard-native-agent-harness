import { describe, expect, it } from "vitest";

import { parsePlannerTimeoutMs } from "../src/agent/planner-timeout.js";

describe("planner timeout option", () => {
  it("accepts a positive integer timeout", () => {
    expect(parsePlannerTimeoutMs("120000")).toBe(120000);
  });

  it.each(["0", "-1", "abc", "1.5", ""])("rejects invalid timeout value %s", (value) => {
    expect(() => parsePlannerTimeoutMs(value)).toThrow(
      "--planner-timeout-ms must be a positive integer."
    );
  });
});
