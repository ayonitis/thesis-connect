-- Apply after the designated-admin migration.
BEGIN;

CREATE FUNCTION public.admin_delete_faculty(p_faculty_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $delete_faculty$
DECLARE
  v_name text;
  v_department text;
  v_slug text;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.faculty
  WHERE id = p_faculty_id
  RETURNING name, department, slug INTO v_name, v_department, v_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'faculty not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.moderation_log (actor_user_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'admin_delete_faculty', 'faculty', p_faculty_id,
    jsonb_build_object('name', v_name, 'department', v_department, 'slug', v_slug));
END;
$delete_faculty$;

REVOKE ALL ON FUNCTION public.admin_delete_faculty(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_faculty(uuid) TO authenticated;

COMMIT;
