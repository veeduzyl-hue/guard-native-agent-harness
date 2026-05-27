# Ollama Local Planner E2E Acceptance

## Purpose

This guide documents the optional end-to-end local Ollama planner path. It verifies that a local Ollama model can propose a plan, the harness can validate it, registered tools can execute through the Tool Registry and Policy Gate, and the Evidence Pack can be inspected afterward.

This guide does not change the default planner. The default remains `mock`.

## Preconditions

- Run from this repository root.
- Build the CLI with `npm run build`.
- Ollama is already installed outside this harness.
- Ollama is already running at `http://localhost:11434`.
- The model has already been pulled locally.

The harness does not install Ollama, pull models, or run shell commands to manage Ollama.

## Recommended Model

The tested local model for this acceptance path is:

```text
qwen2.5-coder:7b
```

Other local models may work, but this guide records the known successful path.

## Recommended Timeout

Use:

```text
120000
```

Large local models may need more time for first-run loading or generation.

## Safe README Demo

```bash
npm run build
npm run check:ollama
npx guard-agent run "Create a safe README update proposal" --planner ollama --model qwen2.5-coder:7b --planner-timeout-ms 120000
```

Optional local verifier:

```bash
npm run verify:ollama:e2e -- --model qwen2.5-coder:7b
```

The verifier is local-only and is not part of `npm run verify:v0.1` or `npm run verify:v0.1:release`.

## Evidence Pack Checks

The CLI prints:

```text
Evidence Pack: .evidence/<task-id>
```

Expected files:

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `final-report.md`

Generated `.evidence/` directories are local artifacts and should not be committed.

## Expected Provider Metadata

`task.json` should include:

```json
{
  "planner_provider": "ollama",
  "planner_model": "qwen2.5-coder:7b"
}
```

`plan.json` should include:

```json
{
  "provider": "ollama",
  "model": "qwen2.5-coder:7b"
}
```

## Final Report Checks

`final-report.md` should include:

- Tool Calls
- Guard Results
- Runtime Boundary

Guard results are evidence only. They do not grant execution authority.

## Failure Modes

The Ollama E2E path can fail clearly when:

- Ollama is not running locally.
- The requested model is not available locally.
- `dist/cli.js` has not been built.
- The model returns malformed JSON.
- The model returns a plan that fails validation.
- The model proposes invalid input shapes for registered tools.

These failures do not silently fall back to `mock`.

## Boundary

- Ollama only proposes a plan.
- Plan Validator remains mandatory.
- Tool Registry remains mandatory.
- Policy Gate remains mandatory.
- Evidence Writer remains mandatory.
- Guard Adapter output remains evidence-only.
- Tool input schema hints guide the model but do not grant authority.
- Unsafe paths and commands are not rewritten.
- Invalid inputs do not execute.
- The default planner remains `mock`.

## What This Does Not Prove

- It does not prove model output is always valid.
- It does not prove compliance certification.
- It does not replace human review.
- It does not test OpenAI, DeepSeek, or any cloud model provider.
- It does not prove production readiness for SaaS, dashboard, OAuth, or background agents.

## Next Phase

Future provider work can use this guide as a local reference point while keeping model-backed planning optional and policy-gated. PR 10C adds optional OpenAI planning; DeepSeek remains a future optional provider.
