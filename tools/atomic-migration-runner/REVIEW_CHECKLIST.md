# Remediation checklist — not an independent certification

This checklist maps the earlier independent review to the implemented changes.
It is an implementation self-check. A separate reviewer must inspect the revised
code and evidence before any hosted adaptation. There is no hosted execution mode.

| Finding | Implemented control | Evidence / remaining scope |
|---|---|---|
| Ledger suppressing triggers/rules | Reject all ledger triggers, rules, policies, inheritance, unexpected relation attributes, constraints/indexes and ACLs | Real PostgreSQL trigger/rule/RLS/owner/type/ACL regression tests |
| Exact insert | Parameterized INSERT RETURNING; rowcount=1; exact returned tuple and complete prefix checked before COMMIT | Real constraint-failure rollback; simulated bad result/rowcount tests |
| Immutable approved plan | Approved manifest SHA baked into code; original names/versions/order/paths/hashes validated; snapshot bytes immutable; no caller replacement hashes | Modified manifest, order, payload, substituted bytes and extra files rejected |
| Source protection | Original plan read-only; Runner rejects it. Only deterministic synthetic plans execute | Original execution refusal and before/after 8-file hashes |
| Safe scratch | Exclusive automatically created workspace temporary directory; no environment-selected scratch; canonical ancestor and bidirectional overlap checks | Actual Windows junction, overlap and original-byte preservation tests; actual symlink creation may be unavailable; simulated symlink predicate test separately labeled |
| CLI ledger layout | Exact v2.122.0 CREATE/ALTER sequence; validation by names and PostgreSQL types rather than order | Both CLI physical order and alternative order accepted |
| UTF-8 bridge | Concatenate Buffer chunks and fatal-decode once | Actual pipe writes split multibyte characters, byte-for-byte roundtrip |
| Fail closed | BaseException handling; FAILED/UNKNOWN states; owned connection closed after failure; no resume/retry/repair | KeyboardInterrupt/SystemExit injection, actual child-process kill, cleanup-failure and real TCP tests |
| Lock continuity | Session lock on one psycopg connection; backend PID/identity and pg_locks checked before each file and before/after COMMIT | Eight transactions retain same PID/lock; contention/loss/identity-change tests |
| Commit verification | COMMIT command tag and idle status; exact post-commit history/catalog verification | Synthetic eight-file integration test; no application-migration execution |
| Explicit reconciliation | Separate new session and lock; repeatable-read read-only transaction; exact prefix and catalog; never applies or repairs | Both committed and rolled-back real TCP outcomes, mismatch and live-runner refusal |
| Dependency trust | Hash-locked direct/transitive Python wheels; installed-file inventory; exact Python/Node versions and Node binary hash; pinned bridge/parser | Offline pip --require-hashes installation; integrity/tamper tests |

## Before hosted use — still required

- Independent re-review of the revised implementation, parser bridge and tests.
- A separately authorized hosted-target implementation with authenticated endpoint
  pinning, TLS verification and secret-safe credentials. Do not loosen loopback
  guards to repurpose this prototype.
- Genuine Supabase Auth/application migration tests in an approved isolated stack.
- Catalog postconditions covering all application objects, RLS, owners, grants,
  views, functions, search paths and triggers. The current catalog validator is
  deliberately limited to synthetic probe tables.
- Minimum-privilege non-superuser tests; current disposable test-cluster owner is
  a bootstrap superuser. No privilege reductions on application objects were made.
- Real CLI v2.122.0 `migration list --db-url <loopback database>` compatibility test.
  Current tests exercise its exact history schema and SELECT shape, not the CLI
  executable. This can be done entirely locally with a retained synthetic fixture
  database and an isolated workdir holding the eight original filenames.
- External writer and migration-runner isolation. Advisory locks only coordinate
  cooperating clients; table locks do not close the between-file DDL window.
- Hosted failover, server/power-loss durability and recovery review. Local TCP
  acknowledgement-loss tests do not prove those properties.

## Trust boundary

Pinned hashes detect changed artifacts relative to reviewed code, not a hostile
operator who can replace both code and pins. Python monkeypatching in tests is
explicit fault simulation, not a supported runner interface. Reconciliation
never authorizes automatic continuation, even for a consistent committed prefix.

## Test disposition

55 unique cases: 54 PASS, 1 SKIP, 0 FAIL. Three final targeted reruns PASS.
The skipped real Windows symlink case remains unverified; the actual junction
test and simulated symlink classification test passed. All eight original file
hashes are unchanged. These are executed local tests, not an independent approval
or hosted readiness assessment. See `test-results.txt` and `test-summary.json`.
