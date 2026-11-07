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


## Trigger-backed BRAC state proposal

Public npm test now also runs tests/auth-feedback.test.cjs. It uses approved application source and synthetic error/password fixtures only. Existing assertions are retained; the handler harness imports the actual feedback helpers and models the SDK signup data shape.

Separate review command: node --test tests/brac-state-proposal.test.cjs. It requires the new ignored brac-state proposal files and fails if absent. It checks original hashes, exact twelve-body preservation, eleven-table restrictive coverage, helper/trigger/bootstrap/ACL/view contracts and lexical transaction boundaries. No SQL or genuine Auth is executed. Keep this suite outside the public npm script until the proposal is approved for publication.

## Baseline BRAC eligibility migration

`npm test` also runs `tests/brac-baseline-eligibility.test.cjs` against the new
`20261105120000_brac_email_eligibility.sql`. It checks exact baseline RPC body
preservation, eleven authenticated restrictive gates, view projection preservation,
Auth prerequisites/ACLs and mailbox vectors using extracted SQL regex source.
The JavaScript SQL model is not PostgreSQL regex/RLS/Auth integration evidence.
The older blocked drafts/proposals remain excluded from this public test path.

## Student profile and UI

`npm test` includes `tests/student-profile-ui.test.cjs`: actual profile-completion
helpers, validation/data adapters, proxy routing, Auth navigation subscription and
style/accessibility source checks with explicit synthetic SDK/React boundaries.
These tests neither connect to Supabase nor establish genuine Auth/RLS/browser
behavior. The new `20261106120000_student_private_profile_details.sql` migration
has been authored separately; its older proposal remains blocked and unchanged.
Six-field saves now require all three private columns; missing schema fails
explicitly instead of declaring a three-field profile complete. Stateful synthetic
adapter/form tests cover inserts, edits/reloads, user-scoped writes, partial-save
failures and onboarding navigation. No SQL is executed by these tests.

The old student-profile proposal execution barrier is checked separately with
`node --test tests/private/student-profile-proposal.test.cjs`. This ignored
local test requires the ignored SQL proposal and runs only when explicitly
invoked. The public suite still checks both authored migrations.
