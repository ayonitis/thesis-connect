# Database Security Architecture

This document describes migration source, not deployed database state.

Phase 2B defines profiles, private student data, roles, partner rooms, applications/contact details/memberships, faculty, reviews, faculty-add requests, and moderation logs. RLS is enabled in the migration source. Public discovery is limited to `partner_rooms_public`, `faculty_public`, and `faculty_reviews_public`.

Authorization helpers `is_admin()` and `is_admin_or_moderator()` are SECURITY DEFINER, derive the user with `auth.uid()`, and use `search_path = pg_catalog, pg_temp`.

The seven Phase 2B RPCs and the two Phase 4 creation RPCs are SECURITY DEFINER with `search_path = pg_catalog, public, pg_temp`. They validate input, derive caller identity from `auth.uid()`, and restrict EXECUTE to authenticated callers. Phase 4 removes legacy direct faculty-review and faculty-add-request write policies and grants.

Function and owner-privileged view ownership must be verified after controlled deployment. The read-only audit under `supabase/audits/` assists catalog review but cannot prove migration order, owner trust, or runtime authorization behavior.

