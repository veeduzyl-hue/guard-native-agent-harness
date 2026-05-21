# v0.2 Planner Provider Boundary

## Purpose

PR 10A introduced the planner provider interface so future providers can propose plans without changing the v0.1 execution boundary. PR 10B adds the first optional model-backed provider for local Ollama.

Ollama support is local-only, explicitly selected, and still produces only a proposed plan. It does not change tool execution, Policy Gate, evidence capture, or Guard Adapter semantics.

## Provider Interface

A planner provider receives task context and returns a proposed plan. The provider does not execute the plan.

The harness remains responsible for:

- validating the proposed plan
- writing evidence
- orchestrating registered tools
- applying the Policy Gate before tool execution
- collecting Guard Adapter evidence
- rendering the final report

## Supported Provider Names

The known provider names are:

- `mock`
- `ollama`
- `openai`
- `deepseek`

## Current Implementation Status

- `mock`: implemented and available.
- `ollama`: implemented as an optional local-model provider in PR 10B.
- `openai`: recognized but not implemented.
- `deepseek`: recognized but not implemented.

The default provider remains `mock`.

## Ollama Planner Provider

Example:

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name>
```

Longer local model runs can use an explicit timeout:

```bash
npx guard-agent run "Create a safe README update proposal" --planner ollama --model <local-model-name> --planner-timeout-ms 120000
```

Notes:

- Ollama must already be running locally.
- The model must already be available locally.
- The harness calls only `http://localhost:11434/api/generate`.
- Timeout diagnostics include the provider, model, timeout value, and endpoint.
- The harness does not install Ollama.
- The harness does not pull models.
- The harness does not run shell commands to manage Ollama.
- Ollama proposes a plan only.
- Tool input schema hints are included in the planner prompt.
- Model plans must use object-shaped `input` values matching registered tool input shapes.
- Invalid input shapes fail validation and do not execute.
- Ollama plans may be normalized only for safe structural fields, such as missing step IDs, planner metadata, or default expected outputs.
- Unknown tools, unsafe paths, unsafe file reads, `git push`, and destructive commands are not rewritten or removed.
- All plan steps are validated before execution.
- Tool Registry and Policy Gate remain mandatory.
- If validation fails after normalization, no plan steps execute.
- Normalization does not grant execution authority.
- Evidence capture remains unchanged.

## Execution Boundary

Provider output is only a proposed plan. A provider cannot execute tools, read files, run commands, bypass the Tool Registry, bypass the Policy Gate, grant authority, or modify Guard semantics.

Only registered tools can execute, and they must still pass through the existing Policy Gate and Evidence Writer path.

## Plan Validation

Plans are validated before orchestration. The validator checks that:

- planner metadata exists
- steps are an array
- each step has an id
- each step uses a registered tool
- each step input is an object
- tool inputs match registered tool input shape hints
- required input fields are present
- tools expecting empty input receive an empty object
- unknown tools are rejected
- direct command-shaped input is only allowed through `run_command`

If validation fails, the plan is not executed.

For model-backed plans, the harness may apply bounded structural normalization before validation. This normalization is deterministic and does not change semantic intent. It does not make unsafe plans safe; it only makes structurally incomplete plans easier for the validator to evaluate.

## Evidence Boundary

Task and plan evidence record the selected provider and model metadata. `mock` records `null` as the model. `ollama` records the explicitly requested local model name.

PR 10B does not store full raw model responses. Provider output is parsed into a bounded plan shape before validation and evidence writing.

## API Key Boundary

PR 10A and PR 10B introduce no API key handling, no `.env` loading, and no external model credentials.

Future provider work must handle API keys explicitly and avoid leaking keys into evidence, logs, final reports, or provider metadata.

## What Providers May Do

- Produce a proposed plan.
- Include provider metadata that is safe to record.
- Select registered tool names only.
- Provide structured inputs for registered tools.

## What Providers Must Not Do

- Execute tools.
- Read files directly.
- Run commands directly.
- Generate arbitrary shell execution.
- Bypass plan validation.
- Bypass the Tool Registry.
- Bypass the Policy Gate.
- Grant execution authority.
- Modify Guard policy, config, source, or semantics.
- Require `.env` loading.

## Future Provider Roadmap

- PR 10B adds an optional Ollama local planner provider.
- PR 10C may add an optional OpenAI planner provider.
- PR 10D may add an optional DeepSeek planner provider.

All provider-backed planning must remain optional. The default remains `mock` until explicitly changed in a future release.
