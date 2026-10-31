/* Legacy multi-result audit retained as comments for traceability only.
-- READ ONLY Phase 4 deployment-readiness catalog audit.
-- Run only in a controlled validation database or approved production read-only session.
-- Every statement below is SELECT-only. It neither applies migrations nor changes data.

-- 1. Exact function signatures, owner, SECURITY DEFINER, search path / proconfig.
-- `argument_types` intentionally checks PostgreSQL function identity (name + argument types).
WITH expected(proname, argument_types) AS (VALUES
  ('create_partner_room', 'text,text,integer,numeric,boolean,smallint,text,numeric,numeric,integer,text'),
  ('submit_room_application', 'uuid,text,numeric,integer,text,text'),
  ('withdraw_room_application', 'uuid'),
  ('decide_room_application', 'uuid,text,text'),
  ('update_own_faculty_review', 'uuid,smallint,smallint,smallint,smallint,text'),
  ('decide_faculty_add_request', 'uuid,text,text'),
  ('moderate_faculty_review', 'uuid,text'),
  ('is_admin', ''), ('is_admin_or_moderator', ''),
  ('create_own_faculty_review', 'uuid,smallint,smallint,smallint,smallint,text'),
  ('submit_faculty_add_request', 'text,text,text[],text')
), actual AS (
  SELECT p.oid, p.proname,
         regexp_replace(pg_catalog.oidvectortypes(p.proargtypes), '[[:space:]]+', '', 'g') AS argument_types,
         p.prosecdef, pg_catalog.pg_get_userbyid(p.proowner) AS owner,
         p.proconfig, pg_catalog.pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN (SELECT proname FROM expected)
    AND p.prokind = 'f'
), expected_rows AS (
  SELECT 'expected_signature'::text AS inventory_result, e.proname, e.argument_types,
         a.oid::regprocedure::text AS identity, a.oid IS NOT NULL AS signature_exists,
         a.prosecdef AS security_definer, a.owner, a.proconfig, a.definition
  FROM expected e LEFT JOIN actual a
    ON a.proname = e.proname AND a.argument_types = e.argument_types
), unexpected_rows AS (
  SELECT 'unexpected_overload'::text AS inventory_result, a.proname, a.argument_types,
         a.oid::regprocedure::text AS identity, false AS signature_exists,
         a.prosecdef AS security_definer, a.owner, a.proconfig, a.definition
  FROM actual a LEFT JOIN expected e
    ON e.proname = a.proname AND e.argument_types = a.argument_types
  WHERE e.proname IS NULL
), procedure_rows AS (
  SELECT 'same_name_procedure'::text AS inventory_result, p.proname,
         regexp_replace(pg_catalog.oidvectortypes(p.proargtypes), '[[:space:]]+', '', 'g') AS argument_types,
         p.oid::regprocedure::text AS identity, false AS signature_exists,
         false AS security_definer, pg_catalog.pg_get_userbyid(p.proowner) AS owner,
         p.proconfig, pg_catalog.pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN (SELECT proname FROM expected)
    AND p.prokind = 'p'
)
SELECT * FROM expected_rows
UNION ALL
SELECT * FROM unexpected_rows
UNION ALL
SELECT * FROM procedure_rows
ORDER BY proname, argument_types, inventory_result;

-- 2. Direct and effective EXECUTE for client roles and each function owner.
WITH expected(proname) AS (VALUES
  ('create_partner_room'), ('submit_room_application'), ('withdraw_room_application'),
  ('decide_room_application'), ('update_own_faculty_review'),
  ('decide_faculty_add_request'), ('moderate_faculty_review'),
  ('is_admin'), ('is_admin_or_moderator'),
  ('create_own_faculty_review'), ('submit_faculty_add_request')
), functions AS (
  SELECT p.oid, p.proname, p.proowner, pg_catalog.pg_get_userbyid(p.proowner) AS owner
  FROM pg_catalog.pg_proc p JOIN expected e ON e.proname = p.proname
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
), roles AS (
  SELECT 'PUBLIC'::text AS role_name UNION ALL SELECT 'anon' UNION ALL
  SELECT 'authenticated' UNION ALL SELECT 'service_role'
), role_matrix AS (
  SELECT f.*, r.role_name FROM functions f CROSS JOIN roles r
  UNION ALL SELECT f.*, f.owner FROM functions f
)
SELECT proname, oid::regprocedure::text AS identity, owner, role_name,
       EXISTS (
         SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_catalog.pg_proc WHERE oid = role_matrix.oid), acldefault('f', proowner))) x
         WHERE x.grantee = CASE WHEN role_name = 'PUBLIC' THEN 0 ELSE (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = role_name) END
           AND x.privilege_type = 'EXECUTE'
       ) AS direct_execute,
       CASE WHEN role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_catalog.pg_proc WHERE oid = role_matrix.oid), acldefault('f', proowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'
       ) ELSE has_function_privilege(role_name, oid, 'EXECUTE') END AS effective_execute
FROM role_matrix ORDER BY proname, identity, role_name;

-- 3. Owners and RLS state for all Phase 2B application tables.
WITH expected(relname) AS (VALUES
  ('profiles'), ('student_private'), ('app_roles'), ('partner_rooms'),
  ('room_join_applications'), ('room_application_private_details'), ('room_memberships'),
  ('faculty'), ('faculty_reviews'), ('faculty_add_requests'), ('moderation_log')
)
SELECT e.relname AS table_name, c.oid IS NOT NULL AS exists_in_public,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls, c.relacl
FROM expected e
LEFT JOIN pg_catalog.pg_class c ON c.relname = e.relname AND c.relnamespace = 'public'::regnamespace
ORDER BY e.relname;

-- 4. Effective table privileges held by every SECURITY DEFINER function owner.
WITH functions AS (
  SELECT DISTINCT p.proowner, pg_catalog.pg_get_userbyid(p.proowner) AS owner
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
    'create_partner_room','submit_room_application','withdraw_room_application',
    'decide_room_application','update_own_faculty_review','decide_faculty_add_request',
    'moderate_faculty_review','is_admin','is_admin_or_moderator',
    'create_own_faculty_review','submit_faculty_add_request'
  ) AND p.prosecdef AND p.prokind = 'f'
), tables AS (
  SELECT c.oid, c.relname FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
    AND c.relname IN ('profiles','student_private','app_roles','partner_rooms',
      'room_join_applications','room_application_private_details','room_memberships',
      'faculty','faculty_reviews','faculty_add_requests','moderation_log')
)
SELECT f.owner, t.relname AS table_name,
       has_table_privilege(f.owner, t.oid, 'SELECT') AS can_select,
       has_table_privilege(f.owner, t.oid, 'INSERT') AS can_insert,
       has_table_privilege(f.owner, t.oid, 'UPDATE') AS can_update,
       has_table_privilege(f.owner, t.oid, 'DELETE') AS can_delete
FROM functions f CROSS JOIN tables t ORDER BY f.owner, t.relname;

-- 5. Privilege-bypass characteristics of all relevant roles.
WITH function_owners AS (
  SELECT DISTINCT pg_catalog.pg_get_userbyid(p.proowner) AS role_name
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
    'create_partner_room','submit_room_application','withdraw_room_application',
    'decide_room_application','update_own_faculty_review','decide_faculty_add_request',
    'moderate_faculty_review','is_admin','is_admin_or_moderator',
    'create_own_faculty_review','submit_faculty_add_request'
  ) AND p.prokind = 'f'
), roles AS (
  SELECT role_name FROM function_owners UNION SELECT 'anon' UNION SELECT 'authenticated'
  UNION SELECT 'service_role' UNION SELECT 'postgres' UNION SELECT 'supabase_admin'
)
SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit, r.rolcreaterole, r.rolcanlogin
FROM roles wanted LEFT JOIN pg_catalog.pg_roles r ON r.rolname = wanted.role_name
ORDER BY wanted.role_name;

-- 6. Relevant policies exactly as deployed.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('app_roles','faculty','faculty_reviews','faculty_add_requests','moderation_log')
ORDER BY tablename, policyname;

-- 7. Public-view owner, security options, definitions, and effective ACLs.
WITH expected(relname) AS (VALUES ('partner_rooms_public'), ('faculty_public'), ('faculty_reviews_public')),
roles(role_name) AS (VALUES ('PUBLIC'), ('anon'), ('authenticated'), ('service_role'))
SELECT e.relname AS view_name, c.oid IS NOT NULL AS exists_in_public,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.reloptions,
       pg_catalog.pg_get_viewdef(c.oid, true) AS definition, r.role_name,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'SELECT'
       ) ELSE has_table_privilege(r.role_name, c.oid, 'SELECT') END AS can_select,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'INSERT') ELSE has_table_privilege(r.role_name, c.oid, 'INSERT') END AS can_insert,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'UPDATE') ELSE has_table_privilege(r.role_name, c.oid, 'UPDATE') END AS can_update,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'DELETE') ELSE has_table_privilege(r.role_name, c.oid, 'DELETE') END AS can_delete,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'TRUNCATE') ELSE has_table_privilege(r.role_name, c.oid, 'TRUNCATE') END AS can_truncate,
       (CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'INSERT') ELSE has_table_privilege(r.role_name, c.oid, 'INSERT') END
        OR CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'UPDATE') ELSE has_table_privilege(r.role_name, c.oid, 'UPDATE') END
        OR CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'DELETE') ELSE has_table_privilege(r.role_name, c.oid, 'DELETE') END
        OR CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'TRUNCATE') ELSE has_table_privilege(r.role_name, c.oid, 'TRUNCATE') END) AS has_any_write_privilege
FROM expected e CROSS JOIN roles r
LEFT JOIN pg_catalog.pg_class c ON c.relname = e.relname AND c.relnamespace = 'public'::regnamespace
ORDER BY e.relname, r.role_name;

-- 8. Direct authenticated client write paths after Phase 4 migrations.
WITH targets(relname) AS (VALUES ('faculty_reviews'), ('faculty_add_requests'), ('app_roles')),
roles(role_name) AS (VALUES ('PUBLIC'), ('anon'), ('authenticated'), ('service_role'))
SELECT t.relname AS table_name, r.role_name,
       c.oid IS NOT NULL AS exists_in_public,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'INSERT'
       ) ELSE has_table_privilege(r.role_name, c.oid, 'INSERT') END AS can_insert,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'UPDATE'
       ) ELSE has_table_privilege(r.role_name, c.oid, 'UPDATE') END AS can_update,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'DELETE'
       ) ELSE has_table_privilege(r.role_name, c.oid, 'DELETE') END AS can_delete,
       array_agg(p.policyname ORDER BY p.policyname) FILTER (WHERE p.policyname IS NOT NULL) AS policies
FROM targets t CROSS JOIN roles r
LEFT JOIN pg_catalog.pg_class c ON c.relname = t.relname AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_catalog.pg_policies p ON p.schemaname = 'public' AND p.tablename = t.relname
GROUP BY t.relname, r.role_name, c.oid ORDER BY t.relname, r.role_name;

-- 9. Schema CREATE, schema USAGE, and default-ACL risk.
WITH roles(role_name) AS (VALUES ('PUBLIC'), ('anon'), ('authenticated'), ('service_role'))
SELECT n.nspname AS schema_name, r.role_name,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'USAGE'
       ) ELSE has_schema_privilege(r.role_name, n.oid, 'USAGE') END AS can_use,
       CASE WHEN r.role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1 FROM aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) x
         WHERE x.grantee = 0 AND x.privilege_type = 'CREATE'
       ) ELSE has_schema_privilege(r.role_name, n.oid, 'CREATE') END AS can_create
FROM pg_catalog.pg_namespace n CROSS JOIN roles r
WHERE n.nspname IN ('public','auth','storage') ORDER BY n.nspname, r.role_name;

SELECT coalesce(owner.rolname, 'DATABASE DEFAULT') AS default_privilege_owner,
       CASE WHEN d.defaclnamespace = 0 THEN 'DATABASE-WIDE' ELSE n.nspname END AS scope,
       d.defaclobjtype AS object_type, d.defaclacl AS acl
FROM pg_catalog.pg_default_acl d
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
LEFT JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
WHERE d.defaclnamespace IN (0, 'public'::regnamespace)
ORDER BY default_privilege_owner, scope, object_type;
*/

