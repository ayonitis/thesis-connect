Repository integration: copied into `tools/atomic-migration-runner/`; `runner.py` now resolves source paths relative to the repository and scratch under its ignored `.work/`. Added `.gitignore` and `INTEGRATION.md`. The list below records the earlier isolated prototype remediation.

# Changed-file list

All changes are confined to this chat's isolated prototype outputs and work area.
No application code, application environment files, Supabase project configuration,
or original migration files were edited.

Modified deliverables:

- `runner.py` — closed synthetic plan, verified ledger, atomic history insert,
  fail-closed lifecycle, lock/identity continuity and explicit reconciliation.
- `test_runner.py` — expanded regression/integration/fault-injection suite.
- `parse.mjs` — safe complete-stream UTF-8 decode and deterministic chunk-test entry.
- `requirements.txt` — hash enforcement and inclusion of the complete lock file.
- `README.md` — revised behavior, source pins, reproduction, results and limitations.
- `integrity-results.json` — current original-file hash/parser evidence.
- `test-results.txt` — final 55-case run and three targeted reruns.

New deliverables:

- `requirements.lock` — all direct/transitive Python dependencies and wheel hashes.
- `runtime-lock.json` — exact runtimes, Node binary hash and artifact hashes.
- `python-files.lock.json` — 739 installed dependency-file hashes.
- `original-hashes-before-after.json` — eight unchanged approved original hashes.
- `test-summary.json` — machine-readable test outcomes and scope.
- `REVIEW_CHECKLIST.md` — finding-by-finding remediation map and remaining gates.
- `CHANGES.md` — this list.

Unchanged trust inputs: `manifest.json`, `vendor/sql-split.ts`, `vendor/LICENSE`.

Workspace-only intermediates: pinned downloaded wheels, isolated dependency
installation, synthetic temporary fixture files and the stopped disposable local
PostgreSQL cluster under `work/atomic-prototype`. No hosted targets were used.
