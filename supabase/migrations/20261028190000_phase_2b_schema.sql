-- Phase 2B / migration 1 of 3: proposed relational schema only.
-- Rollback note: after confirming no production data depends on this migration,
-- drop the dependent views/functions first, then tables in reverse dependency order.
-- Do not run this migration until supabase/verify/remote_schema_readonly.sql has
-- been reviewed and all object-name conflicts have been reconciled.

begin;

create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  department text check (department is null or department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_private (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  student_id text not null unique check (char_length(trim(student_id)) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_roles (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  granted_by uuid references public.profiles(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create unique index app_roles_single_admin_idx
  on public.app_roles (role)
  where role = 'admin';

create table public.partner_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references public.profiles(user_id) on delete restrict,
  host_display_name text not null check (char_length(trim(host_display_name)) between 1 and 100),
  title text not null check (char_length(trim(title)) between 3 and 200),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  host_department text not null check (host_department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  host_completed_credits integer not null check (host_completed_credits >= 0 and host_completed_credits <= 1000),
  host_cgpa numeric(3,2) check (host_cgpa is null or host_cgpa between 0 and 4),
  show_host_cgpa boolean not null default false,
  additional_members_needed smallint not null check (additional_members_needed between 1 and 10),
  expected_department text not null check (expected_department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  expected_cgpa_min numeric(3,2) not null check (expected_cgpa_min between 0 and 4),
  expected_cgpa_max numeric(3,2) not null check (expected_cgpa_max between 0 and 4 and expected_cgpa_max >= expected_cgpa_min),
  min_completed_credits integer not null check (min_completed_credits >= 0 and min_completed_credits <= 1000),
  additional_info text check (additional_info is null or char_length(additional_info) <= 2000),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_join_applications (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.partner_rooms(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(user_id) on delete restrict,
  applicant_display_name text not null check (char_length(trim(applicant_display_name)) between 1 and 100),
  department text not null check (department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  cgpa numeric(3,2) not null check (cgpa between 0 and 4),
  completed_credits integer not null check (completed_credits >= 0 and completed_credits <= 1000),
  why_join text not null check (char_length(trim(why_join)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  decided_by uuid references public.profiles(user_id) on delete set null,
  decided_at timestamptz,
  host_note text check (host_note is null or char_length(host_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, applicant_user_id),
  check ((status in ('accepted','rejected') and decided_by is not null and decided_at is not null) or
         (status in ('pending','withdrawn') and decided_by is null and decided_at is null))
);

create table public.room_application_private_details (
  application_id uuid primary key references public.room_join_applications(id) on delete cascade,
  contact_link text not null check (char_length(trim(contact_link)) between 3 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.partner_rooms(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  membership_role text not null check (membership_role in ('host','member')),
  application_id uuid unique references public.room_join_applications(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (room_id, user_id),
  check ((membership_role = 'host' and application_id is null) or
         (membership_role = 'member' and application_id is not null))
);

create unique index room_memberships_one_host_per_room on public.room_memberships(room_id) where membership_role = 'host';
create index partner_rooms_open_created_idx on public.partner_rooms(is_open, created_at desc);
create index room_applications_applicant_idx on public.room_join_applications(applicant_user_id, created_at desc);
create index room_applications_room_status_idx on public.room_join_applications(room_id, status, created_at);
create index room_memberships_user_idx on public.room_memberships(user_id, created_at desc);

create table public.faculty (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 200),
  initials text check (initials is null or char_length(trim(initials)) between 1 and 20),
  department text not null check (department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  research_interests text[] not null default '{}',
  summary_note text check (summary_note is null or char_length(summary_note) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faculty_reviews (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculty(id) on delete restrict,
  reviewer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  clarity smallint not null check (clarity between 1 and 10),
  responsiveness smallint not null check (responsiveness between 1 and 10),
  fairness smallint not null check (fairness between 1 and 10),
  workload smallint not null check (workload between 1 and 10),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  moderation_status text not null default 'published' check (moderation_status in ('published','hidden')),
  moderated_by uuid references public.profiles(user_id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, reviewer_user_id),
  check ((moderation_status = 'published' and moderated_by is null and moderated_at is null) or
         (moderation_status = 'hidden' and moderated_by is not null and moderated_at is not null))
);
create unique index faculty_unique_normalized_name_department_idx
  on public.faculty (lower(btrim(name)), department);
create index faculty_reviews_public_idx on public.faculty_reviews(faculty_id, created_at desc) where moderation_status = 'published';

create table public.faculty_add_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(user_id) on delete restrict,
  proposed_name text not null check (char_length(trim(proposed_name)) between 2 and 200),
  proposed_department text not null check (proposed_department in ('CSE','CS','EEE','ESS','ARCH','PHARMACY','BBS')),
  proposed_research_interests text[] not null default '{}',
  rationale text not null check (char_length(trim(rationale)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.profiles(user_id) on delete set null,
  decided_at timestamptz,
  created_faculty_id uuid unique references public.faculty(id) on delete restrict,
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved' and decided_by is not null and decided_at is not null and created_faculty_id is not null) or
         (status = 'rejected' and decided_by is not null and decided_at is not null and created_faculty_id is null) or
         (status = 'pending' and decided_by is null and decided_at is null and created_faculty_id is null))
);
create index faculty_add_requests_status_idx on public.faculty_add_requests(status, created_at);

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  action text not null check (char_length(trim(action)) between 1 and 100),
  target_table text not null check (char_length(trim(target_table)) between 1 and 100),
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index moderation_log_target_idx on public.moderation_log(target_table, target_id, created_at desc);
create index moderation_log_actor_idx on public.moderation_log(actor_user_id, created_at desc);

create function public.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger student_private_set_updated_at before update on public.student_private for each row execute function public.set_updated_at();
create trigger partner_rooms_set_updated_at before update on public.partner_rooms for each row execute function public.set_updated_at();
create trigger room_join_applications_set_updated_at before update on public.room_join_applications for each row execute function public.set_updated_at();
create trigger room_application_private_details_set_updated_at before update on public.room_application_private_details for each row execute function public.set_updated_at();
create trigger faculty_set_updated_at before update on public.faculty for each row execute function public.set_updated_at();
create trigger faculty_reviews_set_updated_at before update on public.faculty_reviews for each row execute function public.set_updated_at();
create trigger faculty_add_requests_set_updated_at before update on public.faculty_add_requests for each row execute function public.set_updated_at();

-- Supabase Auth owns auth.users. This trigger only initializes public data.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.profiles (user_id, display_name, department)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Student'), null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Keep objects created in this migration private before commit. The observed public-schema
-- default ACLs are broad, so RLS and object-scoped revokes must be established in this
-- same transaction rather than deferred to the next migration.
alter table public.profiles enable row level security;
alter table public.student_private enable row level security;
alter table public.app_roles enable row level security;
alter table public.partner_rooms enable row level security;
alter table public.room_join_applications enable row level security;
alter table public.room_application_private_details enable row level security;
alter table public.room_memberships enable row level security;
alter table public.faculty enable row level security;
alter table public.faculty_reviews enable row level security;
alter table public.faculty_add_requests enable row level security;
alter table public.moderation_log enable row level security;

revoke all privileges on table public.profiles, public.student_private, public.app_roles,
  public.partner_rooms, public.room_join_applications, public.room_application_private_details,
  public.room_memberships, public.faculty, public.faculty_reviews,
  public.faculty_add_requests, public.moderation_log
  from public, anon, authenticated, service_role;
revoke all privileges on function public.set_updated_at(), public.handle_new_user()
  from public, anon, authenticated, service_role;

commit;
