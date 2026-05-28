# v0.2 Release Preparation

## Purpose

This document prepares the v0.2 provider baseline for release-readiness review. PR 10E documents and verifies the provider baseline, but it does not create the `v0.2.0` tag.

v0.2 is a provider baseline, not an autonomous agent release.

## Preconditions

- PR 10D.1 is merged into `main`.
- `mock`, `ollama`, `openai`, and `deepseek` are registered planner providers.
- `mock` remains the default provider.
- Optional provider acceptance guides exist for Ollama, OpenAI, and DeepSeek.
- No generated `.evidence/` directories or API keys are tracked.

## Required Validation

Run these checks before considering the provider baseline ready for final release gating:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
npm run verify:v0.2:providers
```

These required checks must not call real OpenAI or DeepSeek requests and must not require Ollama.

## Provider Baseline Checks

`npm run verify:v0.2:providers` verifies the release-prep baseline without provider calls:

- Provider registry includes `mock`, `ollama`, `openai`, and `deepseek`.
- `mock` is the default provider.
- Optional provider verifier scripts are present.
- `OPENAI_API_KEY` and `DEEPSEEK_API_KEY` are not required for baseline verification.
- `.env` loading, `dotenv`, OpenAI SDK dependencies, and DeepSeek SDK dependencies are not introduced.
- Generated `.evidence/` directories are not tracked.
- v0.2 provider baseline and release-prep docs exist.
- README links or mentions the v0.2 provider baseline.

## Manual Optional Checks

These checks are optional and local-only:

```bash
npm run verify:ollama:e2e -- --model <local-model-name>
npm run verify:openai:planner -- --model <model-name>
npm run verify:deepseek:planner -- --model <model-name>
```

Ollama requires a local service and local model. OpenAI requires `OPENAI_API_KEY` in the process environment. DeepSeek requires `DEEPSEEK_API_KEY` in the process environment.

## Release Boundary

v0.2 does not mean model providers are default. v0.2 does not mean cloud providers are required. v0.2 does not mean SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.

Provider output remains a proposed plan only. Plan Normalizer, Plan Validator, Tool Registry, Policy Gate, Evidence Writer, Guard Adapter evidence-only semantics, and final report rendering boundaries remain unchanged.

## Tag Preparation

After PR 10E is merged and a final release gate passes, the future tag flow is:

```bash
git checkout main
git pull origin main

npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
npm run verify:v0.2:providers

git tag -a v0.2.0 -m "Guard-native Agent Harness v0.2.0"
git push origin v0.2.0
```

## Do Not Tag Yet

Do not create `v0.2.0` in PR 10E. Do not npm publish from PR 10E.

The tag should be created only after this PR is merged into `main` and the final release gate passes on the merged baseline.

## Known Limitations

- The default provider remains `mock`.
- Optional local-model and remote-model providers are planner-only.
- Remote-provider quality can vary by model and prompt behavior.
- Optional provider verifiers require local models or API keys and are not CI-safe release gates.
- No provider can bypass the Plan Validator, Tool Registry, Policy Gate, or evidence boundary.

## Next Phase

Post-v0.2 work may compare provider quality, harden prompts, compare evidence produced by different providers, or explore external trace integrations. Those future investigations must preserve the no-authority-expansion boundary unless a later reviewed PR explicitly changes scope.
