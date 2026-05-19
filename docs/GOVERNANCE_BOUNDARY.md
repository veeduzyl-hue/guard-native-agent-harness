# Governance Boundary

## 1. Purpose

This document defines the boundary between Guard-native Agent Harness and MindForge Guard so future work can add harness capabilities without changing Guard's role.

## 2. Core Boundary Statement

Guard-native Agent Harness may eventually execute bounded local workflow tools. MindForge Guard must remain recommendation-only, additive-only, non-executing, deterministic, evidence-first, machine-verifiable, local-first, and protected from authority expansion or production control-plane drift.

## 3. Guard Invariants To Preserve

MindForge Guard remains:

- recommendation-only
- additive-only
- non-executing
- deterministic
- evidence-first
- machine-verifiable
- local-first
- not an authority expansion path
- not a production control-plane mutation path

## 4. Harness Scope

The harness scope is local workflow experimentation, planned tool metadata, evidence capture, lightweight policy gates, and Evidence Pack generation.

PR 1 scope is only scaffold and documentation.

## 5. Execution Boundary

PR 1 includes no execution. Later execution must be:

- local
- bounded
- declared
- allowlisted
- evidence-recorded
- workspace-contained
- denied by default

## 6. Policy Gate Boundary

The Policy Gate is a harness-local decision layer. It may record allow, deny, or review decisions. It must not redefine Guard recommendations as enforcement and must not grant authority to undeclared tools.

PR 1 includes no Policy Gate implementation.

## 7. Evidence Boundary

Evidence must be written locally and be suitable for independent review. Planned evidence formats are JSONL, JSON, and Markdown.

Evidence should describe what happened or was planned. It should not hide execution, silently mutate files, or require SaaS services to be understood.

## 8. Guard Adapter Boundary

The Guard Adapter prepares harness evidence for Guard validation. It must not:

- execute commands
- call workflow tools
- invoke Guard as an executor
- mutate Guard state
- bypass harness policy decisions
- change Guard runtime semantics

## 9. Workspace Boundary

The harness must operate within an explicit local workspace. Later file access should require containment checks and declared scope.

PR 1 contains no file mutation logic beyond repository scaffold files.

## 10. Command Boundary

Future command execution must require explicit allowlists, argument constraints, and evidence records. Shell access must not be implicit.

PR 1 contains no command execution logic.

## 11. Data Boundary

Data should remain local by default. External network calls, model APIs, or telemetry must be explicit future work and must not be introduced in PR 1.

## 12. Commercial Boundary

This repository must not alter pricing, checkout, licensing, entitlements, License Hub, or commercial production paths.

## 13. Agent Boundary

The harness may later coordinate an agent runtime, but PR 1 has no agent runtime. Future agent behavior must be adapter-based, declared, and evidence-recorded.

## 14. Reporting Boundary

Reports should summarize local evidence and policy decisions. Reports must not imply that Guard executed tools or enforced actions.

## 15. PR Boundary Rules

For PR 1:

- scaffold and docs only
- no real agent execution
- no OpenAI integration
- no tool registry implementation
- no policy gate implementation
- no Guard CLI child process calls
- no command execution logic
- no SaaS, dashboard, OAuth, or daemon behavior
- no commercial path changes
- no MindForge Guard runtime semantic changes

Future PRs should preserve narrow scope and document any boundary expansion.

## 16. v0.1 Governance Acceptance Criteria

v0.1 governance is acceptable when:

- workflows are declared
- tools are allowlisted
- policy decisions are recorded
- evidence packs are local and inspectable
- Guard Adapter output is evidence-only
- execution, if present, is bounded and denied by default

PR 1 only establishes the documentation baseline for these criteria.

## 17. Future Boundary For External Agent Runtime Experiments

External agent runtimes may be explored only through explicit adapters. The adapter must normalize requests into harness policy and evidence models before any action is considered.

No external runtime should receive implicit workspace, shell, network, or Guard authority.

## 18. Boundary Summary

The harness is where bounded local workflow experimentation may happen. Guard is where evidence is validated. PR 1 keeps that separation absolute by implementing only scaffold, docs, and a minimal test baseline.
