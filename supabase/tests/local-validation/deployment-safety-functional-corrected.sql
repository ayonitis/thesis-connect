-- Functional Phase 2B tests. This script never runs migrations and never commits.
-- Scratch adaptation: exact isolated target guard; original repository suite unchanged. All persistent mutations are
-- inside the one transaction below and are rolled back before the session ends.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

DO $$ BEGIN IF current_database()<>'thesis_connect_migration_validation' OR current_user<>'postgres' OR inet_server_addr()<>'127.0.0.1'::inet OR inet_server_port()<>5433 OR current_setting('server_version')<>'17.11' OR pg_is_in_recovery() THEN RAISE EXCEPTION 'Wrong validation target'; END IF; IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.faculty) OR EXISTS(SELECT 1 FROM public.profiles) OR EXISTS(SELECT 1 FROM public.app_roles WHERE role='admin') THEN RAISE EXCEPTION 'Existing admin: refusing fixture collision'; END IF; END $$;
CREATE TEMP TABLE functional_baseline(table_name text primary key, row_count bigint) ON COMMIT PRESERVE ROWS;
INSERT INTO functional_baseline VALUES
 ('auth.users',(SELECT count(*) FROM auth.users)), ('profiles',(SELECT count(*) FROM public.profiles)),
 ('app_roles',(SELECT count(*) FROM public.app_roles)), ('partner_rooms',(SELECT count(*) FROM public.partner_rooms)),
 ('room_join_applications',(SELECT count(*) FROM public.room_join_applications)),
 ('room_application_private_details',(SELECT count(*) FROM public.room_application_private_details)),
 ('room_memberships',(SELECT count(*) FROM public.room_memberships)), ('faculty',(SELECT count(*) FROM public.faculty)),
 ('faculty_reviews',(SELECT count(*) FROM public.faculty_reviews)), ('faculty_add_requests',(SELECT count(*) FROM public.faculty_add_requests)),
 ('moderation_log',(SELECT count(*) FROM public.moderation_log));

CREATE TEMP TABLE functional_results(category text, name text, status text, detail text) ON COMMIT PRESERVE ROWS;
CREATE TEMP TABLE functional_ids(key text primary key, id uuid not null) ON COMMIT PRESERVE ROWS;

CREATE FUNCTION pg_temp.add_result(p_category text, p_name text, p_pass boolean, p_detail text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN INSERT INTO functional_results VALUES (p_category,p_name,CASE WHEN p_pass THEN 'PASS' ELSE 'FAIL' END,p_detail); END $$;

-- Execute as a simulated role/user. Expected failures are caught in a subtransaction so
-- they do not poison the enclosing rollback-only test transaction.
CREATE FUNCTION pg_temp.expect_as(p_category text, p_name text, p_role name, p_user_key text,
  p_sql text, p_expect_success boolean, p_expected_state text DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sql text := p_sql; v_key record; v_user uuid; v_claim uuid; v_role text; v_state text; v_detail text; v_ok boolean;
BEGIN
  FOR v_key IN SELECT key,id FROM functional_ids LOOP
    v_sql := replace(v_sql, '{{' || v_key.key || '}}', quote_literal(v_key.id::text) || '::uuid');
  END LOOP;
  IF v_sql ~ '\{\{[a-z_][a-z0-9_]*\}\}' THEN
    PERFORM pg_temp.add_result(p_category,p_name,false,'unresolved fixture placeholder: ' || v_sql);
    RETURN;
  END IF;
  SELECT id INTO v_user FROM functional_ids WHERE key=p_user_key;
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_user::text,''), true);
  EXECUTE 'SET LOCAL ROLE ' || quote_ident(p_role);
  SELECT auth.uid() INTO v_claim;
  v_role := current_user;
  IF v_role <> p_role::text OR v_claim IS DISTINCT FROM v_user THEN
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.add_result(p_category,p_name,false,
      'simulation setup mismatch: expected role=' || p_role || ', claim=' || coalesce(v_user::text,'null') ||
      '; got role=' || v_role || ', claim=' || coalesce(v_claim::text,'null'));
    RETURN;
  END IF;
  BEGIN
    EXECUTE v_sql;
    EXECUTE 'RESET ROLE';
    v_ok := p_expect_success;
    v_detail := CASE WHEN p_expect_success THEN 'operation succeeded' ELSE 'operation unexpectedly succeeded' END;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    v_ok := NOT p_expect_success AND (p_expected_state IS NULL OR v_state = p_expected_state)
      AND (p_message IS NULL OR v_detail ILIKE '%' || p_message || '%');
    v_detail := 'SQLSTATE=' || v_state || '; ' || v_detail;
  END;
  PERFORM pg_temp.add_result(p_category,p_name,v_ok,v_detail);
