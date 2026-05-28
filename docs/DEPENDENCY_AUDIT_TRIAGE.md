# Dependency Audit Triage

## Purpose

This document captures the dependency audit signal observed after `v0.2.0` and defines a safe triage path. PR 11A documents the signal only; it does not remediate dependencies.

## Current Audit Signal

```text
npm install reported 6 vulnerabilities: 2 low, 4 moderate.
```

PR 11B adds a bounded review in [Dependency Audit Review](DEPENDENCY_AUDIT_REVIEW.md). It summarizes the affected packages and remediation options without changing dependencies.

## What We Know

- The audit warning exists after the v0.2.0 release baseline.
- The project package version is `0.2.0`.
- The repository remains private and uses a small dependency surface.
- No dependency upgrade is performed in PR 11A.
- No forced audit fix is performed in PR 11A.

## What We Do Not Know Yet

PR 11A does not claim exact affected packages, advisory IDs, exploitability, or required version changes. Those details should come from a reviewed `npm audit --json` summary in a separate triage PR.

## Triage Principles

- Prefer a bounded audit summary over committing full raw audit output.
- Review direct and transitive dependency paths before changing versions.
- Separate security remediation from runtime behavior changes.
- Avoid changes that weaken Tool Registry, Policy Gate, Guard Adapter, evidence, or provider boundaries.
- Keep `mock` as the default planner unless a future reviewed release explicitly changes it.

## Do Not Run Automatically

Do not run these automatically in PR 11A:

```bash
npm audit fix
npm audit fix --force
```

Do not accept forced major-version changes without review. Do not combine dependency remediation with provider behavior, tool allowlist, or policy semantic changes.

## Recommended Manual Triage Steps

In a separate PR:

```bash
npm audit --json
```

Then summarize:

- Advisory count by severity.
- Affected direct or transitive packages.
- Whether fixes are available.
- Whether fixes require breaking changes.
- Which existing validation commands must pass after remediation.

Do not commit raw audit output unless it is small, intentional, and reviewed.

## Potential Follow-up PRs

- Audit report summary only.
- Patch-level dependency update if available.
- Minor dependency update with full validation.
- Major dependency update only after breaking-change review.
- Tooling upgrade PR if vulnerabilities are limited to development tooling.

## Boundary

Dependency triage must not weaken runtime governance semantics. It must not add `.env` loading, SDK dependencies, API key persistence, provider authority, new tools, command allowlist entries, SaaS, dashboard, OAuth, pricing, checkout, license, entitlement, or MindForge Guard runtime semantic changes.
