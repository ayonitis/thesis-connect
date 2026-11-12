-- Requires the reviewed BRAC baseline. The blocked Google-only candidate is not a dependency.
BEGIN;

DO $prerequisites$
BEGIN
  IF current_user <> 'postgres'
     OR pg_catalog.row_security_active('auth.users'::regclass)
     OR pg_catalog.row_security_active('auth.sessions'::regclass)
     OR NOT pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE')
     OR NOT pg_catalog.has_function_privilege(current_user, 'auth.jwt()', 'EXECUTE')
     OR EXISTS (
       SELECT 1 FROM (VALUES
         ('public.is_admin()'::regprocedure),
         ('public.is_admin_or_moderator()'::regprocedure),
         ('public.decide_faculty_add_request(uuid,text,text)'::regprocedure),
         ('public.moderate_faculty_review(uuid,text)'::regprocedure),
         ('thesis_brac_auth.before_user_created(jsonb)'::regprocedure)
       ) AS expected(oid)
       JOIN pg_catalog.pg_proc AS p ON p.oid = expected.oid
       WHERE p.proowner <> 'postgres'::regrole
     ) THEN
    RAISE EXCEPTION 'STOP: reviewed Auth visibility and migration executor are required';
  END IF;
END;
$prerequisites$;

-- Admission is separate from authorization. This hook does not grant a role.
CREATE OR REPLACE FUNCTION thesis_brac_auth.before_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $hook$
BEGIN
  IF jsonb_typeof(event->'user') IS DISTINCT FROM 'object'
     OR jsonb_typeof(event->'user'->'email') IS DISTINCT FROM 'string'
     OR (event->'user'->'is_anonymous') IS DISTINCT FROM 'false'::jsonb
     OR NOT (thesis_brac_auth.email_is_allowed(event->'user'->>'email')
       OR lower((event->'user'->>'email') COLLATE "C") = 'ayon3015@gmail.com') THEN
    RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,
      'message','Use your BRAC University email ending in @g.bracu.ac.bd (without + aliases).'));
  END IF;
  RETURN '{}'::jsonb;
END;
$hook$;
REVOKE ALL ON FUNCTION thesis_brac_auth.before_user_created(jsonb)
FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION thesis_brac_auth.before_user_created(jsonb) TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = off
AS $admin$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_roles AS r
    JOIN auth.users AS u ON u.id = r.user_id
    JOIN auth.sessions AS s ON s.user_id = u.id
    WHERE r.user_id = auth.uid() AND r.role = 'admin'
      AND s.id = CASE WHEN (auth.jwt()->>'session_id') ~*
        '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        THEN (auth.jwt()->>'session_id')::uuid END
      AND (s.not_after IS NULL OR s.not_after > statement_timestamp())
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      AND u.is_anonymous IS FALSE AND u.deleted_at IS NULL
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email COLLATE "C") = 'ayon3015@gmail.com'
  );
$admin$;

-- Keep existing student-table RLS predicates BRAC-gated. Admin RPCs use is_admin().
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $staff$
  SELECT public.current_user_is_brac_eligible() AND EXISTS (
    SELECT 1 FROM public.app_roles AS r
    WHERE r.user_id = auth.uid() AND r.role = 'moderator'
  );
$staff$;