END $$;

CREATE FUNCTION pg_temp.check_as(p_category text, p_name text, p_role name, p_user_key text,
  p_sql text, p_expected boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sql text := p_sql; v_key record; v_user uuid; v_claim uuid; v_role text; v_actual boolean; v_detail text;
BEGIN
  FOR v_key IN SELECT key,id FROM functional_ids LOOP
    v_sql := replace(v_sql, '{{' || v_key.key || '}}', quote_literal(v_key.id::text) || '::uuid');
  END LOOP;
  IF v_sql ~ '\{\{[a-z_][a-z0-9_]*\}\}' THEN
    PERFORM pg_temp.add_result(p_category,p_name,false,'unresolved fixture placeholder: ' || v_sql);
    RETURN;
  END IF;
  SELECT id INTO v_user FROM functional_ids WHERE key=p_user_key;
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_user::text,''), true);
  EXECUTE 'SET LOCAL ROLE ' || quote_ident(p_role);
  SELECT auth.uid() INTO v_claim;
  v_role := current_user;
  IF v_role <> p_role::text OR v_claim IS DISTINCT FROM v_user THEN
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.add_result(p_category,p_name,false,
      'simulation setup mismatch: expected role=' || p_role || ', claim=' || coalesce(v_user::text,'null') ||
      '; got role=' || v_role || ', claim=' || coalesce(v_claim::text,'null'));
    RETURN;
  END IF;
  BEGIN
    EXECUTE v_sql INTO v_actual;
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.add_result(p_category,p_name,v_actual IS NOT DISTINCT FROM p_expected,
      'expected=' || p_expected || '; actual=' || coalesce(v_actual::text,'null'));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.add_result(p_category,p_name,false,'query error: ' || v_detail);
  END;
END $$;

BEGIN;

-- Runtime UUIDs eliminate collisions with persistent auth users or any prior test run.
INSERT INTO functional_ids VALUES ('host',gen_random_uuid()),('applicant',gen_random_uuid()),
 ('other',gen_random_uuid()),('admin',gen_random_uuid()),('alternate',gen_random_uuid()),('faculty1',gen_random_uuid());
INSERT INTO auth.users(id,raw_user_meta_data)
SELECT id, jsonb_build_object('display_name','Functional ' || initcap(key))
FROM functional_ids WHERE key IN ('host','applicant','other','admin','alternate');
-- The Phase 2B auth.users trigger creates these profile rows. Update only the rows created
-- in this transaction; do not insert/upsert profiles and therefore never overwrite existing data.
UPDATE public.profiles p SET display_name='Functional ' || initcap(f.key),
 department=CASE f.key WHEN 'other' THEN 'EEE' ELSE 'CSE' END
FROM functional_ids f WHERE p.user_id=f.id AND f.key IN ('host','applicant','other','admin','alternate');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.profiles p JOIN functional_ids f ON f.id=p.user_id
      WHERE f.key IN ('host','applicant','other','admin','alternate')) <> 5 THEN
    RAISE EXCEPTION 'auth.users fixture trigger did not create all profiles';
  END IF;
END $$;
INSERT INTO public.app_roles(user_id,role) SELECT id,'admin' FROM functional_ids WHERE key='admin';
INSERT INTO public.faculty(id,slug,name,department,research_interests)
SELECT id,'functional-test-faculty-' || left(replace(id::text,'-',''),8),'Functional Test Faculty','CSE','{}'
FROM functional_ids WHERE key='faculty1';

