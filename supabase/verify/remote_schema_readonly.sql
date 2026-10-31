-- READ ONLY: run manually in Supabase SQL Editor BEFORE considering any migration.
-- Every statement below is SELECT-only. Do not run a migration-history data query
-- until first reviewing the history-object and column-discovery result near the end.
-- Capture all result sets and return them for reconciliation. Visibility depends on
-- the SQL Editor role and PostgreSQL version; no query here asserts complete access.

-- 1. Existing objects and proposed-name conflicts.
select n.nspname as schema_name, c.relname as object_name, c.relkind as object_kind,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced, c.reloptions
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'supabase_migrations')
order by 1, 2;

select n.nspname as schema_name, c.relname as conflicting_relation, c.relkind
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'profiles','student_private','app_roles','partner_rooms','room_join_applications',
  'room_application_private_details','room_memberships','faculty','faculty_reviews',
  'faculty_add_requests','moderation_log','partner_rooms_public','faculty_public','faculty_reviews_public'
) order by 1, 2;

-- 2. Columns, constraints, indexes, sequences, policies, RLS, and table grants.
select table_schema, table_name, column_name, data_type, udt_schema, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema in ('public', 'auth', 'supabase_migrations')
order by 1, 2, ordinal_position;

select n.nspname as schema_name, c.relname as table_name, con.conname,
       pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth') order by 1, 2, 3;

select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes where schemaname in ('public', 'auth') order by 1, 2, 3;

select sequence_schema, sequence_name, data_type, start_value, minimum_value, maximum_value, increment
from information_schema.sequences where sequence_schema = 'public' order by 1, 2;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname = 'public' order by 1, 2, 3;

select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants where table_schema = 'public' order by 1, 2, 3, 4;

-- Post-deployment checks for every Phase 2B table. Missing rows or RLS = false are
-- deployment failures. This is also deliberately explicit about the proposed scope.
with expected(table_name) as (values
  ('profiles'),('student_private'),('app_roles'),('partner_rooms'),
  ('room_join_applications'),('room_application_private_details'),('room_memberships'),
  ('faculty'),('faculty_reviews'),('faculty_add_requests'),('moderation_log')
)
select e.table_name, c.oid is not null as exists_in_public,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pg_catalog.pg_get_userbyid(c.relowner) as owner, c.relacl
from expected e
left join pg_catalog.pg_class c on c.relname = e.table_name and c.relnamespace = 'public'::regnamespace
order by 1;

select object_schema, object_name, object_type, grantee, privilege_type, is_grantable
from information_schema.role_usage_grants where object_schema = 'public' order by 1, 2, 3, 4, 5;

select coalesce(r.rolname, 'DATABASE DEFAULT') as owner_role, n.nspname as schema_name,
       d.defaclobjtype as object_type, d.defaclacl as default_acl
from pg_catalog.pg_default_acl d
join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
left join pg_catalog.pg_roles r on r.oid = d.defaclrole
where n.nspname = 'public' order by 1, 2, 3;

-- 3. Views, functions, function EXECUTE grants/search paths, triggers, extensions.
select table_schema, table_name, view_definition
from information_schema.views where table_schema = 'public' order by 1, 2;

select n.nspname as schema_name, c.relname as view_name,
       pg_catalog.pg_get_userbyid(c.relowner) as owner, c.reloptions,
       pg_catalog.pg_get_viewdef(c.oid, true) as definition
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1, 2;

-- Effective view privileges are checked independently of ACL text because privileges can
-- arise from PUBLIC, direct grants, or membership. No client role may have a write privilege.
with expected(view_name) as (values
  ('partner_rooms_public'),('faculty_public'),('faculty_reviews_public')
), client_role(role_name) as (values ('PUBLIC'),('anon'),('authenticated'),('service_role'))
select e.view_name, r.role_name, c.oid is not null as exists_in_public,
       c.reloptions, v.is_updatable,
       coalesce((select array_agg(x.privilege_type order by x.privilege_type)
                 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
                 where x.grantee = (case when r.role_name = 'PUBLIC' then 0
                    else (select pr.oid from pg_catalog.pg_roles pr where pr.rolname = r.role_name) end)),
                '{}'::text[]) as direct_acl_privileges,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'SELECT') else has_table_privilege(r.role_name, c.oid, 'SELECT') end as can_select,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'INSERT') else has_table_privilege(r.role_name, c.oid, 'INSERT') end as can_insert,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'UPDATE') else has_table_privilege(r.role_name, c.oid, 'UPDATE') end as can_update,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'DELETE') else has_table_privilege(r.role_name, c.oid, 'DELETE') end as can_delete,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'TRUNCATE') else has_table_privilege(r.role_name, c.oid, 'TRUNCATE') end as can_truncate,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'REFERENCES') else has_table_privilege(r.role_name, c.oid, 'REFERENCES') end as can_references,
       case when r.role_name = 'PUBLIC' then exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x where x.grantee = 0 and x.privilege_type = 'TRIGGER') else has_table_privilege(r.role_name, c.oid, 'TRIGGER') end as can_trigger
