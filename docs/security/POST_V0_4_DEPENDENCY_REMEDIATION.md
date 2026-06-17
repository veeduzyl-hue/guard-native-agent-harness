# Post-v0.4 Dependency Remediation

## Purpose

This document records the bounded post-v0.4 dependency remediation for development, build, test, and CI tooling advisories found after the `v0.4.0` release.

The package version remains `0.4.0` in this remediation PR. A later release-preparation PR is expected to prepare `v0.4.1`.

This remediation does not change runtime behavior, provider behavior, planner behavior, Tool Registry semantics, Policy Gate semantics, Guard Adapter semantics, Guard runtime semantics, CLI behavior, or workflow behavior. It does not add SDK dependencies, dotenv, a release tag, a GitHub Release, or npm publishing.

## Advisory Evidence

| Package | Previous Version | Remediated Version | Advisory | Severity | Dependency Chain | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `js-yaml` | `4.1.1` | `4.2.0` | `GHSA-h67p-54hq-rp68` | moderate | root project -> `eslint@9.39.4` -> `@eslint/eslintrc@3.3.5` -> `js-yaml` | transitive dev-only tooling |
| `vite` | `6.4.2` | `6.4.3` | `GHSA-v6wh-96g9-6wx3` | moderate | root project -> `vite` | direct dev-only tooling |
| `vite` | `6.4.2` | `6.4.3` | `GHSA-fx2h-pf6j-xcff` | high | root project -> `vite`; root project -> `vitest@4.1.7` -> `vite` | direct dev-only tooling |

Before remediation, `npm audit --omit=dev --json` reported zero production/runtime vulnerabilities. The advisories were limited to development, build, test, and CI tooling dependencies and were not shipped runtime dependencies.

## Remediation Applied

- Updated the exact direct dev dependency `vite` from `6.4.2` to `6.4.3`.
- Updated the existing transitive lockfile resolution for `js-yaml` from `4.1.1` to `4.2.0`.
- Kept `vitest` at `4.1.7`.
- Did not introduce Vite 7 or Vite 8.
- Did not add `js-yaml` as a direct dependency.
- Did not add package overrides.
- Did not change runtime dependencies.

## Why Raw Audit Fix Was Rejected

`npm audit fix --dry-run --json` proposed broader changes than the bounded remediation target, including a nested Vite 8 path and additional transitive packages. Raw `npm audit fix` was rejected because this remediation only needs compatible Vite 6 and transitive `js-yaml` updates, without Vitest upgrades, Vite major upgrades, runtime dependency changes, provider SDK additions, or broad lockfile churn.

## Verification

The deterministic remediation verifier is:

```text
npm run verify:post-v0.4:dependencies
```

The expected audit outcomes after remediation are:

- Full audit vulnerabilities: `0`.
- Production/runtime audit vulnerabilities: `0`.

This record is factual remediation evidence only. It does not claim certification, exhaustive security coverage, production readiness, deployment approval, merge approval, or authorization.
