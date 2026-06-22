# v0.5.0 Final Release Gate

## Purpose

This document defines the final pre-tag release gate for `v0.5.0`, the Evidence Review Profile Baseline.

This PR prepares the release gate. It does not create the tag, publish a GitHub Release, or publish to npm.

## Preconditions

- v0.5 review profile schema and fixtures are merged into `main`.
- v0.5 deterministic review profile verification is merged into `main`.
- v0.5 `inspect-evidence --profile <profile-id>` support is merged into `main`.
- Package metadata is updated to version `0.5.0` for the v0.5.0 tag flow.
- No generated `.evidence/` directories, `.artifacts/` outputs, credentials, or API keys are tracked.

## Required Commands

Run:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.5:profiles
npm run verify:v0.5:inspect-profile
npm run verify:v0.5:release
```

`verify:v0.5:release` is the final pre-tag gate for v0.5.0.

## Release Gate Coverage

The release gate confirms:

- v0.5 release notes, final release gate, and tag-prep docs are present.
- Package metadata is at `0.5.0`.
- v0.5 review profile schema exists.
- Valid profile fixtures exist for `local-dev`, `ci-pr`, `release-prep`, and `audit-review`.
- Invalid profile fixtures exist for negative validation.
- `verify:v0.5:profiles`, `verify:v0.5:inspect-profile`, and `verify:v0.5:release` scripts are present.
- v0.5 docs mention review profile schema and fixtures.
- v0.5 docs mention the deterministic profile verifier.
- v0.5 docs mention `inspect-evidence --profile`.
- v0.5 docs mention the valid profile IDs.
- v0.5 docs state the review artifact boundary.
- v0.5 docs state that no provider output can authorize execution.
- v0.5 docs state that expected verifier references are declarative only.

## Runtime Boundary Gate

v0.5.0 must not change planner provider authority, runtime execution semantics, replay semantics, v0.4 CI workflow behavior, provider execution authority, approval behavior, enforcement behavior, blocking behavior, deployment authority, runtime control-plane behavior, or authority grants.

The release gate must not add SaaS, dashboard, OAuth, database, telemetry service, pricing, license, checkout, Paddle, API key persistence, `.env` loading, SDK dependencies, cloud model requirements, release tags, GitHub Release publication, or npm publishing.

## Review Boundary Gate

Review profiles remain review artifacts only. They do not approve, enforce, block, deploy, grant authority, control runtime execution, authorize execution, or act as a runtime control plane.

No provider output can authorize execution. Expected verifier references in review profiles are declarative only and are not executed by profile verification or inspection.

## Tag Boundary Gate

This PR must not create `v0.5.0`. Tag creation happens only after merge and final validation on `main`.

Pre-tag gates are intended to run before tag creation and may require that the target tag does not exist. Once a release tag already exists, a historical pre-tag gate should not be treated as a blocker if the only failure is that the historical tag already exists.

Post-tag sanity should be separate from pre-tag release gates. Post-tag sanity should check the existing tag and package artifact instead of requiring tag absence.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.5.0` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full v0.5.0 release gate on `main`.