-- Consolidated Phase 4 catalog audit. Exactly one SELECT result set.
WITH
expected_migrations(version) AS (VALUES
  ('20261028190000'),('20261028190100'),('20261028190200'),
  ('20261031120000'),('20261031121000'),('20261031122000')
),
expected_functions(proname, argument_types, expected_path) AS (VALUES
  ('create_partner_room','text,text,integer,numeric,boolean,smallint,text,numeric,numeric,integer,text','search_path=pg_catalog, public, pg_temp'),
  ('submit_room_application','uuid,text,numeric,integer,text,text','search_path=pg_catalog, public, pg_temp'),
  ('withdraw_room_application','uuid','search_path=pg_catalog, public, pg_temp'),
  ('decide_room_application','uuid,text,text','search_path=pg_catalog, public, pg_temp'),
  ('update_own_faculty_review','uuid,smallint,smallint,smallint,smallint,text','search_path=pg_catalog, public, pg_temp'),
  ('decide_faculty_add_request','uuid,text,text','search_path=pg_catalog, public, pg_temp'),
  ('moderate_faculty_review','uuid,text','search_path=pg_catalog, public, pg_temp'),
  ('is_admin','','search_path=pg_catalog, pg_temp'),
  ('is_admin_or_moderator','','search_path=pg_catalog, pg_temp'),
  ('create_own_faculty_review','uuid,smallint,smallint,smallint,smallint,text','search_path=pg_catalog, public, pg_temp'),
  ('submit_faculty_add_request','text,text,text[],text','search_path=pg_catalog, public, pg_temp')
),
actual_functions AS (
  SELECT p.oid, p.proname, regexp_replace(pg_catalog.oidvectortypes(p.proargtypes), '[[:space:]]+', '', 'g') AS argument_types,
         p.prosecdef, pg_catalog.pg_get_userbyid(p.proowner) AS owner, p.proconfig
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND p.proname IN (SELECT proname FROM expected_functions)
),
expected_tables(relname) AS (VALUES
  ('profiles'),('student_private'),('app_roles'),('partner_rooms'),
  ('room_join_applications'),('room_application_private_details'),('room_memberships'),
  ('faculty'),('faculty_reviews'),('faculty_add_requests'),('moderation_log')
),
expected_final_policies(tablename, policyname, expected_cmd) AS (VALUES
  ('profiles','profiles_select_own','SELECT'),('profiles','profiles_update_own','UPDATE'),
  ('student_private','student_private_select_own_or_admin','SELECT'),('student_private','student_private_insert_own','INSERT'),('student_private','student_private_update_own','UPDATE'),
  ('partner_rooms','rooms_select_own_or_admin','SELECT'),('room_join_applications','applications_select_owner_host_or_admin','SELECT'),
  ('room_application_private_details','private_application_details_select_accepted_parties','SELECT'),
  ('room_memberships','memberships_select_participant_host_or_admin','SELECT'),('faculty','faculty_admin_manage','ALL'),
  ('faculty_reviews','reviews_select_own_or_admin','SELECT'),('faculty_add_requests','faculty_requests_select_own_or_admin','SELECT'),
  ('moderation_log','moderation_log_admin_select','SELECT')
),
tables AS (
  SELECT e.relname, c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  FROM expected_tables e LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = 'public'::regnamespace AND c.relname = e.relname AND c.relkind IN ('r','p')
),
client_roles(role_name) AS (VALUES ('PUBLIC'),('anon'),('authenticated'),('service_role')),
function_owners AS (
  SELECT DISTINCT owner FROM actual_functions WHERE prosecdef
),
relevant_roles(role_name) AS (
  SELECT role_name FROM client_roles UNION SELECT owner FROM function_owners UNION SELECT 'postgres'
),
expected_views(relname) AS (VALUES ('partner_rooms_public'),('faculty_public'),('faculty_reviews_public')),
views AS (
  SELECT e.relname, c.oid, c.relowner, c.relacl, c.reloptions
  FROM expected_views e LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = 'public'::regnamespace AND c.relname=e.relname AND c.relkind='v'
),
history_candidates AS (
  SELECT n.nspname || '.' || c.relname AS name
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='supabase_migrations' AND c.relname='schema_migrations')
     OR (c.relname ILIKE '%migration%' AND n.nspname IN ('public','supabase_migrations'))
),
report AS (
  SELECT 'migration_history'::text category, m.version object_name, 'migration_version_presence' check_name,
         'NOT_VERIFIABLE' status, coalesce((SELECT string_agg(name, ', ') FROM history_candidates), 'no candidate relation') observed_value,
         'applied migration history entry' expected_value, 'BLOCKER' severity,
         'Static read-only SQL cannot safely read arbitrary history-table rows without dynamic SQL; inspect a discovered relation and its columns separately.' details
  FROM expected_migrations m

  UNION ALL
  SELECT 'function', e.proname || '(' || e.argument_types || ')', 'exact_signature',
         CASE WHEN a.oid IS NULL THEN 'FAIL' WHEN a.prosecdef AND coalesce(array_to_string(a.proconfig, ','),'') LIKE '%' || e.expected_path || '%' THEN 'PASS' ELSE 'WARNING' END,
         coalesce(a.oid::regprocedure::text, 'missing'), 'SECURITY DEFINER; ' || e.expected_path,
         CASE WHEN a.oid IS NULL THEN 'BLOCKER' ELSE 'HIGH' END,
         CASE WHEN a.oid IS NULL THEN 'Expected function signature is absent.' ELSE 'Owner=' || a.owner || '; proconfig=' || coalesce(array_to_string(a.proconfig, ','),'NULL') END
  FROM expected_functions e LEFT JOIN actual_functions a ON a.proname=e.proname AND a.argument_types=e.argument_types

  UNION ALL
  SELECT 'function', a.oid::regprocedure::text, 'unexpected_overload', 'WARNING', a.oid::regprocedure::text,
         'no unexpected same-name function overload', 'HIGH', 'Review this function before deployment.'
  FROM actual_functions a LEFT JOIN expected_functions e ON e.proname=a.proname AND e.argument_types=a.argument_types
  WHERE e.proname IS NULL

  UNION ALL
  SELECT 'function', p.oid::regprocedure::text, 'same_name_procedure', 'WARNING', p.oid::regprocedure::text,
         'no same-name procedure', 'HIGH', 'Procedures cannot satisfy expected function signatures.'
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace='public'::regnamespace AND p.prokind='p' AND p.proname IN (SELECT proname FROM expected_functions)

  UNION ALL
  SELECT 'function_acl', a.oid::regprocedure::text || ':' || r.role_name, 'effective_execute',
         CASE WHEN a.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN r.role_name=a.owner AND has_function_privilege(r.role_name,a.oid,'EXECUTE') THEN 'PASS' WHEN r.role_name='authenticated' AND has_function_privilege(r.role_name,a.oid,'EXECUTE') THEN 'PASS'
              WHEN r.role_name IN ('PUBLIC','anon','service_role') AND NOT CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') ELSE has_function_privilege(r.role_name,a.oid,'EXECUTE') END THEN 'PASS' ELSE 'FAIL' END,
         jsonb_build_object('direct_acl',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') ELSE EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE x.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=r.role_name) AND x.privilege_type='EXECUTE') END,'effective',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') ELSE has_function_privilege(r.role_name,a.oid,'EXECUTE') END)::text,
         CASE WHEN r.role_name IN ('authenticated',a.owner) THEN 'effective EXECUTE=true' ELSE 'effective EXECUTE=false' END, 'HIGH', 'Owner=' || a.owner || '; owner execution may be implicit rather than a direct ACL grant.'
  FROM actual_functions a JOIN pg_catalog.pg_proc p ON p.oid=a.oid
  CROSS JOIN LATERAL (SELECT role_name FROM client_roles UNION SELECT a.owner) r

  UNION ALL
  SELECT 'table', t.relname, 'existence_and_rls',
         CASE WHEN t.oid IS NULL THEN 'FAIL' WHEN t.relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN t.oid IS NULL THEN 'missing' ELSE 'owner=' || pg_catalog.pg_get_userbyid(t.relowner) || '; rls=' || t.relrowsecurity || '; force_rls=' || t.relforcerowsecurity END,
         'exists; RLS enabled; FORCE RLS source expectation=false', CASE WHEN t.oid IS NULL THEN 'BLOCKER' ELSE 'HIGH' END,
         'Table ownership and FORCE RLS must be evaluated separately from function ownership.'
  FROM tables t

  UNION ALL
  SELECT 'table_acl', t.relname || ':' || r.role_name, 'effective_privileges',
         CASE WHEN t.oid IS NULL THEN 'NOT_VERIFIABLE' ELSE 'INFO' END,
         CASE WHEN t.oid IS NULL THEN 'missing' ELSE jsonb_build_object('select', CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,t.oid,'SELECT') END,'insert',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='INSERT') ELSE has_table_privilege(r.role_name,t.oid,'INSERT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_table_privilege(r.role_name,t.oid,'UPDATE') END,'delete',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='DELETE') ELSE has_table_privilege(r.role_name,t.oid,'DELETE') END)::text END,
         'role-specific least privilege', 'INFO', 'PUBLIC uses ACL expansion; actual roles use has_table_privilege.'
  FROM tables t CROSS JOIN relevant_roles r

  UNION ALL
  SELECT 'role', coalesce(r.rolname, wanted.role_name), 'security_attributes',
         CASE WHEN r.rolname IS NULL THEN 'WARNING' WHEN r.rolsuper OR r.rolbypassrls THEN 'WARNING' ELSE 'INFO' END,
         coalesce(jsonb_build_object('superuser',r.rolsuper,'bypassrls',r.rolbypassrls,'inherit',r.rolinherit,'createrole',r.rolcreaterole,'login',r.rolcanlogin)::text,'role missing'),
         'client roles neither superuser nor BYPASSRLS', CASE WHEN r.rolsuper THEN 'HIGH' ELSE 'INFO' END,
         'Function owners with superuser/BYPASSRLS require explicit deployment approval.'
  FROM relevant_roles wanted LEFT JOIN pg_catalog.pg_roles r ON r.rolname=wanted.role_name

  UNION ALL
  SELECT 'policy', p.tablename || ':' || p.policyname, 'policy_definition',
         CASE WHEN (p.tablename,p.policyname) IN (('faculty_reviews','reviews_insert_own'),('faculty_reviews','reviews_delete_own'),('faculty_add_requests','faculty_requests_insert_own')) THEN 'WARNING' WHEN EXISTS (SELECT 1 FROM expected_final_policies e WHERE e.tablename=p.tablename AND e.policyname=p.policyname) THEN 'INFO' ELSE 'WARNING' END,
         jsonb_build_object('command',p.cmd,'roles',p.roles,'using',p.qual,'with_check',p.with_check)::text,
         'Phase 4 direct-write policies absent after hardening', CASE WHEN (p.tablename,p.policyname) IN (('faculty_reviews','reviews_insert_own'),('faculty_reviews','reviews_delete_own'),('faculty_add_requests','faculty_requests_insert_own')) THEN 'HIGH' ELSE 'INFO' END,
         'Policy expressions are reported; names alone are not a safety verdict.'
  FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename IN (SELECT relname FROM expected_tables)

  UNION ALL
  SELECT 'policy', e.tablename || ':' || e.policyname, 'expected_policy_presence',
         CASE WHEN NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname) THEN 'FAIL' WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname AND p.cmd=e.expected_cmd AND p.roles=ARRAY['authenticated']::name[]) THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname) THEN 'present' ELSE 'missing' END,
         e.expected_cmd || ' TO authenticated', 'HIGH', 'USING/WITH CHECK source expressions are emitted in policy_definition and require target-specific deparser review.'
  FROM expected_final_policies e

  UNION ALL
  SELECT 'policy', e.tablename || ':' || e.policyname, 'using_with_check_source_comparison', 'NOT_VERIFIABLE',
         coalesce((SELECT jsonb_build_object('using',p.qual,'with_check',p.with_check)::text FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname),'missing'),
         'exact source expression in 20261028190100_phase_2b_rls_and_views.sql', 'MEDIUM', 'PostgreSQL deparser formatting is not safely comparable to source text using a static catalog query.'
  FROM expected_final_policies e

  UNION ALL
  SELECT 'policy', n.tablename || ':' || n.policyname, 'expected_direct_write_policy_absent',
         CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=n.tablename AND p.policyname=n.policyname) THEN 'FAIL' ELSE 'PASS' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=n.tablename AND p.policyname=n.policyname) THEN 'present' ELSE 'absent' END,
         'absent after Phase 4 hardening', 'HIGH', 'Applies only after the corresponding Phase 4 migration is deployed.'
  FROM (VALUES ('faculty_reviews','reviews_insert_own'),('faculty_reviews','reviews_delete_own'),('faculty_add_requests','faculty_requests_insert_own')) n(tablename,policyname)

  UNION ALL
  SELECT 'view', v.relname, 'definition_and_owner', CASE WHEN v.oid IS NULL THEN 'FAIL' WHEN coalesce(v.reloptions, ARRAY[]::text[]) @> ARRAY['security_barrier=true'] AND NOT coalesce(v.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true'] THEN 'PASS' ELSE 'WARNING' END,
         CASE WHEN v.oid IS NULL THEN 'missing' ELSE 'owner=' || pg_catalog.pg_get_userbyid(v.relowner) || '; options=' || coalesce(array_to_string(v.reloptions,','),'NULL') END,
         'trusted owner; security_barrier=true; security_invoker=false (explicit or PostgreSQL default)', CASE WHEN v.oid IS NULL THEN 'BLOCKER' ELSE 'HIGH' END,
         CASE WHEN v.oid IS NULL THEN 'View missing.' ELSE pg_catalog.pg_get_viewdef(v.oid,true) END
  FROM views v

  UNION ALL
  SELECT 'view_acl', v.relname || ':' || r.role_name, 'effective_select_insert_update_delete_truncate',
         CASE WHEN v.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN (CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')) ELSE has_table_privilege(r.role_name,v.oid,'INSERT') OR has_table_privilege(r.role_name,v.oid,'UPDATE') OR has_table_privilege(r.role_name,v.oid,'DELETE') OR has_table_privilege(r.role_name,v.oid,'TRUNCATE') END) THEN 'FAIL' ELSE 'PASS' END,
         CASE WHEN v.oid IS NULL THEN 'missing' ELSE jsonb_build_object('select',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,v.oid,'SELECT') END,'insert',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='INSERT') ELSE has_table_privilege(r.role_name,v.oid,'INSERT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_table_privilege(r.role_name,v.oid,'UPDATE') END,'delete',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='DELETE') ELSE has_table_privilege(r.role_name,v.oid,'DELETE') END,'truncate',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='TRUNCATE') ELSE has_table_privilege(r.role_name,v.oid,'TRUNCATE') END)::text END,
         'read-only public views', 'HIGH', 'PUBLIC uses ACL expansion; real roles use effective privilege checks.'
  FROM views v CROSS JOIN client_roles r

  UNION ALL
  SELECT 'direct_write', t.relname || ':' || r.role_name, 'insert_update_delete_truncate',
         CASE WHEN t.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN (CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')) ELSE has_table_privilege(r.role_name,t.oid,'INSERT') OR has_table_privilege(r.role_name,t.oid,'UPDATE') OR has_table_privilege(r.role_name,t.oid,'DELETE') OR has_table_privilege(r.role_name,t.oid,'TRUNCATE') END) THEN 'FAIL' ELSE 'PASS' END,
         CASE WHEN t.oid IS NULL THEN 'missing' ELSE jsonb_build_object('insert',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='INSERT') ELSE has_table_privilege(r.role_name,t.oid,'INSERT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_table_privilege(r.role_name,t.oid,'UPDATE') END,'delete',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='DELETE') ELSE has_table_privilege(r.role_name,t.oid,'DELETE') END,'truncate',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='TRUNCATE') ELSE has_table_privilege(r.role_name,t.oid,'TRUNCATE') END)::text END,
         'all false after Phase 4 hardening', 'HIGH', 'PUBLIC is inspected through ACL expansion.'
  FROM tables t CROSS JOIN client_roles r WHERE t.relname IN ('faculty_reviews','faculty_add_requests','app_roles')

  UNION ALL
  SELECT 'schema', n.nspname || ':' || r.role_name, 'usage_and_create',
         CASE WHEN r.role_name IN ('PUBLIC','anon','authenticated','service_role') AND (CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='CREATE') ELSE has_schema_privilege(r.role_name,n.oid,'CREATE') END) THEN 'FAIL' ELSE 'PASS' END,
         jsonb_build_object('owner',pg_catalog.pg_get_userbyid(n.nspowner),'usage',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='USAGE') ELSE has_schema_privilege(r.role_name,n.oid,'USAGE') END,'create',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='CREATE') ELSE has_schema_privilege(r.role_name,n.oid,'CREATE') END)::text,
         'no client CREATE on public', 'HIGH', 'PUBLIC uses ACL expansion.'
  FROM pg_catalog.pg_namespace n CROSS JOIN (VALUES ('PUBLIC'),('anon'),('authenticated'),('service_role'),('postgres')) r(role_name)
  WHERE n.nspname='public'

  UNION ALL
  SELECT 'default_acl', coalesce(owner.rolname,'DATABASE DEFAULT') || ':' || CASE WHEN d.defaclnamespace=0 THEN 'DATABASE-WIDE' ELSE n.nspname END || ':' || d.defaclobjtype::text,
         'default_acl', 'INFO', coalesce(d.defaclacl::text,'NULL'), 'review PUBLIC/client grants explicitly', 'MEDIUM',
         'Absent rows do not prove safety; PostgreSQL defaults may still apply.'
  FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN pg_catalog.pg_roles owner ON owner.oid=d.defaclrole
  WHERE d.defaclnamespace IN (0,'public'::regnamespace)

  UNION ALL
  SELECT 'default_acl', coalesce(owner.rolname,'DATABASE DEFAULT') || ':' || CASE WHEN d.defaclnamespace=0 THEN 'DATABASE-WIDE' ELSE n.nspname END || ':' || d.defaclobjtype::text,
         'public_default_grants', CASE WHEN EXISTS (SELECT 1 FROM aclexplode(coalesce(d.defaclacl,acldefault(d.defaclobjtype, d.defaclrole))) x WHERE x.grantee=0) THEN 'WARNING' ELSE 'INFO' END,
         coalesce((SELECT string_agg(x.privilege_type, ', ' ORDER BY x.privilege_type) FROM aclexplode(coalesce(d.defaclacl,acldefault(d.defaclobjtype,d.defaclrole))) x WHERE x.grantee=0),'none'),
         'no unexpected PUBLIC default grants', 'MEDIUM', 'Database-wide and public-schema defaults are both included.'
  FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN pg_catalog.pg_roles owner ON owner.oid=d.defaclrole
  WHERE d.defaclnamespace IN (0,'public'::regnamespace)

  UNION ALL
  SELECT 'sequence', coalesce(s.relname,t.relname), 'owned_sequence_inventory',
         CASE WHEN s.oid IS NULL THEN 'PASS' ELSE 'WARNING' END,
         coalesce('owner=' || pg_catalog.pg_get_userbyid(s.relowner) || '; acl=' || coalesce(s.relacl::text,'NULL'),'none'),
         'no application sequences expected: UUID defaults are used', CASE WHEN s.oid IS NULL THEN 'INFO' ELSE 'MEDIUM' END,
         'Sequences owned by an expected table require review.'
  FROM tables t LEFT JOIN pg_catalog.pg_depend d ON d.refobjid=t.oid AND d.deptype IN ('a','i')
  LEFT JOIN pg_catalog.pg_class s ON s.oid=d.objid AND s.relkind='S'

  UNION ALL
  SELECT 'sequence_acl', s.relname || ':' || r.role_name, 'effective_usage_select_update', 'INFO',
         jsonb_build_object('usage',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(s.relacl,acldefault('S',s.relowner))) x WHERE x.grantee=0 AND x.privilege_type='USAGE') ELSE has_sequence_privilege(r.role_name,s.oid,'USAGE') END,'select',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(s.relacl,acldefault('S',s.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_sequence_privilege(r.role_name,s.oid,'SELECT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS (SELECT 1 FROM aclexplode(coalesce(s.relacl,acldefault('S',s.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_sequence_privilege(r.role_name,s.oid,'UPDATE') END)::text,
         'no application sequences expected', 'MEDIUM', 'Only sequences dependent on expected tables are listed.'
  FROM tables t JOIN pg_catalog.pg_depend d ON d.refobjid=t.oid AND d.deptype IN ('a','i')
  JOIN pg_catalog.pg_class s ON s.oid=d.objid AND s.relkind='S' CROSS JOIN client_roles r
)
SELECT category, object_name, check_name, status, observed_value, expected_value, severity, details
FROM report
ORDER BY category, object_name, check_name;
