# Guard-native Agent Harness Roadmap

## v0.1: Local Evidence-first Harness

Status: complete in `v0.1.0`.

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

Status: v0.2.0 Provider Baseline: final release gate prepared.

v0.2 establishes optional model-backed planners, but only with hard boundaries:

- Model proposes steps only.
- Tool Registry remains mandatory.
- Policy Gate remains mandatory.
- Evidence Writer remains mandatory.
- No direct shell or filesystem authority for the model.
- No `.env` reading by the agent.
- API key handling must be explicit, local, non-leaking, and optional.
- The deterministic mock planner remains available.
- The default provider remains `mock` until explicitly changed in a future release.

v0.2 should not make OpenAI or any external LLM required for the v0.1 local workflow.

Phased plan:

- PR 10A: Planner Provider Interface.
- PR 10B: Ollama Local Planner Provider. Implemented as optional local-only planning.
- PR 10B.5: Ollama Local Planner E2E Acceptance. Optional local acceptance guide and verifier for the Ollama path.
- PR 10C: OpenAI Planner Provider. Optional Responses API planner using process-environment credentials only.
- PR 10C.1: OpenAI Planner Acceptance. Optional manual guide, evidence inspection example, and local verifier for users who supply a process-environment API key.
- PR 10D: DeepSeek Planner Provider. Optional Chat Completions JSON Output planner using process-environment credentials only.
- PR 10D.1: DeepSeek Planner Acceptance. Optional manual guide, evidence inspection example, and local verifier for users who supply a process-environment API key.
- PR 10E: v0.2 Provider Baseline Acceptance + Release Preparation. Provider baseline docs, release-prep checklist, and CI-safe provider baseline verification.
- PR 10F: v0.2.0 Final Release Gate + Tag Preparation. Final release notes, tag-prep docs, and CI-safe final release verification.

PR 10C implements OpenAI as an optional planner only, PR 10C.1 documents its optional acceptance path, PR 10D implements DeepSeek as another optional planner only, PR 10D.1 documents DeepSeek acceptance, PR 10E prepares the v0.2 provider baseline, and PR 10F prepares the final release gate without changing runtime behavior. Ollama remains an optional local planner. Provider output remains a proposed plan that must pass structural normalization, validation, Tool Registry routing, and the Policy Gate before any step can execute. The execution boundary is unchanged.

All providers remain optional. The default provider remains `mock`, v0.1 verification remains mock-based, and no default provider switch has occurred. v0.2 does not introduce autonomous execution, SaaS, dashboard behavior, OAuth, pricing, checkout, license, entitlement, or MindForge Guard runtime semantic changes. The actual `v0.2.0` tag happens only after PR 10F is merged and final validation passes on `main`.

Post-v0.2 work may include provider quality comparisons, prompt hardening, evidence comparison across provider outputs, and optional external trace integrations. Those investigations remain future work and should not imply provider authority expansion.

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
