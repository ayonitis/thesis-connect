-- Phase 4.5: author-owned review deletion through an authenticated RPC.
-- Keep previous applied migrations unchanged. Deploy only after separate approval.
BEGIN;

CREATE FUNCTION public.delete_own_faculty_review(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  DELETE FROM public.faculty_reviews
  WHERE id = p_review_id AND reviewer_user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found';
  END IF;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.delete_own_faculty_review(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_own_faculty_review(uuid) TO authenticated;

-- Editing remains through update_own_faculty_review; moderation uses its own RPC.
REVOKE UPDATE, DELETE ON TABLE public.faculty_reviews
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
