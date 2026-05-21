# Ollama Local Planner Acceptance

## Purpose

This guide explains how to manually verify the optional Ollama local planner provider added after the v0.1 mock-planner baseline.

The Ollama provider proposes a plan only. The harness validates that plan before orchestration, and all execution still flows through the Tool Registry, Policy Gate, Evidence Writer, Guard Adapter, and final report renderer.

## Preconditions

- Ollama is already installed outside this harness.
- Ollama is already running at `http://localhost:11434`.
- The model you want to use has already been pulled locally.
- The project has been built with `npm run build`.

The harness does not install Ollama, pull models, manage Ollama processes, or run shell commands to configure Ollama.

## Check Local Ollama

Build the CLI:

```bash
npm run build
```

Check local Ollama status:

```bash
npm run check:ollama
```

Check a specific local model name:

```bash
npm run check:ollama -- --model <local-model-name>
```

The check is informational. If Ollama is unavailable, it prints guidance and exits without making CI-style validation fail.

## Run Safe README Demo

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name>
```

If the selected local model is large or still loading, use a longer planner timeout:

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name> --planner-timeout-ms 120000
```

Expected behavior:

- Ollama receives a conservative JSON-only planning prompt.
- Ollama proposes a plan.
- The harness may normalize safe structural fields, such as missing step IDs or missing provider metadata.
- The harness does not rewrite unknown tools, unsafe paths, or unsafe commands.
- Plan Validator validates the plan before orchestration.
- Registered tools execute only after validation and Policy Gate checks.
- Evidence is written under `.evidence/<task-id>/`.

## Run Unsafe Blocked-action Demo

```bash
npx guard-agent run "Show a policy demo with blocked action" --planner ollama --model <local-model-name>
```

If the model proposes unsafe actions, the Policy Gate should still block them before execution. Blocked requests are recorded in `blocked-actions.jsonl`.

## Inspect Evidence Pack

The CLI prints an Evidence Pack path:

```text
Evidence Pack: .evidence/<task-id>
```

Inspect:

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `final-report.md`

Confirm `task.json` includes:

```json
{
  "planner_provider": "ollama",
  "planner_model": "<local-model-name>"
}
```

Confirm `plan.json` includes:

```json
{
  "planner": "ollama",
  "provider": "ollama",
  "model": "<local-model-name>"
}
```

## Expected Evidence Files

Each successful run should create:

```text
task.json
plan.json
tool-calls.jsonl
blocked-actions.jsonl
command-results.jsonl
guard-results.json
final-report.md
```

Generated `.evidence/` directories are local artifacts and should not be committed.

## Expected Final Report Sections

`final-report.md` should include:

- Task Summary
- Plan Summary
- Evidence Pack Contents
- Tool Calls
- Blocked Actions
- Command Results
- Guard Results
- Governance Notes
- Runtime Boundary
- Limitations

## Boundary

- Ollama is optional and explicitly selected with `--planner ollama`.
- The default planner remains `mock`.
- Ollama only proposes plans.
- Tool input schema hints are provided to model planners.
- Models must produce object-shaped `input` values that match registered tool input shapes.
- Invalid input shapes fail validation and do not execute.
- Plan normalization is limited to deterministic structural fields.
- Unknown tools, unsafe paths, and unsafe commands are preserved for validation and policy evaluation.
- Plan Validator must pass before orchestration.
- Tool Registry and Policy Gate remain mandatory.
- Blocked actions remain blocked.
- Failed plan validation means no plan steps are executed.
- Normalization does not grant authority.
- Guard output remains evidence only.
- No API key is required.
- No `.env` loading is introduced.

## Troubleshooting

If `npm run check:ollama` reports unavailable:

- Start Ollama outside this harness.
- Confirm it is listening at `http://localhost:11434`.
- Confirm your model has already been pulled locally.

If the run fails with a model-not-found error, use a model name returned by:

```bash
npm run check:ollama
```

If the run times out, the error includes the provider, model, endpoint, and timeout value. Try a smaller already-loaded local model, or increase the planner timeout:

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name> --planner-timeout-ms 120000
```

If the run fails with a plan validation error, inspect the error message. The model may have proposed an unknown tool, malformed input, unsupported input field, missing required input field, or an unsafe direct command shape.

The validation error should identify the provider and model, note whether normalization was attempted, and confirm that no plan steps were executed.

## What This Does Not Do

- Does not install Ollama.
- Does not pull models.
- Does not run shell commands to manage Ollama.
- Does not call OpenAI or DeepSeek.
- Does not add API key handling.
- Does not load `.env`.
- Does not add new tools.
- Does not change Policy Gate semantics.
- Does not change Guard Adapter semantics.
- Does not grant execution authority based on model output.
