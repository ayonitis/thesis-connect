-- Phase 4.2A: authenticated student review creation.
-- This migration is authored only; do not apply it until the Phase 2B deployment
-- blockers and the separately approved production execution plan are resolved.

BEGIN;

CREATE FUNCTION public.create_own_faculty_review(
  p_faculty_id uuid,
  p_clarity smallint,
  p_responsiveness smallint,
  p_fairness smallint,
  p_workload smallint,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_review_id uuid;
  v_constraint_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = v_user
  ) THEN
    RAISE EXCEPTION 'profile is required';
  END IF;

  IF p_clarity IS NULL
     OR p_responsiveness IS NULL
     OR p_fairness IS NULL
     OR p_workload IS NULL
     OR p_clarity NOT BETWEEN 1 AND 10
     OR p_responsiveness NOT BETWEEN 1 AND 10
     OR p_fairness NOT BETWEEN 1 AND 10
     OR p_workload NOT BETWEEN 1 AND 10
     OR p_description IS NULL
     OR char_length(trim(p_description)) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'invalid review content';
  END IF;

  IF p_faculty_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.faculty
       WHERE id = p_faculty_id
         AND is_active
     ) THEN
    RAISE EXCEPTION 'active faculty not found';
  END IF;

  INSERT INTO public.faculty_reviews (
    faculty_id,
    reviewer_user_id,
    clarity,
    responsiveness,
    fairness,
    workload,
    description
  )
  VALUES (
    p_faculty_id,
    v_user,
    p_clarity,
    p_responsiveness,
    p_fairness,
    p_workload,
    trim(p_description)
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;

    IF v_constraint_name = 'faculty_reviews_faculty_id_reviewer_user_id_key' THEN
      RAISE EXCEPTION 'review already exists for this faculty';
    END IF;

    RAISE;
END;
$$;

-- Counter both PUBLIC defaults and direct named-role defaults before restoring
-- the one intended client grant. The migration executor must be a trusted
-- function owner with the necessary table privileges; verify ownership after deployment.
REVOKE ALL PRIVILEGES ON FUNCTION public.create_own_faculty_review(
  uuid, smallint, smallint, smallint, smallint, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_own_faculty_review(
  uuid, smallint, smallint, smallint, smallint, text
) TO authenticated;

COMMIT;
