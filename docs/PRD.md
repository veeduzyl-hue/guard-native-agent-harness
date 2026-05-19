# Product Requirements Document

## 1. One-line Positioning

Guard-native Agent Harness is a bounded local AI agent harness that captures evidence from simple AI-assisted workflows and produces governance-ready Evidence Packs that MindForge Guard can validate.

## 2. Why Now

AI-assisted workflows increasingly need local experimentation without turning governance systems into executors. This project creates a separate harness where bounded local execution can eventually be explored while preserving MindForge Guard as a deterministic, evidence-first validator.

PR 1 exists to establish scope, boundaries, and a TypeScript baseline before runtime behavior is added.

## 3. Relationship To MindForge Guard

MindForge Guard remains:

- recommendation-only
- additive-only
- non-executing
- deterministic
- evidence-first
- machine-verifiable
- local-first
- constrained against authority expansion
- constrained against production control-plane drift

This harness may produce evidence for Guard. It must not change Guard runtime semantics or move execution authority into Guard.

## 4. Relationship To OpenHuman / OpenClaw / Hermes

OpenHuman, OpenClaw, and Hermes may inform future workflow patterns, agent interfaces, or orchestration experiments. They are not dependencies in PR 1.

The harness should treat any future external runtime, agent, or orchestration layer as an input boundary. It should normalize evidence and policy context locally rather than granting those systems implicit authority.

## 5. Target Users

- Developers experimenting with bounded local AI-assisted workflows
- Governance reviewers who need inspectable evidence from local agent activity
- MindForge Guard maintainers validating evidence contracts without adding execution
- Security-conscious teams evaluating tool-call traces before broader automation

## 6. Core Use Cases

- Run a local workflow with declared tools and produce an Evidence Pack
- Capture tool-call requests, decisions, results, and artifacts
- Evaluate lightweight policy gates before or after planned tool calls
- Prepare evidence for Guard validation without invoking Guard as an executor
- Support repeatable local demos of governance-aware agent workflows

## 7. MVP Scope

The MVP should include:

- TypeScript CLI foundation
- Workflow definition schema
- Tool registry metadata
- Policy Gate model
- Filesystem Evidence Pack writer
- Guard Adapter output format
- Minimal local examples and tests

PR 1 includes only scaffold and documentation.

## 8. Non-goals

- Real agent execution in PR 1
- OpenAI integration in PR 1
- Tool execution in PR 1
- Guard CLI child process calls in PR 1
- Production SaaS service
- Dashboard or web server
- OAuth connectors
- Background daemon behavior
- Pricing, checkout, license, entitlement, or License Hub changes
- MindForge Guard runtime semantic changes

## 9. Core Architecture

The planned architecture separates:

- CLI entrypoint
- Workflow loader
- Tool registry metadata
- Policy Gate evaluation
- Evidence recorder
- Guard Adapter
- Local filesystem storage

The executor remains absent in PR 1 and should be introduced only behind explicit allowlists and governance boundaries in later PRs.

## 10. Data Flow

Planned data flow:

1. User invokes a CLI command.
2. CLI loads workflow and workspace context.
3. Harness resolves declared tool metadata.
4. Policy Gate records planned allow, deny, or review decisions.
5. Future executor records bounded tool-call evidence.
6. Evidence writer emits JSONL, JSON, and Markdown files.
7. Guard Adapter prepares a validation-ready bundle.
8. MindForge Guard validates evidence without executing tools.

## 11. Evidence Pack Structure

Planned structure:

```text
evidence-packs/
  <run-id>/
    manifest.json
    run.jsonl
    tool-calls.jsonl
    policy-decisions.jsonl
    artifacts/
    summary.md
```

Planned contents:

- `manifest.json`: run identity, schema version, timestamps, tool registry snapshot, and hashes
- `run.jsonl`: ordered lifecycle events
- `tool-calls.jsonl`: planned and completed tool-call records
- `policy-decisions.jsonl`: policy gate inputs, decisions, and reasons
- `artifacts/`: bounded files generated as evidence
- `summary.md`: human-readable run summary

## 12. Policy Gate Rules

Policy Gate rules should start lightweight:

- Require declared workflow intent
- Require declared tool allowlist
- Deny undeclared tools
- Deny network, filesystem mutation, or shell commands unless explicitly allowed
- Record every decision with reason codes
- Prefer dry-run and review modes before enforcement

PR 1 does not implement these rules.

## 13. Guard Adapter Design

The Guard Adapter should translate harness evidence into a Guard-validation-ready shape. It must not:

- execute commands
- call tools
- mutate Guard state
- bypass policy decisions
- grant authority to the harness

Its role is evidence preparation only.

## 14. CLI Usage

Planned commands may include:

```bash
guard-harness init
guard-harness plan <workflow>
guard-harness run <workflow>
guard-harness evidence inspect <run-id>
guard-harness guard preview <run-id>
```

No CLI behavior is implemented in PR 1.

## 15. Safety Boundary

The project must preserve a strict distinction between:

- harness-local execution experiments
- evidence capture
- policy decisions
- Guard validation

Guard must remain non-executing. The harness must never become a path for production control-plane drift.

## 16. Acceptance Criteria

PR 1 acceptance criteria:

- `npm install` succeeds
- `npm run build` succeeds
- `npm test` succeeds
- README explains positioning, boundaries, workflow direction, Evidence Pack direction, PR sequence, and non-goals
- PRD, architecture, and governance boundary docs exist
- Source and tests remain scaffold-only

## 17. PR Phasing Plan

1. Project scaffold and docs
2. Workflow and evidence schema definitions
3. Tool registry interfaces without execution
4. Policy Gate model and dry-run evaluation
5. Evidence Pack writer
6. Guard Adapter preview
7. Explicitly allowlisted local execution pilot
8. Demo workflows and validation fixtures

## 18. v0.1 / v0.2 / v0.3 Roadmap

v0.1:

- Local CLI skeleton
- Workflow schema
- Evidence Pack writer
- Dry-run policy gate
- Guard Adapter preview

v0.2:

- Bounded local tool execution behind explicit allowlists
- Stronger evidence hashing
- Replay and inspection commands
- More validation fixtures

v0.3:

- External agent runtime experiments behind strict adapters
- Richer policy packs
- Multi-step workflow demos
- Guard compatibility hardening

## 19. Future Relationship To MindForge Guard Main Project

The harness may become a companion repository that produces evidence MindForge Guard can validate. MindForge Guard should not absorb execution behavior from this harness.

Any integration must preserve Guard's deterministic, additive, non-executing role.

## 20. Risks And Mitigations

- Risk: Harness behavior is mistaken for Guard behavior.
  Mitigation: Keep separate repositories, docs, package names, and boundary language.
- Risk: Execution expands too quickly.
  Mitigation: Require phased PRs, explicit allowlists, and dry-run modes.
- Risk: Evidence becomes incomplete or unverifiable.
  Mitigation: Define schemas, hashes, timestamps, and ordered JSONL logs.
- Risk: Guard integration becomes a hidden execution path.
  Mitigation: Keep Guard Adapter evidence-only and prohibit child process execution in early PRs.
- Risk: Commercial or production control-plane code drifts into scope.
  Mitigation: Explicitly exclude SaaS, pricing, license, checkout, and entitlement paths.
