# v0.4.1 Tag Preparation

## Purpose

This document records the manual tag preparation flow for `v0.4.1`. These commands are instructions for after the v0.4.1 release gate PR is merged.

Do not create the tag in the release gate PR.

## Preconditions

- The v0.4.1 release gate PR is merged into `main`.
- The working tree on `main` is clean.
- Package metadata is at version `0.4.1` for the v0.4.1 tag flow.
- The final v0.4.1 release gate has passed without real provider calls or API keys.

## Boundary

The v0.4.1 tag marks a dependency-remediation-only patch release for development, build, test, and CI tooling advisories. It is not approval, not enforcement, not autonomous execution, not a runtime control plane, and no authority grant.

No provider output can authorize execution. There is no runtime semantic change, no provider semantic change, and no Guard runtime semantic change.

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
git tag v0.4.1
git push origin v0.4.1
```

Do not run historical tag-prep checks as blockers after a version is already released if the only failure is that the local historical tag already exists.

## Post-tag Check

After pushing, confirm the tag exists on origin:

```bash
git ls-remote --tags origin v0.4.1
```

## Rollback Notes

If a tag is created incorrectly but not pushed, delete it locally:

```bash
git tag -d v0.4.1
```

If an incorrect tag is pushed, do not rewrite it casually. Open a follow-up issue or PR note documenting the problem and intended remediation.

## Do Not Tag From Feature Branch

Do not tag from `docs/v0.4.1-release-gate` or any other feature branch. The `v0.4.1` tag should be created only from `main` after the v0.4.1 release gate PR is merged and the full release gate passes.
