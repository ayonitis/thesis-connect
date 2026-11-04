# BRAC test scopes

Fresh v2 proposal review is a separate explicit source-only suite:
`node --test tests/brac-email-policy-parity.test.cjs`. It requires the three
`.sql.proposal` artifacts under `supabase/migration-proposals/brac-v2/` and fails
if they are absent. It is deliberately outside `npm test`, preserving clean public
checkout independence from unapproved SQL. See that proposal's README for the
JavaScript model/lexical-parser limits; this is not PostgreSQL or Auth testing.

`npm test` runs the public offline application tests, author-ownership client tests
and dependency compatibility tests. It needs the tracked application source, the
eight approved original migrations and normal locked Node dependencies. It does
not read private drafts, environment files, databases or hosted services.

The public suite checks the actual email policy, fresh-identity/current-email
eligibility and fail-closed RPC handling, protected loaders/layouts/mutations,
callback/session cleanup, cookie propagation, safe errors and ownership RPC
boundaries using explicit synthetic doubles. Original migration SHA-256 checks
remain public. The shared SQL-definition comparator is tested with an approved
original `is_admin()` definition and a synthetic replacement, including rejection
of a case-only change to its role literal. No SQL is executed.

## Private draft review: explicitly blocked in a public checkout

Six existing static assertions are preserved verbatim in
`tests/private/brac-migration-draft-review.test.cjs`, which is excluded from the
publication manifest and from `npm test`:

1. Unconditional draft execution barrier and absence of an unverified Auth trigger.
2. Eleven restrictive RLS USING/WITH CHECK gates without disabling RLS.
3. Review-view eligibility, preserved public projections and direct-write revokes.
4. Current managed email/confirmation checks, no editable metadata/caller identity.
5. Exact preservation of all twelve original privileged function definitions.
6. Case-sensitive SQL preservation using the actual local draft replacement.

These assertions need the unapproved local SQL artifact; approved application
source or a made-up RLS fixture cannot establish what that artifact contains.
They are **BLOCKED for the public checkout**, not silently skipped or claimed
passed by `npm test`. The private file fails with an explicit BLOCKED error unless
`BRAC_PRIVATE_DRAFT_REVIEW=1` is supplied. With that flag it still fails BLOCKED if
the one required private draft is absent. There is no fallback fixture, automatic
approval, SQL execution or barrier removal.

For a separately authorized local **text-only** review, set that non-secret flag
for a child process and run:

```text
node --test tests/private/brac-migration-draft-review.test.cjs
```

This task exercised that private review against the existing unchanged local
artifact. A passing static review does not approve the draft, establish actual
PostgreSQL RLS behavior or authorize migrations. Keep private artifacts out of
public snapshots; do not run a broad test-file glob in place of the explicit
public npm script.

The ten existing genuine Auth/database/browser scenarios remain explicit TODOs
in the public suite and acceptance cases in
`BRAC_PENDING_INTEGRATION_TEST_PLAN.md`. Mocks and text checks do not close them.
