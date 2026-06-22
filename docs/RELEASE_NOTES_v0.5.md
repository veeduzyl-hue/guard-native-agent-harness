# Guard-native Agent Harness v0.5.0 Release Notes

## Summary

v0.5.0 is the Evidence Review Profile Baseline for Guard-native Agent Harness.

This release adds bounded review profile artifacts for local development, pull request CI, release preparation, and audit review. It also adds deterministic verification for those profiles and an `inspect-evidence --profile <profile-id>` option that includes selected profile metadata in JSON or Markdown inspection output.

The release remains evidence-first, local, deterministic, review profile oriented, and review artifact oriented. Review profiles are review artifacts only. They do not approve, enforce, block, deploy, grant authority, control runtime execution, authorize execution, or act as a runtime control plane. No provider output can authorize execution. Expected verifier references in review profiles are declarative only and are not executed by profile verification or inspection.

## Included In v0.5.0

- Review profile schema at `schemas/v0.5/evidence-review-profile.schema.json`.
- Valid profile fixtures for `local-dev`, `ci-pr`, `release-prep`, and `audit-review`.
- Invalid fixtures for negative validation.
- Deterministic review profile verifier: `npm run verify:v0.5:profiles`.
- `inspect-evidence --profile <profile-id>` review metadata output.
- Hardened inspect-profile verifier: `npm run verify:v0.5:inspect-profile`.
- v0.5 release gate: `npm run verify:v0.5:release`.

## What v0.5.0 Does Not Include

v0.5.0 does not include:

- Runtime execution semantic changes.
- Replay semantic changes.
- Planner provider authority model changes.
- Provider behavior changes.
- Provider execution authority.
- Approval behavior.
- Enforcement behavior.
- Blocking behavior.
- Deployment authority.
- Runtime control-plane behavior.
- Authority grants.
- v0.4 CI workflow behavior changes.
- `.env` loading.
- API key persistence.
- SDK dependency additions.
- Release tag creation in this release-prep PR.
- GitHub Release publication in this release-prep PR.
- npm publishing.

This release note is factual release-preparation evidence only. It does not claim certification, production readiness, deployment approval, merge approval, or compliance.

## Verification

The final v0.5.0 pre-tag release gate is:

```bash
npm install
npm run build
npm test
npm run lint
npm run verify:v0.5:profiles
npm run verify:v0.5:inspect-profile
npm run verify:v0.5:release
```

## Tag Status

The `v0.5.0` tag is not created by this release gate PR. It should be created only after this PR is merged into `main` and the final v0.5.0 pre-tag release gate passes on `main`.
