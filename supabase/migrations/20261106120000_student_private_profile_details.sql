-- Student profile details: author locally; separately approve development execution.
-- Apply after baseline versions 1-8 and 20261105120000_brac_email_eligibility.
-- This is a new migration, not permission to run the older blocked drafts/proposal.
BEGIN;

-- Preserve proposal safety intent: require the reviewed existing private relation
-- and BRAC policy; never create a substitute table, repair RLS or skip conflicts.
DO $student_profile_prerequisites$
BEGIN
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'STOP: reviewed postgres migration executor required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
    WHERE oid=pg_catalog.to_regclass('public.student_private') AND relkind='r'
      AND relowner='postgres'::regrole AND relrowsecurity) THEN
    RAISE EXCEPTION 'STOP: expected RLS-protected student_private baseline required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid='public.student_private'::regclass AND polname='brac_eligibility'
      AND NOT polpermissive AND polcmd='*'
      AND polroles=ARRAY['authenticated'::regrole::oid])
    OR pg_catalog.to_regprocedure('public.current_user_is_brac_eligible()') IS NULL THEN
    RAISE EXCEPTION 'STOP: prior BRAC eligibility migration must be verified first';
  END IF;
END;
$student_profile_prerequisites$;

-- Nullable with no defaults: existing students keep NULL until they answer.
-- Existing student_private ownership policies, grants and timestamp trigger apply.
-- Do not use IF NOT EXISTS: pre-existing columns must stop for explicit review.
ALTER TABLE public.student_private
  ADD COLUMN cgpa numeric(3,2),
  ADD COLUMN current_semester text,
  ADD COLUMN brac_like text,
  ADD CONSTRAINT student_private_cgpa_range
    CHECK (cgpa IS NULL OR cgpa BETWEEN 0 AND 4),
  ADD CONSTRAINT student_private_current_semester_length
    CHECK (current_semester IS NULL OR char_length(btrim(current_semester)) BETWEEN 1 AND 40),
  ADD CONSTRAINT student_private_brac_like_length
    CHECK (brac_like IS NULL OR char_length(btrim(brac_like)) BETWEEN 1 AND 500);

COMMIT;
