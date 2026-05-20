# v0.2 Planner Provider Boundary

## Purpose

PR 10A introduces the planner provider interface so future providers can propose plans without changing the v0.1 execution boundary.

This PR only adds the interface, registry, mock provider implementation, provider selection plumbing, and plan validation. It does not add any model API integration.

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
- `ollama`: recognized but not implemented in PR 10A.
- `openai`: recognized but not implemented in PR 10A.
- `deepseek`: recognized but not implemented in PR 10A.

The default provider remains `mock`.

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
- unknown tools are rejected
- direct command-shaped input is only allowed through `run_command`

If validation fails, the plan is not executed.

## Evidence Boundary

Task and plan evidence record the selected provider and model metadata. PR 10A records `mock` as the provider and `null` as the model.

No external prompt or model response evidence is produced in PR 10A because no external provider is implemented.

## API Key Boundary

PR 10A introduces no API key handling, no `.env` loading, and no external model credentials.

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

- PR 10B may add an optional Ollama local planner provider.
- PR 10C may add an optional OpenAI planner provider.
- PR 10D may add an optional DeepSeek planner provider.

All provider-backed planning must remain optional. The default remains `mock` until explicitly changed in a future release.