from expected e cross join client_role r
left join pg_catalog.pg_class c on c.relname = e.view_name and c.relnamespace = 'public'::regnamespace
left join information_schema.views v on v.table_schema = 'public' and v.table_name = e.view_name
order by 1, 2;

select n.nspname as schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.proconfig as function_settings, pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1, 2, 3;

select n.nspname as schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       coalesce(r.rolname, 'PUBLIC') as grantee, x.privilege_type, x.is_grantable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
left join pg_catalog.pg_roles r on r.oid = x.grantee
where n.nspname = 'public' order by 1, 2, 3, 4;

-- Phase 2B RPC execution matrix. Expected: authenticated=true; anon/service_role/PUBLIC=false.
-- Also verify no unexpected overload shares one of these RPC names.
with expected(function_name) as (values
  ('create_partner_room'),('submit_room_application'),('withdraw_room_application'),
  ('decide_room_application'),('update_own_faculty_review'),
  ('decide_faculty_add_request'),('moderate_faculty_review'),('is_admin_or_moderator'),('is_admin'),
  ('set_updated_at'),('handle_new_user')
), role_matrix(role_name) as (values ('PUBLIC'),('anon'),('authenticated'),('service_role'))
select e.function_name, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.oid is not null as exists_in_public, p.prosecdef as security_definer,
       p.proconfig as function_settings, r.role_name,
       exists (
              select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
              where x.grantee = (case when r.role_name = 'PUBLIC' then 0
                 else (select pr.oid from pg_catalog.pg_roles pr where pr.rolname = r.role_name) end)
                and x.privilege_type = 'EXECUTE'
            ) as direct_execute_grant,
       case when r.role_name = 'PUBLIC' then exists (
              select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
              where x.grantee = 0 and x.privilege_type = 'EXECUTE'
            ) else has_function_privilege(r.role_name, p.oid, 'EXECUTE') end as effective_can_execute
from expected e
left join pg_catalog.pg_proc p on p.proname = e.function_name and p.pronamespace = 'public'::regnamespace
cross join role_matrix r
order by 1, 2, 6;

select event_object_schema, event_object_table, trigger_name, action_timing,
       event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth') order by 1, 2, 3;

select extname, extversion, extnamespace::regnamespace::text as schema_name
from pg_catalog.pg_extension order by 1;

-- 4. Proposed function-name conflicts.
select n.nspname as schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as function_settings
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'set_updated_at','handle_new_user','is_admin_or_moderator','is_admin','create_partner_room',
  'submit_room_application','withdraw_room_application','decide_room_application',
  'update_own_faculty_review','decide_faculty_add_request','moderate_faculty_review'
) order by 1, 2, 3;

-- 5. Migration-history discovery only. Do NOT select history data until reviewing
-- these results. Supabase CLI history schema/table/columns can vary by environment.
select n.nspname as schema_name, c.relname as relation_name, c.relkind,
       c.oid::regclass::text as qualified_name
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('supabase_migrations', 'public')
  and (c.relname ilike '%migration%' or c.relname ilike '%schema%')
order by 1, 2;

select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema in ('supabase_migrations', 'public')
  and (table_name ilike '%migration%' or table_name ilike '%schema%')
order by 1, 2, ordinal_position;

-- Operator follow-up after inspecting the two discovery result sets:
-- Write a separate SELECT using only the returned qualified history table and columns.
-- Do not assume `supabase_migrations.schema_migrations`, `schemaname`, `tablename`,
-- or `applied_at` exist. Distinguish any CLI history relation from application tables.
--
-- Result-capture checklist: save the object inventory/conflict rows; public/auth columns,
-- constraints, indexes, sequences, policies and grants; default ACLs; view definitions,
-- owners and reloptions; function definitions/owners/settings/EXECUTE ACLs; triggers;
-- extensions; and both migration-history discovery result sets. Catalog visibility may be
-- incomplete for the executing role; report missing or permission-limited result sets.
-- Before deployment, explicitly reconcile any public-schema default ACL that grants to
-- PUBLIC, anon, authenticated, or service_role. The migrations counter such grants only
-- for their named objects; they intentionally do not change global default privileges.
