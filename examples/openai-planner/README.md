# OpenAI Planner Evidence Inspection

This optional example exercises the OpenAI planner provider while preserving the existing local execution boundary. The default planner remains `mock`.

## Set The API Key

Supply the key in the current process environment only:

```powershell
# PowerShell
$env:OPENAI_API_KEY="..."
```

```bash
# Git Bash
export OPENAI_API_KEY="..."
```

The harness does not read `.env` files, and a real API key must never be committed.

## Run The Planner

```bash
npm run build
npx guard-agent run "Create a safe README update proposal" --planner openai --model <model-name> --planner-timeout-ms 120000
```

Optional acceptance helper:

```bash
npm run verify:openai:planner -- --model <model-name>
```

OpenAI proposes a plan only. The Plan Normalizer, Plan Validator, Tool Registry, and Policy Gate remain in the execution path.

## Inspect Evidence

The CLI prints the evidence location:

```text
Evidence Pack: .evidence/<task-id>
```

Inspect:

- `task.json` for `planner_provider: "openai"` and `planner_model: "<model-name>"`.
- `plan.json` for `provider: "openai"`, `model: "<model-name>"`, and bounded diagnostics.
- `tool-calls.jsonl` and `blocked-actions.jsonl` for policy-routed execution evidence.
- `guard-results.json` and `final-report.md` for the evidence-only Guard and runtime-boundary statements.

Generated `.evidence/` directories must not be committed.

## Confirm API Key Non-leakage

Search the Evidence Pack for the actual key value locally; it must not occur in any evidence file. The optional verifier performs this check for all expected evidence artifacts after a successful run.

Do not paste the key into commands that record it as task content, documentation, tests, or screenshots.

## Understand Failures

- Missing key means `OPENAI_API_KEY` was not supplied in the process environment.
- Missing model means PR 10C requires explicit model selection.
- HTTP authentication, permission, rate-limit, or model errors are controlled provider failures.
- Timeout or malformed/invalid plan output means no unvalidated plan steps execute.
- Policy-blocked actions show that a validated proposal still does not bypass the Policy Gate.
