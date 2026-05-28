# Dependency Remediation Decision

## Purpose

This document records the PR 11C remediation decision after reviewing the dependency audit summary and `npm audit fix --dry-run`.

## Baseline Audit Signal

The baseline audit signal remains:

```text
Total: 6
Low: 2
Moderate: 4
High: 0
Critical: 0
```

Affected packages:

- `@eslint/plugin-kit`
- `eslint`
- `esbuild`
- `vite`
- `vite-node`
- `vitest`

## Dry-run Result

`npm audit fix --dry-run` reported that available fixes require `npm audit fix --force`.

The ESLint path would install `eslint@9.39.4`, which npm reported as outside the stated dependency range. The Vitest path would install `vitest@4.1.7`, which npm reported as a breaking change.

## Remediation Decision

No safe non-forced remediation is available in PR 11C.

Because the dry run requires `--force`, PR 11C does not run `npm audit fix` and does not update dependencies.

## Changes Applied

No dependency changes were applied.

PR 11C updates documentation only:

- Records the dry-run result.
- Documents that no safe non-forced remediation was applied.
- Keeps dependency remediation deferred to a separate reviewed PR.

## Validation Result

The full baseline validation must pass without dependency remediation:

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
npm run audit:summary
```

## Residual Audit Signal

The residual audit signal remains unchanged:

```text
Total: 6
Low: 2
Moderate: 4
High: 0
Critical: 0
```

## Boundary

PR 11C does not run `npm audit fix --force`, does not change runtime behavior, does not change provider behavior, does not add tools, does not change command allowlists, does not change Policy Gate or Guard semantics, does not add `.env` loading, does not add SDK dependencies, does not change API key handling, does not create a tag, and does not publish packages.

## Follow-up

A future dependency remediation PR may review explicit version bumps, such as an ESLint update or a Vitest major upgrade, with changelog review and full validation. Forced fixes require explicit approval before use.

PR 11D defines the future sandbox approach in [Dependency Upgrade Sandbox Plan](DEPENDENCY_UPGRADE_SANDBOX_PLAN.md). It remains planning-only and does not change dependencies.
