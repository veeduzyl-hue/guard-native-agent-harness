# v0.4.0 Final Release Gate

## Purpose

This document defines the final pre-tag release gate for `v0.4.0`, the CI Evidence Readiness Baseline.

PR 19 prepares the release gate. It does not create the tag and does not publish anything.

## Preconditions

- PR 16 is merged into `main`.
- PR 17 is merged into `main`.
- PR 18 is merged into `main`.
- Package metadata is updated to version `0.4.0` for the v0.4.0 tag flow.
- The GitHub Actions verification workflow, workflow boundary verifier, and CI evidence artifact smoke verifier are present.
- No generated `.evidence/` directories, `.artifacts/` outputs, credentials, or API keys are tracked.

## Required Commands

Run:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.2:providers
npm run verify:post-v0.2
npm run verify:dependency-upgrade-plan
npm run audit:summary
npm run verify:v0.3:evidence
npm run verify:v0.3:runtime-evidence
npm run verify:v0.3:inspect-evidence
npm run verify:v0.3:release
npm run verify:v0.4:ci-workflow
npm run verify:v0.4:ci-evidence-artifact
npm run verify:v0.4:release
```

`verify:v0.4:release` is the final pre-tag gate for v0.4.0.

## CI Evidence Readiness Gate

The release gate confirms that v0.4 CI evidence readiness remains evidence-first, local, deterministic, CI-verifiable, and review artifact oriented.

The gate checks:

- v0.4 release notes, final release gate, and tag-prep docs.
- Package metadata version `0.4.0`.
- Package scripts for v0.4 CI workflow, CI evidence artifact smoke, and release readiness verification.
- GitHub Actions verification workflow.
- Read-only workflow permission.
- Tag-aware checkout with `fetch-depth: 0` or an explicit read-only tag fetch.
- v0.4 CI workflow boundary verifier.
- v0.4 CI generated evidence artifact smoke verifier.
- Bounded artifact upload settings when artifact upload is present.

## Runtime Boundary Gate

The release gate must not introduce new runtime features, provider behavior changes, planner behavior changes, Tool Registry semantic changes, Policy Gate semantic changes, Guard Adapter semantic changes, or Guard runtime semantic changes.

The release gate must not add SaaS, dashboard, OAuth, database, telemetry service, pricing, license, checkout, Paddle, API key persistence, `.env` loading, SDK dependencies, cloud model requirements, release tags, GitHub Release publication, or npm publishing.

## Review Boundary Gate

v0.4.0 remains a review artifact baseline. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant.

No provider output can authorize execution. There is no Guard runtime semantic change.

## Tag Boundary Gate

PR 19 must not create `v0.4.0`. Tag creation happens only after merge and final validation on `main`.

Do not run historical tag-prep checks as blockers after a version is already released if the only failure is that the local historical tag already exists.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.4.0` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full v0.4.0 release gate on `main`.
