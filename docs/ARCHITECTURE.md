# Architecture

## 1. Architecture Goal

Create a local TypeScript harness that can eventually run bounded AI-assisted workflows while producing structured evidence that MindForge Guard can validate without becoming an executor.

PR 1 establishes the scaffold and architecture direction only.

## 2. Design Principles

- Local-first filesystem behavior
- Evidence-first records before convenience features
- Explicit boundaries between harness execution and Guard validation
- Deterministic evidence formats where possible
- Small, inspectable components
- No hidden network, shell, or file mutation behavior
- Phased implementation through narrow PRs

## 3. Proposed Directory Structure

```text
guard-native-agent-harness/
  package.json
  README.md
  tsconfig.json
  docs/
    PRD.md
    ARCHITECTURE.md
    GOVERNANCE_BOUNDARY.md
  src/
    index.ts
  tests/
    scaffold.test.ts
```

Future directories may include:

```text
src/
  cli/
  workflows/
  tools/
  policy/
  evidence/
  guard-adapter/
  storage/
```

## 4. Main Components

- CLI: planned local entrypoint built with commander
- Workflow Loader: planned parser for workflow intent and declared steps
- Tool Registry: planned metadata registry for allowed tools
- Policy Gate: planned lightweight decision layer
- Evidence Recorder: planned JSONL, JSON, and Markdown writer
- Guard Adapter: planned evidence preparation layer for MindForge Guard validation
- Storage Layer: planned filesystem-first evidence storage

None of these runtime components are implemented in PR 1.

## 5. Workflow Sequence

Planned sequence:

1. CLI receives a workflow path or identifier.
2. Workflow Loader reads declared intent and tools.
3. Tool Registry resolves tool metadata.
4. Policy Gate evaluates planned actions.
5. Future executor performs only allowed local actions.
6. Evidence Recorder writes ordered records.
7. Guard Adapter prepares validation output.
8. User reviews local evidence and Guard results.

## 6. Evidence Contract

Evidence should be:

- local
- append-oriented where practical
- timestamped
- ordered
- schema-versioned
- hashable
- machine-verifiable
- human-reviewable

The planned Evidence Pack uses:

- `manifest.json`
- `run.jsonl`
- `tool-calls.jsonl`
- `policy-decisions.jsonl`
- `artifacts/`
- `summary.md`

## 7. Policy Evaluation Flow

Planned policy flow:

1. Normalize requested action.
2. Check workflow declaration.
3. Check tool allowlist.
4. Check workspace and command boundaries.
5. Return allow, deny, or review.
6. Record the decision and reason code.
7. Continue only when the current mode permits the decision.

PR 1 does not implement policy evaluation.

## 8. Command Allowlist Direction

Command execution, if added later, must require:

- explicit workflow declaration
- explicit command allowlist
- argument constraints
- workspace containment checks
- evidence logging before and after execution
- denial by default

PR 1 includes no command runner.

## 9. Guard Adapter Boundary

The Guard Adapter may format or validate evidence shape for Guard. It must not execute tools, call shell commands, mutate Guard state, or turn Guard recommendations into enforcement.

## 10. Error Handling Model

Planned errors should be structured and evidence-friendly:

- stable error code
- human-readable message
- component name
- run identifier when available
- recoverability hint
- evidence record when relevant

Failures should preserve partial evidence where safe.

## 11. Testing Architecture

Testing should grow in layers:

- scaffold tests for project baseline
- schema tests for workflow and evidence contracts
- unit tests for policy decisions
- filesystem tests for Evidence Pack writing
- adapter tests for Guard-compatible output
- end-to-end local demo tests only after execution exists

PR 1 includes one scaffold test.

## 12. Extensibility Plan

Future extension points:

- workflow schema versions
- tool metadata adapters
- policy rule packs
- evidence serializers
- Guard Adapter versions
- external agent runtime adapters

Each extension point should preserve local-first behavior and explicit boundaries.

## 13. Architecture Non-goals

- No SaaS backend
- No dashboard
- No API server
- No OAuth connector
- No background daemon
- No production control-plane integration
- No OpenAI client in PR 1
- No tool execution in PR 1
- No Guard CLI child process calls in PR 1

## 14. Architecture Acceptance Criteria

PR 1 architecture is acceptable when:

- project structure is present
- TypeScript build works
- test runner works
- docs describe planned components and boundaries
- no runtime execution behavior exists
- no Guard or MindForge production semantics are changed
