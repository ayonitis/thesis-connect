-- Apply after BRAC eligibility and designated admin.
BEGIN;

ALTER TABLE public.faculty_reviews
  ADD COLUMN rating_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN marking smallint,
  ADD COLUMN responsibility smallint,
  ADD COLUMN connection smallint,
  ADD COLUMN recommendation_letter smallint,
  ALTER COLUMN clarity DROP NOT NULL,
  ALTER COLUMN fairness DROP NOT NULL,
  ALTER COLUMN workload DROP NOT NULL,
  ADD CONSTRAINT faculty_reviews_rating_version_check CHECK (
    (rating_version = 1
      AND clarity IS NOT NULL AND fairness IS NOT NULL AND workload IS NOT NULL
      AND marking IS NULL AND responsibility IS NULL AND connection IS NULL
      AND recommendation_letter IS NULL)
    OR
    (rating_version = 2
      AND clarity IS NULL AND fairness IS NULL AND workload IS NULL
      AND marking IS NOT NULL AND marking BETWEEN 1 AND 10
      AND responsibility IS NOT NULL AND responsibility BETWEEN 1 AND 10
      AND connection IS NOT NULL AND connection BETWEEN 1 AND 10
      AND recommendation_letter IS NOT NULL AND recommendation_letter BETWEEN 1 AND 10)
  );

ALTER TABLE public.faculty_reviews ALTER COLUMN rating_version SET DEFAULT 2;

CREATE FUNCTION public.create_own_faculty_review_v2(
  p_faculty_id uuid,
  p_marking smallint,
  p_responsiveness smallint,
  p_responsibility smallint,
  p_connection smallint,
  p_recommendation_letter smallint,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_review_id uuid;
  v_constraint_name text;
BEGIN
  IF public.current_user_is_brac_eligible() IS DISTINCT FROM true THEN
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

  IF p_marking IS NULL OR p_marking NOT BETWEEN 1 AND 10
     OR p_responsiveness IS NULL OR p_responsiveness NOT BETWEEN 1 AND 10
     OR p_responsibility IS NULL OR p_responsibility NOT BETWEEN 1 AND 10
     OR p_connection IS NULL OR p_connection NOT BETWEEN 1 AND 10
     OR p_recommendation_letter IS NULL OR p_recommendation_letter NOT BETWEEN 1 AND 10
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
    rating_version,
    marking,
    responsiveness,
    responsibility,
    connection,
    recommendation_letter,
    description
  )
  VALUES (
    p_faculty_id,
    v_user,
    2,
    p_marking,
    p_responsiveness,
    p_responsibility,
    p_connection,
    p_recommendation_letter,
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

CREATE FUNCTION public.update_own_faculty_review_v2(
  p_review_id uuid,
  p_marking smallint,
  p_responsiveness smallint,
  p_responsibility smallint,
  p_connection smallint,
  p_recommendation_letter smallint,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF public.current_user_is_brac_eligible() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_marking IS NULL OR p_marking NOT BETWEEN 1 AND 10
     OR p_responsiveness IS NULL OR p_responsiveness NOT BETWEEN 1 AND 10
     OR p_responsibility IS NULL OR p_responsibility NOT BETWEEN 1 AND 10
     OR p_connection IS NULL OR p_connection NOT BETWEEN 1 AND 10
     OR p_recommendation_letter IS NULL OR p_recommendation_letter NOT BETWEEN 1 AND 10
     OR p_description IS NULL
     OR char_length(trim(p_description)) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'invalid review content';
  END IF;

  UPDATE public.faculty_reviews
  SET marking = p_marking,
      responsiveness = p_responsiveness,
      responsibility = p_responsibility,
      connection = p_connection,
      recommendation_letter = p_recommendation_letter,
      description = trim(p_description)
  WHERE id = p_review_id
    AND reviewer_user_id = v_user
    AND rating_version = 2;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found';
  END IF;
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
  SET description = p_description
  WHERE id = p_review_id
    AND reviewer_user_id = v_user
    AND rating_version = 1
    AND clarity = p_clarity AND responsiveness = p_responsiveness
    AND fairness = p_fairness AND workload = p_workload;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found';
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.faculty_reviews_public WITH (security_barrier = true, security_invoker = false) AS
  SELECT r.faculty_id, 'Anonymous Student'::text AS author_label, r.clarity,
         r.responsiveness, r.fairness, r.workload, r.description,
         r.rating_version, r.marking, r.responsibility, r.connection, r.recommendation_letter
  FROM public.faculty_reviews r JOIN public.faculty f ON f.id = r.faculty_id
  WHERE r.moderation_status = 'published' AND f.is_active
    AND (SELECT public.current_user_is_brac_eligible());

CREATE OR REPLACE FUNCTION public.admin_dashboard()
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
             r.fairness, r.workload, r.moderation_status, r.created_at,
             r.rating_version, r.marking, r.responsibility, r.connection, r.recommendation_letter
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

-- Prevent old clients from creating new legacy rows.
REVOKE EXECUTE ON FUNCTION public.create_own_faculty_review(uuid, smallint, smallint, smallint, smallint, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.create_own_faculty_review_v2(uuid, smallint, smallint, smallint, smallint, smallint, text),
  public.update_own_faculty_review_v2(uuid, smallint, smallint, smallint, smallint, smallint, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.create_own_faculty_review_v2(uuid, smallint, smallint, smallint, smallint, smallint, text),
  public.update_own_faculty_review_v2(uuid, smallint, smallint, smallint, smallint, smallint, text)
  TO authenticated;

COMMIT;
