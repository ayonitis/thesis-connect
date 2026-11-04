# Repository integration

This folder contains the isolated atomic migration runner prototype and its saved
security/test evidence. It is not connected to either Supabase project and has no
hosted deployment mode.

- `runner.py` resolves the original migrations at `../../supabase/migrations`.
- All generated fixtures belong under this folder's ignored `.work/` directory.
- `.venv/`, Python bytecode and `.work/` are ignored locally by `.gitignore`.
- Original migration SQL, application code, environment files and Supabase
  configuration were not changed by this integration.
- Existing `Security Runner` and `Security Runner v2` folders remain untouched.

## Setup for a separately authorized local test run

From this folder, use the exact Python and Node versions in `runtime-lock.json`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements.lock
.\.venv\Scripts\python.exe test_runner.py
```

The test command requires a dedicated disposable PostgreSQL 17.11 server already
running on loopback port 55439 with the test-only role `prototype_owner`. Tests
create and drop only randomly named `atomic_proto_*` databases. Do not start the
application, supply Supabase credentials, or retarget this prototype to hosted
PostgreSQL. Node is pinned to an absolute executable path and binary hash; another
machine requires a reviewed repin, not disabling integrity verification.

`test-results.txt`, `test-summary.json`, and `integrity-results.json` are historical
executed evidence from the isolated workspace. The full database suite was not
rerun during repository integration. Only non-database integrity/parser checks
were run after copying. See `REVIEW_CHECKLIST.md` for unresolved hosted-use gates.