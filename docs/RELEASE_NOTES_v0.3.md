# Guard-native Agent Harness v0.3.0 Release Notes

## Summary

v0.3.0 is the Replayable Evidence Pack Baseline for Guard-native Agent Harness.

It makes generated evidence packs more inspectable and replayable through a v0.3 evidence contract, deterministic manifest rules, runtime manifest generation, generated-pack verification, and deterministic local inspection output.

This release remains evidence-first, local, deterministic, replayable, and review-oriented. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution. There is no Guard runtime semantic change.

## What Changed Since v0.2.1

Since v0.2.1, the v0.3 work added:

- v0.3 evidence pack contract documentation.
- Deterministic manifest rules for local evidence artifacts.
- Fixture-based v0.3 evidence verifier.
- Runtime generation of `evidence-manifest.json`.
- Runtime generated-pack verifier.
- Deterministic evidence inspector.
- JSON and Markdown inspection output.

## Evidence Pack Contract

The v0.3 contract defines a local review artifact layout around existing harness evidence:

- `task.json`
- `plan.json`
- `final-report.md`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `evidence-manifest.json`

The manifest records deterministic relative paths, byte sizes, SHA-256 hashes, and artifact roles. The manifest excludes itself from its own file list to avoid self-hash recursion.

## Runtime Manifest Generation

Runtime task runs now write `evidence-manifest.json` after the expected evidence files are finalized, including `final-report.md`.

Manifest generation is local and file-based. It does not call model providers, does not call Guard CLI, does not load `.env`, does not persist credentials, and does not grant authority.

## Evidence Inspector

The v0.3 evidence inspector reads an existing evidence directory and emits deterministic JSON or Markdown output:

```bash
guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --json
guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --markdown
```

The inspector is read-only. It does not run tasks, execute tools, call planner or model providers, call Guard CLI, mutate evidence files, or create a new evidence pack.

## Verification Commands

The required v0.3.0 release gate is:

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

## What v0.3.0 Does Not Include

v0.3.0 does not include:

- New runtime features beyond evidence manifest generation and local inspection.
- Provider behavior changes.
- Planner behavior changes.
- Tool Registry semantic changes.
- Policy Gate semantic changes.
- Guard Adapter semantic changes.
- Guard runtime semantic changes.
- `.env` loading, SDK dependencies, or API key persistence.
- SaaS, dashboard, OAuth, database, telemetry, pricing, license, checkout, Paddle, or commercial surface changes.
- Release tag creation in the release-prep PR.
- GitHub Release publication in the release-prep PR.

## Tag Status

The `v0.3.0` tag is not created by PR 15. It should be created only after PR 15 is merged into `main` and the final v0.3.0 release gate passes on `main`.
