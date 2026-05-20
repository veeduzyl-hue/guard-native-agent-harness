# Guard-native Agent Harness

Guard-native Agent Harness is a bounded local AI agent harness for simple AI-assisted workflows through registered tools, tool-call evidence capture, lightweight policy gates, and governance-ready evidence packs that MindForge Guard can validate.

The current CLI initializes local task evidence and optional Guard Adapter evidence. The project includes an internal Tool Registry, bounded safe tools, a local Policy Gate, and a strictly allowlisted command sandbox, but it still does not implement an autonomous agent runtime, OpenAI integration, general shell execution, dashboards, SaaS behavior, OAuth connectors, or background daemon behavior.

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

This command only initializes task evidence and optional Guard Adapter evidence. It does not execute tools, run allowlisted workflow commands, call OpenAI, call external APIs, or perform real agent planning.

## PR 3: Tool Registry + Safe Tools

PR 3 introduces an internal Tool Registry and low-risk safe tools for local evidence-aware workflows:

- `list_files`
- `read_file`
- `write_file`
- `git_status`
- `git_diff`
- `create_report`

Successful tool calls append structured JSONL evidence to `.evidence/<task-id>/tool-calls.jsonl`. Tool evidence records use `policy_decision: "not_evaluated_in_pr3"` because the full Policy Gate is not implemented yet.

PR 3 did not add `run_command`; PR 5 below describes the later allowlisted command sandbox. General shell execution, Guard execution authority, OpenAI or external model APIs, autonomous planning, SaaS, dashboards, OAuth, and background agent behavior remain out of scope.

## PR 4: Policy Gate + Blocked Actions

PR 4 introduces a hardcoded v0.1 Policy Gate for tool requests. Unsafe requests are denied before tool execution and recorded in `.evidence/<task-id>/blocked-actions.jsonl`.

The current policy blocks `.env` reads, credential-like file reads, workspace escape attempts, protected commercial or production writes, destructive command requests, and `git push` command requests. Successful registry tool calls now record `policy_decision: "allow"` in `tool-calls.jsonl`.

PR 4 did not add command execution; PR 5 below describes the later allowlisted `run_command` sandbox. General shell execution, actual destructive command execution, actual git push execution, Guard execution authority, OpenAI or external LLM integration, autonomous planning, SaaS, dashboards, OAuth, and background agent behavior remain out of scope.

## PR 5: Run Command + Sandbox Rules

PR 5 introduces a `run_command` tool for explicitly allowlisted local validation and inspection commands. Allowed commands run inside the workspace sandbox with `shell: false`, bounded output capture, timeouts, and command-result evidence.

Allowed command results are written to `.evidence/<task-id>/command-results.jsonl`, and the corresponding tool events are written to `tool-calls.jsonl` with `policy_decision: "allow"`. Denied commands are not executed and are written to `blocked-actions.jsonl`.

The command allowlist is limited to `git status --short`, `git diff`, `npm test`, `npm run build`, `node --version`, and `node -v`. Destructive commands, `git push`, deployment commands, network commands, package publishing, package installation, and arbitrary shell execution remain blocked. Guard execution authority, OpenAI or external LLM integration, autonomous planning, SaaS, dashboards, OAuth, and background agent behavior remain out of scope.

## PR 6: Guard Adapter

PR 6 introduces an optional Guard Adapter. When a local `guard` CLI is available, the harness attempts `guard status --json`, `guard audit --json`, and `guard drift status --json`, then writes bounded command summaries and parsed JSON, when valid, to `.evidence/<task-id>/guard-results.json`.

The Guard CLI is optional. If it is missing, the run still succeeds and `guard-results.json` records `guard_available: false` with reason `Guard CLI not found`.

Guard output is evidence only. It does not grant execution authority, bypass the Policy Gate, install or configure Guard, modify Guard policy or source, or change MindForge Guard runtime semantics. OpenAI or external LLM integration is still not implemented, and final report rendering will be improved in a later PR.

## PR 7: Final Report Renderer

PR 7 upgrades `final-report.md` into a deterministic governance report generated from local evidence files. The report summarizes task metadata, plan details, Evidence Pack contents, tool calls, blocked actions, command results, Guard results, file changes, governance notes, runtime boundaries, and limitations.

The report is generated from local JSON, JSONL, and diff evidence. It does not use an LLM, does not invent evidence, does not grant execution authority, and treats Guard output as evidence only. OpenAI or external LLM integration is still not implemented.

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