CREATE OR REPLACE FUNCTION public.decide_faculty_add_request(
  p_request_id uuid,
  p_decision text,
  p_decision_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request public.faculty_add_requests%ROWTYPE;
  v_faculty_id uuid;
  v_slug text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  IF p_decision_note IS NOT NULL AND char_length(p_decision_note) > 2000 THEN
    RAISE EXCEPTION 'invalid decision note';
  END IF;

  SELECT *
  INTO v_request
  FROM public.faculty_add_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  IF p_decision = 'approved' THEN
    v_slug := trim(
      both '-' FROM regexp_replace(
        lower(trim(v_request.proposed_name)),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    );

    IF v_slug = '' THEN
      RAISE EXCEPTION 'request name cannot produce a slug';
    END IF;

    v_slug := left(v_slug, 50) || '-' ||
              left(replace(v_request.id::text, '-', ''), 8);

    INSERT INTO public.faculty (
      slug,
      name,
      department,
      research_interests
    )
    VALUES (
      v_slug,
      v_request.proposed_name,
      v_request.proposed_department,
      v_request.proposed_research_interests
    )
    RETURNING id INTO v_faculty_id;
  END IF;

  UPDATE public.faculty_add_requests
  SET status = p_decision,
      decided_by = v_user,
      decided_at = now(),
      decision_note = p_decision_note,
      created_faculty_id = v_faculty_id
  WHERE id = p_request_id;

  INSERT INTO public.moderation_log (
    actor_user_id,
    action,
    target_table,
    target_id,
    details
  )
  VALUES (
    v_user,
    'faculty_add_request_' || p_decision,
    'faculty_add_requests',
    p_request_id,
    '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_faculty_review(
  p_review_id uuid,
  p_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN ('published', 'hidden') THEN
    RAISE EXCEPTION 'invalid visibility';
  END IF;

  UPDATE public.faculty_reviews
  SET moderation_status = p_visibility,
      moderated_by = CASE WHEN p_visibility = 'hidden' THEN v_user ELSE NULL END,
      moderated_at = CASE WHEN p_visibility = 'hidden' THEN now() ELSE NULL END
  WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found';
  END IF;

  INSERT INTO public.moderation_log (
    actor_user_id,
    action,
    target_table,
    target_id,
    details
  )
  VALUES (
    v_user,
    'moderate_review',
    'faculty_reviews',
    p_review_id,
    jsonb_build_object('visibility', p_visibility)
  );
END;
$$;

-- Return only the fields required by moderation. No contact links, student IDs,
-- CGPA, email addresses, reviewer identities, or session details are returned.
CREATE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $dashboard$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'facultyCount', (SELECT count(*) FROM public.faculty),
    'pendingCount', (SELECT count(*) FROM public.faculty_add_requests WHERE status = 'pending'),
    'reviewCount', (SELECT count(*) FROM public.faculty_reviews),
    'openRoomCount', (SELECT count(*) FROM public.partner_rooms WHERE is_open),
    'requests', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM (
      SELECT id, proposed_name, proposed_department, rationale, status, decision_note, created_at
      FROM public.faculty_add_requests ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 100
    ) AS q),
    'reviews', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM (
      SELECT r.id, f.name AS faculty_name, r.description, r.clarity, r.responsiveness,
             r.fairness, r.workload, r.moderation_status, r.created_at
      FROM public.faculty_reviews AS r JOIN public.faculty AS f ON f.id = r.faculty_id
      ORDER BY r.created_at DESC LIMIT 100
    ) AS q),
    'rooms', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM (
      SELECT id, title, description, host_display_name, is_open, created_at
      FROM public.partner_rooms ORDER BY created_at DESC LIMIT 100
    ) AS q),
    'accounts', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM (
      SELECT u.id, p.display_name, p.department, u.email_confirmed_at IS NOT NULL AS confirmed,
             COALESCE(thesis_brac_auth.email_is_allowed(u.email), false)
               AND u.email_confirmed_at IS NOT NULL AS brac_eligible,
             EXISTS (SELECT 1 FROM public.app_roles AS r WHERE r.user_id = u.id AND r.role = 'moderator') AS moderator,
             u.created_at
      FROM auth.users AS u LEFT JOIN public.profiles AS p ON p.user_id = u.id
      WHERE u.deleted_at IS NULL AND u.is_anonymous IS FALSE
      ORDER BY u.created_at DESC LIMIT 100
    ) AS q),
    'logs', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb) FROM (
      SELECT id, action, created_at FROM public.moderation_log ORDER BY created_at DESC LIMIT 10
    ) AS q)
  );
END;
$dashboard$;

CREATE FUNCTION public.admin_close_room(p_room_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $close$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid moderation reason';
  END IF;

  -- Serialize with joins (KEY SHARE), acceptance, owner edits and owner deletion.
  PERFORM 1 FROM public.partner_rooms WHERE id = p_room_id AND is_open FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room is closed';
  END IF;
  UPDATE public.partner_rooms SET is_open = false WHERE id = p_room_id;
  INSERT INTO public.moderation_log (actor_user_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'close_partner_room', 'partner_rooms', p_room_id,
          jsonb_build_object('reason', btrim(p_reason)));
END;
$close$;

REVOKE ALL ON FUNCTION public.is_admin(), public.is_admin_or_moderator(),
  public.admin_dashboard(), public.admin_close_room(uuid, text),
  public.decide_faculty_add_request(uuid, text, text), public.moderate_faculty_review(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_admin_or_moderator(),
  public.admin_dashboard(), public.admin_close_room(uuid, text),
  public.decide_faculty_add_request(uuid, text, text), public.moderate_faculty_review(uuid, text)
TO authenticated;

COMMIT;
