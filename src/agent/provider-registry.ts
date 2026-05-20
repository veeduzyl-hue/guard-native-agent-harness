import { createOllamaPlannerProvider } from "./ollama-provider.js";
import { mockPlannerProvider } from "./planner.js";
import type { PlannerProvider, PlannerProviderName } from "./provider.js";

const futureProviderNames = new Set<PlannerProviderName>(["openai", "deepseek"]);

export class PlannerProviderRegistry {
  private readonly providers = new Map<PlannerProviderName, PlannerProvider>();

  register(provider: PlannerProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): PlannerProvider {
    if (isPlannerProviderName(name)) {
      const provider = this.providers.get(name);

      if (provider) {
        return provider;
      }

      if (futureProviderNames.has(name)) {
        throw new PlannerProviderNotImplementedError(
          `Planner provider "${name}" is recognized but not implemented.`
        );
      }
    }

    throw new UnknownPlannerProviderError(`Unknown planner provider: ${name}`);
  }

  defaultProvider(): PlannerProvider {
    return this.get("mock");
  }
}

export class UnknownPlannerProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownPlannerProviderError";
  }
}

export class PlannerProviderNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerProviderNotImplementedError";
  }
}

export function createDefaultPlannerProviderRegistry(): PlannerProviderRegistry {
  const registry = new PlannerProviderRegistry();
  registry.register(mockPlannerProvider);
  registry.register(createOllamaPlannerProvider());

  return registry;
}

export function isPlannerProviderName(value: string): value is PlannerProviderName {
  return ["mock", "ollama", "openai", "deepseek"].includes(value);
}
