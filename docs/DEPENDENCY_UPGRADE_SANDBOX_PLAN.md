# Dependency Upgrade Sandbox Plan

## Purpose

This document defines a controlled future sandbox path for dependency upgrades related to the post-v0.2 audit findings. PR 11D is planning-only: it does not upgrade dependencies, run audit fixes, or change runtime behavior.

## Baseline

The current baseline is `v0.2.0` plus PRs 11A through 11C:

- PR 11A added post-v0.2 maintenance and audit triage.
- PR 11B added a bounded audit review and `audit:summary`.
- PR 11C confirmed no safe non-forced remediation was available from `npm audit fix --dry-run`.

The default planner remains `mock`, and Ollama, OpenAI, and DeepSeek remain optional.

## Residual Audit Signal

The residual audit signal is:

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

## Affected Package Matrix

| Package | Current Role | Direct / Transitive | Audit Severity | Likely Upgrade Risk | Notes |
|---|---|---|---|---|---|
| `@eslint/plugin-kit` | lint tooling | audit-derived | low/moderate as reported | tied to ESLint path | review with ESLint upgrade |
| `eslint` | lint tooling | direct/dev if applicable | audit-derived | may move outside range | do not force yet |
| `esbuild` | build/dev tooling | audit-derived | moderate as reported | tied to Vite/Vitest | validate build/test carefully |
| `vite` | dev/test tooling | audit-derived | moderate as reported | may require major path | review with Vitest |
| `vite-node` | test tooling | audit-derived | moderate as reported | tied to Vitest | review with Vitest |
| `vitest` | test tooling | direct/dev if applicable | audit-derived | breaking upgrade reported | isolate in sandbox |

## Dev-tooling Exposure

The affected packages are currently understood as lint and test tooling dependencies, not CLI runtime dependencies. That does not mean the findings can be ignored, but it does shape the remediation strategy: upgrade candidates should be isolated, tested, and reviewed as tooling changes.

## Upgrade Risk

PR 11C found that `npm audit fix --dry-run` requires `npm audit fix --force` for the available remediation paths. The ESLint path may move outside the stated dependency range, and the Vitest path may require a breaking upgrade.

Any upgrade attempt should assume tooling behavior can change and should validate TypeScript build output, Vitest behavior, lint behavior, and all release/post-release verifiers.

## Sandbox Branch Strategy

Future upgrade evaluation should happen in a separate sandbox branch:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b chore/sandbox-dependency-upgrade-vite-vitest-eslint
```

A future evaluator may inspect targeted upgrade options with commands such as:

```bash
npm outdated
npm audit --json
npm install --save-dev <candidate versions>
```

Do not run those upgrade commands in PR 11D.

## Proposed Validation Sequence

Any future upgrade PR must run:

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

It must also include:

```bash
git diff -- package.json package-lock.json
```

and a written dependency-change summary.

## Rejection Criteria

Reject a future upgrade candidate if it:

- Requires `npm audit fix --force`.
- Changes runtime behavior.
- Changes provider behavior.
- Breaks TypeScript build.
- Breaks Vitest tests.
- Breaks lint.
- Changes Tool Registry, Policy Gate, or Guard semantics.
- Introduces `.env` loading.
- Introduces SDK dependencies.
- Introduces API key persistence.
- Adds new tools or command allowlist entries.
- Requires real provider calls for validation.

## No-force Policy

`npm audit fix --force` remains forbidden unless a future reviewed PR explicitly approves it and documents the exact dependency, lockfile, and validation impact.

## What This PR Does Not Change

PR 11D does not upgrade dependencies, run `npm audit fix`, run `npm audit fix --force`, modify `package-lock.json`, change runtime behavior, change provider behavior, add tools, change command allowlists, alter Policy Gate or Guard semantics, add `.env` loading, add SDK dependencies, change API key handling, create tags, or publish packages.

## Recommended Next PR

Open a separate sandbox PR to evaluate explicit ESLint and Vitest/Vite candidate versions. That PR should include exact candidate versions, package and lockfile diffs, changelog notes, validation results, residual audit summary, and a clear accept/reject decision.
