# Final Phase 2B Security and Migration Review

This document records the corrected local migration proposal, completed disposable PostgreSQL validation, and outstanding production-verification requirements.

**This is not production deployment approval.** No production SQL has been executed, no production migration has been applied, and no production Auth user or role has been modified.

## Final permissions correction (2026-10-29)

The proposal was corrected against the supplied repository files after accounting for the reported broad `public`-schema default ACLs. The correction is intentionally object-scoped: it does not alter Supabase-managed schemas, global/default privileges, the existing `ensure_rls` trigger, or the product architecture.

- Each migration is transaction-bounded. Migration 1 enables RLS and revokes every table privilege from `PUBLIC`, `anon`, `authenticated`, and `service_role` before its newly-created tables become visible at commit. Consequently, the later policy/grant migration is not a window of exposure.
- The same explicit named-role revokes apply to the two trigger functions, the two authorization helpers, all privileged RPCs, and all three views. This counters both `PUBLIC` ACL entries and direct default grants.
- Only intended grants are restored: `authenticated` can execute the authorization helpers and authorized RPCs; `anon`/`authenticated` can select public room and faculty discovery views; only `authenticated` can select the public review view.
- `set_updated_at` and `handle_new_user` are trigger-only: `PUBLIC`, `anon`, `authenticated`, and `service_role` receive no `EXECUTE`. PostgreSQL executes a trigger function through its trigger and does not require a client-role `EXECUTE` grant.
- `service_role` receives no direct Phase 2B table, view, or function grant. The reviewed application code uses user-context RPCs and has no documented service-role data path. This is deliberate least privilege, not an assumption that a `PUBLIC` revoke removes its direct default ACL; any future trusted backend path must receive a separately reviewed, object-specific grant.
- `faculty_public` may be automatically updatable because it is a single-table view. It remains safe only because all seven table/view write-related privileges are explicitly revoked from every client role; the verification script tests each effective privilege. The room view (aggregate/subquery) and review view (join) are not automatically updatable.
- Trigger functions remain non-executable by client roles. PostgreSQL invokes them through their triggers; client `EXECUTE` is neither required nor granted.

## Migration order and ownership boundary

1. `20261028190000_phase_2b_schema.sql`: tables, constraints, indexes, triggers, and future-signup profile initialization.
2. `20261028190100_phase_2b_rls_and_views.sql`: RLS, Thesis Connect-scoped grants/revokes, and minimal read views.
3. `20261028190200_phase_2b_secure_rpcs.sql`: restricted mutation RPCs.
4. `20261031120000_phase_4_2a_create_own_faculty_review.sql`: a separately authored Phase 4.2A extension for first-review creation. It must be applied only after Phase 2B and its deployment blockers are resolved; it has not been deployed or runtime-tested.
5. `20261031121000_phase_4_2b_faculty_review_rpc_only.sql`: removes the direct authenticated review INSERT/DELETE grants and owner write policies so review creation/editing use their restricted RPCs. It is authored only and not deployed.
6. `20261031122000_phase_4_3_submit_faculty_add_request.sql`: adds authenticated `submit_faculty_add_request(text, text, text[], text) returns uuid`, removes direct request INSERT, and prevents duplicate matching pending requests per requester. It is authored only and not deployed.

Do not change this sequence or apply it until the read-only remote evidence is reconciled. A remote object with a conflicting name, owner, definition, policy, or migration history is a stop condition—not permission to drop, replace, or alter it.

## Review visibility, anonymity, and view security

- `faculty_reviews_public` is available to **authenticated users only**. `anon` is explicitly revoked and has no direct table grant, review RPC, or alternate view that returns review content.
- The review view emits only faculty ID, fixed `Anonymous Student`, the four 1–10 scores, and review text. It omits review ID, reviewer UUID, profile data, student ID, contact link, timestamps, moderation status, moderator identity, and moderation-log data.
- Anonymous labeling does not prevent self-identification in review text. Students must not include identifying details in free text.
- Administrators can read the `faculty_reviews` base table, including reviewer identity, solely for authorized moderation/abuse handling. Ordinary moderators cannot read that table and do not automatically receive reviewer identity access. Moderators have no hide/publish RPC; moderation remains admin-only.
- `partner_rooms_public` and `faculty_public` remain deliberately readable by `anon` and `authenticated`, matching public room/faculty discovery. Their projections exclude student IDs, contact links, applications, memberships, reviewer data, and faculty research interests.
- All three views use `security_invoker = false` because callers intentionally lack base-table `SELECT`. This is an owner-privileged, minimal-projection boundary, not a general RLS bypass. After an approved deployment, verification must confirm trusted function and view ownership, PostgreSQL support for the option, resulting reloptions, definitions, and effective grants. Ownership is not established by this document or by local validation.

