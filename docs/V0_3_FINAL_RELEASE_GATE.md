# v0.3.0 Final Release Gate

## Purpose

This document defines the final pre-tag release gate for `v0.3.0`, the Replayable Evidence Pack Baseline.

PR 15 prepares the release gate. It does not create the tag and does not publish anything.

## Preconditions

- PR 12 is merged into `main`.
- PR 13 is merged into `main`.
- PR 14 is merged into `main`.
- Package metadata is updated to version `0.3.0` for the v0.3.0 tag flow.
- The v0.3 evidence contract, runtime manifest generation, runtime verifier, and evidence inspector are present.
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
npm run verify:v0.3:evidence
npm run verify:v0.3:runtime-evidence
npm run verify:v0.3:inspect-evidence
npm run verify:v0.3:release
```

`verify:v0.3:release` is the final pre-tag gate for v0.3.0.

## Evidence Baseline Gate

The release gate confirms that v0.3 evidence packs are evidence-first, local, deterministic, replayable, and review-oriented.

The gate checks:

- v0.3 release notes, final release gate, and tag-prep docs.
- v0.3 evidence contract documentation.
- v0.3 fixture evidence verifier.
- Runtime `evidence-manifest.json` generation.
- Runtime generated-pack verification.
- Deterministic evidence inspector output.
- Package scripts for all v0.3 verification commands.
- Package metadata version `0.3.0`.

## Runtime Boundary Gate

The release gate must not introduce provider behavior changes, planner behavior changes, Tool Registry semantic changes, Policy Gate semantic changes, Guard Adapter semantic changes, or Guard runtime semantic changes.

The release gate must not add SaaS, dashboard, OAuth, database, telemetry, pricing, license, checkout, Paddle, API key persistence, `.env` loading, SDK dependencies, cloud requirements, release tags, or GitHub Release publication.

## Review Boundary Gate

v0.3.0 remains a review artifact baseline. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant.

No provider output can authorize execution. There is no Guard runtime semantic change.

## Tag Boundary Gate

PR 15 must not create `v0.3.0`. Tag creation happens only after merge and final validation on `main`.

Do not run v0.2.1 tag-prep checks as a blocker after v0.2.1 is already released if the only failure is that local tag v0.2.1 already exists.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.3.0` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full v0.3.0 release gate on `main`.
