# v0.2 Planner Provider Boundary

## Purpose

PR 10A introduced the planner provider interface so providers can propose plans without changing the v0.1 execution boundary. PR 10B added the first optional model-backed provider for local Ollama. PR 10C adds an optional OpenAI Responses API planner provider.

Ollama and OpenAI are explicitly selected and still produce only proposed plans. They do not change tool execution, Policy Gate, evidence capture, or Guard Adapter semantics.

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
- `openai`: implemented as an optional remote-model provider in PR 10C.
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

## OpenAI Planner Provider

Example:

```bash
npx guard-agent run "Create a safe README update proposal" --planner openai --model <model-name> --planner-timeout-ms 120000
```

Notes:

- OpenAI is optional and must be selected with `--planner openai`.
- PR 10C requires an explicit `--model <model-name>`.
- The provider reads `OPENAI_API_KEY` only from the process environment.
- The harness does not load `.env` files or store API keys in evidence or reports.
- The provider sends a structured JSON plan request to `https://api.openai.com/v1/responses` with Node built-in `fetch`.
- The request exposes no tools and gives OpenAI no execution authority.
- The same Plan Normalizer, Plan Validator, Tool Registry, Policy Gate, Evidence Writer, and Guard evidence-only boundary remain mandatory.
- HTTP failures, malformed output, refusals, validation failures, and timeouts stop before plan execution.

See [OpenAI Planner Provider](OPENAI_PLANNER_PROVIDER.md) for the full boundary and failure behavior.

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

Task and plan evidence record the selected provider and model metadata. `mock` records `null` as the model. `ollama` records the explicitly requested local model name. `openai` records the explicitly requested remote model name and bounded provider diagnostics after successful validation.

Model providers do not store full raw model responses or full prompts. Provider output is parsed into a bounded plan shape before validation and evidence writing.

## API Key Boundary

The OpenAI provider may read only `process.env.OPENAI_API_KEY`. It does not load `.env`, add `dotenv`, read API keys through tools, log an API key, or record one in evidence, errors, final reports, or provider metadata.

Mock and Ollama workflows do not require an OpenAI API key. OpenAI fails cleanly if it is explicitly selected without the required environment variable.

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

- PR 10B added an optional Ollama local planner provider.
- PR 10C adds an optional OpenAI planner provider.
- PR 10D may add an optional DeepSeek planner provider.

All provider-backed planning must remain optional. The default remains `mock` until explicitly changed in a future release.
