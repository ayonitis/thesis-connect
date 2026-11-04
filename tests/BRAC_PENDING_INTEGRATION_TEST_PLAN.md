# Pending real Auth/database validation — not executed

These are acceptance scenarios, not automated passing tests. Ten `test.todo` entries in the offline suite track them. No SQL, Auth accounts, network clients or application startup is permitted in the current task. A local `auth.uid()` shim would not close these gaps.

Before execution: independent review of the draft, compatible application-capable atomic executor, a verified development-only harness, enforceable writer/test gates, protected runtime/manifest, exact execution-role privileges, approved synthetic accounts/mailboxes and fixture cleanup journal, and separate execution approval.

| Scenario | Required assertions |
|---|---|
| Password creation | Approved domain may create before confirmation; forbidden domain/plus address rejected through direct Auth REST; reject leaves no user/profile; allowed user has exactly one profile |
| Google | Real first-user creation, repeat login, missing email, provider verification, linked existing identities and mismatched primary/provider emails; no automatic user deletion |
| Confirmation/tokens | Unconfirmed Auth sessions cannot read protected data; confirmation permits eligibility; expired/invalid JWT rejected by real ingress; token issuance to legacy accounts is not claimed prohibited |
| Restrictive RLS | All eleven tables deny unauthorized/currently unverified/anonymous user using actual JWT, including prior owner/admin/moderator; eligible user retains original ownership constraints |
| Definer RPCs | All ten business RPCs and both role helpers enforce eligibility; exact signature, owner, ACL, search path and original author/host/moderation checks preserved |
| Authenticated view | faculty_reviews_public denies eligibility; no reviewer identifiers added; view-owner privileges cannot omit caller predicate |
| Public projections | Anonymous and ineligible callers retain intended faculty_public/partner_rooms_public data; hidden/private contacts remain absent; compare rowsets under trusted view owner |
| Owner/Auth compatibility | Full managed Auth trigger definitions/order, schema/function/column privileges, Auth-table RLS behavior for dedicated reader, role flags/memberships, invoker/definer execution and before-insert rollback; never grant bypass casually |
| Changes/concurrency | Allowed-to-forbidden primary email change denies next statement despite stale JWT; unconfirmed change state fails closed as intended; document in-flight statement snapshot limit and account-link policy |
| Browser/Next | Server layout denial, client navigation with reused layouts, cookie propagation and failed cleanup, malformed callbacks and proxy origins; protected loaders still independently guard requests |

The new SQL draft deliberately raises BLOCKED before any DDL. Its managed Auth creation gate is not implemented. Review and replace that barrier only under a separately approved change after compatibility evidence exists; this document is not permission to remove it or execute the draft.
