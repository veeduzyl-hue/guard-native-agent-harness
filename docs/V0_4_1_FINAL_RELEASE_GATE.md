# v0.4.1 Final Release Gate

## Purpose

This document defines the final pre-tag release gate for `v0.4.1`, the Dependency Remediation Patch.

This PR prepares the release gate. It does not create the tag, publish a GitHub Release, or publish to npm.

## Preconditions

- The bounded post-v0.4 dependency remediation is merged into `main`.
- Package metadata is updated to version `0.4.1` for the v0.4.1 tag flow.
- The remediation record exists at `docs/security/POST_V0_4_DEPENDENCY_REMEDIATION.md`.
- No generated `.evidence/` directories, `.artifacts/` outputs, credentials, or API keys are tracked.

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
npm run verify:v0.4:ci-workflow
npm run verify:v0.4:ci-evidence-artifact
npm run verify:v0.4:release
npm run verify:post-v0.4:dependencies
npm run verify:v0.4.1:release
```

`verify:v0.4.1:release` is the final pre-tag gate for v0.4.1.

## Dependency Remediation Gate

The release gate confirms:

- `vite` remains pinned to `6.4.3`.
- `js-yaml` resolves to `4.2.0`.
- `vitest` remains `4.1.7`.
- No Vite 7 or Vite 8 dependency exists.
- Full audit reports 0 vulnerabilities.
- Runtime-only audit reports 0 vulnerabilities.

## Runtime Boundary Gate

v0.4.1 is dependency-remediation-only.

The release gate must not introduce runtime behavior changes, provider behavior changes, planner behavior changes, Tool Registry semantic changes, Policy Gate semantic changes, Guard Adapter semantic changes, or Guard runtime semantic changes.

The release gate must not add SaaS, dashboard, OAuth, database, telemetry service, pricing, license, checkout, Paddle, API key persistence, `.env` loading, SDK dependencies, cloud model requirements, release tags, GitHub Release publication, or npm publishing.

## Review Boundary Gate

v0.4.1 remains a review artifact baseline patch. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant.

No provider output can authorize execution. There is no runtime semantic change, no provider semantic change, and no Guard runtime semantic change.

## Tag Boundary Gate

This PR must not create `v0.4.1`. Tag creation happens only after merge and final validation on `main`.

Do not run historical tag-prep checks as blockers after a version is already released if the only failure is that the local historical tag already exists.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.4.1` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full v0.4.1 release gate on `main`.
