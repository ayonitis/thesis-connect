-- BRAC eligibility: LOCAL AUTHORING ONLY; separately review/approve before execution.
-- Apply ONLY after the eight original baseline versions. Do not run a directory-wide
-- db push: an older, blocked BRAC draft remains in this repository and is NOT approved.
-- No Auth users, Auth policies, Auth triggers, role memberships or base grants are changed.
BEGIN;

-- Fail rather than invent managed Auth privileges or silently accept filtered reads.
DO $prerequisites$
DECLARE item record;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'requires reviewed trusted postgres application owner';
  END IF;
  IF NOT pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE')
     OR NOT pg_catalog.has_function_privilege(current_user, 'auth.uid()', 'EXECUTE')
     OR pg_catalog.row_security_active('auth.users'::regclass) THEN
    RAISE EXCEPTION 'authoritative unfiltered Auth visibility must be owner-verified';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('id','uuid'::regtype), ('email','character varying'::regtype),
    ('email_confirmed_at','timestamp with time zone'::regtype),
    ('is_anonymous','boolean'::regtype), ('deleted_at','timestamp with time zone'::regtype)
  ) AS expected(column_name, type_oid) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='auth.users'::regclass AND attname=item.column_name
        AND atttypid=item.type_oid AND attnum>0 AND NOT attisdropped)
      OR NOT pg_catalog.has_column_privilege(current_user,'auth.users',item.column_name,'SELECT') THEN
      RAISE EXCEPTION 'required Auth column/type/read privilege unavailable: %', item.column_name;
    END IF;
  END LOOP;
  -- Replacements must retain the baseline trusted owner, not take over foreign objects.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.is_admin()'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.is_admin_or_moderator()'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.create_partner_room(text, text, integer, numeric, boolean, smallint, text, numeric, numeric, integer, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.submit_room_application(uuid, text, numeric, integer, text, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.withdraw_room_application(uuid)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.decide_room_application(uuid, text, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.update_own_faculty_review(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.decide_faculty_add_request(uuid, text, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.moderate_faculty_review(uuid, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.create_own_faculty_review(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.submit_faculty_add_request(text, text, text[], text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.delete_own_faculty_review(uuid)'::regprocedure AND proowner='postgres'::regrole AND prosecdef) THEN
    RAISE EXCEPTION 'baseline function ownership/security mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
    WHERE oid='public.faculty_reviews_public'::regclass AND relkind='v'
      AND relowner='postgres'::regrole) THEN
    RAISE EXCEPTION 'review view owner/type mismatch';
  END IF;
END;
$prerequisites$;

-- Private hook/predicate schema: no client or service-role access.
CREATE SCHEMA thesis_brac_auth AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA thesis_brac_auth FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA thesis_brac_auth TO supabase_auth_admin;

CREATE FUNCTION thesis_brac_auth.email_is_allowed(email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $email$
  SELECT coalesce(
    length(email) BETWEEN 1 AND 254
    AND octet_length(email)=length(email)
    AND email !~ '[^!-~]'
    AND length(split_part(email,'@',1)) BETWEEN 1 AND 64
    AND email !~ '[+]'
    AND email COLLATE "C" ~ '^[A-Za-z0-9!#$%&''*/=?^_`{|}~-]+([.][A-Za-z0-9!#$%&''*/=?^_`{|}~-]+)*@[gG][.][bB][rR][aA][cC][uU][.][aA][cC][.][bB][dD]$',
    false);
$email$;
REVOKE ALL ON FUNCTION thesis_brac_auth.email_is_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION thesis_brac_auth.email_is_allowed(text) TO supabase_auth_admin;

-- No caller email/UUID argument and no JWT email or editable metadata authority.
-- row_security=off does NOT grant bypass: it raises if Auth reads become RLS-filtered.
CREATE FUNCTION public.current_user_is_brac_eligible()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = off
AS $eligibility$
  SELECT EXISTS (SELECT 1 FROM auth.users AS u
    WHERE u.id=auth.uid() AND u.is_anonymous IS FALSE
      AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
      AND thesis_brac_auth.email_is_allowed(u.email));
$eligibility$;
REVOKE ALL ON FUNCTION public.current_user_is_brac_eligible()
  FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.current_user_is_brac_eligible() TO authenticated;

-- Admission only: unconfirmed password signup must reach email confirmation.
-- Auth invokes this SECURITY INVOKER hook; it never reads auth.users or creates profiles.
CREATE FUNCTION thesis_brac_auth.before_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $hook$
BEGIN
  IF jsonb_typeof(event->'user') IS DISTINCT FROM 'object'
     OR jsonb_typeof(event->'user'->'email') IS DISTINCT FROM 'string'
     OR (event->'user'->'is_anonymous') IS DISTINCT FROM 'false'::jsonb
     OR NOT thesis_brac_auth.email_is_allowed(event->'user'->>'email') THEN
    RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,
      'message','Use your BRAC University email ending in @g.bracu.ac.bd (without + aliases).'));
  END IF;
  RETURN '{}'::jsonb;
END;
$hook$;
REVOKE ALL ON FUNCTION thesis_brac_auth.before_user_created(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION thesis_brac_auth.before_user_created(jsonb) TO supabase_auth_admin;

-- These gates apply ONLY to authenticated. They intersect the baseline permissive
-- policies; they confer no table privileges and cannot create access on app_roles.
-- Public discovery uses the unchanged owner-privileged faculty/room projections.
CREATE POLICY brac_eligibility ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.student_private
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.app_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.partner_rooms
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.room_join_applications
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.room_application_private_details
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.room_memberships
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.faculty
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.faculty_reviews
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.faculty_add_requests
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));
CREATE POLICY brac_eligibility ON public.moderation_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.current_user_is_brac_eligible()))
  WITH CHECK ((SELECT public.current_user_is_brac_eligible()));

-- Original function definitions retained exactly except the added eligibility gate.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT public.current_user_is_brac_eligible() AND EXISTS (
    SELECT 1
    FROM public.app_roles AS r
    WHERE r.user_id = auth.uid()
      AND r.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT public.current_user_is_brac_eligible() AND EXISTS (
    SELECT 1
    FROM public.app_roles AS r
    WHERE r.user_id = auth.uid()
      AND r.role IN ('admin', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.create_partner_room(
  p_title text,
  p_description text,
  p_host_completed_credits integer,
  p_host_cgpa numeric,
  p_show_host_cgpa boolean,
  p_additional_members_needed smallint,
  p_expected_department text,
  p_expected_cgpa_min numeric,
  p_expected_cgpa_max numeric,
  p_min_completed_credits integer,
  p_additional_info text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_room_id uuid;
  v_name text;
  v_department text;
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT display_name, department
  INTO v_name, v_department
  FROM public.profiles
  WHERE user_id = v_user;

  IF v_name IS NULL
     OR char_length(trim(v_name)) NOT BETWEEN 1 AND 100
     OR v_department IS NULL
     OR v_department NOT IN ('CSE', 'CS', 'EEE', 'ESS', 'ARCH', 'PHARMACY', 'BBS') THEN
    RAISE EXCEPTION 'complete profile display name and department are required';
  END IF;

  IF p_title IS NULL
     OR char_length(trim(p_title)) NOT BETWEEN 3 AND 200
     OR p_description IS NULL
     OR char_length(trim(p_description)) NOT BETWEEN 10 AND 5000
     OR p_host_completed_credits IS NULL
     OR p_host_completed_credits NOT BETWEEN 0 AND 1000
     OR p_show_host_cgpa IS NULL
     OR (p_show_host_cgpa AND p_host_cgpa IS NULL)
     OR (p_host_cgpa IS NOT NULL AND p_host_cgpa NOT BETWEEN 0 AND 4)
     OR p_additional_members_needed IS NULL
     OR p_additional_members_needed NOT BETWEEN 1 AND 10
     OR p_expected_department IS NULL
     OR p_expected_department NOT IN ('CSE', 'CS', 'EEE', 'ESS', 'ARCH', 'PHARMACY', 'BBS')
     OR p_expected_cgpa_min IS NULL
     OR p_expected_cgpa_min NOT BETWEEN 0 AND 4
     OR p_expected_cgpa_max IS NULL
     OR p_expected_cgpa_max NOT BETWEEN 0 AND 4
     OR p_expected_cgpa_max < p_expected_cgpa_min
     OR p_min_completed_credits IS NULL
     OR p_min_completed_credits NOT BETWEEN 0 AND 1000
     OR (p_additional_info IS NOT NULL AND char_length(p_additional_info) > 2000) THEN
    RAISE EXCEPTION 'invalid room input';
  END IF;

  INSERT INTO public.partner_rooms (
    host_user_id,
    host_display_name,
    title,
    description,
    host_department,
    host_completed_credits,
    host_cgpa,
    show_host_cgpa,
    additional_members_needed,
    expected_department,
    expected_cgpa_min,
    expected_cgpa_max,
    min_completed_credits,
    additional_info
  )
  VALUES (
    v_user,
    v_name,
    p_title,
    p_description,
    v_department,
    p_host_completed_credits,
    p_host_cgpa,
    p_show_host_cgpa,
    p_additional_members_needed,
    p_expected_department,
    p_expected_cgpa_min,
    p_expected_cgpa_max,
    p_min_completed_credits,
    p_additional_info
  )
  RETURNING id INTO v_room_id;

  INSERT INTO public.room_memberships (room_id, user_id, membership_role)
  VALUES (v_room_id, v_user, 'host');

  RETURN v_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_room_application(
  p_room_id uuid,
  p_department text,
  p_cgpa numeric,
  p_completed_credits integer,
  p_why_join text,
  p_contact_link text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_application_id uuid;
  v_name text;
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT display_name
  INTO v_name
  FROM public.profiles
  WHERE user_id = v_user;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'profile is required';
  END IF;

  IF p_department IS NULL
     OR p_department NOT IN ('CSE', 'CS', 'EEE', 'ESS', 'ARCH', 'PHARMACY', 'BBS')
     OR p_cgpa IS NULL
     OR p_cgpa NOT BETWEEN 0 AND 4
     OR p_completed_credits IS NULL
     OR p_completed_credits NOT BETWEEN 0 AND 1000
     OR p_why_join IS NULL
     OR char_length(trim(p_why_join)) NOT BETWEEN 10 AND 3000
     OR p_contact_link IS NULL
     OR char_length(trim(p_contact_link)) NOT BETWEEN 3 AND 2048 THEN
    RAISE EXCEPTION 'invalid application input';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.partner_rooms
    WHERE id = p_room_id
      AND is_open
    FOR KEY SHARE
  ) THEN
    RAISE EXCEPTION 'room is not open';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.partner_rooms
    WHERE id = p_room_id
      AND host_user_id = v_user
  ) THEN
    RAISE EXCEPTION 'host cannot apply to own room';
  END IF;

  INSERT INTO public.room_join_applications (
    room_id,
    applicant_user_id,
    applicant_display_name,
    department,
    cgpa,
    completed_credits,
    why_join
  )
  VALUES (
    p_room_id,
    v_user,
    v_name,
    p_department,
    p_cgpa,
    p_completed_credits,
    p_why_join
  )
  RETURNING id INTO v_application_id;

  INSERT INTO public.room_application_private_details (application_id, contact_link)
  VALUES (v_application_id, p_contact_link);

  RETURN v_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_room_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_application public.room_join_applications%ROWTYPE;
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_application
  FROM public.room_join_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_application.applicant_user_id <> v_user
     OR v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'pending application not found';
  END IF;

  UPDATE public.room_join_applications
  SET status = 'withdrawn'
  WHERE id = v_application.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_room_application(
  p_application_id uuid,
  p_decision text,
  p_host_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_app public.room_join_applications%ROWTYPE;
  v_room public.partner_rooms%ROWTYPE;
  v_members integer;
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  IF p_host_note IS NOT NULL AND char_length(p_host_note) > 2000 THEN
    RAISE EXCEPTION 'invalid host note';
  END IF;

  SELECT *
  INTO v_app
  FROM public.room_join_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND OR v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'application is not pending';
  END IF;

  SELECT *
  INTO v_room
  FROM public.partner_rooms
  WHERE id = v_app.room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'room not found';
  END IF;

  IF v_room.host_user_id <> v_user AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_decision = 'accepted' THEN
    IF NOT v_room.is_open THEN
      RAISE EXCEPTION 'room is closed';
    END IF;

    SELECT count(*)
    INTO v_members
    FROM public.room_memberships
    WHERE room_id = v_room.id
      AND membership_role = 'member';

    IF v_members >= v_room.additional_members_needed THEN
      RAISE EXCEPTION 'room has no remaining capacity';
    END IF;

    INSERT INTO public.room_memberships (
      room_id,
      user_id,
      membership_role,
      application_id
    )
    VALUES (
      v_room.id,
      v_app.applicant_user_id,
      'member',
      v_app.id
    );
  END IF;

  UPDATE public.room_join_applications
  SET status = p_decision,
      decided_by = v_user,
      decided_at = now(),
      host_note = p_host_note
  WHERE id = v_app.id;

  INSERT INTO public.moderation_log (
    actor_user_id,
    action,
    target_table,
    target_id,
    details
  )
  VALUES (
    v_user,
    'room_application_' || p_decision,
    'room_join_applications',
    v_app.id,
    jsonb_build_object('room_id', v_room.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_faculty_review(
  p_review_id uuid,
  p_clarity smallint,
  p_responsiveness smallint,
  p_fairness smallint,
  p_workload smallint,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
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

  UPDATE public.faculty_reviews
  SET clarity = p_clarity,
      responsiveness = p_responsiveness,
      fairness = p_fairness,
      workload = p_workload,
      description = p_description
  WHERE id = p_review_id
    AND reviewer_user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_faculty_add_request(
  p_request_id uuid,
  p_decision text,
  p_decision_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request public.faculty_add_requests%ROWTYPE;
  v_faculty_id uuid;
  v_slug text;
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required';
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
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required';
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

CREATE OR REPLACE FUNCTION public.create_own_faculty_review(
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
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
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

CREATE OR REPLACE FUNCTION public.submit_faculty_add_request(
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
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
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

CREATE OR REPLACE FUNCTION public.delete_own_faculty_review(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.current_user_is_brac_eligible() THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
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

-- Preserve projection, anonymized author label, owner and existing view ACLs.
-- Baseline SELECT is authenticated-only: "Anonymous Student" masks authors,
-- not caller identity. anon has neither view SELECT nor helper EXECUTE.
-- Eligible authenticated callers retain published rows; ineligible callers do not.
CREATE OR REPLACE VIEW public.faculty_reviews_public WITH (security_barrier = true, security_invoker = false) AS
  SELECT r.faculty_id, 'Anonymous Student'::text AS author_label, r.clarity,
         r.responsiveness, r.fairness, r.workload, r.description
  FROM public.faculty_reviews r JOIN public.faculty f ON f.id = r.faculty_id
  WHERE r.moderation_status = 'published' AND f.is_active
    AND (SELECT public.current_user_is_brac_eligible());

COMMIT;
