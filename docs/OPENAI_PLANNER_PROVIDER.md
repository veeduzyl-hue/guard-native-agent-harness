# OpenAI Planner Provider

## Purpose

The OpenAI planner provider is an optional PR 10C path for producing a proposed `AgentPlan` through the OpenAI Responses API. It does not execute work and does not change the local harness execution boundary.

## Status

`openai` is implemented as an optional provider. The default planner remains `mock`, and DeepSeek remains recognized but unimplemented.

## Preconditions

- Select the provider explicitly with `--planner openai`.
- Supply an explicit model with `--model <model-name>`.
- Provide `OPENAI_API_KEY` in the process environment.
- Network access to `https://api.openai.com/v1/responses` must be available for a real run.

## API Key Boundary

The provider reads only `process.env.OPENAI_API_KEY`. It does not read `.env`, load `dotenv`, retrieve credentials through tools, log the key, or write it to task evidence, plan evidence, final reports, diagnostics, or errors.

If the environment variable is absent, the selected OpenAI path fails before plan execution:

```text
OpenAI planner requires OPENAI_API_KEY in the process environment.
```

## Model Selection

PR 10C has no default OpenAI model. A selected OpenAI run without `--model` fails before a request is sent:

```text
OpenAI planner requires --model <model-name> in PR 10C.
```

## Example Command

```powershell
$env:OPENAI_API_KEY="..."
npx guard-agent run "Create a safe README update proposal" --planner openai --model <model-name> --planner-timeout-ms 120000
```

## Structured Plan Output

The provider uses Node 20 built-in `fetch` to call the Responses API with a local JSON Schema for a plan containing `planner`, `provider`, `model`, `steps`, `risk_notes`, and `expected_outputs`. Its prompt includes registered tool names, exact input shape hints, and compact examples. It instructs the model to emit JSON only, propose safe local steps only, and avoid `.env`, secrets, `git push`, destructive commands, and non-allowlisted commands.

The request supplies no OpenAI tools and does not use function calling for execution.

## Plan Validation

OpenAI output is a proposal only:

```text
OpenAI proposes plan
  -> Plan Normalizer
  -> Plan Validator
  -> Orchestrator
  -> Tool Registry
  -> Policy Gate
  -> Evidence Writer
  -> Guard Adapter
  -> Final Report
```

Normalization is limited to structural fields already supported by the harness, such as missing step IDs or provider metadata. It does not rewrite unknown tools, unsafe paths, destructive commands, or `git push`. Invalid plans do not execute.

## Evidence Boundary

For successful validated OpenAI plans, `task.json` records the provider and requested model. `plan.json` records provider/model metadata and bounded diagnostics indicating normalization and validation status.

The provider does not persist the full prompt, raw API response, API key, complete file contents, or invented tool-call evidence. Provider failures and validation failures occur before plan execution and do not create fake tool-call evidence.

## Runtime Boundary

OpenAI proposes a plan only. The harness alone may orchestrate validated registered tools, and every tool request remains subject to the existing Policy Gate and Evidence Writer path. Guard Adapter output remains evidence only and never grants execution authority.

## Failure Modes

- Missing model or API key: controlled pre-request failure.
- HTTP authentication, permission, endpoint/model, rate-limit, or upstream response: controlled HTTP status failure without raw response dumping.
- Network failure: controlled provider error.
- Planner timeout: controlled timeout error using `--planner-timeout-ms` or the provider default.
- Malformed JSON, refusal, non-plan output, or failed validation: controlled failure before execution.

## What This Does Not Do

- No OpenAI tool calling or function execution.
- No OpenAI Agents SDK or OpenAI SDK dependency.
- No web search, file search, or code interpreter.
- No direct file reads or command execution by OpenAI.
- No `.env` loading or API key evidence.
- No DeepSeek integration.
- No new tools, command allowlist entries, Policy Gate semantics, or Guard semantics.
- No SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.
