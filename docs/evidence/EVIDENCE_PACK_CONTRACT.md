# v0.3 Evidence Pack Contract

## Purpose

The v0.3 evidence pack contract defines a minimal evidence-first, local, deterministic, read-only verification baseline for review artifacts produced by the Guard-native Agent Harness.

This contract is additive. It makes evidence packs easier to inspect and replay locally. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution. This contract introduces no Guard runtime semantic change.

## Scope

The v0.3 contract covers local evidence files already produced or implied by the harness and adds a deterministic manifest for review.

Required files:

- `evidence-manifest.json`
- `task.json`
- `plan.json`
- `final-report.md`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`

Optional files:

- `file-changes.diff`
- `policy-decisions.jsonl`, if a future harness version produces it

The verifier must treat the pack as a review artifact. It must not execute tools, call providers or models, invoke the Guard CLI, load `.env`, persist API keys or credentials, record model reasoning or chain-of-thought, or claim approval, deployment safety, merge safety, or production readiness.

## Manifest

`evidence-manifest.json` is a deterministic local index of evidence artifacts.

Required manifest fields:

- `schema_version`: `guard-native-evidence-pack-manifest.v1`
- `evidence_pack_version`: `v0.3`
- `created_by`: `guard-native-agent-harness`
- `task_id`: the same task id recorded in `task.json`
- `files`: an array of file entries

Each file entry must include:

- `path`: relative POSIX-style path inside the evidence pack
- `size_bytes`: byte length of the file
- `sha256`: lowercase SHA-256 hash of the file bytes
- `role`: review-oriented artifact role

The manifest must not use absolute paths, parent directory traversal, backslashes, or paths outside the evidence pack.

The `files` array must be sorted deterministically by `path` in ascending lexical order. The manifest should list required evidence artifacts other than `evidence-manifest.json`. Optional artifacts may be listed when present.

## File Rules

`task.json`, `plan.json`, `guard-results.json`, and `evidence-manifest.json` must parse as JSON.

`tool-calls.jsonl`, `blocked-actions.jsonl`, `command-results.jsonl`, and optional `policy-decisions.jsonl` must parse line by line as JSONL. Blank lines are ignored. An empty or whitespace-only JSONL file is a valid zero-event stream. Malformed JSONL must be reported with deterministic file and line numbers.

`final-report.md` is a local human review summary. It must remain a review artifact and must not imply approval, enforcement, autonomous execution, runtime control plane authority, or Guard runtime semantic change.

## Verification Boundary

`npm run verify:v0.3:evidence` runs the local verifier.

The verifier:

- checks required files exist
- parses JSON files
- parses JSONL files line by line
- handles empty and malformed JSONL deterministically
- checks manifest ordering
- recomputes manifest file sizes and SHA-256 hashes locally
- performs read-only verification
- performs no tool execution
- performs no provider/model call
- performs no Guard CLI call
- does not load `.env`
- does not persist API keys or credentials
- does not record model reasoning or chain-of-thought
- does not claim approval, deployment safety, merge safety, or production readiness

The result is evidence-first local verification for review. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution. There is no Guard runtime semantic change.
