Repository location: `tools/atomic-migration-runner/`. See [INTEGRATION.md](INTEGRATION.md) for repository-relative paths, setup and evidence provenance.

# Thesis Connect atomic runner — hardened local prototype

**No hosted mode. No application migration execution. Not deployment-ready.**

The eight original files are read only by `original_plan()`. The executable
`Runner` accepts only a closed `SyntheticPlan`: eight fixed CREATE TABLE fixtures
using the approved filenames and versions. Caller-supplied SQL, paths, replacement
hashes, connections, commit callbacks and execution hooks are not accepted.

## Source and dependencies

SQL splitter: Supabase CLI v2.122.0, immutable commit
`5afad870388552d0198087d27037da7ac745ba2b`, unmodified vendored TypeScript.
SHA-256: `005c59d49c164c72e60bbc9ab96b18bc7b811173b1702ded2e6bedabd2c688c0`.
Upstream MIT license is retained in `vendor/LICENSE`.

- Parser: https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/command-internal/sql-split.ts
- Ledger: https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/command-internal/migration-history.ts
- Transactions: https://www.postgresql.org/docs/17/tutorial-transactions.html
- Locks: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS

`requirements.lock` pins psycopg 3.3.3, psycopg-binary 3.3.3 and tzdata 2026.6,
including wheel SHA-256 hashes. The binary wheel is Windows x64 CPython 3.14
specific. `requirements.txt` enables pip hash enforcement. Installation was checked
offline against the downloaded wheels in the workspace, not into the application.
`python-files.lock.json` covers installed dependency files; runtime validation
checks versions and these hashes before opening the runner connection.

`runtime-lock.json` pins the absolute Node 24.16.0 binary and its SHA-256, the exact
Python patch version, and hashes of the bridge, parser and dependency locks. Its
digest is embedded in the runner. The bridge concatenates bytes before fatal UTF-8
decoding. There are no npm dependencies. Another machine/runtime needs a reviewed
repin; silently updating the runtime is rejected.

## Transaction and lifecycle

1. Verify the approved manifest, immutable fixture bytes and runtime artifacts.
2. Connect to fixed loopback PostgreSQL port 55439 and a random `atomic_proto_*`
   database, as `prototype_owner`. Port 55440 is reserved for the local TCP test.
3. Acquire session advisory lock 7426021220001, rejecting contention. The runner
   owns one direct psycopg connection and performs no pooling/reconnection.
4. Bootstrap a missing ledger using the exact CLI CREATE/ALTER sequence in a
   separate transaction. Reject unexpected schema/table owners, relation kinds,
   persistence, RLS, columns/types/defaults, keys/indexes, triggers, rules, policies,
   inheritance or non-owner table/schema/column ACLs.
5. Check the complete exact history and catalog prefix before each file. Compare
   backend identity/PID and lock ownership before every transaction and COMMIT.
6. Execute the authored BEGIN, ledger table lock and original synthetic body;
   insert version/name/original statement array using parameters and RETURNING.
   Require one row and exact returned/stored contents before the authored COMMIT.
7. Require COMMIT completion and idle status; verify post-commit history/catalog.
8. Any failure permanently stops the runner. Catch process-control exceptions as
   well as ordinary exceptions. Attempt rollback/unlock, preserve the original
   failure if cleanup fails, and close the connection. `run()` and context-manager
   use guarantee cleanup; a hard OS kill relies on PostgreSQL session termination.

No upsert, migration repair, retries or automatic replay exists. An empty ledger
may remain after a failed application transaction because bootstrap is separate.
A lock/table schema check is not a mechanism for excluding arbitrary administrators.

## Unknown COMMIT outcome and explicit reconciliation

Any failure once COMMIT dispatch begins is conservatively UnknownOutcome and closes
the connection, including interrupted acknowledgement/post-commit verification.
The runner cannot continue. Earlier successful transactions remain committed.

`reconcile(database, plan)` is a separate explicit operation. It takes a new session
advisory lock (rejecting an old/live holder), then uses a read-only repeatable-read
transaction to check the exact ledger and synthetic catalog prefix. A matching
prefix returns its length with `resume_authorized: false`. Mismatches raise an
error. It never executes migration SQL or repairs history. New execution requires
separate review; the constructor intentionally accepts only an empty baseline.

## Tests and reproduction

Tests use automatically created exclusive workspace temporary directories, never
`ATOMIC_PROTO_SCRATCH`. Paths/ancestors are checked for links and junctions and
scratch/source overlap. Original migration files must remain unchanged.

Use the disposable PostgreSQL 17.11 cluster on 127.0.0.1:55439, Node 24.16.0 and
the exact Python version recorded in `runtime-lock.json`. Install requirements in
an isolated environment and run `python test_runner.py`. No Supabase credentials
or connection configuration is used. Tests create and drop only random
`atomic_proto_*` databases. The dedicated test cluster must not serve other work.

Real integration cases include ledger suppression triggers/rules, RLS/owner/type
rejection, rollback, lock contention, a forcibly killed child process after history
insertion, and real TCP loss both before COMMIT forwarding and after forwarding
before acknowledgement. Driver-return corruption, injected SQL failures,
KeyboardInterrupt/SystemExit and cleanup failures use unittest monkeypatching;
they are fault simulations backed by local PostgreSQL transactions, not hosted
failure experiments. Real symlink creation requires Windows privilege; a skipped
test is reported explicitly, with a separate simulated predicate test. Windows
junction creation is tested for real.

`test-results.txt` is the authoritative final test count and skip list.
`integrity-results.json` records parser/hash verification of the originals, with
`executed: false`. `REVIEW_CHECKLIST.md` maps fixes and remaining hosted gates.

## Remaining limitations

This is a synthetic prototype, not an application deployment runner. It does not
establish genuine Supabase Auth behavior, hosted ownership/RLS/grants, minimum
non-superuser privileges, hosted failover/power-loss durability or application
catalog postconditions. The disposable bootstrap owner is a local superuser.
The real CLI `migration list` command has not been invoked; its ledger format and
version SELECT are exercised. Advisory locking cannot exclude uncooperative CLI,
Dashboard, MCP or other writers. The reviewed code and embedded trust pins must be
protected from unauthorized changes. Independent re-review is still required.

## Final remediation evidence

Full run: **55 cases, 54 passed, 1 skipped, 0 failed** (144.022 seconds).
The real symlink test was skipped because Windows denied symlink creation with
error 1314. The real junction test and separately labeled simulated symlink test
passed. After the final path guard/parser assertions, three targeted reruns also
passed. These results replace the earlier 14-test prototype evidence.

All eight original SHA-256 hashes matched the approved manifest both before and
after remediation. See `original-hashes-before-after.json`. Zero original SQL
files were executed. The disposable local PostgreSQL cluster was stopped after
testing. `test-summary.json` provides machine-readable results.
