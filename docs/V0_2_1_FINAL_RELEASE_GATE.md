# v0.2.1 Final Release Gate

## Purpose

This document defines the final pre-tag gate for `v0.2.1`, a patch release for dev-tooling dependency remediation.

PR 11F prepares the patch release gate. It does not create the tag and does not publish anything.

## Preconditions

- PR 11E is merged into `main`.
- `package.json` and `package-lock.json` are prepared at version `0.2.1`.
- The dependency remediation remains limited to development tooling.
- `mock` remains the default provider.
- Optional providers remain optional.
- No generated `.evidence/` directories or API keys are tracked.

## Required Commands

Run:

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

`verify:v0.2.1:release` is the final pre-tag gate.

## Dependency Remediation Gate

The release gate confirms the patch release is dependency-remediation-only. It must not introduce runtime, provider, Tool Registry, Policy Gate, Guard Adapter, or report renderer semantic changes.

## Audit Gate

`npm run audit:summary` must report zero residual vulnerabilities before tagging `v0.2.1`.

## Runtime Boundary Gate

The release gate must not add tools, command allowlist entries, `.env` loading, SDK dependencies, API key persistence, autonomous execution, SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.

## Provider Boundary Gate

Real Ollama, OpenAI, and DeepSeek checks are optional and are not required for the release gate. No API key is required, and no provider network calls should occur.

## Tag Boundary Gate

PR 11F must not create `v0.2.1`. Tag creation happens only after merge and final validation on `main`.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.2.1` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full final patch release gate on `main`.
