# Guard-native Agent Harness

Guard-native Agent Harness is a local, evidence-first harness for bounded AI-assisted workflows. It produces replayable Evidence Packs, emits a Guard-compatible execution-facts envelope, validates bounded planner output, records tool, policy, and command evidence, and supports review-profile-based evidence inspection.

## Current Release

- Current release: `v0.5.0`
- Baseline: Evidence Review Profile Baseline
- Tag: `v0.5.0`
- Release notes: [docs/RELEASE_NOTES_v0.5.md](docs/RELEASE_NOTES_v0.5.md)

## What It Does

- Runs bounded local workflows through registered tools.
- Captures local Evidence Packs for review and replay.
- Applies local policy gates before registered tool execution.
- Uses the deterministic `mock` planner by default.
- Supports optional planner providers: Ollama, OpenAI, and DeepSeek.
- Validates planner output before any tool execution.
- Supports deterministic `inspect-evidence` output.
- Supports v0.5 review profiles:
  - `local-dev`
  - `ci-pr`
  - `release-prep`
  - `audit-review`

## What It Does Not Do

- No autonomous execution.
- No model-granted authority.
- No provider tool calling.
- No arbitrary shell execution.
- No SaaS, dashboard, or background daemon.
- No OAuth connectors.
- No npm publishing behavior.
- No deployment authority.
- No runtime control plane.
- No MindForge Guard semantic changes.

## Quickstart

```bash
npm install
npm run build
npx guard-agent run "Create a safe README update proposal"
```

Fallback:

```bash
node dist/cli.js run "Create a safe README update proposal"
```

The default run uses the deterministic `mock` planner and registered local tools. It does not require provider API keys.

## Evidence Pack Output

A run writes a local Evidence Pack under `.evidence/<task-id>/`:

```text
.evidence/<task-id>/
  task.json
  plan.json
  tool-calls.jsonl
  blocked-actions.jsonl
  command-results.jsonl
  guard-results.json
  evidence-manifest.json
  evidence-pack.json
  final-report.md
```

Evidence Packs are filesystem-first review artifacts. They are intended to be inspected locally and replayed through deterministic verification.

Harness is an Evidence Producer only. It emits bounded execution facts for Guard ingestion and does not compute governance verdicts, reason codes, risk summaries, or evidence coverage.

## Inspect Evidence

Build the CLI, then inspect an existing Evidence Pack:

```bash
npm run build
npx guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --json
npx guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --markdown
```

`inspect-evidence` is read-only. It does not run tasks, execute tools, call planner providers, call Guard, mutate evidence files, or create a new Evidence Pack.

## v0.5 Review Profiles

Use a review profile to include bounded review metadata and framing in inspection output:

```bash
npx guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --profile local-dev --json
npx guard-agent inspect-evidence --evidence-dir .evidence/<task-id> --profile audit-review --markdown
```

Valid profile IDs are:

- `local-dev`
- `ci-pr`
- `release-prep`
- `audit-review`

Unknown profile IDs are rejected deterministically. Profiles are not inferred from environment, CI, branch, or Git state.

The selected profile only adds review metadata and framing. Review profiles are review artifacts only. They do not approve, enforce, block, deploy, grant authority, control runtime execution, authorize execution, or act as a runtime control plane. Expected verifier references are declarative only and are not executed by profile verification or inspection.

Review profile docs:

- [Review Profile Schema](docs/evidence/REVIEW_PROFILE_SCHEMA.md)
- [v0.5 Release Notes](docs/RELEASE_NOTES_v0.5.md)

## Planner Providers

The default planner provider is `mock`:

```bash
npx guard-agent run "Create a safe README update proposal" --planner mock
```

Optional providers are available when explicitly selected:

- Ollama
- OpenAI
- DeepSeek

Remote providers require process-environment API keys only. The harness does not load `.env` files. Providers propose plans only; they do not receive tools, call tools, or receive execution authority. The Plan Validator, Tool Registry, and Policy Gate remain mandatory before any valid step can run.

