\set ON_ERROR_STOP on
SELECT current_database()='thesis_connect_migration_validation' AND current_user='postgres' AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5433 AND current_setting('server_version')='17.11' AND NOT pg_is_in_recovery() AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth') AS safe
\gset
\if :safe
BEGIN;
CREATE SCHEMA auth AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);
REVOKE ALL ON TABLE auth.users FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
COMMIT;
\else
\quit 3
\endif
BEGIN READ ONLY;
SELECT json_build_object('database',current_database(),'user',current_user,'port',inet_server_port(),'version',current_setting('server_version'),'function_definition',pg_get_functiondef('auth.uid()'::regprocedure),'no_claim_returns_null',auth.uid() IS NULL,'table_acl',(SELECT relacl::text FROM pg_class WHERE oid='auth.users'::regclass),'schema_acl',(SELECT nspacl::text FROM pg_namespace WHERE nspname='auth'),'function_acl',(SELECT proacl::text FROM pg_proc WHERE oid='auth.uid()'::regprocedure),'columns',(SELECT json_agg(json_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull)) FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attnum>0 AND NOT attisdropped));
COMMIT;
