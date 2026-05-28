# v0.2.0 Final Release Gate

## Purpose

This document defines the final pre-tag release gate for `v0.2.0`. It is intended to be run after PR 10F is merged and before creating the `v0.2.0` git tag.

PR 10F prepares the gate. It does not create the tag and does not publish anything.

## Preconditions

- PR 10E is merged into `main`.
- PR 10F is merged into `main`.
- `package.json` and `package-lock.json` are prepared at version `0.2.0`.
- `mock` remains the default planner.
- Optional providers remain optional.
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
```

`verify:v0.2:release` is the final pre-tag gate.

## Provider Baseline Gate

The release gate confirms that `mock`, `ollama`, `openai`, and `deepseek` are registered and that `mock` remains the default provider.

Real Ollama, OpenAI, and DeepSeek checks are optional and are not required for the release gate.

## Runtime Boundary Gate

The release gate must not introduce runtime semantic changes. It must not add provider runtime behavior, new provider API calls, new tools, command allowlist entries, autonomous execution, or default provider switching.

## Evidence Boundary Gate

Provider output remains proposed plan data only. API keys, full raw responses, full prompts, and reasoning or chain-of-thought must not be persisted in evidence. Guard output remains evidence only.

## API Key Boundary Gate

No API key is required for the release gate. The release gate must not read `.env`, require Ollama, require model installation, or make network calls to provider APIs.

## Tag Boundary Gate

The `v0.2.0` tag must not exist before the final gate passes. PR 10F must not create the tag. Tag creation happens only after merge and final validation on `main`.

## Release Decision

If every required command passes on `main`, the repository is ready for a manual `v0.2.0` tag.

## Failure Handling

If any required command fails, do not tag. Fix the failure in a reviewed PR, merge it, then rerun the full final release gate on `main`.
