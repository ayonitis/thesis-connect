-- Phase 4.2B: make faculty-review writes RPC-only.
-- Apply only after the Phase 2B deployment blockers and trusted SECURITY DEFINER
-- ownership checks have been resolved.

BEGIN;

DROP POLICY reviews_insert_own ON public.faculty_reviews;
DROP POLICY reviews_delete_own ON public.faculty_reviews;

-- Preserve authenticated SELECT for an author's own review and admin moderation,
-- but remove direct Data API writes. Creation and editing use the reviewed RPCs.
REVOKE INSERT, DELETE ON TABLE public.faculty_reviews
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
