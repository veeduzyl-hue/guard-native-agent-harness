import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDefaultPlannerProviderRegistry,
  PlannerProviderNotImplementedError,
  UnknownPlannerProviderError
} from "../src/agent/provider-registry.js";
import { GuardAdapter } from "../src/guard/adapter.js";
import { runTask } from "../src/task/runner.js";

const unavailableGuardAdapter = new GuardAdapter(async () => {
  throw Object.assign(new Error("guard not found"), { code: "ENOENT" });
});

describe("planner provider registry", () => {
  it("registers mock as the default available provider", () => {
    const registry = createDefaultPlannerProviderRegistry();

    expect(registry.defaultProvider().name).toBe("mock");
    expect(registry.get("mock")).toMatchObject({
      name: "mock",
      kind: "local-deterministic",
      available: true
    });
  });

  it("rejects unknown provider names", () => {
    const registry = createDefaultPlannerProviderRegistry();

    expect(() => registry.get("missing-provider")).toThrow(UnknownPlannerProviderError);
    expect(() => registry.get("missing-provider")).toThrow("Unknown planner provider: missing-provider");
  });

  it.each(["ollama", "openai", "deepseek"])(
    "recognizes %s as unimplemented in PR 10A",
    (providerName) => {
      const registry = createDefaultPlannerProviderRegistry();

      expect(() => registry.get(providerName)).toThrow(PlannerProviderNotImplementedError);
      expect(() => registry.get(providerName)).toThrow(
        `Planner provider "${providerName}" is recognized but not implemented in PR 10A.`
      );
    }
  );
});

describe("planner provider selection", () => {
  it("uses mock when no planner provider is requested", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-provider-default-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    expect(result.task.planner_provider).toBe("mock");
    expect(result.plan.provider).toBe("mock");
  });

  it("uses mock when --planner mock is represented in runner options", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "guard-agent-provider-mock-"));
    await writeFile(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");

    const result = await runTask("Create a safe README update proposal", {
      workspaceRoot,
      plannerProvider: "mock",
      plannerModel: "future-model-metadata",
      guardAdapter: unavailableGuardAdapter,
      executePlan: false
    });

    const task = JSON.parse(await readFile(path.join(result.evidenceDirectory, "task.json"), "utf8")) as {
      planner_provider: string;
      planner_model: string | null;
    };

    expect(task.planner_provider).toBe("mock");
    expect(task.planner_model).toBeNull();
    expect(result.plan.model).toBeNull();
  });

  it.each(["ollama", "openai", "deepseek"])(
    "fails with a controlled error for unimplemented provider %s",
    async (providerName) => {
      const workspaceRoot = await mkdtemp(path.join(tmpdir(), `guard-agent-provider-${providerName}-`));

      await expect(
        runTask("Create a safe README update proposal", {
          workspaceRoot,
          plannerProvider: providerName,
          plannerModel: "future-model",
          guardAdapter: unavailableGuardAdapter
        })
      ).rejects.toThrow(`Planner provider "${providerName}" is recognized but not implemented in PR 10A.`);
    }
  );
});
