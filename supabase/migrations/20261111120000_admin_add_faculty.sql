-- Apply after the designated-admin migration.
BEGIN;

ALTER TABLE public.faculty
  ADD COLUMN designation text CHECK (designation IS NULL OR char_length(designation) BETWEEN 1 AND 120),
  ADD COLUMN email text CHECK (email IS NULL OR (
    char_length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ));

CREATE FUNCTION public.admin_add_faculty(
  p_name text,
  p_department text,
  p_designation text,
  p_email text,
  p_summary_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $add_faculty$
DECLARE
  v_name text := btrim(p_name);
  v_designation text := nullif(btrim(p_designation), '');
  v_email text := nullif(btrim(p_email), '');
  v_note text := nullif(btrim(p_summary_note), '');
  v_slug text;
  v_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 200
     OR p_department IS NULL OR p_department NOT IN ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')
     OR char_length(v_designation) > 120 OR char_length(v_note) > 2000
     OR (v_email IS NOT NULL AND (
       char_length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     )) THEN
    RAISE EXCEPTION 'invalid faculty input' USING ERRCODE = '22023';
  END IF;

  v_slug := trim(both '-' FROM regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(rtrim(left(v_slug, 50), '-'), ''), 'faculty');
  INSERT INTO public.faculty (slug, name, department, designation, email, summary_note)
  VALUES (v_slug || '-' || gen_random_uuid()::text, v_name, p_department, v_designation, v_email, v_note)
  RETURNING id INTO v_id;

  INSERT INTO public.moderation_log (actor_user_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'admin_add_faculty', 'faculty', v_id, '{}'::jsonb);
  RETURN v_id;
END;
$add_faculty$;

REVOKE ALL ON FUNCTION public.admin_add_faculty(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_add_faculty(text, text, text, text, text) TO authenticated;

COMMIT;
