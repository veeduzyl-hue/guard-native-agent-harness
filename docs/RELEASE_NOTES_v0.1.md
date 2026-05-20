# Guard-native Agent Harness v0.1 Release Notes

## Release Summary

v0.1 establishes a local, deterministic, evidence-first agent harness baseline using a mock planner, registered tools, policy-gated execution, Guard evidence capture, and deterministic final reports.

## What v0.1 Includes

- Local CLI workflow through `guard-agent run "<task>"`.
- Deterministic mock planner with fixed workflow templates.
- Sequential orchestrator that routes plan steps through the Tool Registry.
- Tool Registry with safe tools for file inspection, bounded file writing, git inspection, evidence report artifacts, and allowlisted commands.
- Policy Gate that evaluates requests before execution.
- Blocked-action evidence in `blocked-actions.jsonl`.
- Command allowlist and sandbox for explicitly allowed local validation commands.
- Optional Guard Adapter with graceful unavailable fallback.
- Deterministic final report renderer derived from local evidence files.
- v0.1 acceptance script through `npm run verify:v0.1`.

## What v0.1 Does Not Include

- OpenAI or external LLM integration.
- Autonomous planning.
- Long-running agents.
- OAuth connectors.
- SaaS backend.
- Dashboard.
- Multi-tenant system.
- Enterprise permission system.
- Production deployment control.
- MindForge Guard runtime semantic changes.

## Evidence Pack Contract

Each v0.1 run writes an Evidence Pack under `.evidence/<task-id>/`:

```text
task.json
plan.json
tool-calls.jsonl
blocked-actions.jsonl
command-results.jsonl
guard-results.json
final-report.md
```

Generated Evidence Packs are local artifacts and are not committed.

## CLI Workflows

The v0.1 CLI supports deterministic demo workflows selected from the task prompt. It does not call an LLM and does not infer arbitrary tools or commands.

## Safe Demo

```bash
node dist/cli.js run "Create a safe README update proposal"
```

The safe demo generates tool-call evidence and a README update proposal artifact without directly modifying `README.md`.

## Unsafe Blocked-action Demo

```bash
node dist/cli.js run "Show a policy demo with blocked action"
```

The unsafe demo intentionally requests blocked actions such as `.env` reads and `git push`. These requests are denied before execution and recorded in `blocked-actions.jsonl`.

## Guard Adapter Behavior

The Guard CLI is optional. If unavailable, `guard-results.json` records `guard_available: false` and the run still completes.

Guard output is evidence only. It does not grant execution authority, bypass the Policy Gate, install Guard, mutate Guard policy, or change MindForge Guard semantics.

## Final Report Behavior

`final-report.md` is generated deterministically from local evidence files. It summarizes task metadata, plan details, evidence contents, tool calls, blocked actions, command results, Guard results, file changes, governance notes, runtime boundaries, and limitations.

## Validation Commands

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
```

## Governance Boundary

v0.1 is local-first, evidence-first, and mock-planner based. Tool execution must be registered, policy-gated, and evidence-producing. Command execution is limited to the existing allowlist. Guard Adapter results remain evidence only.

## Known Limitations

- No model-backed planner.
- No autonomous multi-step reasoning.
- No production deployment control.
- No complete compliance certification.
- Guard CLI may be unavailable locally.
- Evidence completeness depends on local generated files.

## Next Phase

Future work may explore optional model-backed planning, richer evidence hashes, and external runtime trace experiments. Any next phase must preserve Tool Registry, Policy Gate, Evidence Writer, and Guard evidence-only boundaries.