## Scoped privilege model

The RLS migration no longer revokes privileges from every table or sequence in `public`. It explicitly revokes only the eleven Thesis Connect base tables and the proposal's functions/views. This proposal creates UUID defaults with `gen_random_uuid()` and therefore creates no Thesis Connect sequence; no sequence privilege statement is needed. It makes no `ALTER DEFAULT PRIVILEGES` change.

| Object | Direct authenticated access | Identity/privacy boundary |
|---|---|---|
| profiles | Own select/update; admin/moderator select | Roles are not profile fields. |
| student_private | Own select/insert/update; admin select | Student ID is never public or moderator-wide. |
| app_roles | None | Controlled trusted-operator first-admin bootstrap or separately approved trusted database administration; no client table grant or role-assignment RPC. |
| partner_rooms | Host/admin/moderator select | Creation is RPC-only. |
| room_join_applications | Applicant, room host, admin/moderator select | No client INSERT/UPDATE; RPC-only mutations. |
| room_application_private_details | Accepted applicant/host/admin/moderator select | Contact link remains hidden until acceptance. |
| room_memberships | Participant/host/admin/moderator select | No membership identity in public room view. |
| faculty | Admin select/insert/update | Official records are admin-managed; no routine delete grant. |
| faculty_reviews | Owner/admin select; owner insert/delete | Only admin can see reviewer identities beyond the owner. |
| faculty_add_requests | Requester select/insert; admin/moderator select | Official creation is admin-only RPC. |
| moderation_log | Admin select | Not student- or moderator-readable. |

## Profile and room creation

`create_partner_room` derives the caller from `auth.uid()`, reads only that caller's profile, and requires a nonblank display name plus an approved department. It explicitly validates title/description, completed credits (0–1000), optional CGPA (0–4), `show_host_cgpa` consistency, room capacity, teammate department, teammate CGPA range, minimum credits, and additional-info length before inserting.

Host name/department are snapshotted from the profile. Host completed credits are supplied by the authenticated caller but constrained by the existing domain range. A host is inserted exactly once as a `room_memberships` row. `additional_members_needed` means accepted members beyond this host. `partner_rooms_public.member_count` counts all current memberships, including the host and accepted members; it is not an additional-member count. The profile trigger creates a default profile only for future Auth users; profile completion UI is not implemented in this phase, and existing users require a separately reviewed backfill plan.

## Application, capacity, review, and faculty-request controls

- `submit_room_application` validates all caller-supplied application fields, locks an open room for the check, rejects host self-application, and preserves one permanent `(room_id, applicant_user_id)` record.
- `withdraw_room_application` locks the application and permits only its owner's pending-to-withdrawn transition. It cannot rewrite application answers, identity, contact data, room, or decision data.
- `decide_room_application` locks application and room rows. Only the host or an admin may accept/reject a pending request. Acceptance counts `member` rows, atomically inserts a membership, rejects overflow, and never auto-rejects unrelated pending applications.
- `create_own_faculty_review` is authored in the separate Phase 4.2A migration but is **not deployed**. It derives the reviewer from `auth.uid()`, requires a matching profile plus an active faculty ID, validates four 1–10 ratings and a 10–5,000 character description, stores the trimmed description, inserts only schema-required review fields, and returns the inserted UUID. It accepts no caller-controlled reviewer UUID or moderation fields. The schema-declared unnamed `(faculty_id, reviewer_user_id)` unique constraint receives PostgreSQL's generated name `faculty_reviews_faculty_id_reviewer_user_id_key`; only violation of that constraint is translated to `review already exists for this faculty`, while any other unique violation is re-raised unchanged. Phase 4.2B removes direct review INSERT/DELETE and the corresponding write policies; `SELECT` ownership and admin moderation access remain unchanged.
- `submit_faculty_add_request` is authored in the separate Phase 4.3 migration but is **not deployed**. It derives the requester from `auth.uid()`, requires a profile, validates name, department, and rationale against the existing schema contract, preserves the pending default, and returns the request UUID. It accepts no requester, decision, status, or faculty-creation input. The migration removes direct request INSERT and only translates the new matching-pending-request unique-index conflict.
- `update_own_faculty_review` requires ownership from `auth.uid()` and changes only four required 1–10 scores and description. It cannot republish a hidden review or alter moderation fields.
- `moderate_faculty_review` is admin-only; it publishes/hides reviews and writes an admin-only log. Review author deletion remains allowed by the product decision and does not expose identity publicly.
- `decide_faculty_add_request` is admin-only. Approval locks a pending request, creates an official validated faculty row with a request-suffixed deterministic slug, and links it atomically through `created_faculty_id`; a normalized-name-and-department unique index prevents duplicate official records even when duplicate requests are approved concurrently. Rejection creates no faculty row.

