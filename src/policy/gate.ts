import { evaluatePolicyRules } from "./rules.js";
import type { PolicyDecision, PolicyRequest } from "./types.js";

export class PolicyGate {
  evaluate(request: PolicyRequest): PolicyDecision {
    return evaluatePolicyRules(request);
  }
}

export function createDefaultPolicyGate(): PolicyGate {
  return new PolicyGate();
}
