# Thesis Connect — Phase 2B + Phase 4 Final Security Review

## Executive verdict: APPROVED_WITH_BLOCKERS

The current repository source implements the intended Phase 2B and Phase 4 security design, including the Phase 4 RPC-only paths and a forward-only reconciliation migration for previously deployed Phase 2B RPC search paths. This is a source-level conclusion only. It does not establish that any database, including production, has received these migrations or has safe function/view ownership.

Production deployment is not approved by this review. The deployment blockers are trusted ownership, target-catalog verification, administrator activation, and a separately authorized migration execution plan.

## Evidence boundaries

- Inspected: repository SQL migrations, existing audit scripts, security-test artifacts, bootstrap instructions, Supabase data-layer code, and application RPC call sites.
- Not performed: database connection, SQL execution, migration application, test execution, production access, bootstrap, credential inspection, or Supabase configuration changes.
- Historical local audit CSV evidence showed an older disposable database state: Phase 4 functions absent, legacy direct-write paths retained, and seven Phase 2B RPC paths lacking explicit `pg_temp`. Those are catalog observations, not proof of production state.
- Git history is unavailable in the supplied project directory; this review does not reconstruct or fabricate a diff.

## Audit-script correction record

The production audit now treats `handle_new_user()` as an expected SECURITY DEFINER trigger function but excludes it from client RPC EXECUTE expectations. The seven Phase 2B RPCs, two Phase 4 RPCs, and both authorization helpers retain the authenticated-versus-client-role effective EXECUTE matrix.

Function and view findings now include owner name plus `rolsuper`, `rolbypassrls`, and `rolcanlogin`; ownership by `service_role` is a failure. Other owners are reported, not presumed trusted. An operator must judge the actual owner and its effective table privileges.

The audit emits individual default-ACL entries with grantor, scope, internal object type, grantee, privilege, and grant-option state. Client-role defaults are warnings; a default ACL’s mere existence is informational.

The audit reports complete deployed policy definitions, including `USING` and `WITH CHECK`, but source-equivalence of deparsed expressions remains `NOT_VERIFIABLE`. Trigger and constraint catalog inventories are emitted for manual source comparison; this script does not claim a source-equivalence PASS where catalog formatting or a complex expected set cannot be safely compared statically.

The audit now extracts the `search_path` entry from `pg_proc.proconfig` and compares it exactly rather than with a substring match. A missing path entry or any different value is a warning; the distinct expected values remain `pg_catalog, public, pg_temp` for nine client RPCs, `pg_catalog, pg_temp` for both helpers, and `pg_catalog, public, pg_temp` for `handle_new_user()`.

Ownership is reported separately from function/view configuration. `service_role` ownership is a failure. Superuser or BYPASSRLS ownership is a warning requiring operator review. Any other owner remains `NOT_VERIFIABLE` for trust: role attributes alone cannot establish that the owner is approved, minimally privileged, or appropriate for SECURITY DEFINER/view-owner behavior. Default-ACL entries now distinguish `defaclrole` (the default-privilege owner) from the actual grantor returned by `aclexplode()`.

The `existence_owner_rls` table inventory now also reports each table owner’s `rolsuper`, `rolbypassrls`, and `rolcanlogin` attributes. These fields are inventory evidence only; they do not establish that ownership is trusted or that RLS cannot be bypassed through another role path.

## Migration order and dependency map

| Order | Migration | Purpose and dependencies |
|---|---|---|
| 1 | `20261028190000_phase_2b_schema.sql` | Creates 11 application tables, constraints/indexes, UUID defaults, `set_updated_at`, `handle_new_user`, triggers, RLS enablement, and initial object revokes. Requires `auth.users` and `pgcrypto`. |
| 2 | `20261028190100_phase_2b_rls_and_views.sql` | Creates authorization helpers, policies, grants, and three public views. Depends on Phase 2B schema and `auth.uid()`. |
| 3 | `20261028190200_phase_2b_secure_rpcs.sql` | Creates seven authenticated SECURITY DEFINER RPCs and their ACLs. Depends on schema, helper functions, and policies. |
| 4 | `20261031120000_phase_4_2a_create_own_faculty_review.sql` | Adds review creation RPC. Depends on profiles, faculty, reviews, and Phase 2B ACL/RLS design. |
| 5 | `20261031121000_phase_4_2b_faculty_review_rpc_only.sql` | Removes legacy review insert/delete policies and direct table privileges. Must follow Phase 4.2A. |
| 6 | `20261031122000_phase_4_3_submit_faculty_add_request.sql` | Adds request-submission RPC, duplicate guard, removes legacy insert policy/privilege. Depends on Phase 2B tables. |
| 7 | `20261031123000_phase_4_4_harden_phase_2b_rpc_search_paths.sql` | Forward-only `ALTER FUNCTION ... SET search_path` reconciliation for seven legacy RPCs. Depends on exact pre-existing signatures. |

