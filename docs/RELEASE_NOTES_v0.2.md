# Guard-native Agent Harness v0.2.0 Release Notes

## Summary

v0.2.0 is the provider baseline release for Guard-native Agent Harness. It adds optional planner provider paths while keeping the deterministic `mock` planner as the default.

This is not an autonomous agent release. Provider output remains a proposed plan only, and all execution remains bounded by the existing Tool Registry, Policy Gate, evidence writer, Guard Adapter evidence-only boundary, and final report renderer.

## What Changed Since v0.1.0

Since v0.1.0, the harness added:

- Planner Provider interface.
- Provider Registry.
- `--planner`, `--model`, and `--planner-timeout-ms`.
- Plan Normalizer and Plan Validator.
- Tool input schema hints for planner prompts.
- Optional Ollama local-model planner.
- Optional OpenAI remote-model planner.
- Optional DeepSeek remote-model planner.
- Provider acceptance guides and local verifier scripts.
- v0.2 provider baseline and release-preparation checks.

## Provider Baseline

The v0.2.0 provider baseline is:

| Provider | Status | Default | Key Required | Boundary |
|---|---|---:|---:|---|
| mock | implemented | yes | no | local deterministic |
| ollama | implemented optional | no | no | local model |
| openai | implemented optional | no | yes, process env only | remote model |
| deepseek | implemented optional | no | yes, process env only | remote model |

## Default Planner

`mock` remains the default planner. The v0.1 verification path remains mock-based, deterministic, and CI-safe.

## Optional Providers

Ollama, OpenAI, and DeepSeek are optional. They must be selected explicitly. Real Ollama checks require a local Ollama service and local model. Real OpenAI and DeepSeek checks require process-environment API keys only.

The harness does not read `.env` files, load `dotenv`, add OpenAI SDK dependencies, add DeepSeek SDK dependencies, install Ollama, or pull models.

## Evidence Boundary

Provider output is not authority. API keys, full raw provider responses, full prompts, and reasoning or chain-of-thought are not written into evidence.

Guard output remains evidence only and does not grant execution authority.

## Execution Boundary

No provider executes tools directly. Provider output must pass through the Plan Normalizer and Plan Validator. Validated steps still route through the Tool Registry and Policy Gate before execution.

The command allowlist is not expanded by v0.2.0.

## Verification Commands

The required release gate is:

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

`verify:v0.1` remains mock-based. `verify:v0.2:providers` is CI-safe and does not call real providers. `verify:v0.2:release` is the final CI-safe pre-tag release gate.

## What v0.2.0 Does Not Include

v0.2.0 does not include:

- Autonomous planning or autonomous execution.
- A default provider switch away from `mock`.
- Required cloud providers.
- New tools or command allowlist entries.
- Provider-granted tool authority.
- Policy Gate, Guard Adapter, or report renderer semantic changes.
- `.env` loading, `dotenv`, SDK dependencies, or API key persistence.
- Reasoning or chain-of-thought persistence.
- SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.
- MindForge Guard runtime semantic changes.
- npm publish behavior.

## Upgrade / Usage Notes

Existing v0.1 mock-based workflows continue to work without provider API keys. Users who want local or remote model planning must opt in with `--planner` and supply provider-specific requirements outside the release gate.

Remote providers require process environment API keys only:

- `OPENAI_API_KEY` for `--planner openai`.
- `DEEPSEEK_API_KEY` for `--planner deepseek`.

## Tag Status

The `v0.2.0` tag is not created by PR 10F. It should be created only after PR 10F is merged into `main` and the final release gate passes on `main`.
