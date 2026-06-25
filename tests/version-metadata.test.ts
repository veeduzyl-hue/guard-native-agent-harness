import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HARNESS_VERSION } from "../src/index.js";

describe("version metadata", () => {
  it("keeps HARNESS_VERSION aligned with package.json version", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(process.cwd(), "package.json"), "utf8")
    ) as { version: string };

    expect(HARNESS_VERSION).toBe(packageJson.version);
  });

  it("uses HARNESS_VERSION for the CLI version banner", async () => {
    const cliSource = await readFile(path.join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(cliSource).toContain(".version(HARNESS_VERSION)");
  });
});
