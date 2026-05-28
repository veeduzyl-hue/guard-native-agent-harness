# Post-v0.2 Maintenance

## Purpose

This document records the post-v0.2 maintenance baseline after the `v0.2.0` release. The goal is to preserve stability, document known follow-up work, and keep provider and governance boundaries intact while dependency audit warnings are triaged separately.

## Current Release State

`v0.2.0` is tagged and released. The release commit is on `main`, the package version is `0.2.0`, and the release validation baseline has passed.

The post-release baseline should stay documentation-first and verification-first. It should not change runtime behavior.

## Provider Baseline

`mock` remains the default planner provider.

Optional providers remain:

- `ollama`
- `openai`
- `deepseek`

No real provider calls are required for baseline verification. Optional provider checks remain local-only or credential-dependent and are not required for post-release maintenance verification.

## Validation Baseline

The current release validation baseline is:

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
```

`verify:post-v0.2` is CI-safe. It does not call real providers, require API keys, require Ollama, modify files, run audit fixes, create tags, or publish packages.

## Post-release Checks

Post-release maintenance should confirm:

- `package.json` remains at `0.2.0` until the next intentional version change.
- v0.2 release docs remain present.
- Post-v0.2 maintenance docs remain present.
- `mock` remains the default provider.
- Optional providers remain registered.
- `.env` loading, `dotenv`, provider SDK dependencies, and API key persistence remain absent.
- Generated `.evidence/` directories remain untracked.
- The local `v0.2.0` tag is present when tags are available locally.

## Dependency Audit Follow-up

The latest `npm install` reported dependency audit warnings:

```text
6 vulnerabilities (2 low, 4 moderate)
```

These warnings should be triaged in a separate reviewed PR. PR 11A does not perform dependency upgrades and does not run `npm audit fix` or `npm audit fix --force`.

## Branch / Tag Hygiene

Post-release maintenance work should happen on feature branches, not directly on `main`. New tags should not be created for maintenance documentation or audit triage baselines.

The existing `v0.2.0` tag should remain the immutable release marker for the released baseline.

## Known Non-goals

PR 11A does not include:

- Runtime behavior changes.
- Provider changes.
- Dependency upgrades.
- `npm audit fix` or `npm audit fix --force`.
- New tools or command allowlist entries.
- Policy Gate, Guard Adapter, or report renderer semantic changes.
- `.env` loading, SDK dependencies, or API key handling changes.
- SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement changes.
- New git tags or npm publish.

## Recommended Next PRs

Recommended follow-up PRs:

- Dependency audit triage with a reviewed `npm audit --json` summary.
- Bounded dependency remediation after reviewing transitive risk and breaking changes.
- Provider quality comparison using existing optional verification paths.
- Prompt hardening that preserves provider authority boundaries.
- Evidence comparison across providers.
- Optional external trace integration exploration without authority expansion.
