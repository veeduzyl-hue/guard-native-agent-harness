# Guard-native Agent Harness Roadmap

## v0.1: Local Evidence-first Harness

Status: release candidate after PR 9B.

v0.1 establishes the local deterministic baseline:

- CLI workflow.
- Deterministic mock planner.
- Sequential orchestrator.
- Tool Registry and safe tools.
- Policy Gate and blocked-action evidence.
- Allowlisted command sandbox.
- Optional Guard Adapter evidence capture.
- Deterministic final report renderer.
- v0.1 acceptance and release readiness checks.

## v0.2: Optional Model-backed Planner

v0.2 may explore an optional model-backed planner, but only with hard boundaries:

- Model proposes steps only.
- Tool Registry remains mandatory.
- Policy Gate remains mandatory.
- Evidence Writer remains mandatory.
- No direct shell or filesystem authority for the model.
- No `.env` reading by the agent.
- API key handling must be explicit, local, non-leaking, and optional.
- The deterministic mock planner remains available.

v0.2 should not make OpenAI or any external LLM required for the v0.1 local workflow.

## v0.3: External Runtime Trace Experiments

v0.3 may explore trace and evidence interoperability with external runtime experiments:

- OpenHuman-like workflows.
- OpenClaw-like workflows.
- Hermes-like workflows.
- Evidence completeness comparison.
- Trace-to-Evidence-Pack conversion.

These experiments should compare evidence quality and trace completeness. They should not grant external runtimes production authority.

## Deferred / Explicit Non-goals

- Production SaaS control plane.
- Dashboard or OAuth system.
- Multi-tenant enterprise permission system.
- Arbitrary command execution.
- Deployment command execution.
- Guard policy/config/source mutation.
- Execution authority based on Guard output.
- MindForge Guard runtime semantic changes.
