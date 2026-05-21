# Ollama Local Planner Example

Use this example when Ollama is already installed, running locally, and has a model available.

## Recommended Command

```bash
npm run build
npm run check:ollama
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name>
```

For larger local models, check the exact model name and use a longer planner timeout:

```bash
npm run check:ollama -- --model <local-model-name>
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name> --planner-timeout-ms 120000
```

## Evidence Directory

The CLI prints:

```text
Evidence Pack: .evidence/<task-id>
```

Generated `.evidence/` directories are local artifacts and should not be committed.

## Files To Inspect

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `blocked-actions.jsonl`
- `command-results.jsonl`
- `guard-results.json`
- `final-report.md`

## Confirm Planner Metadata

In `task.json`, confirm:

```json
{
  "planner_provider": "ollama"
}
```

In `plan.json`, confirm:

```json
{
  "provider": "ollama"
}
```

Both files should record the selected local model name.

## Confirm Normalization Boundary

Ollama plans may be normalized only for safe structural fields, such as missing step IDs or provider metadata. Unknown tools, unsafe paths, and unsafe commands are not rewritten or removed.

Tool input schema hints are provided to the planner, but they are not authority. The model must still produce object-shaped `input` values that match registered tool input shapes. Invalid input shapes fail validation and do not execute.

Plan Validator still runs after normalization. Policy Gate still evaluates tool execution. If validation fails, no plan steps are executed.

## Confirm Final Report

Open `final-report.md` and confirm it includes:

- Tool Calls
- Blocked Actions
- Guard Results
- Runtime Boundary
- Limitations

The report is generated from local evidence. It does not grant execution authority.
