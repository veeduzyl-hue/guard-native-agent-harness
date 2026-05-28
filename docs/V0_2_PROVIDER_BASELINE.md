# v0.2 Provider Baseline

## Purpose

This document records the v0.2 provider baseline for release-readiness review. It consolidates which planner providers exist, which provider remains default, which checks are CI-safe, and which optional checks require a local model or process-environment API key.

v0.2 is a provider baseline. It is not an autonomous agent release, not a default-provider switch, and not a cloud-provider requirement.

## Provider Matrix

| Provider | Status | Default | Key Required | Local / Remote | Verification |
|---|---|---:|---:|---|---|
| mock | implemented | yes | no | local deterministic | v0.1 + v0.2 baseline |
| ollama | implemented optional | no | no | local model | optional local E2E |
| openai | implemented optional | no | yes, process env only | remote model | optional local verification |
| deepseek | implemented optional | no | yes, process env only | remote model | optional local verification |

## Default Provider

`mock` remains the default provider.

The default path is deterministic and local. `verify:v0.1` remains mock-based, and `verify:v0.1:release` remains mock-based and release-boundary oriented. No v0.2 release-prep check changes the default planner provider.

## Optional Provider Status

Ollama, OpenAI, and DeepSeek are implemented as optional planner providers. They must be selected explicitly with `--planner`.

Optional providers propose plans only. They do not gain tool authority, shell authority, filesystem authority, Guard authority, or policy authority.

## Local Provider Boundary

`mock` is the local deterministic default. `ollama` is optional and local-only, but it requires an already-running local Ollama service and an already-available local model for real E2E use.

The harness does not install Ollama, pull models, manage local model services, or require Ollama for CI-safe validation.

## Remote Provider Boundary

`openai` and `deepseek` are optional remote-model planners. They require explicit provider selection, an explicit model, network access for a real run, and their provider-specific process-environment API key.

Remote providers are not required for `verify:v0.1`, `verify:v0.1:release`, or `verify:v0.2:providers`.

## API Key Boundary

OpenAI requires `OPENAI_API_KEY` only when the OpenAI planner is explicitly selected or its optional local verifier is run. DeepSeek requires `DEEPSEEK_API_KEY` only when the DeepSeek planner is explicitly selected or its optional local verifier is run.

API keys are read from the process environment only. The harness does not read `.env` files, load API key files, add `dotenv`, persist API keys, or write API keys into evidence.

## Evidence Boundary

Provider output is evidence-adjacent planner input, not authority. All accepted provider output is normalized and validated before any plan steps can execute.

API keys, full raw provider responses, full prompts, and reasoning or chain-of-thought are not written into evidence. Guard output remains evidence only and never grants execution authority.

## Execution Boundary

No provider can execute tools directly. All provider output must go through the Plan Normalizer and Plan Validator. Validated steps still go through the Tool Registry and Policy Gate before execution.

Provider output never grants authority. The Tool Registry, command allowlist, and Policy Gate remain mandatory.

## Verification Scripts

- `verify:v0.1`: mock-based v0.1 acceptance verification.
- `verify:v0.1:release`: mock-based release-boundary verification.
- `verify:v0.2:providers`: CI-safe provider baseline verification.
- `verify:ollama:e2e`: optional local-only Ollama E2E verification.
- `verify:openai:planner`: optional OpenAI verification that requires `OPENAI_API_KEY`.
- `verify:deepseek:planner`: optional DeepSeek verification that requires `DEEPSEEK_API_KEY`.

## CI-safe Checks

The CI-safe provider baseline is:

```bash
npm run verify:v0.2:providers
```

This check inspects repository metadata, provider registration, package scripts, dependency boundaries, documentation, and tracked evidence status. It does not call Ollama, OpenAI, or DeepSeek. It does not require API keys, network access, `.env`, or model installation.

## Local-only Checks

The following checks are optional and local-only:

- `npm run verify:ollama:e2e -- --model <local-model-name>`
- `npm run verify:openai:planner -- --model <model-name>`
- `npm run verify:deepseek:planner -- --model <model-name>`

Ollama requires a local Ollama service and local model. OpenAI requires `OPENAI_API_KEY` in the process environment. DeepSeek requires `DEEPSEEK_API_KEY` in the process environment.

## Non-goals

v0.2 does not include:

- New provider runtime behavior.
- New model providers.
- A default provider switch.
- Autonomous planning or autonomous execution.
- New tools or command allowlist entries.
- Policy Gate, Guard Adapter, or report renderer semantic changes.
- `.env` loading, `dotenv`, SDK dependencies, or API key persistence.
- Reasoning or chain-of-thought persistence.
- SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.
- MindForge Guard runtime semantic changes.
- A `v0.2.0` git tag or npm publish.

## Release Candidate Statement

The v0.2 provider baseline is release-candidate material after the PR 10E documentation and CI-safe provider verification pass. It is safe to tag later as `v0.2.0` only after this release-preparation PR is merged and a final release gate passes on `main`.
