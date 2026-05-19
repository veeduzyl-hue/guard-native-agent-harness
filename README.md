# Guard-native Agent Harness

Guard-native Agent Harness is a bounded local AI agent harness for simple AI-assisted workflows through registered tools, tool-call evidence capture, lightweight policy gates, and governance-ready evidence packs that MindForge Guard can validate.

The current CLI initializes local task evidence only. PR 3 adds an internal Tool Registry with bounded safe tools, but the project still does not implement an autonomous agent runtime, OpenAI integration, general command execution, Guard CLI integration, policy enforcement, dashboards, SaaS behavior, OAuth connectors, or background daemon behavior.

## Relationship To MindForge Guard

This repository is separate from MindForge Guard.

MindForge Guard remains recommendation-only, additive-only, non-executing, deterministic, evidence-first, machine-verifiable, local-first, and constrained against authority expansion or production control-plane drift.

The harness may eventually execute bounded local workflow tools, but it must not alter MindForge Guard semantics. Guard should validate evidence produced by this harness; it should not become the executor.

## Current Status

This repository currently contains:

- TypeScript project metadata
- Build, test, lint, and format scripts
- README, PRD, architecture, and governance boundary documentation
- A minimal `guard-agent run` command that creates local placeholder evidence
- Tests for scaffold and evidence initialization

No actual agent execution exists yet.

## Current Runnable Command

Build the CLI and initialize a placeholder Evidence Pack:

```bash
npm run build
npx guard-agent run "Create a safe README update proposal"
```

Fallback command:

```bash
node dist/cli.js run "Create a safe README update proposal"
```

The command creates:

```text
.evidence/<task-id>/
  task.json
  plan.json
  final-report.md
```

This command only initializes task evidence. It does not execute tools, execute commands, run Guard CLI, call OpenAI, call external APIs, or perform real agent planning.

## PR 3: Tool Registry + Safe Tools

PR 3 introduces an internal Tool Registry and low-risk safe tools for local evidence-aware workflows:

- `list_files`
- `read_file`
- `write_file`
- `git_status`
- `git_diff`
- `create_report`

Successful tool calls append structured JSONL evidence to `.evidence/<task-id>/tool-calls.jsonl`. Tool evidence records use `policy_decision: "not_evaluated_in_pr3"` because the full Policy Gate is not implemented yet.

The `run_command` tool is not implemented. General shell execution, Guard CLI integration, OpenAI or external model APIs, autonomous planning, SaaS, dashboards, OAuth, and background agent behavior remain out of scope.

## PR 4: Policy Gate + Blocked Actions

PR 4 introduces a hardcoded v0.1 Policy Gate for tool requests. Unsafe requests are denied before tool execution and recorded in `.evidence/<task-id>/blocked-actions.jsonl`.

The current policy blocks `.env` reads, credential-like file reads, workspace escape attempts, protected commercial or production writes, destructive command requests, and `git push` command requests. Successful registry tool calls now record `policy_decision: "allow"` in `tool-calls.jsonl`.

`run_command` execution is still not implemented. General shell execution, actual destructive command execution, actual git push execution, Guard CLI integration, OpenAI or external LLM integration, autonomous planning, SaaS, dashboards, OAuth, and background agent behavior remain out of scope.

## v0.1 Intended Workflow

The intended v0.1 workflow is:

1. A user starts a local harness run from a CLI.
2. The harness loads a bounded workflow definition and declared tool allowlist.
3. The harness records planned steps, policy gate decisions, and tool-call evidence.
4. The harness writes an Evidence Pack to the local filesystem.
5. A Guard Adapter prepares the Evidence Pack for MindForge Guard validation.
6. MindForge Guard validates evidence without executing tools or expanding authority.

This workflow is directional. PR 2 implements only the initial evidence creation step with a placeholder plan.

## Boundary Statement

The harness is allowed to become a bounded local executor in later PRs, but MindForge Guard remains non-executing and recommendation-only. PR 2 creates no real execution path, no command runner, no tool runtime, no policy engine, and no Guard CLI child process integration.

## Planned Evidence Pack Structure

Evidence output is planned to be filesystem-first, using JSONL, JSON, and Markdown:

```text
.evidence/
  <task-id>/
    task.json
    plan.json
    final-report.md
```

Future PRs may extend this structure with JSONL event streams, artifacts, hashes, and Guard Adapter output.

## Planned PR Sequence

1. Project scaffold and docs
2. Evidence writer and task runner scaffold
3. Workflow and evidence schema definitions
4. Tool registry interfaces without execution
5. Policy Gate model and dry-run evaluation
6. Guard Adapter preview output
7. Bounded command execution pilot behind explicit allowlists
8. End-to-end local workflow demo

## Non-goals

- Real agent execution
- OpenAI API calls
- Tool execution or command execution
- Guard CLI invocation
- Policy enforcement implementation
- SaaS, dashboard, API server, OAuth, or background daemon behavior
- Pricing, checkout, license, entitlement, or License Hub changes
- MindForge Guard runtime semantic changes
