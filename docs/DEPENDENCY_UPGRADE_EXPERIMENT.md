# Dependency Upgrade Sandbox Experiment

## Purpose

This document records the PR 11E dependency upgrade sandbox experiment for audit-affected development tooling. The experiment was limited to lint and test tooling dependencies and did not change runtime, provider, Tool Registry, Policy Gate, Guard Adapter, or report renderer behavior.

## Baseline

The experiment started from the PR 11D sandbox plan on top of `v0.2.0` maintenance work.

Baseline audit summary:

```text
Total: 6
Low: 2
Moderate: 4
High: 0
Critical: 0
```

Baseline affected packages:

- `@eslint/plugin-kit`
- `eslint`
- `esbuild`
- `vite`
- `vite-node`
- `vitest`

## Commands Run

Initial inspection:

```bash
git status
node -p "require('./package.json').version"
npm run audit:summary
npm outdated
npm audit fix --dry-run
```

Targeted sandbox upgrade commands:

```bash
npm install --save-dev eslint@9.39.4 @eslint/js@9.39.4
npm install --save-dev vitest@4.1.7
npm install --save-dev --save-exact eslint@9.39.4 @eslint/js@9.39.4 vitest@4.1.7
npm install --save-dev --save-exact vite@6.4.2
```

`npm audit fix --force` was not run.

## Upgrade Candidates

The candidate set was limited to audit-affected dev tooling paths:

- ESLint path: `eslint`, `@eslint/js`, and transitive `@eslint/plugin-kit`.
- Vitest/Vite path: `vitest`, explicit patched `vite`, and audit-derived `vite-node` / `esbuild` findings.

Bounded `npm outdated` observation before the experiment:

- `eslint` current/wanted `9.17.0`, latest `10.4.0`.
- `vitest` current/wanted `0.34.6`, latest `4.1.7`.
- Other outdated packages were visible, but PR 11E did not broaden remediation beyond audit-affected dev tooling.

## Changes Attempted

Kept direct dependency changes:

- `@eslint/js`: `9.17.0` to `9.39.4`.
- `eslint`: `9.17.0` to `9.39.4`.
- `vite`: added as an exact-pinned dev dependency at `6.4.2` so Vitest uses a patched Vite 6 path.
- `vitest`: `0.34.6` to `4.1.7`.

Observed transitive result:

- `@eslint/plugin-kit` resolves to `0.4.1`.
- `vitest@4.1.7` resolves through `vite@6.4.2`.
- `vite@6.4.2` resolves `esbuild@0.25.12`.

The final dependency declarations remain exact-pinned.

## Validation Result

The targeted upgrades passed:

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
```

The experiment initially observed a peer-resolution warning when npm selected `vite@8.0.14` transitively. Pinning `vite@6.4.2` kept the upgrade closer to the existing Node/tooling baseline, removed that warning, and retained a zero-vulnerability audit summary.

## Audit Result After Experiment

Residual audit summary:

```text
Total: 0
Low: 0
Moderate: 0
High: 0
Critical: 0
```

## Decision

The targeted dev-tooling dependency changes were kept because the full validation baseline passed and the audit summary reported zero vulnerabilities.

## Residual Risk

The main residual risk is tooling behavior drift from the Vitest major upgrade and explicit Vite update. Current tests, lint, build, and release/post-release verifiers passed, but future test-runner changes should be reviewed carefully if new failures appear.

## Boundary

PR 11E does not run `npm audit fix --force`, does not change runtime behavior, does not change provider behavior, does not add tools, does not change command allowlists, does not change Policy Gate or Guard semantics, does not add `.env` loading, does not add SDK dependencies, does not change API key handling, does not create a tag, and does not publish packages.

## Follow-up

Monitor the Vitest/Vite toolchain for future compatibility changes. PR 11E does not broaden the upgrade beyond the audit-affected tooling path.