The authorization helpers fix `search_path` to `pg_catalog, pg_temp`. `handle_new_user` and each client-facing RPC fix it to `pg_catalog, public, pg_temp`, with `pg_temp` explicitly last. Every `SECURITY DEFINER` function derives identity from `auth.uid()` where applicable, validates controlled inputs, has `PUBLIC` EXECUTE revoked, and is executable only by `authenticated` callers subject to internal authorization. Trigger-only functions are not granted client-role `EXECUTE`. No function returns student IDs, contact links, reviewer IDs, or private profile records.

## First administrator and existing users

`manual/FIRST_ADMIN_BOOTSTRAP.md` remains a controlled operator-only procedure. It does not create a user, change Auth configuration, or run automatically.

Before it is used:

1. An authorized operator independently identifies the intended, already-created Auth user UUID in the Supabase Dashboard.
2. The operator confirms that a matching `public.profiles` row exists.
3. The operator executes the separately reviewed bootstrap statement under trusted SQL Editor access.
4. The resulting role is independently verified and recorded.

Existing Auth users may require a separately reviewed profile-backfill procedure. The existing production Auth user must be preserved. No administrator role is assigned automatically by these migrations.

## Read-only verification evidence required

Run `verify/remote_schema_readonly.sql` manually in the Supabase SQL Editor. It uses only catalog/information-schema `SELECT` statements and captures object inventory, proposal conflicts, columns, constraints, indexes, sequences, RLS/FORCE RLS, policies, object/default privileges, view definitions/owners/reloptions, functions/owners/security/search paths/EXECUTE ACLs, triggers, extensions, and migration-history candidates.

Its Phase 2B matrices show both direct ACL grants and effective privileges for `PUBLIC`, `anon`, `authenticated`, and `service_role`; this distinguishes inherited/`PUBLIC` access from a direct named-role ACL.

Migration history is discovery-only: inspect returned candidate relations and columns first, then compose a separate read-only history query using exactly those discovered names. Do not assume a CLI history table, custom history table, schema, or column names. Catalog results may be incomplete if the SQL Editor role lacks visibility; capture and report any missing or permission-limited result set.

Before deployment, explicitly reconcile any `public`-schema default ACL that grants to `PUBLIC`, `anon`, `authenticated`, or `service_role`. The migrations counter such grants only for their named objects; they intentionally do not change global default privileges.

## Remaining blockers before any migration application

1. The complete remote schema, PostgreSQL version/support for view options, object owners, grants, default ACLs, and application migration history still require reconciliation.
2. Any existing object conflicts must be reconciled through a separately reviewed plan; this proposal does not overwrite remote definitions.
3. Existing Auth users may require profile backfill, which is intentionally not included in the migrations.
4. The separate Drizzle/direct-Postgres health path (`src/db/schema.ts`, `drizzle.config.json`, and the health route) remains unresolved and must not compete with Supabase migrations as schema authority.
5. Production deployment still requires a separately approved execution and recovery plan.
6. Before enabling review submission, verify that the trusted, non-`service_role` owner of `create_own_faculty_review` and `update_own_faculty_review` has only the table privileges it needs and can perform its writes under the deployed RLS configuration; verify their fixed `proconfig`, ownership, and `FORCE ROW LEVEL SECURITY` behavior. Phase 4.2B is the separately authored source correction that removes direct authenticated review writes; verify its effective ACLs and policies after deployment before enabling the client form.
7. Application-level integration and build blockers remain separate from database migration validation.

## Local validation record

