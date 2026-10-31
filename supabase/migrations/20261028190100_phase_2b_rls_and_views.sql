-- Phase 2B / migration 2 of 3: RLS, least-privilege grants, and safe read surfaces.
-- Rollback note: revoke public-view grants, drop the views, then disable/drop policies
-- only as part of a reviewed rollback. Do not broadly grant base-table access.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_join_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_application_private_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_add_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

-- Scope privilege changes to objects created by this proposal; do not alter unrelated public objects.
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.student_private, public.app_roles,
  public.partner_rooms, public.room_join_applications, public.room_application_private_details,
  public.room_memberships, public.faculty, public.faculty_reviews,
  public.faculty_add_requests, public.moderation_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.set_updated_at(), public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_roles AS r
    WHERE r.user_id = auth.uid()
      AND r.role = 'admin'
  );
$$;

CREATE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_roles AS r
    WHERE r.user_id = auth.uid()
      AND r.role IN ('admin', 'moderator')
  );
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin_or_moderator(), public.is_admin()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator(), public.is_admin() TO authenticated;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_moderator());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY student_private_select_own_or_admin ON public.student_private FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY student_private_insert_own ON public.student_private FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY student_private_update_own ON public.student_private FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_private TO authenticated;

CREATE POLICY rooms_select_own_or_admin ON public.partner_rooms FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR public.is_admin_or_moderator());
GRANT SELECT ON public.partner_rooms TO authenticated;

CREATE POLICY applications_select_owner_host_or_admin ON public.room_join_applications FOR SELECT TO authenticated USING (
  applicant_user_id = auth.uid() OR public.is_admin_or_moderator() OR EXISTS (
    SELECT 1 FROM public.partner_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()
  )
);
GRANT SELECT ON public.room_join_applications TO authenticated;

CREATE POLICY private_application_details_select_accepted_parties ON public.room_application_private_details FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_join_applications a WHERE a.id = application_id AND a.status = 'accepted' AND (
    a.applicant_user_id = auth.uid() OR public.is_admin_or_moderator() OR EXISTS (
      SELECT 1 FROM public.partner_rooms r WHERE r.id = a.room_id AND r.host_user_id = auth.uid()
    )
  ))
);
GRANT SELECT ON public.room_application_private_details TO authenticated;

CREATE POLICY memberships_select_participant_host_or_admin ON public.room_memberships FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_admin_or_moderator() OR EXISTS (
    SELECT 1 FROM public.partner_rooms r WHERE r.id = room_id AND r.host_user_id = auth.uid()
  )
);
GRANT SELECT ON public.room_memberships TO authenticated;

CREATE POLICY faculty_admin_manage ON public.faculty FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY reviews_select_own_or_admin ON public.faculty_reviews FOR SELECT TO authenticated
  USING (reviewer_user_id = auth.uid() OR public.is_admin());
CREATE POLICY reviews_insert_own ON public.faculty_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid() AND moderation_status = 'published' AND moderated_by IS NULL AND moderated_at IS NULL);
CREATE POLICY reviews_delete_own ON public.faculty_reviews FOR DELETE TO authenticated
  USING (reviewer_user_id = auth.uid());
GRANT SELECT, INSERT, DELETE ON public.faculty_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.faculty TO authenticated;

CREATE POLICY faculty_requests_select_own_or_admin ON public.faculty_add_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR public.is_admin_or_moderator());
CREATE POLICY faculty_requests_insert_own ON public.faculty_add_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid() AND status = 'pending' AND decided_by IS NULL AND decided_at IS NULL);
GRANT SELECT, INSERT ON public.faculty_add_requests TO authenticated;
CREATE POLICY moderation_log_admin_select ON public.moderation_log FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.moderation_log TO authenticated;

-- These owner-privileged views are necessary because their callers do not receive base-table
-- SELECT. Their owner must be a trusted migration role; remote verification must confirm it.
-- Projections omit student IDs, application data, contact links, reviewer UUIDs, and moderation data.
CREATE VIEW public.partner_rooms_public WITH (security_barrier = true, security_invoker = false) AS
  SELECT id, host_display_name, title, description, host_department, host_completed_credits,
         CASE WHEN show_host_cgpa THEN host_cgpa ELSE NULL END AS host_cgpa,
         show_host_cgpa, additional_members_needed, expected_department, expected_cgpa_min,
         expected_cgpa_max, min_completed_credits, additional_info, created_at,
         (SELECT count(*)::integer FROM public.room_memberships m WHERE m.room_id = partner_rooms.id) AS member_count
  FROM public.partner_rooms WHERE is_open;

CREATE VIEW public.faculty_public WITH (security_barrier = true, security_invoker = false) AS
  SELECT id, slug, name, initials, department, summary_note, created_at
  FROM public.faculty WHERE is_active;

CREATE VIEW public.faculty_reviews_public WITH (security_barrier = true, security_invoker = false) AS
  SELECT r.faculty_id, 'Anonymous Student'::text AS author_label, r.clarity,
         r.responsiveness, r.fairness, r.workload, r.description
  FROM public.faculty_reviews r JOIN public.faculty f ON f.id = r.faculty_id
  WHERE r.moderation_status = 'published' AND f.is_active;

-- faculty_public is automatically updatable on supported PostgreSQL versions; the explicit
-- ALL revokes below therefore matter as much as the read-only intent of the projection.
-- The other two views are not automatically updatable (aggregate/subquery and join).
REVOKE ALL PRIVILEGES ON TABLE public.partner_rooms_public, public.faculty_public,
  public.faculty_reviews_public FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.partner_rooms_public, public.faculty_public TO anon, authenticated;
GRANT SELECT ON public.faculty_reviews_public TO authenticated;

COMMIT;
