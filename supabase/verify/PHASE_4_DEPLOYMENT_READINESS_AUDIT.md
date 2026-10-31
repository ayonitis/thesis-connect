# Phase 4 deployment-readiness catalog audit

## Consolidated execution

`phase_4_deployment_readonly.sql` now returns one normalized result grid only:
`category`, `object_name`, `check_name`, `status`, `observed_value`, `expected_value`, `severity`, and `details`.

In pgAdmin, open a read-only query window for the intended database, paste the complete runner, and execute it once. Export or copy the one result grid (CSV is preferred) with all columns. Do not run the legacy commented SQL at the top of the file separately.

- `PASS` means the observed catalog value matches a source-derived expectation.
- `FAIL` means an object is missing or a known security expectation is contradicted.
- `WARNING` requires reviewed deployment judgment; it is not a success result.
- `INFO` records inventory/evidence without claiming a security verdict.
- `NOT_VERIFIABLE` identifies facts a static generic query cannot establish, notably arbitrary migration-history row contents.
- `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, and `INFO` rank the deployment consequence, not the trustworthiness of the query.

The current local observations supplied by the user apply only to PostgreSQL 17.11 database `thesis_connect_clean_validation`: nine Phase 2B definer functions existed, both Phase 4 functions were missing, all eleven tables had RLS enabled, the functions/tables were owned by superuser `postgres`, and three direct-write policies plus their corresponding authenticated grants remained. Those observations are not production Supabase evidence.

The runner is source-authored only. Codex did not execute it, connect to PostgreSQL/Supabase, or modify any database. Source-level approval is not production deployment approval.

The consolidated runner treats a function owner's effective `EXECUTE` as expected ownership behavior and reports its direct ACL separately; only `PUBLIC`, `anon`, and `service_role` are expected to lack execution. Direct-write rows fail for any prohibited client principal (`PUBLIC`, `anon`, `authenticated`, or `service_role`) that has effective `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` on the protected tables.

Function search-path expectations are source-derived: the current Phase 2B RPC migrations and the two Phase 4 RPC migrations specify `pg_catalog, public, pg_temp`; the two authorization helpers specify `pg_catalog, pg_temp`. The supplied local database observation of `pg_catalog, public` for existing RPCs is therefore a source-versus-local discrepancy requiring review, not a value this document normalizes or accepts.

The view expectation is also source-derived: all three current view definitions explicitly use `security_barrier = true` and `security_invoker = false`. Policy name/table/command/role checks are automated; observed `USING` and `WITH CHECK` expressions are retained in the grid, but exact source-string equality is `NOT_VERIFIABLE` because PostgreSQL deparser formatting is not a reliable static textual comparator.

For view catalog checks, `security_barrier=true` must be explicitly present in `reloptions`. PostgreSQL may omit default `security_invoker=false` from `reloptions`, so an absent `security_invoker` option is treated as the source-consistent default; an explicit `security_invoker=true` produces a warning. The grid still returns the actual options, owner, and view definition for deployment review.

Obsolete direct-write policy detection uses exact `(tablename, policyname)` pairs only: `faculty_reviews.reviews_insert_own`, `faculty_reviews.reviews_delete_own`, and `faculty_add_requests.faculty_requests_insert_own`. An identically named policy on another table is inventory evidence but is not classified as one of these Phase 4 obsolete policies.

For real roles, view and direct-write failure checks evaluate `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` as four individual effective-privilege checks joined with `OR`; they do not rely on a combined privilege string. PUBLIC remains evaluated through ACL expansion.

Current source verification found no unresolved expected-function path: the seven Phase 2B RPCs and the two Phase 4 RPCs all declare `SET search_path = pg_catalog, public, pg_temp`; `is_admin()` and `is_admin_or_moderator()` declare `SET search_path = pg_catalog, pg_temp`. Target-database `proconfig` remains a deployment-time check.

The consolidated grid includes migration-history discovery, exact function identities and ACLs, table/RLS/owner/privilege evidence, role attributes, expected-versus-observed policy inventory, view definitions and privileges, direct-write checks, `public` schema ACLs, database-wide/public default ACLs, and dependent-sequence inventory. A generic static query cannot safely read rows from an arbitrary discovered migration-history table without dynamic SQL, so individual migration-version presence is deliberately reported as `NOT_VERIFIABLE` until a reviewed target-specific follow-up query is approved.

Run [phase_4_deployment_readonly.sql](phase_4_deployment_readonly.sql) only against a controlled disposable database or an approved read-only production session. It contains `SELECT` statements only. It is not migration SQL and does not establish target-database facts by itself.

## Repository-derived expectations

- The eleven Phase 2B tables are in `public` with RLS enabled. The migrations do not request `FORCE ROW LEVEL SECURITY`, so `relforcerowsecurity = false` is expected unless a separately approved deployment change set it.
- The runner now checks each expected function identity by name and argument types, reports a missing expected signature as `expected_signature` with `signature_exists = false`, and reports any other same-name signature as `unexpected_overload`.
- The seven Phase 2B RPCs and both authorization helpers are `SECURITY DEFINER`. Their intended fixed search paths are `pg_catalog, public, pg_temp` for RPCs and `pg_catalog, pg_temp` for helpers.
- Phase 2B revokes RPC/helper execution from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then grants only `authenticated`. Trigger-only functions are not in this audit's callable-RPC set.
- Phase 4 adds `create_own_faculty_review` and `submit_faculty_add_request`, also `SECURITY DEFINER`, with `pg_catalog, public, pg_temp` and `authenticated`-only `EXECUTE`.
- After the Phase 4.2B/4.3 migrations, `authenticated` must not retain direct `INSERT`, `UPDATE`, or `DELETE` on `faculty_reviews` or `faculty_add_requests`; `app_roles` must have no client write path.

## 1. Functions, owners, definer status, and settings

**Query:** section 1 of the SQL runner.

**Safe:** every expected name-and-argument-type signature exists and no `unexpected_overload` rows appear. All listed RPCs/helpers are `SECURITY DEFINER`; `proconfig` contains the expected `search_path`; each function owner is a trusted administrative database role, not `service_role`.

**Dangerous:** a missing expected signature, unexpected overload, missing/floating search path, `SECURITY INVOKER`, an untrusted function owner, or `service_role` owner. Function ownership cannot be established from migrations, so this is a deployment blocker until observed.

## 2. Function EXECUTE privileges

**Query:** section 2.

**Safe:** `authenticated` has effective `EXECUTE`; `PUBLIC`, `anon`, and `service_role` do not. The owner may execute by ownership/implicit privilege.

**Dangerous:** effective execution through `PUBLIC`, direct named-role grants to `anon` or `service_role`, unexpected overloads, or a missing authenticated grant. This addresses public SECURITY DEFINER invocation risk.

## 3. Table ownership and RLS

**Query:** section 3.

**Safe:** all eleven expected tables exist, RLS is enabled, and table ownership belongs to the approved trusted deployment owner. `force_rls = false` is source-consistent but must be considered with the function-owner result.

**Dangerous:** missing tables, disabled RLS, unreviewed table owner, or unexpected `FORCE RLS`. Table ownership is separate from function ownership. An owner subject to forced RLS may be unable to execute a definer function unless a policy permits it.

## 4. Effective table privileges for function owners

**Query:** section 4.

**Safe:** each trusted function owner has only the effective privileges needed by its actual body. In particular, review creation needs `SELECT` on `profiles`/`faculty` and `INSERT` on `faculty_reviews`; review editing needs `UPDATE` on `faculty_reviews`; moderation needs `UPDATE` on reviews plus `INSERT` on `moderation_log`; request submission needs `SELECT` on profiles and `INSERT` on requests; request decision needs its corresponding `SELECT`/`UPDATE`/`INSERT` privileges. Effective privileges are separate from ownership and role bypass attributes.

**Dangerous:** missing required privileges (runtime failure) or broad unnecessary privileges, especially on `app_roles`, private tables, or unrelated objects. This addresses the unresolved SECURITY DEFINER ownership boundary.

## 5. Role bypass attributes

**Query:** section 5.

**Safe:** application client roles are neither superusers nor `BYPASSRLS`; intended function owners are reviewed deliberately. The intended owner must not be `service_role`. `BYPASSRLS`/superuser status is an independent role attribute, not evidence of ownership or an ACL grant.

**Dangerous:** a client role with `rolsuper` or `rolbypassrls`, or a function owner that is untrusted or unexpectedly bypasses RLS without a documented reason.

## 6. Policies

**Query:** section 6.

**Safe:** policy text matches the migration design: `app_roles` has no client write policy; `faculty` management is admin-only; reviews remain selectable by owner/admin; requests remain selectable by owner/admin-or-moderator; moderation log remains admin-selectable. After Phase 4, `reviews_insert_own`, `reviews_delete_own`, and `faculty_requests_insert_own` must be absent.

**Dangerous:** permissive client write policies, absent ownership predicates, retained direct-write policies after Phase 4, or unexpected policies that broaden moderator/client access.

## 7. Views

**Query:** section 7.

**Safe:** the three views have a trusted owner; `reloptions` include `security_barrier=true` and `security_invoker=false`; only `partner_rooms_public` and `faculty_public` allow `anon`/`authenticated` select, while `faculty_reviews_public` allows authenticated select only. The runner reports `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` separately and combines them as `has_any_write_privilege`; all must be false for client roles.

**Dangerous:** a `service_role`/untrusted view owner, changed security options, view write privileges, or public access to `faculty_reviews_public`.

## 8. Remaining direct client writes

**Query:** section 8.

**Safe:** each target reports `exists_in_public = true`; `authenticated`, `anon`, `service_role`, and `PUBLIC` have false for all `INSERT`, `UPDATE`, and `DELETE` checks on `faculty_reviews`, `faculty_add_requests`, and `app_roles`. No former insert/delete policies remain for the first two tables.

**Dangerous:** any true direct client write privilege or surviving write policy. This directly verifies the Phase 4 RPC-only model.

## 9. Schema creation and default ACLs

**Query:** section 9.

**Safe:** untrusted/client roles lack `CREATE` on `public`; only intended roles have required `USAGE`. Both `DATABASE-WIDE` and `public`-schema-specific default ACL rows grant no unexpected privileges on functions/tables to client roles.

**Dangerous:** client `CREATE` on `public` (shadowing risk for `SECURITY DEFINER` functions), or default ACLs that restore broad grants after migrations run.

## Deployment blockers this audit resolves

This evidence is required before enabling Phase 4 database-backed client functionality. It verifies target-specific facts that cannot be proven from source: actual function/table/view ownership, RLS/force-RLS state, effective privileges, role bypass attributes, default ACLs, and whether the Phase 4 revokes/policy drops actually took effect.

It does not authorize migration application, administrator bootstrap, or production deployment. Capture query results separately for the disposable validation database and the production target; do not treat one as evidence for the other.