-- Authentication and room creation.
SELECT pg_temp.expect_as('Authorization','Unauthenticated caller is rejected by create room','authenticated',NULL,
 $$SELECT public.create_partner_room('No Auth Room','This must be rejected for no auth',10,3.0,false,1::smallint,'CSE',2,4,10,NULL)$$,false,'P0001','authentication required');
SELECT pg_temp.expect_as('Authorization','anon cannot execute privileged room RPC','anon',NULL,
 $$SELECT public.create_partner_room('Anon Room','This must fail by execute privilege',10,3.0,false,1::smallint,'CSE',2,4,10,NULL)$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Partner rooms','Student creates a valid room through RPC','authenticated','host',
 $$SELECT public.create_partner_room('Functional open room','A valid functional test room description.',60,3.20,false,1::smallint,'CSE',2.50,4.00,20,'test fixture')$$,true);
INSERT INTO functional_ids SELECT 'room1',id FROM public.partner_rooms
 WHERE title='Functional open room' AND host_user_id=(SELECT id FROM functional_ids WHERE key='host');
SELECT pg_temp.check_as('Partner rooms','Created room retains authenticated host','authenticated','host',
 $$SELECT EXISTS(SELECT 1 FROM public.partner_rooms WHERE id={{room1}} AND host_user_id={{host}})$$,true);
SELECT pg_temp.check_as('Partner rooms','Open room is publicly discoverable','anon',NULL,
 $$SELECT EXISTS(SELECT 1 FROM public.partner_rooms_public WHERE id={{room1}})$$,true);
SELECT pg_temp.check_as('Partner rooms','CGPA is hidden when show_host_cgpa is false','anon',NULL,
 $$SELECT (SELECT host_cgpa IS NULL FROM public.partner_rooms_public WHERE id={{room1}})$$,true);
SELECT pg_temp.expect_as('Partner rooms','Direct room INSERT is denied','authenticated','host',
 $$INSERT INTO public.partner_rooms(id,host_user_id,host_display_name,title,description,host_department,host_completed_credits,additional_members_needed,expected_department,expected_cgpa_min,expected_cgpa_max,min_completed_credits) VALUES (gen_random_uuid(),{{host}},'x','abc','long enough description','CSE',1,1,'CSE',1,2,1)$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Partner rooms','Direct room UPDATE is denied','authenticated','host',
 $$UPDATE public.partner_rooms SET title='blocked' WHERE id={{room1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Partner rooms','Direct room DELETE is denied','authenticated','host',
 $$DELETE FROM public.partner_rooms WHERE id={{room1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Partner rooms','Invalid room input is rejected','authenticated','host',
 $$SELECT public.create_partner_room('x','short',60,3.2,false,1::smallint,'CSE',2,4,20,NULL)$$,false,'P0001','invalid room input');
UPDATE public.partner_rooms SET is_open=false WHERE id=(SELECT id FROM functional_ids WHERE key='room1');
SELECT pg_temp.check_as('Partner rooms','Closed room is absent from public view','anon',NULL,
 $$SELECT NOT EXISTS(SELECT 1 FROM public.partner_rooms_public WHERE id={{room1}})$$,true);
UPDATE public.partner_rooms SET is_open=true WHERE id=(SELECT id FROM functional_ids WHERE key='room1');

-- Applications, capacity, memberships, and contact privacy.
SELECT pg_temp.expect_as('Applications','Applicant submits a valid application','authenticated','applicant',
 $$SELECT public.submit_room_application({{room1}},'CSE',3.5,45,'I would like to collaborate on this project.','https://example.test/contact-a')$$,true);
INSERT INTO functional_ids SELECT 'app1',id FROM public.room_join_applications WHERE room_id=(SELECT id FROM functional_ids WHERE key='room1') AND applicant_user_id=(SELECT id FROM functional_ids WHERE key='applicant');
SELECT pg_temp.check_as('Applications','Applicant sees own application','authenticated','applicant',
 $$SELECT EXISTS(SELECT 1 FROM public.room_join_applications WHERE id={{app1}})$$,true);
SELECT pg_temp.check_as('Applications','Host sees room application','authenticated','host',
 $$SELECT EXISTS(SELECT 1 FROM public.room_join_applications WHERE id={{app1}})$$,true);
SELECT pg_temp.check_as('Applications','Unrelated student cannot see application','authenticated','other',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.room_join_applications WHERE id={{app1}})$$,true);
SELECT pg_temp.check_as('Private contacts','Pending contact is hidden from applicant','authenticated','applicant',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app1}})$$,true);
SELECT pg_temp.check_as('Private contacts','Pending contact is hidden from host','authenticated','host',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app1}})$$,true);
SELECT pg_temp.expect_as('Applications','Host accepts pending application','authenticated','host',
 $$SELECT public.decide_room_application({{app1}},'accepted','welcome')$$,true);
