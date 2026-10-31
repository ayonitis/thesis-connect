-- Phase 4.4: reconcile already-deployed Phase 2B RPC search paths.
-- Changes only per-function search_path configuration.

BEGIN;

ALTER FUNCTION public.create_partner_room(
  text, text, integer, numeric, boolean, smallint, text,
  numeric, numeric, integer, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.submit_room_application(
  uuid, text, numeric, integer, text, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.withdraw_room_application(
  uuid
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.decide_room_application(
  uuid, text, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.update_own_faculty_review(
  uuid, smallint, smallint, smallint, smallint, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.decide_faculty_add_request(
  uuid, text, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.moderate_faculty_review(
  uuid, text
) SET search_path = pg_catalog, public, pg_temp;

COMMIT;
