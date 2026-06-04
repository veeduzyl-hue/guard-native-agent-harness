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

Status: released in `v0.2.0`.

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

All providers remain optional. The default provider remains `mock`, v0.1 verification remains mock-based, and no default provider switch has occurred. v0.2 does not introduce autonomous execution, SaaS, dashboard behavior, OAuth, pricing, checkout, license, entitlement, or MindForge Guard runtime semantic changes. The `v0.2.0` tag and GitHub Release now mark the released provider baseline.

Post-v0.2 work may include provider quality comparisons, prompt hardening, evidence comparison across provider outputs, and optional external trace integrations. Those investigations remain future work and should not imply provider authority expansion.

## Post-v0.2 Maintenance

Status: PR 11A starts maintenance and dependency audit triage.

Post-v0.2 maintenance should prioritize stability and boundary preservation:

- Keep `mock` as the default provider unless a future reviewed release explicitly changes it.
- Keep Ollama, OpenAI, and DeepSeek optional.
- Keep release and post-release verification CI-safe.
- Triage dependency audit warnings in separate reviewed PRs.
- Do not run `npm audit fix` or `npm audit fix --force` without review.
- Do not combine dependency remediation with provider, tool, Policy Gate, Guard Adapter, or report renderer semantic changes.

Future work may include provider quality comparison, prompt hardening, evidence comparison, optional external trace integrations, and dependency audit remediation after review.

PR 11B performs a bounded dependency audit review and documents remediation options without dependency upgrades, audit fixes, or runtime changes. Dependency remediation should happen in separate reviewed PRs, with forced fixes avoided unless explicitly approved.

PR 11C checks non-forced remediation with `npm audit fix --dry-run`. No safe non-forced remediation is available, so dependency versions remain unchanged and forced fixes remain deferred for explicit review.

PR 11D defines the dependency upgrade sandbox plan. Actual dependency upgrades are deferred to a separate sandbox PR, where package and lockfile changes must be isolated, reviewed, and fully validated.

PR 11E executes the dependency upgrade sandbox experiment for audit-affected dev tooling. Targeted ESLint and Vitest upgrades are kept after the full validation baseline passes and the audit summary reports zero vulnerabilities.

Status: v0.2.1 Dependency Remediation Patch: final release gate prepared in PR 11F.

PR 11F prepares the final patch release gate. The actual `v0.2.1` tag happens only after merge and final validation on `main`. v0.2.1 does not change runtime or provider behavior, does not switch the default provider, does not add autonomous execution, and does not introduce SaaS, dashboard, or OAuth behavior.

## v0.3: Replayable Evidence Pack Baseline

Status: released in `v0.3.0`.

v0.3 establishes a replayable evidence pack baseline:

- v0.3 evidence pack contract.
- Deterministic manifest rules.
- Fixture-based evidence verifier.
- Runtime generation of `evidence-manifest.json`.
- Runtime generated-pack verifier.
- Deterministic evidence inspector.
- JSON and Markdown inspection output.

v0.3 remains evidence-first, local, deterministic, replayable, and review-oriented. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution, and there is no Guard runtime semantic change.

## v0.4: CI Evidence Readiness Baseline

Status: v0.4.0 release gate prepared in PR 19.

v0.4 makes Guard-native Agent Harness easier to validate in pull requests and CI while preserving local deterministic semantics. The sequence is PR 16 planning, PR 17 GitHub Actions verification workflow, PR 18 CI generated evidence artifact smoke check, and PR 19 v0.4 release gate and tag prep.

v0.4 remains evidence-first, local, deterministic, CI-verifiable, and review artifact oriented. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution, and there is no Guard runtime semantic change.

## Deferred / Explicit Non-goals

- Production SaaS control plane.
- Dashboard or OAuth system.
- Multi-tenant enterprise permission system.
- Arbitrary command execution.
- Deployment command execution.
- Guard policy/config/source mutation.
- Execution authority based on Guard output.
- MindForge Guard runtime semantic changes.
