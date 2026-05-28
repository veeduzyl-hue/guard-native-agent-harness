# Dependency Audit Review

## Purpose

This document records the bounded dependency audit review for PR 11B. It identifies the current audit findings and recommends follow-up without changing dependencies or runtime behavior.

## Audit Command

The review used:

```bash
npm audit --json
```

The command exited non-zero because vulnerabilities are present. That is expected for this review. Raw audit output is not committed.

## Current Summary

```text
Total: 6
Low: 2
Moderate: 4
High: 0
Critical: 0
```

## Affected Packages

| Package | Severity | Direct | Fix Available | Recommendation |
|---|---|---:|---|---|
| `@eslint/plugin-kit` | low | no | `eslint@9.39.4`, no semver-major force required | Safe patch candidate |
| `eslint` | low | yes | `eslint@9.39.4`, no semver-major force required | Safe patch candidate |
| `esbuild` | moderate | no | `vitest@4.1.7`, semver-major force required | Avoid force fix until reviewed |
| `vite` | moderate | no | `vitest@4.1.7`, semver-major force required | Avoid force fix until reviewed |
| `vite-node` | moderate | no | `vitest@4.1.7`, semver-major force required | Avoid force fix until reviewed |
| `vitest` | moderate | yes | `vitest@4.1.7`, semver-major force required | Needs manual review |

## Direct vs Transitive Exposure

Direct affected packages are `eslint` and `vitest`. The remaining findings are transitive through the lint and test toolchain:

- `@eslint/plugin-kit` is pulled through `eslint`.
- `esbuild`, `vite`, and `vite-node` are pulled through `vitest`.

## Runtime Exposure Assessment

The findings appear to be in development tooling rather than the harness runtime dependency path. `eslint` is lint tooling, and `vitest` is test tooling. The audit data does not by itself establish runtime exploitability in the released CLI.

The Vite/esbuild findings should still be reviewed because local development servers and test tooling can have security-relevant behavior. Remediation should not weaken Tool Registry, Policy Gate, provider, evidence, or Guard boundaries.

## Fix Availability

The ESLint path has a non-major fix candidate: update `eslint` to `9.39.4`.

The Vitest path has a fix candidate at `vitest@4.1.7`, but npm marks it as semver-major. That should be handled in a separate reviewed PR with changelog review and full validation.

## Force Upgrade Risk

`npm audit fix --force` would likely attempt the semver-major Vitest upgrade. That can change test runner behavior and transitive tooling behavior, so it should not be applied automatically.

## Recommended Remediation Plan

1. Safe patch candidate: review and test an `eslint` patch update to `9.39.4` in a dedicated dependency PR.
2. Needs manual review: review Vitest 4.x breaking changes before any `vitest@4.1.7` upgrade.
3. Avoid force fix until reviewed: do not use `npm audit fix --force` to remediate Vite/esbuild findings.
4. No action yet / monitor: keep the current audit review linked from maintenance docs until remediation PRs are opened.

## What Was Not Changed

PR 11B does not perform dependency upgrades, does not run `npm audit fix`, does not run `npm audit fix --force`, and does not introduce package-lock remediation changes.

## Boundary

Dependency remediation must not change runtime behavior, provider behavior, tools, command allowlists, Policy Gate semantics, Guard Adapter semantics, report renderer semantics, `.env` loading, SDK dependencies, API key handling, SaaS/dashboard/OAuth behavior, pricing/checkout/license/entitlement behavior, tags, or npm publishing.

## Next Decision

Open a separate reviewed remediation PR for the ESLint patch candidate first, or explicitly decide to review the Vitest major upgrade path. Forced fixes require explicit approval.
