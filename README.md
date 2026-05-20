# Guard-native Agent Harness

Guard-native Agent Harness is a bounded local AI agent harness for simple AI-assisted workflows through registered tools, tool-call evidence capture, lightweight policy gates, and governance-ready evidence packs that MindForge Guard can validate.

The current CLI runs a deterministic mock workflow through the local Tool Registry, Policy Gate, evidence writer, optional Guard Adapter, and final report renderer. It still does not implement autonomous planning, OpenAI integration, general shell execution, dashboards, SaaS behavior, OAuth connectors, or background daemon behavior.

## Relationship To MindForge Guard

This repository is separate from MindForge Guard.

MindForge Guard remains recommendation-only, additive-only, non-executing, deterministic, evidence-first, machine-verifiable, local-first, and constrained against authority expansion or production control-plane drift.

The harness may eventually execute bounded local workflow tools, but it must not alter MindForge Guard semantics. Guard should validate evidence produced by this harness; it should not become the executor.

## Current Status

This repository currently contains:

- TypeScript project metadata
- Build, test, lint, and format scripts
- README, PRD, architecture, and governance boundary documentation
- A `guard-agent run` command that executes deterministic mock workflow templates
- Tests for scaffold and evidence initialization

No autonomous or model-backed agent execution exists yet.

## Current Runnable Command

Build the CLI and run the bounded README proposal demo:

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
  tool-calls.jsonl
  blocked-actions.jsonl
  command-results.jsonl
  guard-results.json
  final-report.md
```

This command uses a deterministic mock planner and registered tools. It does not call OpenAI, call external APIs, perform autonomous planning, bypass the Policy Gate, or grant execution authority from Guard output.

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

## PR 8: Mock Agent Planner + End-to-End Demo

PR 8 introduces a deterministic mock planner and a small orchestrator for bounded demo workflows. The CLI now selects fixed templates for README update proposals, repository review, unsafe policy demonstrations, and a safe default workflow.

All plan steps go through the Tool Registry and Policy Gate. Allowed tool calls are written to `tool-calls.jsonl`, denied requests are written to `blocked-actions.jsonl`, allowlisted command results are written to `command-results.jsonl`, Guard results are written to `guard-results.json`, and `final-report.md` summarizes the Evidence Pack.

The mock planner is not autonomous and does not use an LLM. It does not generate arbitrary tools or commands, does not execute outside the existing allowlist, does not install or mutate Guard, and does not add OpenAI or external LLM integration.

## v0.1 Acceptance

Validate the v0.1 local harness with:

```bash
npm run build
npm test
npm run lint
npm run verify:v0.1
```

`npm run verify:v0.1` runs both the safe README proposal workflow and the unsafe blocked-action workflow, then verifies the generated Evidence Packs and final reports.

v0.1 remains local-first and deterministic. It uses the mock planner, does not require `OPENAI_API_KEY`, does not require a `.env` file, does not call external LLM providers, and treats Guard Adapter output as evidence only.

## v0.1 Release Readiness

Before tagging v0.1, run:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
```

Release readiness docs:

- [v0.1 Acceptance](docs/V0_1_ACCEPTANCE.md)
- [v0.1 Release Notes](docs/RELEASE_NOTES_v0.1.md)
- [v0.1 Baseline](docs/V0_1_BASELINE.md)
- [v0.1 Tag Preparation](docs/V0_1_TAG_PREP.md)
- [Roadmap](docs/ROADMAP.md)

v0.1 is mock-planner based. It does not use OpenAI or external LLMs, is not SaaS, is not a dashboard, and does not change MindForge Guard semantics. Actual `v0.1.0` tag creation happens only after the release preparation PR is reviewed and merged.

## Planner Providers

The default planner provider is `mock`:

```bash
npx guard-agent run "Create a safe README update proposal" --planner mock
```

PR 10A added the planner provider interface and local plan validation. PR 10B adds optional local Ollama planning. OpenAI and DeepSeek remain future optional providers.

No API key is required and no `.env` file is loaded.

## Ollama Planner Provider

Example:

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name>
```

Notes:

- Ollama must already be running locally.
- The model must already be available locally.
- The harness does not install Ollama.
- The harness does not pull models.
- The harness does not run shell commands to manage Ollama.
- Ollama proposes a plan only.
- All plan steps are validated before execution.
- Tool Registry and Policy Gate remain mandatory.
- Evidence capture remains unchanged.

## v0.1 Intended Workflow

The intended v0.1 workflow is:

1. A user starts a local harness run from a CLI.
2. The harness loads a bounded workflow definition and declared tool allowlist.
3. The harness records planned steps, policy gate decisions, and tool-call evidence.
4. The harness writes an Evidence Pack to the local filesystem.
5. A Guard Adapter prepares the Evidence Pack for MindForge Guard validation.
6. MindForge Guard validates evidence without executing tools or expanding authority.

PR 8 implements this workflow with deterministic mock templates only. Model-backed or autonomous planning remains out of scope.

## Boundary Statement

The harness can execute only bounded local workflow steps through registered tools, the local Policy Gate, and the command allowlist. MindForge Guard remains non-executing and recommendation-only, and Guard output is evidence rather than execution authority.

## Planned Evidence Pack Structure

Evidence output is planned to be filesystem-first, using JSONL, JSON, and Markdown:

```text
.evidence/
  <task-id>/
    task.json
    plan.json
    tool-calls.jsonl
    blocked-actions.jsonl
    command-results.jsonl
    guard-results.json
    final-report.md
```

Future PRs may extend this structure with additional artifacts and hashes.

## Planned PR Sequence

1. Project scaffold and docs
2. Evidence writer and task runner scaffold
3. Tool Registry and safe tools
4. Policy Gate and blocked actions
5. Bounded command execution behind explicit allowlists
6. Guard Adapter evidence capture
7. Deterministic final report renderer
8. Mock planner end-to-end local workflow demo

## Non-goals

- Autonomous or model-backed agent execution
- OpenAI API calls
- Arbitrary tool execution or arbitrary command execution
- Required Guard CLI installation
- Policy authority outside the local harness boundary
- SaaS, dashboard, API server, OAuth, or background daemon behavior
- Pricing, checkout, license, entitlement, or License Hub changes
- MindForge Guard runtime semantic changes