SELECT pg_temp.check_as('Memberships','Acceptance creates a member membership','authenticated','host',
 $$SELECT EXISTS(SELECT 1 FROM public.room_memberships WHERE application_id={{app1}} AND membership_role='member')$$,true);
SELECT pg_temp.check_as('Private contacts','Accepted applicant sees contact','authenticated','applicant',
 $$SELECT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app1}})$$,true);
SELECT pg_temp.check_as('Private contacts','Accepted host sees contact','authenticated','host',
 $$SELECT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app1}})$$,true);
SELECT pg_temp.check_as('Private contacts','Unrelated student cannot see accepted contact','authenticated','other',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app1}})$$,true);
SELECT pg_temp.expect_as('Applications','Duplicate application is rejected','authenticated','applicant',
 $$SELECT public.submit_room_application({{room1}},'CSE',3.5,45,'I would like to collaborate on this project.','https://example.test/duplicate')$$,false,'23505',NULL);
SELECT pg_temp.expect_as('Applications','Host cannot apply to own room','authenticated','host',
 $$SELECT public.submit_room_application({{room1}},'CSE',3.5,45,'I would like to collaborate on this project.','https://example.test/self')$$,false,'P0001','host cannot apply');
SELECT pg_temp.expect_as('Applications','Second acceptance beyond capacity is rejected','authenticated','other',
 $$SELECT public.submit_room_application({{room1}},'EEE',3.1,40,'I would like to collaborate on this project.','https://example.test/contact-b')$$,true);
INSERT INTO functional_ids SELECT 'app2',id FROM public.room_join_applications WHERE room_id=(SELECT id FROM functional_ids WHERE key='room1') AND applicant_user_id=(SELECT id FROM functional_ids WHERE key='other');
SELECT pg_temp.expect_as('Memberships','Capacity prevents second acceptance','authenticated','host',
 $$SELECT public.decide_room_application({{app2}},'accepted',NULL)$$,false,'P0001','no remaining capacity');
SELECT pg_temp.expect_as('Memberships','Students cannot directly insert memberships','authenticated','other',
 $$INSERT INTO public.room_memberships(room_id,user_id,membership_role,application_id) VALUES ({{room1}},{{other}},'member',{{app2}})$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Applications','Host rejects a pending application','authenticated','host',
 $$SELECT public.decide_room_application({{app2}},'rejected','no remaining slot')$$,true);
SELECT pg_temp.check_as('Private contacts','Rejected application contact remains hidden','authenticated','other',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.room_application_private_details WHERE application_id={{app2}})$$,true);
SELECT pg_temp.expect_as('Partner rooms','Other student creates independent room','authenticated','other',
 $$SELECT public.create_partner_room('Independent test room','A separate room for authorization lifecycle testing.',40,3.1,true,2::smallint,'CSE',2,4,20,NULL)$$,true);
INSERT INTO functional_ids SELECT 'room2',id FROM public.partner_rooms
 WHERE title='Independent test room' AND host_user_id=(SELECT id FROM functional_ids WHERE key='other');
