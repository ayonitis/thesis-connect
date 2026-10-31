-- Phase 4.3: authenticated student faculty-addition request submission.
-- This migration is authored only; do not apply it before Phase 2B deployment
-- blockers, trusted function ownership, and execution planning are resolved.

BEGIN;

CREATE UNIQUE INDEX faculty_add_requests_one_pending_per_requester_idx
  ON public.faculty_add_requests (
    requester_user_id,
    lower(btrim(proposed_name)),
    proposed_department
  )
  WHERE status = 'pending';

CREATE FUNCTION public.submit_faculty_add_request(
  p_proposed_name text,
  p_proposed_department text,
  p_proposed_research_interests text[],
  p_rationale text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request_id uuid;
  v_constraint_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = v_user
  ) THEN
    RAISE EXCEPTION 'profile is required';
  END IF;

  IF p_proposed_name IS NULL
     OR char_length(trim(p_proposed_name)) NOT BETWEEN 2 AND 200
     OR p_proposed_department IS NULL
     OR p_proposed_department NOT IN ('CSE', 'CS', 'EEE', 'ESS', 'ARCH', 'PHARMACY', 'BBS')
     OR p_rationale IS NULL
     OR char_length(trim(p_rationale)) NOT BETWEEN 10 AND 3000 THEN
    RAISE EXCEPTION 'invalid faculty request input';
  END IF;

  INSERT INTO public.faculty_add_requests (
    requester_user_id,
    proposed_name,
    proposed_department,
    proposed_research_interests,
    rationale
  ) VALUES (
    v_user,
    trim(p_proposed_name),
    p_proposed_department,
    coalesce(p_proposed_research_interests, '{}'::text[]),
    trim(p_rationale)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'faculty_add_requests_one_pending_per_requester_idx' THEN
      RAISE EXCEPTION 'a matching faculty request is already pending';
    END IF;
    RAISE;
END;
$$;

-- Remove the former direct client insert path. SELECT remains available through
-- the existing own-or-admin RLS policy; only this RPC creates requests.
DROP POLICY faculty_requests_insert_own ON public.faculty_add_requests;
REVOKE INSERT ON TABLE public.faculty_add_requests
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.submit_faculty_add_request(
  text, text, text[], text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_faculty_add_request(
  text, text, text[], text
) TO authenticated;

COMMIT;
