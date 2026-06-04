# Guard-native Agent Harness v0.4.0 Release Notes

## Summary

v0.4.0 is the CI Evidence Readiness Baseline for Guard-native Agent Harness.

It makes the repository easier to validate in pull requests and CI through a deterministic GitHub Actions verification workflow, local CI workflow boundary verification, and a generated evidence artifact smoke check.

This release remains evidence-first, local, deterministic, CI-verifiable, and review artifact oriented. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution. There is no Guard runtime semantic change.

## What Changed Since v0.3.0

Since v0.3.0, the v0.4 work added:

- Release-prep package metadata updated to `0.4.0`.
- v0.4 CI evidence readiness planning.
- Deterministic GitHub Actions verification workflow.
- `fetch-depth: 0` checkout for historical tag-aware baseline verification.
- Local workflow boundary verifier: `npm run verify:v0.4:ci-workflow`.
- CI generated evidence artifact smoke check.
- Local smoke verifier: `npm run verify:v0.4:ci-evidence-artifact`.
- Bounded CI artifact upload for inspection outputs only.
- Deterministic v0.4 release readiness verifier: `npm run verify:v0.4:release`.

## CI Verification Workflow

The v0.4 workflow runs on pull requests and pushes to `main` with read-only repository permissions:

```text
contents: read
```

The workflow uses `actions/checkout@v4` with `fetch-depth: 0` so historical local tag checks can run in CI without tag loss from shallow checkout behavior.

The workflow runs deterministic local checks only. It does not use secrets, API keys, model providers, release tags, GitHub Release publishing, or npm publishing.

## CI Evidence Artifact Smoke Check

The v0.4 smoke check uses existing runtime behavior to generate a minimal evidence pack through the default mock planner path, verifies the generated `evidence-manifest.json`, and inspects the evidence pack in JSON and Markdown modes.

The bounded CI artifact upload is:

- Artifact name: `v0.4-ci-evidence-smoke`.
- Artifact path: `.artifacts/v0.4-ci-evidence-smoke/`.
- Retention: 7 days.
- Contents: `evidence-inspection.json` and `evidence-inspection.md` only.

The workflow does not upload `.env`, credentials, `node_modules`, the full repository, or full `.evidence/` directories.

## Verification Commands

The required v0.4.0 release gate is:

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

## What v0.4.0 Does Not Include

v0.4.0 does not include:

- New runtime features.
- New CI features beyond release verification references in this release-prep PR.
- Provider behavior changes.
- Planner behavior changes.
- Tool Registry semantic changes.
- Policy Gate semantic changes.
- Guard Adapter semantic changes.
- Guard runtime semantic changes.
- New model providers.
- `.env` loading, SDK dependencies, cloud model requirements, or API key persistence.
- SaaS, dashboard, OAuth, database, telemetry service, pricing, license, checkout, Paddle, or commercial surface changes.
- Release tag creation in the release-prep PR.
- GitHub Release publication in the release-prep PR.
- npm publishing.

## Tag Status

The `v0.4.0` tag is not created by PR 19. It should be created only after PR 19 is merged into `main` and the final v0.4.0 release gate passes on `main`.