SELECT pg_temp.expect_as('Applications','Alternate student submits application','authenticated','alternate',
 $$SELECT public.submit_room_application({{room2}},'CSE',3.2,30,'I would like to join the independent test room.','https://example.test/alternate')$$,true);
INSERT INTO functional_ids SELECT 'app3',id FROM public.room_join_applications WHERE room_id=(SELECT id FROM functional_ids WHERE key='room2') AND applicant_user_id=(SELECT id FROM functional_ids WHERE key='alternate');
SELECT pg_temp.expect_as('Authorization','Non-host cannot decide another host application','authenticated','host',
 $$SELECT public.decide_room_application({{app3}},'rejected',NULL)$$,false,'P0001','not authorized');
SELECT pg_temp.expect_as('Applications','Applicant withdraws own pending application','authenticated','alternate',
 $$SELECT public.withdraw_room_application({{app3}})$$,true);
SELECT pg_temp.expect_as('Applications','Resubmission after withdrawal is rejected by unique constraint','authenticated','alternate',
 $$SELECT public.submit_room_application({{room2}},'CSE',3.2,30,'I would like to join the independent test room.','https://example.test/retry')$$,false,'23505',NULL);
UPDATE public.partner_rooms SET is_open=false WHERE id=(SELECT id FROM functional_ids WHERE key='room2');
SELECT pg_temp.expect_as('Applications','Closed rooms reject applications','authenticated','applicant',
 $$SELECT public.submit_room_application({{room2}},'CSE',3.2,30,'I would like to join the independent test room.','https://example.test/closed')$$,false,'P0001','room is not open');
SELECT pg_temp.expect_as('Applications','Invalid application input is rejected','authenticated','applicant',
 $$SELECT public.submit_room_application({{room1}},'CSE',9.9,30,'I would like to join the independent test room.','https://example.test/invalid')$$,false,'P0001','invalid application input');
SELECT pg_temp.check_as('Authorization','No application-facing role-assignment RPC','authenticated','applicant',
 $$SELECT NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='grant_app_role')$$,true);

-- Faculty requests and reviews.
SELECT pg_temp.expect_as('Faculty requests','Student submits faculty addition request','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('Functional Proposed Faculty','CSE','{}'::text[],'A valid rationale for a faculty addition request.')$$,true);
INSERT INTO functional_ids SELECT 'request1',id FROM public.faculty_add_requests
 WHERE proposed_name='Functional Proposed Faculty' AND requester_user_id=(SELECT id FROM functional_ids WHERE key='applicant');
SELECT pg_temp.check_as('Faculty requests','Requester sees own request','authenticated','applicant',
 $$SELECT EXISTS(SELECT 1 FROM public.faculty_add_requests WHERE id={{request1}})$$,true);
SELECT pg_temp.check_as('Faculty requests','Unrelated student cannot see request','authenticated','other',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.faculty_add_requests WHERE id={{request1}})$$,true);
SELECT pg_temp.expect_as('Authorization','Student cannot approve faculty request','authenticated','applicant',
 $$SELECT public.decide_faculty_add_request({{request1}},'approved',NULL)$$,false,'P0001','admin required');
SELECT pg_temp.expect_as('Faculty requests','Admin approves pending request','authenticated','admin',
 $$SELECT public.decide_faculty_add_request({{request1}},'approved','approved in functional test')$$,true);
SELECT pg_temp.check_as('Faculty requests','Approval creates faculty and decision metadata','postgres',NULL,
 $$SELECT EXISTS(SELECT 1 FROM public.faculty_add_requests r JOIN public.faculty f ON f.id=r.created_faculty_id WHERE r.id={{request1}} AND r.status='approved' AND r.decided_by={{admin}} AND r.decided_at IS NOT NULL)$$,true);
SELECT pg_temp.expect_as('Faculty requests','Other student submits request for rejection','authenticated','other',
 $$SELECT public.submit_faculty_add_request('Functional Rejected Faculty','EEE','{}'::text[],'A valid rationale for a rejected faculty addition request.')$$,true);
