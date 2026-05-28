# v0.2.0 Tag Preparation

## Purpose

This document records the manual tag preparation flow for `v0.2.0`. These commands are instructions for after PR 10F is merged.

Do not create the tag in PR 10F.

## Preconditions

- PR 10F is merged into `main`.
- The working tree on `main` is clean.
- `package.json` and `package-lock.json` are at version `0.2.0`.
- The final release gate has not required real provider calls or API keys.

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
```

## Tag Commands

After final validation passes on `main`, create and push the tag:

```bash
git tag -a v0.2.0 -m "Guard-native Agent Harness v0.2.0"
git push origin v0.2.0
```

## Post-tag Check

After pushing, confirm the tag exists on origin:

```bash
git ls-remote --tags origin v0.2.0
```

## Rollback Notes

If a tag is created incorrectly but not pushed, delete it locally:

```bash
git tag -d v0.2.0
```

If an incorrect tag is pushed, do not rewrite it casually. Open a follow-up issue or PR note documenting the problem and the intended remediation.

## Do Not Tag From Feature Branch

Do not tag from `docs/pr10f-v0-2-final-release-gate` or any other feature branch. The `v0.2.0` tag should be created only from `main` after PR 10F is merged and the full release gate passes.
