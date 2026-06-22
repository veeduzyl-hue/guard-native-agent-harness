# v0.5 Evidence Review Profile Schema

## Purpose

The v0.5 evidence review profile schema defines a small, local, deterministic shape for review profiles.

A review profile is a review artifact. It describes expected verifier commands, required evidence files, inspection outputs, review sections, and explicit boundaries for a review context. It is evidence-first and review-oriented.

Review profiles are not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution.

## Schema File

The local schema is:

```text
schemas/v0.5/evidence-review-profile.schema.json
```

The schema is intentionally bounded. It defines only the descriptive fields needed by v0.5 profile fixtures and does not create a governance ontology.

## Profile Fields

Each profile may describe:

- `schema_version`: the local profile schema version.
- `profile_id`: the stable profile identifier.
- `display_name`: the human-readable profile name.
- `description`: a short review-oriented description.
- `intended_context`: the review context where the profile is useful.
- `required_evidence_files`: expected evidence or artifact files for the review.
- `expected_verifiers`: deterministic verifier commands expected for the review.
- `inspection_outputs`: expected JSON or Markdown inspection outputs.
- `review_sections`: bounded review areas for human inspection.
- `boundary`: explicit false authority and execution boundary flags.
- `non_goals`: changes the profile must not introduce.

## Boundary

Every v0.5 fixture preserves these boundary flags:

```json
{
  "approval": false,
  "enforcement": false,
  "autonomous_execution": false,
  "runtime_control_plane": false,
  "authority_grant": false,
  "provider_output_authorizes_execution": false
}
```

These flags mean that review profiles are local, deterministic review artifacts only. They do not authorize execution, deployment, merges, provider behavior, planner behavior, Tool Registry semantics, Policy Gate semantics, Guard Adapter semantics, or Guard runtime semantics.

## Non-goals

Profiles must not introduce:

- SaaS.
- Dashboard.
- OAuth.
- Database.
- Telemetry service.
- Pricing changes.
- License changes.
- Checkout or Paddle changes.
- API key persistence.
- `.env` loading.
- SDK dependency.
- Cloud model requirement.
- Autonomous execution expansion.
- Provider behavior changes.
- Planner behavior changes.
- Tool Registry semantic changes.
- Policy Gate semantic changes.
- Guard Adapter semantic changes.
- Guard runtime semantic changes.
- Compliance certification.
- Deployment approval.
- Merge approval.

## Fixture Baseline

The v0.5 fixture baseline is:

- `fixtures/v0.5/review-profiles/local-dev.profile.json`
- `fixtures/v0.5/review-profiles/ci-pr.profile.json`
- `fixtures/v0.5/review-profiles/release-prep.profile.json`
- `fixtures/v0.5/review-profiles/audit-review.profile.json`

The invalid fixture baseline is:

- `fixtures/v0.5/review-profiles-invalid/missing-required-field.profile.json`
- `fixtures/v0.5/review-profiles-invalid/forbidden-command.profile.json`
- `fixtures/v0.5/review-profiles-invalid/authority-grant-true.profile.json`

The fixtures are deterministic JSON examples for the profile types and negative validation cases. They do not implement runtime profile loading, CLI profile selection, workflow behavior, or package version changes.

## Profile Verifier

The deterministic v0.5 verifier is:

```text
npm.cmd run verify:v0.5:profiles
```

The verifier validates the schema, the four valid profile fixtures, the invalid fixtures, declared verifier command boundaries, review sections, inspection outputs, non-goals, and explicit false authority flags. Expected verifier commands are declarative references only; the profile verifier does not execute those commands.