INSERT INTO functional_ids SELECT 'request2',id FROM public.faculty_add_requests
 WHERE proposed_name='Functional Rejected Faculty' AND requester_user_id=(SELECT id FROM functional_ids WHERE key='other');
SELECT pg_temp.expect_as('Faculty requests','Admin rejects pending request','authenticated','admin',
 $$SELECT public.decide_faculty_add_request({{request2}},'rejected','not needed')$$,true);
SELECT pg_temp.check_as('Faculty requests','Rejected request creates no faculty row','postgres',NULL,
 $$SELECT EXISTS(SELECT 1 FROM public.faculty_add_requests WHERE id={{request2}} AND status='rejected' AND created_faculty_id IS NULL AND decided_at IS NOT NULL)$$,true);
SELECT pg_temp.expect_as('Faculty requests','Already decided request cannot be decided again','authenticated','admin',
 $$SELECT public.decide_faculty_add_request({{request2}},'rejected',NULL)$$,false,'P0001','request is not pending');
SELECT pg_temp.expect_as('Faculty reviews','Student submits review','authenticated','applicant',
 $$SELECT public.create_own_faculty_review({{faculty1}},8::smallint,8::smallint,8::smallint,8::smallint,'A valid anonymous functional test review.')$$,true);
INSERT INTO functional_ids SELECT 'review1',id FROM public.faculty_reviews WHERE faculty_id=(SELECT id FROM functional_ids WHERE key='faculty1') AND reviewer_user_id=(SELECT id FROM functional_ids WHERE key='applicant');
SELECT pg_temp.expect_as('Faculty reviews','Duplicate review is rejected','authenticated','applicant',
 $$SELECT public.create_own_faculty_review({{faculty1}},8::smallint,8::smallint,8::smallint,8::smallint,'Another valid but duplicate functional test review.')$$,false,'P0001','review already exists');
SELECT pg_temp.expect_as('Faculty reviews','Reviewer edits own review through RPC','authenticated','applicant',
 $$SELECT public.update_own_faculty_review({{review1}},9::smallint,9::smallint,9::smallint,9::smallint,'Updated functional test review text.')$$,true);
SELECT pg_temp.expect_as('Faculty reviews','Other student cannot edit review','authenticated','other',
 $$SELECT public.update_own_faculty_review({{review1}},9::smallint,9::smallint,9::smallint,9::smallint,'Unauthorized modification attempt.')$$,false,'P0001','review not found');
SELECT pg_temp.expect_as('Faculty reviews','Student cannot directly manipulate moderation metadata','authenticated','applicant',
 $$UPDATE public.faculty_reviews SET moderation_status='hidden' WHERE id={{review1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Authorization','Student cannot moderate review','authenticated','applicant',
 $$SELECT public.moderate_faculty_review({{review1}},'hidden')$$,false,'P0001','admin required');
SELECT pg_temp.expect_as('Faculty reviews','Admin hides review','authenticated','admin',
 $$SELECT public.moderate_faculty_review({{review1}},'hidden')$$,true);
SELECT pg_temp.check_as('Faculty reviews','Hidden review is absent from public view','authenticated','applicant',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.faculty_reviews_public WHERE faculty_id={{faculty1}} AND description='Updated functional test review text.')$$,true);
SELECT pg_temp.expect_as('Faculty reviews','Admin republishes review','authenticated','admin',
 $$SELECT public.moderate_faculty_review({{review1}},'published')$$,true);
SELECT pg_temp.check_as('Faculty reviews','Republished review is anonymous in public view','authenticated','applicant',
 $$SELECT EXISTS(SELECT 1 FROM public.faculty_reviews_public WHERE faculty_id={{faculty1}} AND author_label='Anonymous Student' AND description='Updated functional test review text.')$$,true);
SELECT pg_temp.check_as('Audit log','Moderation and approval actions are logged','postgres',NULL,
 $$SELECT (SELECT count(*) FROM public.moderation_log WHERE actor_user_id={{admin}} AND action IN ('faculty_add_request_approved','moderate_review')) >= 3$$,true);


-- Additional Phase 4 / deployment safety assertions. Synthetic fixtures only.
INSERT INTO functional_ids VALUES ('mod',gen_random_uuid());
INSERT INTO auth.users(id,raw_user_meta_data) SELECT id,'{"display_name":"Safety moderator"}'::jsonb FROM functional_ids WHERE key='mod';
UPDATE public.profiles SET department='CSE' WHERE user_id=(SELECT id FROM functional_ids WHERE key='mod');
INSERT INTO public.app_roles(user_id,role) SELECT id,'moderator' FROM functional_ids WHERE key='mod';
INSERT INTO public.student_private(user_id,student_id) SELECT id,'SYNTHETIC-'||id::text FROM functional_ids WHERE key IN('applicant','other');
SELECT pg_temp.check_as('Privacy','Student cannot read another private student record','authenticated','applicant',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.student_private WHERE user_id={{other}})$$,true);
SELECT pg_temp.check_as('Privacy','Student can read own private record','authenticated','applicant',
 $$SELECT EXISTS(SELECT 1 FROM public.student_private WHERE user_id={{applicant}})$$,true);