Provider docs:

- [Ollama Local Planner Acceptance](docs/OLLAMA_LOCAL_PLANNER_ACCEPTANCE.md)
- [Ollama Local Planner E2E Acceptance](docs/OLLAMA_E2E_ACCEPTANCE.md)
- [OpenAI Planner Provider](docs/OPENAI_PLANNER_PROVIDER.md)
- [OpenAI Planner Acceptance](docs/OPENAI_PLANNER_ACCEPTANCE.md)
- [DeepSeek Planner Provider](docs/DEEPSEEK_PLANNER_PROVIDER.md)
- [DeepSeek Planner Acceptance](docs/DEEPSEEK_PLANNER_ACCEPTANCE.md)
- [v0.2 Planner Provider Boundary](docs/V0_2_PLANNER_PROVIDER_BOUNDARY.md)

## Verification

Recommended local verification:

```bash
npm run build
npm run lint
npm test
npm run verify:v0.5:profiles
npm run verify:v0.5:inspect-profile
```

The v0.5 release gate is also available:

```bash
npm run verify:v0.5:release
```

`verify:v0.5:release` is a pre-tag release gate. It checks release-readiness assumptions that are intended to run before the `v0.5.0` tag exists, so it should not be used as a post-tag blocker after `v0.5.0` has been created.

## Release Docs

- [v0.5 Release Notes](docs/RELEASE_NOTES_v0.5.md)
- [v0.5 Final Release Gate](docs/V0_5_FINAL_RELEASE_GATE.md)
- [v0.5 Tag Preparation](docs/V0_5_TAG_PREP.md)
- [Roadmap](docs/ROADMAP.md)
- [Review Profile Schema](docs/evidence/REVIEW_PROFILE_SCHEMA.md)
- [Evidence Pack Contract](docs/evidence/EVIDENCE_PACK_CONTRACT.md)
- [Governance Boundary](docs/GOVERNANCE_BOUNDARY.md)

## v0.1 Release Readiness

The original v0.1 release-readiness documents remain linked for baseline evidence-pack acceptance and release-history review:

- [docs/RELEASE_NOTES_v0.1.md](docs/RELEASE_NOTES_v0.1.md)
- [docs/V0_1_TAG_PREP.md](docs/V0_1_TAG_PREP.md)
- [docs/V0_1_ACCEPTANCE.md](docs/V0_1_ACCEPTANCE.md)
- [docs/V0_1_BASELINE.md](docs/V0_1_BASELINE.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

## Relationship To MindForge Guard

This repository is separate from MindForge Guard. Harness is the local evidence producer. Guard is the evidence consumer and governance authority. The harness may produce Guard-compatible evidence packs that Guard can ingest, but Harness does not compute governance verdicts, reason codes, risk summaries, or evidence coverage.

Existing local Policy Gate blocks remain Harness safety controls. They are not Guard governance verdicts, and Guard output is still evidence, not execution authority.

The harness must not change MindForge Guard runtime semantics, policy semantics, commercial behavior, or production control-plane behavior.

## Version History

- `v0.1`: Local Evidence-first Harness.
- `v0.2`: Optional Planner Provider Baseline.
- `v0.3`: Replayable Evidence Pack Baseline.
- `v0.4`: CI Evidence Readiness Baseline.
- `v0.4.1`: Dependency remediation patch for dev/build/test/CI tooling.
- `v0.5.0`: Evidence Review Profile Baseline.

For details, use the release notes and [docs/ROADMAP.md](docs/ROADMAP.md).

## Non-goals

- Autonomous or model-granted execution authority.
- Provider tool calling or provider-controlled execution.
- Arbitrary tool execution or arbitrary command execution.
- Required provider API keys.
- Required Guard CLI installation.
- SaaS, dashboard, API server, OAuth, or background daemon behavior.
- Pricing, checkout, license, entitlement, or License Hub changes.
- npm publishing behavior.
- Deployment authority.
- Runtime control-plane behavior.
- MindForge Guard runtime semantic changes.
