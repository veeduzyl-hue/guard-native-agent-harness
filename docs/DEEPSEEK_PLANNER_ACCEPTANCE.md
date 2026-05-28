# DeepSeek Planner Acceptance

## Purpose

This guide documents an optional local acceptance check for the DeepSeek planner provider added in PR 10D. DeepSeek proposes a JSON plan only; the harness remains responsible for normalization, validation, registered tool execution, policy checks, evidence capture, and report generation.

The default planner remains `mock`. A real DeepSeek run is never required by the standard v0.1 validation path.

## Preconditions

- Run from this repository root.
- Build the CLI with `npm run build`.
- Supply an explicit DeepSeek model name.
- Set `DEEPSEEK_API_KEY` in the process environment.
- Allow network access to the DeepSeek Chat Completions API for a real acceptance run.

## API Key Boundary

Set the API key in the current shell process only:

```powershell
# PowerShell
$env:DEEPSEEK_API_KEY="..."
```

```bash
# Git Bash
export DEEPSEEK_API_KEY="..."
```

The harness does not read `.env` files or load a dotenv dependency. The API key must not appear in task evidence, plan evidence, tool-call evidence, blocked-action evidence, command results, Guard results, or the final report.

## Recommended Command

After building the CLI, run the optional verifier:

```bash
npm run build
npm run verify:deepseek:planner -- --model <model-name>
```

This invokes the bounded planner path with a 120000 ms timeout:

```bash
node dist/cli.js run "Create a safe README update proposal" --planner deepseek --model <model-name> --planner-timeout-ms 120000
```

The verifier is optional and is not run by `npm run verify:v0.1` or `npm run verify:v0.1:release`.

## Evidence Pack Checks

A successful run prints:

```text
Evidence Pack: .evidence/<task-id>
```

Verify these files exist:

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `final-report.md`

Generated `.evidence/` directories are local artifacts and must not be committed.

## Expected Provider Metadata

`task.json` should include:

```json
{
  "planner_provider": "deepseek",
  "planner_model": "<model-name>"
}
```

`plan.json` should include:

```json
{
  "provider": "deepseek",
  "model": "<model-name>"
}
```

Provider diagnostics must remain bounded. They do not include raw API output or reasoning content.

## Final Report Checks

`final-report.md` should include:

- Tool Calls
- Guard Results
- Runtime Boundary

Guard output remains evidence only. It does not grant execution authority.

## API Key Non-leakage Checks

The optional verifier checks that the process API key does not appear in:

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `final-report.md`

The verifier also checks that evidence does not persist a `reasoning_content` field. Do not paste real API keys into issue text, documentation, snapshots, or committed test data.

## Failure Modes

The acceptance helper fails clearly when:

- `DEEPSEEK_API_KEY` is missing from the process environment.
- `--model <model-name>` is missing.
- `dist/cli.js` has not been built.
- The DeepSeek request fails because of authentication, permission, rate limiting, model selection, network availability, or timeout.
- DeepSeek returns empty, malformed, markdown-wrapped, refused, or structurally invalid plan output.
- The resulting Evidence Pack is missing required bounded artifacts or expected metadata.
- The API key or a reasoning-output field appears in evidence.

Provider failures do not silently fall back to `mock`.

## Boundary

- DeepSeek is optional and explicitly selected.
- `mock` remains the default planner.
- DeepSeek only proposes a plan.
- Plan Normalizer remains mandatory.
- Plan Validator remains mandatory.
- Tool Registry remains mandatory.
- Policy Gate remains mandatory.
- Evidence Writer remains mandatory.
- Guard output remains evidence only.
- No DeepSeek tool execution is added.
- No DeepSeek SDK is used.
- No `.env` loading, API key file loading, SaaS, dashboard, or OAuth behavior is added.
- Reasoning or chain-of-thought content is not stored in evidence.

## What This Does Not Prove

- It does not prove that every model response produces a valid plan.
- It does not prove compliance or production readiness.
- It does not replace human review.
- It does not test another optional provider or change the default planner.
- It does not grant DeepSeek, Guard, or model output execution authority.

## Next Phase

Future provider and acceptance work must preserve the same Plan Normalizer, Plan Validator, Tool Registry, Policy Gate, evidence, and Guard evidence-only boundaries. DeepSeek remains optional, and v0.1 verification remains mock-based.