A clean database using current source receives the desired RPC paths during Phase 2B migration 3. An existing database that applied an older revision needs Phase 4.4 because historical migration text is not re-run.

## Phase 2B review

### Schema, RLS, triggers, and views

PASS — The schema migration defines profiles, student-private data, single-admin roles, partner rooms, applications, memberships, faculty, reviews, faculty requests, and moderation logs with primary keys, foreign keys, uniqueness checks, status checks, and relevant indexes.

PASS — RLS is enabled on all 11 application tables before commit. Table and trigger-function privileges are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role` in the schema transaction. Phase 2B RLS migration reasserts the same baseline before grants/policies.

PASS — `handle_new_user()` is SECURITY DEFINER with `pg_catalog, public, pg_temp`; it only creates an idempotent profile and only reads display name metadata. It does not assign roles. `set_updated_at()` is not SECURITY DEFINER and only assigns `updated_at`.

PASS — The three views use `security_barrier=true` and `security_invoker=false`. Their projections omit private IDs, contacts, applicant data, and review authors. `partner_rooms_public.member_count` includes host membership plus accepted members.

REVIEW — Views intentionally use owner privileges because callers lack base-table access. A trusted view owner must be verified after deployment. `security_invoker=false` is deliberate; changing it would break the access model.

### Authorization helpers

PASS — `is_admin()` and `is_admin_or_moderator()` derive identity from `auth.uid()`, query fully-qualified `public.app_roles`, fail closed, are SECURITY DEFINER, and set `search_path = pg_catalog, pg_temp`.

REVIEW — Their execution is granted to `authenticated`, which is acceptable only because they return a caller-scoped boolean and policies/RPCs perform the real authorization. The production function owner, effective table privileges, and RLS-bypass capability require catalog verification.

### Seven Phase 2B RPCs

| RPC | Source finding |
|---|---|
| `create_partner_room` | PASS: derives host identity/profile from `auth.uid()`, validates room input, creates host membership, returns UUID. |
| `submit_room_application` | PASS: derives applicant identity, validates input, locks/checks open room, blocks host self-application, creates application/private contact data. |
| `withdraw_room_application` | PASS: locks application; only authenticated applicant may withdraw a pending record. |
| `decide_room_application` | PASS: locks application and room; requires host or admin, prevents closed/full acceptance, creates membership and audit log. |
| `update_own_faculty_review` | PASS: requires auth, validates ratings/text, restricts update by `reviewer_user_id = auth.uid()`. |
| `decide_faculty_add_request` | PASS: requires `is_admin()`, locks pending request, validates decision, creates faculty only on approval, logs action. |
| `moderate_faculty_review` | PASS: requires `is_admin()`, validates visibility, updates only moderation state/audit fields, logs action. |

All seven are `SECURITY DEFINER`, authenticate with `auth.uid()`, use schema-qualified application tables, have no dynamic SQL, and are revoked from `PUBLIC`, `anon`, and `service_role` before `authenticated` is granted execution. Phase 4.4 preserves their bodies, ACLs, and security mode while explicitly reconciling their paths to `pg_catalog, public, pg_temp`.

## Phase 4 review

### `create_own_faculty_review`

PASS — `20261031120000_phase_4_2a_create_own_faculty_review.sql` creates the exact expected signature, returns the inserted UUID, derives reviewer identity from `auth.uid()`, requires a profile and active faculty, validates four ratings (1–10) and trimmed description length (10–5,000), inserts no caller-controlled moderation fields, and only translates the expected `(faculty_id, reviewer_user_id)` unique violation.

PASS — The function revokes default/direct execution from all client roles then grants only `authenticated`.

### RPC-only faculty reviews

PASS — `20261031121000_phase_4_2b_faculty_review_rpc_only.sql` removes `reviews_insert_own` and `reviews_delete_own`, then revokes direct `INSERT, DELETE` from all client roles. Read and administrator moderation paths remain.

### `submit_faculty_add_request`

PASS — `20261031122000_phase_4_3_submit_faculty_add_request.sql` creates the exact expected signature, derives identity from `auth.uid()`, requires a profile, validates permitted departments and text bounds, controls status through defaults, catches only the expected pending-duplicate constraint, and returns the inserted UUID.

PASS — It drops `faculty_requests_insert_own` and revokes direct `INSERT` for all client roles while granting RPC execution only to `authenticated`.

## Application compatibility

PASS — `src/lib/data/faculty.ts` calls `create_own_faculty_review`, `update_own_faculty_review`, `submit_faculty_add_request`, `decide_faculty_add_request`, and `moderate_faculty_review`; it contains no direct mutation of `faculty_reviews`, `faculty_add_requests`, or `app_roles`.

PASS — Partner Room mutations use the corresponding seven RPCs. Public discovery uses `partner_rooms_public`; hosted/application reads use RLS-protected tables.

REVIEW — Client-side admin checks are a usability guard only. Server-side RPC and RLS authorization remains authoritative, as required.

## Confirmed blockers and required actions

1. **Trusted ownership is unverified.** Before deployment, verify every SECURITY DEFINER function and owner-privileged view owner, `proconfig`, ACL, effective table privileges, `rolsuper`, and `rolbypassrls`. Do not designate `service_role` as the owner.
2. **Production catalog state is unverified.** Run the new read-only audit manually in the intended production SQL editor and export all rows. Confirm identity first.
3. **Administrator activation remains separate.** The migrations do not assign an administrator. Follow `supabase/manual/FIRST_ADMIN_BOOTSTRAP.md` only through a separately approved trusted-operator procedure after confirming the existing Auth user/profile.
4. **Forward reconciliation is required for existing old deployments.** Apply Phase 4.4 only through a separately authorized plan after its exact function identities have been catalog-verified.
5. **Default ACLs require operational controls.** Broad named-role defaults can affect future objects; object-specific same-transaction revokes remain mandatory.

## Production audit instructions

1. Open the target project’s SQL editor in a read-only approved session.
2. Paste [`supabase/audits/thesis_connect_phase_2b_phase_4_production_readonly_audit.sql`](supabase/audits/thesis_connect_phase_2b_phase_4_production_readonly_audit.sql).
3. Confirm the first `identity/current_session` row is the intended target. A PostgreSQL database name cannot prove the project reference.
4. Export the complete single result set to CSV. Do not filter out `INFO`, `WARNING`, or `NOT_VERIFIABLE` rows.
5. Treat any `FAIL`, `BLOCKER`, unexpected `WARNING`, or identity discrepancy as a stop condition.

## Local validation plan — do not run as part of this review

1. Use only separately authorized PostgreSQL 17 disposable database `thesis_connect_clean_validation` on port 5433.
2. Verify server identity, database name, user, and empty/preapproved baseline before any write.
3. Apply migrations in the order above. Test a clean database and, separately, an already-migrated Phase 2B reconciliation path.
4. Verify catalog identity/signatures/paths/ACLs/RLS/views/triggers with the audit script.
5. Run functional tests for anonymous, authenticated, ordinary student, admin, and no-profile cases; include cross-user write attempts, duplicate requests/reviews, inactive faculty, full/closed rooms, direct table writes, and RPC execute denial.
6. Verify rollback leaves no synthetic records. Runtime tests must use disposable fixtures only.

## Final readiness assessment

- **Phase 2B source:** approved with deployment blockers.
- **Phase 4 source:** approved with deployment blockers.
- **Local migration validation:** not yet established by this review; requires separately authorized clean and reconciliation validation.
- **Production deployment:** not approved. It requires a reviewed execution plan, trusted ownership confirmation, administrator activation plan, and a successful complete post-deployment read-only audit.
