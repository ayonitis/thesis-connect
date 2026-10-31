-- Thesis Connect Phase 2B + Phase 4 production inspection (PostgreSQL 17).
-- READ ONLY: one WITH ... SELECT; no DDL, DML, transaction control, or session changes.
-- Export every row. PASS applies only to the stated catalog condition.
WITH
expected_tables(relname) AS (VALUES
 ('profiles'),('student_private'),('app_roles'),('partner_rooms'),('room_join_applications'),
 ('room_application_private_details'),('room_memberships'),('faculty'),('faculty_reviews'),
 ('faculty_add_requests'),('moderation_log')
),
expected_functions(proname,args,return_type,path,client_callable) AS (VALUES
 ('create_partner_room','text,text,integer,numeric,boolean,smallint,text,numeric,numeric,integer,text','uuid','search_path=pg_catalog, public, pg_temp',true),
 ('submit_room_application','uuid,text,numeric,integer,text,text','uuid','search_path=pg_catalog, public, pg_temp',true),
 ('withdraw_room_application','uuid','void','search_path=pg_catalog, public, pg_temp',true),
 ('decide_room_application','uuid,text,text','void','search_path=pg_catalog, public, pg_temp',true),
 ('update_own_faculty_review','uuid,smallint,smallint,smallint,smallint,text','void','search_path=pg_catalog, public, pg_temp',true),
 ('decide_faculty_add_request','uuid,text,text','void','search_path=pg_catalog, public, pg_temp',true),
 ('moderate_faculty_review','uuid,text','void','search_path=pg_catalog, public, pg_temp',true),
 ('create_own_faculty_review','uuid,smallint,smallint,smallint,smallint,text','uuid','search_path=pg_catalog, public, pg_temp',true),
 ('submit_faculty_add_request','text,text,text[],text','uuid','search_path=pg_catalog, public, pg_temp',true),
 ('is_admin','','boolean','search_path=pg_catalog, pg_temp',true),
 ('is_admin_or_moderator','','boolean','search_path=pg_catalog, pg_temp',true),
 ('handle_new_user','','trigger','search_path=pg_catalog, public, pg_temp',false)
),
expected_policies(tablename,policyname,cmd) AS (VALUES
 ('profiles','profiles_select_own','SELECT'),('profiles','profiles_update_own','UPDATE'),
 ('student_private','student_private_select_own_or_admin','SELECT'),('student_private','student_private_insert_own','INSERT'),('student_private','student_private_update_own','UPDATE'),
 ('partner_rooms','rooms_select_own_or_admin','SELECT'),('room_join_applications','applications_select_owner_host_or_admin','SELECT'),
 ('room_application_private_details','private_application_details_select_accepted_parties','SELECT'),('room_memberships','memberships_select_participant_host_or_admin','SELECT'),
 ('faculty','faculty_admin_manage','ALL'),('faculty_reviews','reviews_select_own_or_admin','SELECT'),
 ('faculty_add_requests','faculty_requests_select_own_or_admin','SELECT'),('moderation_log','moderation_log_admin_select','SELECT')
),
obsolete_policies(tablename,policyname) AS (VALUES
 ('faculty_reviews','reviews_insert_own'),('faculty_reviews','reviews_delete_own'),('faculty_add_requests','faculty_requests_insert_own')
),
roles(role_name) AS (VALUES ('PUBLIC'),('anon'),('authenticated'),('service_role')),
tables AS (
 SELECT e.relname,c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
   owner_role.rolsuper owner_super,owner_role.rolbypassrls owner_bypassrls,owner_role.rolcanlogin owner_canlogin
 FROM expected_tables e LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=e.relname AND c.relkind IN ('r','p')
 LEFT JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner
),
actual_functions AS (
 SELECT p.oid,p.proname,regexp_replace(pg_catalog.oidvectortypes(p.proargtypes),'[[:space:]]+','','g') args,
   pg_catalog.format_type(p.prorettype,NULL) return_type,p.prokind,p.prosecdef,p.proowner,p.proacl,p.proconfig,
   owner_role.rolsuper owner_super,owner_role.rolbypassrls owner_bypassrls,owner_role.rolcanlogin owner_canlogin,
   (SELECT split_part(cfg,'=',2) FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) cfg WHERE cfg LIKE 'search_path=%' LIMIT 1) search_path_value
 FROM pg_catalog.pg_proc p LEFT JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner
 WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
),
expected_views(relname,anonymous_read) AS (VALUES ('partner_rooms_public',true),('faculty_public',true),('faculty_reviews_public',false)),
views AS (
 SELECT e.relname,e.anonymous_read,c.oid,c.relowner,c.relacl,c.reloptions,owner_role.rolsuper owner_super,owner_role.rolbypassrls owner_bypassrls,owner_role.rolcanlogin owner_canlogin
 FROM expected_views e LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=e.relname AND c.relkind='v'
 LEFT JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner
),
report AS (
 SELECT 'identity'::text section,'current_session'::text object_name,'target_identity'::text check_name,'INFO'::text status,
  jsonb_build_object('database',current_database(),'user',current_user,'server_version',current_setting('server_version',true),'port',current_setting('port',true),'server_address',coalesce(inet_server_addr()::text,'NULL'),'in_recovery',pg_is_in_recovery())::text actual_value,
  'Operator must independently confirm intended Supabase project; a database name does not prove project reference.'::text expected_value,'INFO'::text severity,
  'Identity only; it is not a production-approval result.'::text explanation,'Stop if this is not the intended read-only target.'::text recommended_action

 UNION ALL
 SELECT 'function',e.proname||'('||e.args||')','expected_signature_security',
  CASE WHEN a.oid IS NULL THEN 'FAIL' WHEN pg_catalog.pg_get_userbyid(a.proowner)='service_role' THEN 'FAIL' WHEN a.prosecdef AND a.return_type=e.return_type AND a.search_path_value=replace(e.path,'search_path=','') THEN 'PASS' ELSE 'WARNING' END,
  coalesce(jsonb_build_object('identity',a.oid::regprocedure::text,'returns',a.return_type,'security_definer',a.prosecdef,'owner',pg_catalog.pg_get_userbyid(a.proowner),'owner_superuser',a.owner_super,'owner_bypassrls',a.owner_bypassrls,'owner_canlogin',a.owner_canlogin,'search_path',a.search_path_value,'proconfig',a.proconfig)::text,'missing'),
  'function; returns '||e.return_type||'; SECURITY DEFINER; '||e.path,CASE WHEN a.oid IS NULL THEN 'BLOCKER' ELSE 'HIGH' END,
  'Input defaults are intentionally absent from function identity.',CASE WHEN a.oid IS NULL THEN 'Apply only separately approved migrations, then rerun.' ELSE 'Review owner and configuration.' END
 FROM expected_functions e LEFT JOIN actual_functions a ON a.proname=e.proname AND a.args=e.args

 UNION ALL
 SELECT 'ownership',e.proname||'('||e.args||')','function_owner_assessment',
  CASE WHEN a.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN pg_catalog.pg_get_userbyid(a.proowner)='service_role' THEN 'FAIL' WHEN a.owner_super OR a.owner_bypassrls THEN 'WARNING' ELSE 'NOT_VERIFIABLE' END,
  coalesce(jsonb_build_object('owner',pg_catalog.pg_get_userbyid(a.proowner),'rolsuper',a.owner_super,'rolbypassrls',a.owner_bypassrls,'rolcanlogin',a.owner_canlogin)::text,'missing'),
  'trusted owner selected and approved by deployment process','HIGH','Role attributes identify elevated capability but do not prove trust or minimum necessary privileges.','Require operator approval of owner, effective table privileges, and RLS behavior.'
 FROM expected_functions e LEFT JOIN actual_functions a ON a.proname=e.proname AND a.args=e.args

 UNION ALL
 SELECT 'function',a.oid::regprocedure::text,'unexpected_overload','WARNING',jsonb_build_object('returns',a.return_type,'security_definer',a.prosecdef,'owner',pg_catalog.pg_get_userbyid(a.proowner),'proconfig',a.proconfig)::text,
  'no same-name overload outside expected identities','HIGH','Overloads can expose an unintended API or confuse RPC resolution.','Review before deployment.'
 FROM actual_functions a JOIN expected_functions e ON e.proname=a.proname LEFT JOIN expected_functions exact ON exact.proname=a.proname AND exact.args=a.args WHERE exact.proname IS NULL

 UNION ALL
 SELECT 'procedure',p.oid::regprocedure::text,'same_name_procedure','WARNING',jsonb_build_object('owner',pg_catalog.pg_get_userbyid(p.proowner),'proconfig',p.proconfig)::text,
  'no procedure with an expected function name','HIGH','Procedures cannot satisfy expected function identities.','Review before deployment.'
 FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='p' AND p.proname IN (SELECT proname FROM expected_functions)

 UNION ALL
 SELECT 'function',a.oid::regprocedure::text||':'||r.role_name,'effective_execute',
  CASE WHEN r.role_name='authenticated' AND has_function_privilege(r.role_name,a.oid,'EXECUTE') THEN 'PASS'
       WHEN r.role_name IN ('PUBLIC','anon','service_role') AND NOT CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') ELSE has_function_privilege(r.role_name,a.oid,'EXECUTE') END THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object('effective',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') ELSE has_function_privilege(r.role_name,a.oid,'EXECUTE') END)::text,
  CASE WHEN r.role_name='authenticated' THEN 'authenticated=true' ELSE 'client role=false' END,'HIGH','PUBLIC uses ACL expansion; named roles use PostgreSQL effective privilege checks.','Revoke unintended EXECUTE through a reviewed forward migration.'
 FROM actual_functions a JOIN expected_functions e ON e.proname=a.proname AND e.args=a.args CROSS JOIN roles r
 WHERE e.client_callable

 UNION ALL
 SELECT 'function',p.oid::regprocedure::text,'additional_public_security_definer','WARNING',jsonb_build_object('owner',pg_catalog.pg_get_userbyid(p.proowner),'proconfig',p.proconfig)::text,
  'must be one of the expected security-sensitive functions','HIGH','All public SECURITY DEFINER functions not in the expected list require review.','Inspect body, ACL, owner, and path.'
 FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' AND p.prosecdef
  AND NOT EXISTS(SELECT 1 FROM expected_functions e WHERE e.proname=p.proname AND e.args=regexp_replace(pg_catalog.oidvectortypes(p.proargtypes),'[[:space:]]+','','g'))

 UNION ALL
 SELECT 'table',t.relname,'existence_owner_rls',CASE WHEN t.oid IS NULL OR NOT t.relrowsecurity THEN 'FAIL' ELSE 'PASS' END,
  CASE WHEN t.oid IS NULL THEN 'missing' ELSE jsonb_build_object('owner',pg_catalog.pg_get_userbyid(t.relowner),'owner_superuser',t.owner_super,'owner_bypassrls',t.owner_bypassrls,'owner_canlogin',t.owner_canlogin,'rls_enabled',t.relrowsecurity,'force_rls',t.relforcerowsecurity)::text END,
  'exists; RLS enabled; owner/FORCE RLS reviewed separately',CASE WHEN t.oid IS NULL THEN 'BLOCKER' ELSE 'HIGH' END,
  'A table owner or BYPASSRLS role can bypass ordinary RLS.','Investigate missing tables or disabled RLS.'
 FROM tables t

 UNION ALL
 SELECT 'table_acl',t.relname||':'||r.role_name,'effective_privileges','INFO',
  CASE WHEN t.oid IS NULL THEN 'missing' ELSE jsonb_build_object('select',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,t.oid,'SELECT') END,'insert',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='INSERT') ELSE has_table_privilege(r.role_name,t.oid,'INSERT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_table_privilege(r.role_name,t.oid,'UPDATE') END,'delete',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='DELETE') ELSE has_table_privilege(r.role_name,t.oid,'DELETE') END)::text END,
  'least privilege','MEDIUM','ACLs do not establish RLS row visibility.','Review with policies and direct-write checks.'
 FROM tables t CROSS JOIN roles r

 UNION ALL
 SELECT 'column_acl',cp.table_name||'.'||cp.column_name||':'||cp.grantee,'explicit_column_grant','INFO',jsonb_build_object('privilege',cp.privilege_type,'grantor',cp.grantor)::text,
  'no unexpected client column grants','MEDIUM','Reports explicit column grants only.','Review every client grant.'
 FROM information_schema.column_privileges cp WHERE cp.table_schema='public' AND cp.table_name IN(SELECT relname FROM expected_tables) AND cp.grantee IN('PUBLIC','anon','authenticated','service_role')

 UNION ALL
 SELECT 'policy',p.tablename||':'||p.policyname,'policy_definition',CASE WHEN (p.tablename,p.policyname) IN(SELECT tablename,policyname FROM obsolete_policies) THEN 'WARNING' WHEN EXISTS(SELECT 1 FROM expected_policies e WHERE e.tablename=p.tablename AND e.policyname=p.policyname) THEN 'INFO' ELSE 'WARNING' END,
  jsonb_build_object('command',p.cmd,'roles',p.roles,'permissive',p.permissive,'using',p.qual,'with_check',p.with_check)::text,
  'expected or explicitly approved policy','MEDIUM','Catalog deparser output is evidence, not byte-for-byte source proof.','Review expressions and unexpected policies.'
 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename IN(SELECT relname FROM expected_tables)

 UNION ALL
 SELECT 'policy',e.tablename||':'||e.policyname,'expected_policy_presence',CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname AND p.cmd=e.cmd AND p.roles=ARRAY['authenticated']::name[]) THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname) THEN 'present' ELSE 'missing' END,
  e.cmd||' TO authenticated','HIGH','Expressions are emitted separately.','Restore/correct only through reviewed forward migration.'
 FROM expected_policies e

 UNION ALL
 SELECT 'policy',o.tablename||':'||o.policyname,'obsolete_direct_write_policy_absent',CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=o.tablename AND p.policyname=o.policyname) THEN 'FAIL' ELSE 'PASS' END,
  CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename=o.tablename AND p.policyname=o.policyname) THEN 'present' ELSE 'absent' END,
  'absent after Phase 4 RPC-only hardening','HIGH','Exact table/policy pairs avoid false positives.','Apply approved Phase 4 RPC-only migration only after authorization.'
 FROM obsolete_policies o

 UNION ALL
 SELECT 'direct_write',t.relname||':'||r.role_name,'prohibited_client_writes',CASE WHEN t.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN (CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')) ELSE has_table_privilege(r.role_name,t.oid,'INSERT') OR has_table_privilege(r.role_name,t.oid,'UPDATE') OR has_table_privilege(r.role_name,t.oid,'DELETE') OR has_table_privilege(r.role_name,t.oid,'TRUNCATE') END) THEN 'FAIL' ELSE 'PASS' END,
  CASE WHEN t.oid IS NULL THEN 'missing' ELSE jsonb_build_object('insert',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='INSERT') ELSE has_table_privilege(r.role_name,t.oid,'INSERT') END,'update',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='UPDATE') ELSE has_table_privilege(r.role_name,t.oid,'UPDATE') END,'delete',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='DELETE') ELSE has_table_privilege(r.role_name,t.oid,'DELETE') END,'truncate',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE x.grantee=0 AND x.privilege_type='TRUNCATE') ELSE has_table_privilege(r.role_name,t.oid,'TRUNCATE') END)::text END,
  'all false','HIGH','Restricted to faculty_reviews, faculty_add_requests, and app_roles.','Revoke reported write access in a reviewed migration.'
 FROM tables t CROSS JOIN roles r WHERE t.relname IN('faculty_reviews','faculty_add_requests','app_roles')

 UNION ALL
 SELECT 'view',v.relname,'definition_owner_security',CASE WHEN v.oid IS NULL THEN 'FAIL' WHEN pg_catalog.pg_get_userbyid(v.relowner)='service_role' THEN 'FAIL' WHEN coalesce(v.reloptions,ARRAY[]::text[])@>ARRAY['security_barrier=true'] AND NOT coalesce(v.reloptions,ARRAY[]::text[])@>ARRAY['security_invoker=true'] THEN 'PASS' ELSE 'WARNING' END,
  CASE WHEN v.oid IS NULL THEN 'missing' ELSE jsonb_build_object('owner',pg_catalog.pg_get_userbyid(v.relowner),'owner_superuser',v.owner_super,'owner_bypassrls',v.owner_bypassrls,'owner_canlogin',v.owner_canlogin,'options',v.reloptions,'definition',pg_catalog.pg_get_viewdef(v.oid,true))::text END,
  'trusted owner; security_barrier=true; security_invoker=false (explicit/default)','HIGH','Absent security_invoker is PostgreSQL default false; explicit true is flagged.','Review owner and projection.'
 FROM views v

 UNION ALL
 SELECT 'ownership',v.relname,'view_owner_assessment',CASE WHEN v.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN pg_catalog.pg_get_userbyid(v.relowner)='service_role' THEN 'FAIL' WHEN v.owner_super OR v.owner_bypassrls THEN 'WARNING' ELSE 'NOT_VERIFIABLE' END,
  CASE WHEN v.oid IS NULL THEN 'missing' ELSE jsonb_build_object('owner',pg_catalog.pg_get_userbyid(v.relowner),'rolsuper',v.owner_super,'rolbypassrls',v.owner_bypassrls,'rolcanlogin',v.owner_canlogin)::text END,
  'trusted owner selected and approved by deployment process','HIGH','Owner attributes do not by themselves establish trusted owner status.','Require operator approval of view ownership and underlying-object access.'
 FROM views v

 UNION ALL
 SELECT 'view_acl',v.relname||':'||r.role_name,'view_acl',CASE WHEN v.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN (CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')) ELSE has_table_privilege(r.role_name,v.oid,'INSERT') OR has_table_privilege(r.role_name,v.oid,'UPDATE') OR has_table_privilege(r.role_name,v.oid,'DELETE') OR has_table_privilege(r.role_name,v.oid,'TRUNCATE') END) THEN 'FAIL' ELSE 'PASS' END,
  jsonb_build_object('select',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,v.oid,'SELECT') END)::text,
  'no client write privileges','HIGH','Read entitlement must be compared manually to intended anonymous/authenticated model.','Revoke any write privilege.'
 FROM views v CROSS JOIN roles r

 UNION ALL
 SELECT 'view_acl',v.relname||':'||r.role_name,'expected_select_access',CASE WHEN v.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN (CASE WHEN v.anonymous_read THEN r.role_name IN('anon','authenticated') ELSE r.role_name='authenticated' END) = (CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,v.oid,'SELECT') END) THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN v.oid IS NULL THEN 'missing' ELSE jsonb_build_object('effective_select',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(v.relacl,acldefault('r',v.relowner))) x WHERE x.grantee=0 AND x.privilege_type='SELECT') ELSE has_table_privilege(r.role_name,v.oid,'SELECT') END)::text END,
  CASE WHEN v.anonymous_read THEN 'anon/authenticated=true; PUBLIC/service_role=false' ELSE 'authenticated=true; PUBLIC/anon/service_role=false' END,'HIGH','Checks the intended view read model separately from write denial.','Correct unexpected view ACLs through a reviewed forward migration.'
 FROM views v CROSS JOIN roles r

 UNION ALL
 SELECT 'trigger',t.relname||':'||tg.tgname,'trigger_definition',CASE WHEN tg.oid IS NULL THEN 'INFO' WHEN tg.tgenabled IN('O','A') THEN 'INFO' ELSE 'WARNING' END,
  jsonb_build_object('enabled',tg.tgenabled,'definition',pg_catalog.pg_get_triggerdef(tg.oid,true),'function',tg.tgfoid::regprocedure::text)::text,
  'review expected updated_at and auth profile triggers','MEDIUM','All non-internal triggers on expected application tables are emitted.','Compare to approved source.'
 FROM tables t LEFT JOIN pg_catalog.pg_trigger tg ON tg.tgrelid=t.oid AND NOT tg.tgisinternal

 UNION ALL
 SELECT 'constraint',t.relname||':'||c.conname,'constraint_definition','INFO',jsonb_build_object('type',c.contype,'definition',pg_catalog.pg_get_constraintdef(c.oid,true),'validated',c.convalidated)::text,
  'approved PK, FK, UNIQUE, and CHECK constraints','MEDIUM','Catalog inventory only.','Review missing or unexpected constraints.'
 FROM tables t JOIN pg_catalog.pg_constraint c ON c.conrelid=t.oid

 UNION ALL
 SELECT 'schema',n.nspname||':'||r.role_name,'usage_create_privileges',CASE WHEN n.oid IS NULL THEN 'NOT_VERIFIABLE' WHEN n.nspname='public' AND (CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='CREATE') ELSE has_schema_privilege(r.role_name,n.oid,'CREATE') END) THEN 'FAIL' ELSE 'INFO' END,
  CASE WHEN n.oid IS NULL THEN 'missing' ELSE jsonb_build_object('usage',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='USAGE') ELSE has_schema_privilege(r.role_name,n.oid,'USAGE') END,'create',CASE WHEN r.role_name='PUBLIC' THEN EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE x.grantee=0 AND x.privilege_type='CREATE') ELSE has_schema_privilege(r.role_name,n.oid,'CREATE') END)::text END,
  'no client CREATE on public','HIGH','PUBLIC uses ACL expansion; auth/storage are context only.','Revoke unexpected public CREATE.'
 FROM (VALUES('public'),('auth'),('storage')) wanted(nspname) LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=wanted.nspname CROSS JOIN roles r

 UNION ALL
 SELECT 'sequence',s.relname,'application_dependent_sequence','INFO',jsonb_build_object('owner',pg_catalog.pg_get_userbyid(s.relowner),'acl',s.relacl)::text,
  'inventory only; UUID-based schema expects no dependent application sequences','MEDIUM','A sequence is not automatically unsafe; its privileges must be assessed.','Review sequence ACLs and role use.'
 FROM tables t JOIN pg_catalog.pg_depend d ON d.refobjid=t.oid AND d.deptype IN('a','i') JOIN pg_catalog.pg_class s ON s.oid=d.objid AND s.relkind='S'

 UNION ALL
 SELECT 'default_acl',coalesce(owner.rolname,'DATABASE DEFAULT')||':'||CASE WHEN d.defaclnamespace=0 THEN 'DATABASE-WIDE' ELSE n.nspname END||':'||d.defaclobjtype::text,'default_acl_inventory','INFO',coalesce(d.defaclacl::text,'NULL'),
  'review named client and PUBLIC defaults','MEDIUM','Database-wide and public-schema defaults; absence does not prove safety.','Ensure object-scoped revokes occur in the same transaction as creation.'
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN pg_catalog.pg_roles owner ON owner.oid=d.defaclrole
 WHERE d.defaclnamespace IN(0,'public'::regnamespace)

 UNION ALL
 SELECT 'default_acl',coalesce(owner.rolname,'DATABASE DEFAULT')||':'||CASE WHEN d.defaclnamespace=0 THEN 'DATABASE-WIDE' ELSE n.nspname END||':'||d.defaclobjtype::text||':'||coalesce(grantee.rolname,'PUBLIC'),'individual_default_acl_entry',
  CASE WHEN x.grantee=0 OR coalesce(grantee.rolname,'') IN('anon','authenticated','service_role') THEN 'WARNING' ELSE 'INFO' END,
  jsonb_build_object('default_privilege_owner',coalesce(owner.rolname,'DATABASE DEFAULT'),'acl_grantor',coalesce(grantor.rolname,'UNKNOWN'),'scope',CASE WHEN d.defaclnamespace=0 THEN 'DATABASE-WIDE' ELSE n.nspname END,'object_type',d.defaclobjtype::text,'grantee',coalesce(grantee.rolname,'PUBLIC'),'privilege',x.privilege_type,'grantable',x.is_grantable)::text,
  'no unexpected PUBLIC/anon/authenticated/service_role default privilege','MEDIUM','Only client-role default entries are warnings; the existence of a default ACL alone is informational.','Review whether the grant is intended and preserve object-specific revokes.'
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN pg_catalog.pg_roles owner ON owner.oid=d.defaclrole
 CROSS JOIN LATERAL aclexplode(coalesce(d.defaclacl,acldefault(d.defaclobjtype,d.defaclrole))) x
 LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=x.grantee
 LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=x.grantor
 WHERE d.defaclnamespace IN(0,'public'::regnamespace)
)
SELECT section,object_name,check_name,status,actual_value,expected_value,severity,explanation,recommended_action
FROM report
ORDER BY section,object_name,check_name;
