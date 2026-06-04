# v0.4.0 Tag Preparation

## Purpose

This document records the manual tag preparation flow for `v0.4.0`. These commands are instructions for after PR 19 is merged.

Do not create the tag in PR 19.

## Preconditions

- PR 19 is merged into `main`.
- The working tree on `main` is clean.
- Package metadata is at version `0.4.0` for the v0.4.0 tag flow.
- The final v0.4.0 release gate has passed without real provider calls or API keys.

## Boundary

The v0.4.0 tag marks an evidence-first local deterministic CI-verifiable review artifact baseline. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant.

No provider output can authorize execution. There is no Guard runtime semantic change.

## Final Validation

Run the full release gate on `main`:

```bash
git checkout main
git pull origin main
npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.2:providers
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
```

Do not run historical tag-prep checks as blockers after a version is already released if the only failure is that the local historical tag already exists.

## Tag Commands

After final validation passes on `main`, create and push the tag:

```bash
git tag v0.4.0
git push origin v0.4.0
```

## Post-tag Check

After pushing, confirm the tag exists on origin:

```bash
git ls-remote --tags origin v0.4.0
```

## Rollback Notes

If a tag is created incorrectly but not pushed, delete it locally:

```bash
git tag -d v0.4.0
```

If an incorrect tag is pushed, do not rewrite it casually. Open a follow-up issue or PR note documenting the problem and intended remediation.

## Do Not Tag From Feature Branch

Do not tag from `docs/v0.4.0-release-gate` or any other feature branch. The `v0.4.0` tag should be created only from `main` after PR 19 is merged and the full release gate passes.
