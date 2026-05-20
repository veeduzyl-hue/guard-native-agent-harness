# Guard-native Agent Harness v0.1 Baseline

## Baseline Positioning

v0.1 is a local-first, deterministic, evidence-first agent harness baseline. It proves a bounded local evidence loop without model-backed or autonomous planning.

## Architecture Baseline

The baseline includes a CLI task runner, deterministic mock planner, sequential orchestrator, Tool Registry, Policy Gate, Evidence Writer, optional Guard Adapter, and deterministic final report renderer.

## Runtime Baseline

Runtime execution is bounded to registered tools. The mock planner selects fixed templates from prompt text. It does not call OpenAI, external LLMs, or local model providers.

## Evidence Baseline

Each run produces an Evidence Pack under `.evidence/<task-id>/` with task metadata, plan evidence, tool-call evidence, blocked-action evidence, command-result evidence, Guard results, and a final Markdown report.

## Policy Baseline

The Policy Gate evaluates tool requests before execution. It blocks `.env` reads, credential-like reads, workspace escape attempts, protected commercial or production writes, destructive command requests, `git push`, and non-allowlisted commands.

## Guard Adapter Baseline

Guard Adapter output is recorded in `guard-results.json`. If the local Guard CLI is unavailable, the harness writes a graceful fallback and still completes.

Guard results are evidence only. They do not grant execution authority.

## Report Baseline

`final-report.md` is generated deterministically from local evidence files. The report does not use an LLM, does not invent evidence, and does not certify compliance.

## Acceptance Baseline

`npm run verify:v0.1` verifies the safe demo, unsafe blocked-action demo, required Evidence Pack files, final report sections, Guard evidence-only boundary statement, and absence of required OpenAI/API key or `.env` configuration.

## Non-goals

- OpenAI or external LLM integration.
- Autonomous planning.
- New tools outside the registered v0.1 set.
- Arbitrary command execution.
- New command allowlist entries.
- SaaS, dashboard, OAuth, or background agent behavior.
- Pricing, checkout, license, entitlement, or License Hub changes.
- MindForge Guard runtime semantic changes.

## Future Work

Future PRs should use this document as a boundary reference. Optional model-backed planning, external trace experiments, stronger hashing, or richer reports must preserve registered tool execution, Policy Gate evaluation, Evidence Writer capture, and Guard evidence-only semantics.
