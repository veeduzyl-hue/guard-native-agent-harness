# Guard-native Agent Harness v0.2.1 Release Notes

## Summary

v0.2.1 is a patch release for dev-tooling dependency remediation completed in PR 11E.

It does not change runtime behavior, provider behavior, Tool Registry behavior, Policy Gate behavior, Guard Adapter behavior, or report renderer behavior.

## What Changed Since v0.2.0

Since v0.2.0, the post-release maintenance track added audit triage, a bounded audit review, a remediation decision, a sandbox upgrade plan, and a controlled dependency upgrade experiment.

PR 11E safely applied targeted dev-tooling dependency updates after full validation passed.

## Dependency Remediation

PR 11E kept these dev-tooling changes:

- `@eslint/js`: `9.17.0` to `9.39.4`.
- `eslint`: `9.17.0` to `9.39.4`.
- `vite`: explicit `6.4.2`.
- `vitest`: `0.34.6` to `4.1.7`.

`npm audit fix --force` was not used.

## Audit Result

After PR 11E:

```text
Total: 0
Low: 0
Moderate: 0
High: 0
Critical: 0
```

## Runtime Boundary

v0.2.1 does not change harness runtime behavior. It does not add tools, command allowlist entries, `.env` loading, SDK dependencies, API key persistence, autonomous planning, SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.

## Provider Boundary

`mock` remains the default planner. Ollama, OpenAI, and DeepSeek remain optional planner providers. No default provider switch occurs in v0.2.1.

## Validation Commands

The required patch release gate is:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
npm run verify:v0.2:providers
npm run verify:v0.2:release
npm run verify:post-v0.2
npm run verify:dependency-upgrade-plan
npm run audit:summary
npm run verify:v0.2.1:release
```

## What v0.2.1 Does Not Include

v0.2.1 does not include:

- Runtime behavior changes.
- Provider changes.
- Default provider switching.
- New tools or command allowlist entries.
- Policy Gate, Guard Adapter, or report renderer semantic changes.
- `.env` loading, provider SDKs, or API key handling changes.
- Autonomous execution.
- SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.
- npm publish behavior.

## Tag Status

The `v0.2.1` tag is not created by PR 11F. It should be created only after PR 11F is merged into `main` and the final patch release gate passes on `main`.