SELECT pg_temp.check_as('Privacy','Student cannot read another profile','authenticated','applicant',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id={{other}})$$,true);
SELECT pg_temp.check_as('Privacy','Student cannot modify another profile','authenticated','applicant',
 $$WITH changed AS (UPDATE public.profiles SET display_name='Forbidden' WHERE user_id={{other}} RETURNING user_id) SELECT count(*)=0 FROM changed$$,true);
SELECT pg_temp.expect_as('Privacy','Anonymous cannot read private records','anon',NULL,$$SELECT * FROM public.student_private$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Authorization','Student cannot assign admin role','authenticated','applicant',
 $$INSERT INTO public.app_roles(user_id,role) VALUES({{applicant}},'admin')$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Authorization','Moderator cannot moderate reviews','authenticated','mod',
 $$SELECT public.moderate_faculty_review({{review1}},'hidden')$$,false,'P0001','admin required');
SELECT pg_temp.check_as('Privacy','Moderator cannot read unrelated reviewer identity','authenticated','mod',
 $$SELECT NOT EXISTS(SELECT 1 FROM public.faculty_reviews WHERE id={{review1}})$$,true);
SELECT pg_temp.expect_as('Reviews','Anonymous cannot select review view','anon',NULL,$$SELECT * FROM public.faculty_reviews_public$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Requests','Direct student request insertion denied','authenticated','applicant',
 $$INSERT INTO public.faculty_add_requests(requester_user_id,proposed_name,proposed_department,rationale) VALUES({{applicant}},'Blocked direct request','CSE','Valid request rationale text.')$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Requests','Duplicate pending request first submission','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('Safety duplicate faculty','CSE','{}'::text[],'A legitimate synthetic request rationale.')$$,true);
