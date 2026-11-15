BEGIN;

-- 1. Persistent notification records
CREATE TABLE public.room_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  application_id uuid NOT NULL
    REFERENCES public.room_join_applications(id) ON DELETE CASCADE,
  room_id uuid NOT NULL
    REFERENCES public.partner_rooms(id) ON DELETE CASCADE,
  event text NOT NULL
    CHECK (event IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (application_id, event)
);

CREATE INDEX room_notifications_recipient_created_idx
  ON public.room_notifications (recipient_id, created_at DESC);

-- 2. Recipient-only access
ALTER TABLE public.room_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.room_notifications
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, UPDATE (read_at)
  ON public.room_notifications TO authenticated;

CREATE POLICY room_notifications_read_own
  ON public.room_notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND (SELECT public.current_user_is_brac_eligible())
  );

CREATE POLICY room_notifications_update_own
  ON public.room_notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND (SELECT public.current_user_is_brac_eligible())
  )
  WITH CHECK (
    recipient_id = (SELECT auth.uid())
    AND (SELECT public.current_user_is_brac_eligible())
  );

-- 3. Create notifications automatically from application changes
CREATE FUNCTION public.record_room_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  recipient uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN

    SELECT host_user_id
    INTO STRICT recipient
    FROM public.partner_rooms
    WHERE id = NEW.room_id;

  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status IN ('accepted', 'rejected') THEN

    recipient := NEW.applicant_user_id;

  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.room_notifications (
    recipient_id,
    application_id,
    room_id,
    event
  )
  VALUES (
    recipient,
    NEW.id,
    NEW.room_id,
    NEW.status
  )
  ON CONFLICT (application_id, event) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Explicitly establish the trusted function owner
ALTER FUNCTION public.record_room_notification() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.record_room_notification()
  FROM PUBLIC, anon, authenticated, service_role;

-- 4. Attach the trigger
CREATE TRIGGER room_application_notification
  AFTER INSERT OR UPDATE OF status
  ON public.room_join_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.record_room_notification();

-- 5. Add the table to Realtime only if it is not already published
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'room_notifications'
  ) THEN
    EXECUTE
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_notifications';
  END IF;
END;
$$;

COMMIT;
