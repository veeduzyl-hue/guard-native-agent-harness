# Guard-native Agent Harness v0.4.1 Release Notes

## Summary

v0.4.1 is a dependency-remediation-only patch release for Guard-native Agent Harness.

This patch preserves the v0.4 CI Evidence Readiness Baseline while carrying the bounded post-v0.4 dependency remediation merged after `v0.4.0`.

The release remains evidence-first, local, deterministic, CI-verifiable, and review artifact oriented. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant. No provider output can authorize execution. There is no runtime semantic change, no provider semantic change, and no Guard runtime semantic change.

## Advisory Coverage

v0.4.1 documents remediation for:

- `GHSA-h67p-54hq-rp68`
- `GHSA-v6wh-96g9-6wx3`
- `GHSA-fx2h-pf6j-xcff`

## Dependency Remediation

The dependency remediation is limited to development, build, test, and CI tooling:

- Direct `vite`: `6.4.2` to `6.4.3`.
- Transitive `js-yaml`: `4.1.1` to `4.2.0`.

The remediation record is:

```text
docs/security/POST_V0_4_DEPENDENCY_REMEDIATION.md
```

## Audit Result

The expected v0.4.1 release gate audit outcome is:

- Full audit: 0 vulnerabilities.
- Runtime-only audit: 0 vulnerabilities.

## What v0.4.1 Does Not Include

v0.4.1 does not include:

- `npm audit fix --force`.
- Vite major upgrades.
- Vitest upgrades.
- Runtime dependency changes.
- Runtime behavior changes.
- Provider behavior changes.
- Planner behavior changes.
- Tool Registry semantic changes.
- Policy Gate semantic changes.
- Guard Adapter semantic changes.
- Guard runtime semantic changes.
- CLI behavior changes.
- Workflow behavior changes.
- `.env` loading.
- SDK dependency additions.
- Release tag creation in this release-prep PR.
- GitHub Release publication in this release-prep PR.
- npm publishing.

This release note is factual remediation evidence only. It does not claim certification, exhaustive security coverage, production readiness, deployment approval, merge approval, or compliance.

## Verification

The final v0.4.1 release gate is:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
npm run verify:v0.2:providers
npm run verify:v0.2:release
npm run verify:post-v0.2
npm run verify:dependency-upgrade-plan
npm run audit:summary
npm run verify:v0.3:evidence
npm run verify:v0.3:runtime-evidence
npm run verify:v0.3:inspect-evidence
npm run verify:v0.3:release
npm run verify:v0.4:ci-workflow
npm run verify:v0.4:ci-evidence-artifact
npm run verify:v0.4:release
npm run verify:post-v0.4:dependencies
npm run verify:v0.4.1:release
```

## Tag Status

The `v0.4.1` tag is not created by this release gate PR. It should be created only after this PR is merged into `main` and the final v0.4.1 release gate passes on `main`.