- Reviewed every proposal migration, the verification script, bootstrap procedure, department definitions, Drizzle configuration, and package scripts.
- All three corrected Phase 2B migrations were successfully applied in a disposable PostgreSQL 17 validation database.
- The prior review recorded a disposable catalog/security validation result of **59 PASS, 0 FAIL, 0 REVIEW**; its underlying report artifact is not among the files reviewed for this closure audit.
- The prior review recorded functional validation of **58 PASS, 0 FAIL, 0 REVIEW**; the available report artifact is described in the historical-evidence note below.
- PowerShell validation runner scripts parsed with zero syntax errors.
- Validation fixtures and test artifacts were rolled back. No test data remains in the clean validation database.
- These results establish local migration and security-test compatibility. They do not establish production compatibility or authorize deployment.
- No production migration, SQL modification, seed, or role assignment has been performed.

This is historical evidence, not a rerun against the final source revision. The available catalog report artifact records **61 PASS, 0 FAIL, 0 REVIEW** on `localhost:5433/thesis_connect_test` on 2026-10-30, while the historical functional report records **58 PASS, 0 FAIL, 0 REVIEW** with rollback verified on the same local target. Neither report was rerun during the final closure audit. The current catalog test source still expects `search_path=pg_catalog, public`, while the final hardened migrations require `pg_catalog, public, pg_temp`; its report also predates removal of `grant_app_role()` from the production migration set. It must be updated and rerun against a disposable database before it can be used as final-runtime evidence for this revision.

## Transaction strategy

Each migration file contains an explicit `BEGIN`/`COMMIT` block. The corrected migrations were successfully applied as standalone SQL scripts in the disposable PostgreSQL 17 validation environment, exercising the intended transaction strategy.

Migration 1 creates tables, enables RLS, and removes default-derived object grants before its commit; migrations 2 and 3 likewise create/revoke/grant views and functions before their commits. These wrappers are defense in depth, not the only control: every object still has its own explicit final ACL and RLS/policy definition.

## Final closure-audit addendum (2026-10-31)

- **Final source implementation:** PASS. The eleven application tables, constraints, foreign keys, indexes, triggers, eleven RLS enables, sixteen policies, three owner-privileged minimal-projection views, two authorization helpers, and seven client-facing RPCs were inspected. No new source-level migration defect was identified.
- **SECURITY DEFINER hardening:** PASS. `is_admin()` and `is_admin_or_moderator()` retain `pg_catalog, pg_temp`; `handle_new_user()` and all seven client-facing RPCs use `pg_catalog, public, pg_temp`, with `pg_temp` explicitly last. `set_updated_at()` remains a non-definer trigger function.
- **Privilege and role-assignment boundary:** PASS at source level. Client execution is explicitly revoked before intended grants, no `grant_app_role()` function remains in the migration set, and first-admin assignment remains a trusted-operator-only procedure. The existing Auth user requires a matching `public.profiles` row through a separately reviewed backfill before the bootstrap insert can succeed.
- **Static evidence rerun during this audit:** the two PowerShell runners parsed without syntax errors; `verify/remote_schema_readonly.sql` was inspected and contains no mutating statement prefix; the current functional source retains its transaction, rollback verification, runtime fixture UUID, JWT-claim, and no-role-assignment-RPC checks. No database test, migration, or remote query was run during this audit.
- **Historical traceability limitation:** the supplied project directory has no `.git` metadata. No Git diff was available, and no history was reconstructed or fabricated. Current source was inspected directly, but historical report artifacts cannot be cryptographically bound to the final source revision.
- **Deployment blockers remain:** after an approved deployment, verify the trusted owners and `proconfig` of every SECURITY DEFINER function and helper; direct and effective function ACLs; trusted view owners and `security_barrier`/`security_invoker` reloptions; table ACLs, RLS, and policies; trigger definitions; and that untrusted roles lack `CREATE` on `public`. Do not use `service_role` as the intended SECURITY DEFINER owner. Reconcile default ACLs, migration history, PostgreSQL/view-option compatibility, and the approved execution/recovery plan before deployment.

## Verdict

`FINAL_SOURCE_REVIEW_PASSED_PENDING_DEPLOYMENT_BLOCKERS`

This is not `READY_TO_APPLY`.

Before any production migration:

1. Complete and review the remote read-only verification evidence.
2. Reconcile existing object inventory, ownership, default privileges, function/view permissions, and migration-history findings.
3. Confirm the production PostgreSQL version and compatibility with the proposed view options.
4. Preserve the existing Auth user and separately establish the required profile and first-admin bootstrap plan.
5. Resolve the migration execution and recovery plan.
6. Obtain explicit production deployment approval.

Only after these requirements have been satisfied should the three migrations be considered for production application, in the exact sequence documented above.