SELECT pg_temp.expect_as('Requests','Duplicate pending request rejected by RPC','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('Safety duplicate faculty','CSE','{}'::text[],'A legitimate synthetic request rationale.')$$,false,'P0001','already pending');
SELECT pg_temp.expect_as('Inputs','Invalid faculty department rejected','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('Safety invalid faculty','INVALID','{}'::text[],'A legitimate synthetic request rationale.')$$,false,'P0001','invalid faculty request input');
SELECT pg_temp.expect_as('Inputs','Empty faculty name rejected','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('','CSE','{}'::text[],'A legitimate synthetic request rationale.')$$,false,'P0001','invalid faculty request input');
SELECT pg_temp.expect_as('Inputs','Oversized faculty rationale rejected','authenticated','applicant',
 $$SELECT public.submit_faculty_add_request('Safety long rationale','CSE','{}'::text[],repeat('x',3001))$$,false,'P0001','invalid faculty request input');
SELECT pg_temp.expect_as('Inputs','Invalid rating rejected','authenticated','applicant',
 $$SELECT public.update_own_faculty_review({{review1}},0::smallint,9::smallint,9::smallint,9::smallint,'A legitimate synthetic review description.')$$,false,'P0001','invalid review content');
SELECT pg_temp.expect_as('Inputs','Empty review text rejected','authenticated','applicant',
 $$SELECT public.update_own_faculty_review({{review1}},9::smallint,9::smallint,9::smallint,9::smallint,'')$$,false,'P0001','invalid review content');
SELECT pg_temp.expect_as('Inputs','Oversized review text rejected','authenticated','applicant',
 $$SELECT public.update_own_faculty_review({{review1}},9::smallint,9::smallint,9::smallint,9::smallint,repeat('x',5001))$$,false,'P0001','invalid review content');
SELECT pg_temp.expect_as('Inputs','Malformed UUID cast rejected','authenticated','applicant',
 $$SELECT public.withdraw_room_application('not-a-uuid'::uuid)$$,false,'22P02',NULL);
SELECT pg_temp.expect_as('Applications','Rejected application cannot be accepted later','authenticated','host',
 $$SELECT public.decide_room_application({{app2}},'accepted',NULL)$$,false,'P0001','not pending');
SELECT pg_temp.expect_as('Applications','Withdrawn application cannot be accepted','authenticated','other',
 $$SELECT public.decide_room_application({{app3}},'accepted',NULL)$$,false,'P0001','not pending');
SELECT pg_temp.expect_as('Applications','Rejected applicant cannot reapply','authenticated','other',
 $$SELECT public.submit_room_application({{room1}},'EEE',3.1,40,'A legitimate synthetic application description.','https://example.test/retry')$$,false,'23505',NULL);
SELECT pg_temp.expect_as('Deletion','applicant cannot directly delete a review','authenticated','applicant',$$DELETE FROM public.faculty_reviews WHERE id={{review1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Deletion','other cannot directly delete a review','authenticated','other',$$DELETE FROM public.faculty_reviews WHERE id={{review1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Deletion','admin cannot directly delete a review','authenticated','admin',$$DELETE FROM public.faculty_reviews WHERE id={{review1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Deletion','mod cannot directly delete a review','authenticated','mod',$$DELETE FROM public.faculty_reviews WHERE id={{review1}}$$,false,'42501',NULL);
SELECT pg_temp.expect_as('Deletion','anonymous cannot directly delete a review','anon',NULL,$$DELETE FROM public.faculty_reviews WHERE id={{review1}}$$,false,'42501',NULL);

SELECT 'REPORT_JSON:' || json_build_object(
 'passCount',count(*) FILTER (WHERE status='PASS'),'failCount',count(*) FILTER (WHERE status='FAIL'),
 'reviewCount',count(*) FILTER (WHERE status='REVIEW'),
 'tests',coalesce(json_agg(json_build_object('category',category,'name',name,'status',status,'detail',detail) ORDER BY category,name),'[]'::json)
)::text FROM functional_results;

ROLLBACK;

WITH current_counts(table_name,row_count) AS (VALUES
 ('auth.users',(SELECT count(*) FROM auth.users)), ('profiles',(SELECT count(*) FROM public.profiles)),
 ('app_roles',(SELECT count(*) FROM public.app_roles)), ('partner_rooms',(SELECT count(*) FROM public.partner_rooms)),
 ('room_join_applications',(SELECT count(*) FROM public.room_join_applications)), ('room_application_private_details',(SELECT count(*) FROM public.room_application_private_details)),
 ('room_memberships',(SELECT count(*) FROM public.room_memberships)), ('faculty',(SELECT count(*) FROM public.faculty)),
 ('faculty_reviews',(SELECT count(*) FROM public.faculty_reviews)), ('faculty_add_requests',(SELECT count(*) FROM public.faculty_add_requests)),
 ('moderation_log',(SELECT count(*) FROM public.moderation_log))
), comparison AS (SELECT b.table_name,b.row_count AS baseline,c.row_count AS current FROM functional_baseline b JOIN current_counts c USING(table_name))
SELECT 'ROLLBACK_JSON:' || json_build_object('verified',bool_and(baseline=current),'tables',json_agg(json_build_object('table',table_name,'baseline',baseline,'current',current) ORDER BY table_name))::text FROM comparison;
