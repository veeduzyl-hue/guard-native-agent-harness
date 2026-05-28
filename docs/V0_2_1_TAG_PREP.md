# v0.2.1 Tag Preparation

## Purpose

This document records the manual tag preparation flow for `v0.2.1`. These commands are instructions for after PR 11F is merged.

Do not create the tag in PR 11F.

## Preconditions

- PR 11F is merged into `main`.
- The working tree on `main` is clean.
- `package.json` and `package-lock.json` are at version `0.2.1`.
- The final patch release gate has passed without real provider calls or API keys.

## Final Validation

Run the full release gate on `main`:

```bash
git checkout main
git pull --ff-only origin main

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
npm run verify:v0.2.1:release
```

## Tag Commands

After final validation passes on `main`, create and push the tag:

```bash
git tag -a v0.2.1 -m "Guard-native Agent Harness v0.2.1"
git push origin v0.2.1
```

## Post-tag Check

After pushing, confirm the tag exists on origin:

```bash
git ls-remote --tags origin v0.2.1
```

## Rollback Notes

If a tag is created incorrectly but not pushed, delete it locally:

```bash
git tag -d v0.2.1
```

If an incorrect tag is pushed, do not rewrite it casually. Open a follow-up issue or PR note documenting the problem and intended remediation.

## Do Not Tag From Feature Branch

Do not tag from `docs/pr11f-v0-2-1-patch-release-gate` or any other feature branch. The `v0.2.1` tag should be created only from `main` after PR 11F is merged and the full patch release gate passes.
