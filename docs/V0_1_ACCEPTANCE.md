# Guard-native Agent Harness v0.1 Acceptance

## Summary

v0.1 proves that Guard-native Agent Harness can run bounded local demo workflows, route every plan step through registered tools and the Policy Gate, capture evidence, collect optional Guard Adapter results, and render a deterministic final governance report.

v0.1 remains local-first and mock-planner based. It does not use OpenAI, external LLMs, autonomous planning, SaaS services, dashboards, OAuth connectors, or background agents.

## What v0.1 Proves

- The CLI can run a safe deterministic workflow.
- The CLI can run an unsafe demonstration workflow where Policy Gate blocks risky requests.
- Evidence Packs are created under `.evidence/<task-id>/`.
- Tool calls are written to `tool-calls.jsonl`.
- Blocked requests are written to `blocked-actions.jsonl`.
- Allowlisted command results are written to `command-results.jsonl` when such commands execute.
- Guard Adapter results are written to `guard-results.json`.
- `final-report.md` summarizes the local evidence deterministically.

## What v0.1 Does Not Prove

- It does not prove autonomous planning.
- It does not prove model-backed reasoning.
- It does not prove complete security assurance or compliance certification.
- It does not prove production deployment readiness.
- It does not change MindForge Guard semantics.

## Evidence Pack Contract

Each v0.1 demo run must create:

```text
.evidence/<task-id>/
  task.json
  plan.json
  tool-calls.jsonl
  blocked-actions.jsonl
  command-results.jsonl
  guard-results.json
  final-report.md
```

Evidence is filesystem-first and uses JSON, JSONL, and Markdown. Generated `.evidence/` directories are local artifacts and should not be committed.

## Safe Demo

The safe demo command is:

```bash
node dist/cli.js run "Create a safe README update proposal"
```

This uses the deterministic README proposal template. It may read `README.md`, inspect git status and diff through registered safe tools, write a proposal artifact under `examples/readme-update/`, create a task-local report artifact, collect Guard Adapter results, and render a final report.

The template does not mutate `README.md` directly.

## Unsafe Blocked-action Demo

The unsafe demo command is:

```bash
node dist/cli.js run "Show a policy demo with blocked action"
```

This intentionally requests blocked actions such as reading `.env` and requesting `git push origin main`. The Policy Gate must deny those requests before execution and write blocked-action evidence.

The unsafe demo must not execute destructive commands or `git push`.

## Guard Adapter Behavior

The local Guard CLI is optional. If unavailable, v0.1 writes a graceful fallback to `guard-results.json`:

```json
{
  "guard_available": false,
  "reason": "Guard CLI not found"
}
```

Guard results are recorded as evidence only. They do not grant execution authority, bypass the Policy Gate, install Guard, mutate Guard policy, or change MindForge Guard runtime semantics.

## Runtime Boundary

- Local-first execution only.
- Deterministic mock planner only.
- Registered tools only.
- Policy-gated tool execution.
- Command allowlist only.
- No OpenAI or external LLM integration.
- No autonomous long-running agents.
- No SaaS, dashboard, OAuth, or background daemon behavior.
- No pricing, checkout, license, entitlement, or License Hub changes.

## Validation Commands

Run:

```bash
npm run build
npm test
npm run lint
npm run verify:v0.1
```

`npm run verify:v0.1` builds the CLI, runs the safe and unsafe demo workflows, verifies required evidence files, checks report contents, and confirms that v0.1 has no required OpenAI/API key or `.env` requirement.

## Acceptance Criteria

v0.1 acceptance passes when:

- Safe demo generates a complete Evidence Pack.
- Unsafe demo generates a complete Evidence Pack.
- Safe demo records at least one tool-call event.
- Unsafe demo records at least one blocked-action event.
- Unsafe demo does not record command execution results for blocked commands.
- Final reports include Tool Calls, Blocked Actions where relevant, Guard Results, and the Guard evidence-only boundary statement.
- No OpenAI or external LLM integration is required.
- No generated `.evidence/` directories are committed.

## Next Phase Options

Possible next phases include optional model integration, richer planner templates, stronger evidence hashing, broader report checks, and external validation workflows. Those phases must preserve the governance boundary: Guard output remains evidence, not execution authority.
