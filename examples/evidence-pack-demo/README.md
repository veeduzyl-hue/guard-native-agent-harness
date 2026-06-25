# Evidence Pack Demo

This guide shows how to generate local v0.1 demo Evidence Packs.

## Build

```bash
npm run build
```

## Safe Demo

```bash
node dist/cli.js run "Create a safe README update proposal"
```

This creates an Evidence Pack under:

```text
.evidence/<task-id>/
```

Inspect:

- `task.json`
- `plan.json`
- `tool-calls.jsonl`
- `guard-results.json`
- `evidence-manifest.json`
- `evidence-pack.json`
- `tool-report.md`
- `final-report.md`

The safe demo uses a deterministic mock planner. It writes a README update proposal artifact rather than modifying `README.md` directly.

## Unsafe Demo

```bash
node dist/cli.js run "Show a policy demo with blocked action"
```

Inspect:

- `blocked-actions.jsonl`
- `command-results.jsonl`
- `evidence-manifest.json`
- `evidence-pack.json`
- `final-report.md`

A blocked action means the Policy Gate denied the request before execution. In the unsafe demo, requests such as `.env` reads and `git push` are recorded as blocked evidence and are not executed. These blocks remain local Harness safety controls, not Guard governance verdicts.

## Guard Unavailable Fallback

If the local `guard` CLI is unavailable, the run still succeeds. `guard-results.json` records:

```json
{
  "guard_available": false,
  "reason": "Guard CLI not found"
}
```

Guard output is evidence only. It does not grant execution authority, compute verdicts, or override local Harness safety controls.

## Do Not Commit Generated Evidence

Generated `.evidence/` directories are local artifacts. They are ignored by git and should not be committed.
