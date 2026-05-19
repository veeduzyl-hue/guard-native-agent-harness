import { describe, expect, it } from "vitest";

import { PROJECT_NAME } from "../src/index.js";

describe("project scaffold", () => {
  it("exports the expected project name", () => {
    expect(PROJECT_NAME).toBe("guard-native-agent-harness");
  });
});
