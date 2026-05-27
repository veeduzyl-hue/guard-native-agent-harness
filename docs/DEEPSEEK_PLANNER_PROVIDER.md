# DeepSeek Planner Provider

## Purpose

The DeepSeek planner provider is an optional PR 10D path for producing a proposed `AgentPlan` through the DeepSeek Chat Completions API. It does not execute work or change the local harness execution boundary.

## Status

`deepseek` is implemented as an optional remote-model provider. The default planner remains `mock`.

## Preconditions

- Select the provider explicitly with `--planner deepseek`.
- Supply an explicit model with `--model <model-name>`.
- Provide `DEEPSEEK_API_KEY` in the process environment.
- Network access to `https://api.deepseek.com/chat/completions` must be available for a real run.

## API Key Boundary

The provider reads only `process.env.DEEPSEEK_API_KEY`. It does not read `.env`, load `dotenv`, retrieve credentials through tools, log the key, or write it to task evidence, plan evidence, final reports, diagnostics, or errors.

If the environment variable is absent, the selected DeepSeek path fails before plan execution:

```text
DeepSeek planner requires DEEPSEEK_API_KEY in the process environment.
```

## Model Selection

PR 10D has no default DeepSeek model. A selected DeepSeek run without `--model` fails before a request is sent:

```text
DeepSeek planner requires --model <model-name> in PR 10D.
```

## Example Command

```powershell
$env:DEEPSEEK_API_KEY="..."
npx guard-agent run "Create a safe README update proposal" --planner deepseek --model deepseek-chat --planner-timeout-ms 120000
```

## JSON Plan Output

The provider uses Node 20 built-in `fetch` to call `POST https://api.deepseek.com/chat/completions` in JSON Output mode:

```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

Its conservative prompt requests valid JSON only and includes registered tool names, exact input shape hints, and compact examples. It instructs the model to avoid `.env`, secrets, `git push`, destructive commands, and non-allowlisted commands.

The request exposes no tools and does not use tool calling or function execution.

## Plan Validation

DeepSeek output is a proposal only:

```text
DeepSeek proposes plan
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

For successful validated DeepSeek plans, `task.json` records the provider and requested model. `plan.json` records provider/model metadata and bounded diagnostics indicating normalization and validation status.

The provider does not persist the full prompt, raw API response, API key, complete file contents, or invented tool-call evidence. Provider failures and validation failures occur before plan execution and do not create fake tool-call evidence.

## Reasoning Output Boundary

If a selected DeepSeek model returns reasoning content, the provider does not place it in plan evidence, tool-call evidence, blocked-action evidence, Guard results, or final reports. Only the parsed plan content and bounded provider diagnostics are eligible for evidence capture.

## Runtime Boundary

DeepSeek proposes a plan only. The harness alone may orchestrate validated registered tools, and every tool request remains subject to the existing Policy Gate and Evidence Writer path. Guard Adapter output remains evidence only and never grants execution authority.

## Failure Modes

- Missing model or API key: controlled pre-request failure.
- HTTP authentication, permission, endpoint/model, rate-limit, or upstream response: controlled HTTP status failure without raw response dumping.
- Network failure: controlled provider error.
- Planner timeout: controlled timeout error using `--planner-timeout-ms` or the provider default.
- Empty, markdown-wrapped, malformed JSON, non-plan output, or failed validation: controlled failure before execution.

## What This Does Not Do

- No DeepSeek tool calling or function execution.
- No DeepSeek SDK dependency.
- No direct file reads or command execution by DeepSeek.
- No `.env` loading or API key evidence.
- No reasoning or chain-of-thought evidence capture.
- No new tools, command allowlist entries, Policy Gate semantics, or Guard semantics.
- No SaaS, dashboard, OAuth, pricing, checkout, license, or entitlement behavior.
