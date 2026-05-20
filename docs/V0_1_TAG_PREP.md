# v0.1 Tag Preparation

## Purpose

This checklist prepares the repository for a future `v0.1.0` tag after the release notes and readiness documents are reviewed and merged.

Do not create the tag in this PR.

## Preconditions

- PR 9B has been reviewed and merged to `main`.
- `main` is clean and up to date with `origin/main`.
- `package.json` and `package-lock.json` show version `0.1.0`.
- Required release documents are present.
- Generated `.evidence/` directories are not tracked.

## Required Validation

Run these commands on `main` after this PR is merged:

```bash
git checkout main
git pull origin main

npm install
npm run build
npm test
npm run lint
npm run verify:v0.1
npm run verify:v0.1:release
```

## Manual Review Checklist

- Confirm `docs/RELEASE_NOTES_v0.1.md` reflects the merged code.
- Confirm `docs/V0_1_BASELINE.md` matches the v0.1 runtime boundary.
- Confirm `docs/V0_1_ACCEPTANCE.md` still matches `npm run verify:v0.1`.
- Confirm `docs/ROADMAP.md` does not overstate future commitments.
- Confirm README links to release readiness documents.
- Confirm no OpenAI, external LLM, SaaS, dashboard, OAuth, or autonomous planning capability was added.

## Tag Command

After review and merge, create the tag from updated `main`:

```bash
git tag -a v0.1.0 -m "Guard-native Agent Harness v0.1.0"
```

## Push Tag Command

```bash
git push origin v0.1.0
```

## Post-tag Checks

- Confirm `git tag --list v0.1.0` shows the tag locally.
- Confirm the tag is visible on GitHub.
- Confirm the tag points to the intended merge commit on `main`.
- Re-run `npm run verify:v0.1` if any local release artifact needs inspection.

## Rollback Note

If a tag is created against the wrong commit, do not force-delete it casually. Record the mistake, coordinate with maintainers, and only then delete or replace the tag according to repository policy.

## Boundary

The v0.1 tag marks a deterministic local harness baseline. It does not mark an OpenAI-backed agent release or a production SaaS release.
