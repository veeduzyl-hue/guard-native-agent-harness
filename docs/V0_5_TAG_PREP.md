# v0.5.0 Tag Preparation

## Purpose

This document records the manual tag preparation flow for `v0.5.0`. These commands are instructions for after the v0.5.0 release gate PR is merged.

Do not create the tag in the release gate PR.

## Preconditions

- The v0.5.0 release gate PR is merged into `main`.
- The working tree on `main` is clean.
- Package metadata is at version `0.5.0` for the v0.5.0 tag flow.
- The final v0.5.0 pre-tag release gate has passed without real provider calls or API keys.

## Boundary

The v0.5.0 tag marks the Evidence Review Profile Baseline. Review profiles are review artifacts only. They do not approve, enforce, block, deploy, grant authority, control runtime execution, authorize execution, or act as a runtime control plane.

No provider output can authorize execution. Expected verifier references in review profiles are declarative only and are not executed by profile verification or inspection.

## Final Validation

Run the full release gate on `main`:

```bash
git checkout main
git pull origin main
npm install
npm run build
npm test
npm run lint
npm run verify:v0.5:profiles
npm run verify:v0.5:inspect-profile
npm run verify:v0.5:release
git tag v0.5.0
git push origin v0.5.0
```

Do not run historical pre-tag checks as blockers after a version is already released if the only failure is that the local historical tag already exists.

## Post-tag Check

After pushing, confirm the tag exists on origin:

```bash
git ls-remote --tags origin v0.5.0
```

Post-tag sanity should check the existing tag and package artifact. It should not require tag absence.

## Rollback Notes

If a tag is created incorrectly but not pushed, delete it locally:

```bash
git tag -d v0.5.0
```

If an incorrect tag is pushed, do not rewrite it casually. Open a follow-up issue or PR note documenting the problem and intended remediation.

## Do Not Tag From Feature Branch

Do not tag from `release/v0-5-gate-tag-prep` or any other feature branch. The `v0.5.0` tag should be created only from `main` after the v0.5.0 release gate PR is merged and the full release gate passes.
