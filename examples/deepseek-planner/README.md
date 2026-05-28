# DeepSeek Planner Evidence Inspection

This optional example exercises the DeepSeek planner provider while preserving the existing local execution boundary. The default planner remains `mock`.

## Set The API Key

Supply the key in the current process environment only:

```powershell
# PowerShell
$env:DEEPSEEK_API_KEY="..."
```

```bash
# Git Bash
export DEEPSEEK_API_KEY="..."
```

The harness does not read `.env` files, and a real API key must never be committed.

## Run The Planner

```bash
npm run build
npx guard-agent run "Create a safe README update proposal" --planner deepseek --model <model-name> --planner-timeout-ms 120000
```

Optional acceptance helper:

```bash
npm run verify:deepseek:planner -- --model <model-name>
```

DeepSeek proposes a plan only. The Plan Normalizer, Plan Validator, Tool Registry, and Policy Gate remain in the execution path.

## Inspect Evidence

The CLI prints the evidence location:

```text
Evidence Pack: .evidence/<task-id>
```

Inspect:

- `task.json` for `planner_provider: "deepseek"` and `planner_model: "<model-name>"`.
- `plan.json` for `provider: "deepseek"`, `model: "<model-name>"`, and bounded diagnostics.
- `tool-calls.jsonl` and `blocked-actions.jsonl` for policy-routed execution evidence.
- `guard-results.json` and `final-report.md` for the evidence-only Guard and runtime-boundary statements.

Generated `.evidence/` directories must not be committed.

## Confirm API Key And Reasoning Non-leakage

Search the Evidence Pack for the actual key value locally; it must not occur in any evidence file. The optional verifier performs this check for all expected evidence artifacts after a successful run and rejects persisted `reasoning_content` output.

Do not paste the key into commands that record it as task content, documentation, tests, or screenshots. Do not treat reasoning output as reportable evidence.

## Understand Failures

- Missing key means `DEEPSEEK_API_KEY` was not supplied in the process environment.
- Missing model means PR 10D requires explicit model selection.
- HTTP authentication, permission, rate-limit, or model errors are controlled provider failures.
- Timeout, empty content, or malformed/invalid plan output means no unvalidated plan steps execute.
- Policy-blocked actions show that a validated proposal still does not bypass the Policy Gate.
