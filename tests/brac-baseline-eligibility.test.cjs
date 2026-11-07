// Offline source regression tests only: no SQL, Auth service or network execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const sql = read('supabase/migrations/20261105120000_brac_email_eligibility.sql');
const source = ts.transpileModule(read('src/lib/auth/email-policy.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUnit = { exports: {} };
vm.runInNewContext(source, { exports: moduleUnit.exports, module: moduleUnit });
const validate = moduleUnit.exports.validateBracEmail;
const pattern = sql.match(/email COLLATE "C" ~ '((?:''|[^'])*)'/)[1].replace(/''/g, "'");
const mailbox = new RegExp(pattern);
// Model the extracted SQL expression, not PostgreSQL execution or proof of regex parity.
const model = email => typeof email === 'string' && email.length >= 1 && email.length <= 254
  && Buffer.byteLength(email) === email.length && !/[^!-~]/.test(email)
  && email.split('@')[0].length >= 1 && email.split('@')[0].length <= 64
  && !email.includes('+') && mailbox.test(email);
const vectors = [
  ['student@g.bracu.ac.bd', true], ['Student.Name@G.BRACU.AC.BD', true],
  ["o'neil@g.bracu.ac.bd", true], ['a'.repeat(64)+'@g.bracu.ac.bd', true],
  ['student+alias@g.bracu.ac.bd', false], ['student@bracu.ac.bd', false],
  ['student@g.bracu.ac.bd.evil.test', false], ['student@sub.g.bracu.ac.bd', false],
  ['student@@g.bracu.ac.bd', false], ['student@g.bracu.ac.bd.', false],
  ['.student@g.bracu.ac.bd', false], ['student.@g.bracu.ac.bd', false],
  ['stu..dent@g.bracu.ac.bd', false], [' student@g.bracu.ac.bd', false],
  ['student@g.bracu.ac.bd\n', false], ['studént@g.bracu.ac.bd', false],
  ['student@g.brаcu.ac.bd', false], ['"student"@g.bracu.ac.bd', false],
  ['a'.repeat(65)+'@g.bracu.ac.bd', false], [null, false], ['', false],
];
vectors.forEach(([email, expected], i) => test('email policy source/model vector '+i, () => {
  assert.equal(validate(email).ok, expected);
  assert.equal(model(email), expected);
}));
const tables = ['profiles','student_private','app_roles','partner_rooms','room_join_applications',
  'room_application_private_details','room_memberships','faculty','faculty_reviews',
  'faculty_add_requests','moderation_log'];
test('exact eleven restrictive authenticated gates without table-grant expansion', () => {
  const policies = [...sql.matchAll(/CREATE POLICY brac_eligibility ON public\.(\w+)\s+AS RESTRICTIVE FOR ALL TO authenticated\s+USING \(\(SELECT public.current_user_is_brac_eligible\(\)\)\)\s+WITH CHECK \(\(SELECT public.current_user_is_brac_eligible\(\)\)\);/g)];
  assert.deepEqual(policies.map(m => m[1]), tables);
  assert.doesNotMatch(sql, /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE).*ON\s+(?:TABLE\s+)?(?:auth|public)\./i);
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|BYPASSRLS|DROP POLICY|ALTER ROLE/i);
});
const baselineFiles = ['20261028190100_phase_2b_rls_and_views.sql',
  '20261028190200_phase_2b_secure_rpcs.sql','20261031120000_phase_4_2a_create_own_faculty_review.sql',
  '20261031122000_phase_4_3_submit_faculty_add_request.sql','20261101130000_phase_4_5_delete_own_faculty_review.sql'];
const definitionPattern = /CREATE FUNCTION public\.(\w+)\([\s\S]*?\$\$;/g;
let functionCount = 0;
for (const file of baselineFiles) {
  for (const match of read('supabase/migrations/'+file).matchAll(definitionPattern)) {
    const [definition, name] = match;
    functionCount++;
    test('exact signature/security/business-body preservation: '+name, () => {
      const replacement = sql.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\([\\s\\S]*?\\$\\$;'))?.[0];
      assert.ok(replacement, name);
      let restored = replacement.replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION');
      if (['is_admin','is_admin_or_moderator'].includes(name)) {
        assert.match(restored, /SELECT public.current_user_is_brac_eligible\(\) AND EXISTS/);
        restored = restored.replace('SELECT public.current_user_is_brac_eligible() AND EXISTS', 'SELECT EXISTS');
      } else {
        const gate = "  IF NOT public.current_user_is_brac_eligible() THEN\n    RAISE EXCEPTION 'verified BRAC University email required' USING ERRCODE = '42501';\n  END IF;\n";
        assert.ok(restored.includes('\nBEGIN\n'+gate));
        restored = restored.replace('\nBEGIN\n'+gate, '\nBEGIN\n');
      }
      assert.equal(restored, definition);
    });
  }
}
test('all twelve baseline role helpers and business RPCs accounted for', () => assert.equal(functionCount, 12));
test('authoritative current Auth read and fail-closed owner prerequisites', () => {
  const helper = sql.split('AS $eligibility$')[1].split('$eligibility$;')[0];
  assert.match(helper, /FROM auth.users AS u/);
  for (const check of ['u.id=auth.uid()', 'u.is_anonymous IS FALSE', 'u.email_confirmed_at IS NOT NULL', 'u.deleted_at IS NULL', 'email_is_allowed(u.email)']) assert.ok(helper.includes(check));
  assert.doesNotMatch(helper, /metadata|jwt|email_change|app_roles/);
  assert.match(sql, /SET row_security = off/);
  assert.match(sql, /row_security_active\('auth.users'::regclass\)/);
  assert.match(sql, /has_column_privilege/);
  assert.match(sql, /atttypid=item.type_oid/);
  assert.match(sql, /current_user <> 'postgres'/);
});
test('new helper ACL, fixed search path, private invoker hook', () => {
  assert.match(sql, /current_user_is_brac_eligible\(\)\s+RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.current_user_is_brac_eligible\(\)\s+FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.current_user_is_brac_eligible\(\) TO authenticated;/);
  assert.match(sql, /before_user_created\(event jsonb\)\s+RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER\s+SET search_path = pg_catalog, pg_temp/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION thesis_brac_auth.before_user_created\(jsonb\) TO supabase_auth_admin;/);
});
test('hook admits unconfirmed domain-valid signup without metadata authority', () => {
  const hook = sql.split('AS $hook$')[1].split('$hook$;')[0];
  assert.match(hook, /jsonb_typeof\(event->'user'->'email'\) IS DISTINCT FROM 'string'/);
  assert.match(hook, /is_anonymous.*IS DISTINCT FROM 'false'::jsonb/);
  assert.match(hook, /email_is_allowed\(event->'user'->>'email'\)/);
  assert.match(hook, /'http_code',403/);
  assert.doesNotMatch(hook, /confirmed|metadata|auth.users|INSERT|DELETE|UPDATE/);
});
test('review projection unchanged except explicit eligibility predicate; public discovery untouched', () => {
  const original = read('supabase/migrations/20261028190100_phase_2b_rls_and_views.sql')
    .match(/CREATE VIEW public.faculty_reviews_public[\s\S]*?;/)[0];
  const replacement = sql.match(/CREATE OR REPLACE VIEW public.faculty_reviews_public[\s\S]*?;/)[0];
  assert.equal(replacement.replace('CREATE OR REPLACE VIEW', 'CREATE VIEW')
    .replace('\n    AND (SELECT public.current_user_is_brac_eligible())', ''), original);
  assert.doesNotMatch(sql, /(?:CREATE|ALTER|DROP|REVOKE).*VIEW public\.(?:faculty_public|partner_rooms_public)/);
  assert.doesNotMatch(sql, /CREATE(?: OR REPLACE)? FUNCTION public.handle_new_user|CREATE TRIGGER|ALTER TABLE auth.users/);
});
test('single transaction and no user migration/deletion or ledger repair', () => {
  assert.equal((sql.match(/^BEGIN;$/gm)||[]).length, 1);
  assert.equal((sql.match(/^COMMIT;$/gm)||[]).length, 1);
  assert.ok(sql.trim().endsWith('COMMIT;'));
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM) auth.users|migration repair|INSERT INTO supabase_migrations/);
});


test('baseline review view is authenticated-only; anonymous means author masking', () => {
  const baseline = read('supabase/migrations/20261028190100_phase_2b_rls_and_views.sql');
  assert.match(baseline, /REVOKE ALL PRIVILEGES ON TABLE public.partner_rooms_public, public.faculty_public,\s+public.faculty_reviews_public FROM PUBLIC, anon, authenticated, service_role;/);
  assert.match(baseline, /GRANT SELECT ON public.faculty_reviews_public TO authenticated;/);
  const versions = fs.readdirSync(path.join(root, 'supabase/migrations'))
    .filter(name => /^(20261028|20261031|20261101130000)/.test(name) && name.endsWith('.sql'));
  assert.equal(versions.length, 8);
  const grants = versions.flatMap(name => [...read('supabase/migrations/'+name)
    .matchAll(/GRANT\s+[\s\S]*?;/gi)].map(m => m[0]))
    .filter(statement => statement.includes('public.faculty_reviews_public'));
  assert.deepEqual(grants, ['GRANT SELECT ON public.faculty_reviews_public TO authenticated;']);
});
test('new migration preserves review ACLs and does not open anonymous helper execution', () => {
  const grants = [...sql.matchAll(/^(?:GRANT|REVOKE)\s+[\s\S]*?;/gmi)].map(m => m[0]);
  assert.ok(grants.every(statement => !statement.includes('public.faculty_reviews_public')));
  const helperGrants = grants.filter(statement => /^GRANT\b/i.test(statement)
    && statement.includes('public.current_user_is_brac_eligible'));
  assert.deepEqual(helperGrants, ['GRANT EXECUTE ON FUNCTION public.current_user_is_brac_eligible() TO authenticated;']);
});
test('review rows require eligibility while retaining publication and anonymity filters', () => {
  const view = sql.match(/CREATE OR REPLACE VIEW public.faculty_reviews_public[\s\S]*?;/)[0];
  assert.match(view, /WHERE r.moderation_status = 'published' AND f.is_active\s+AND \(SELECT public.current_user_is_brac_eligible\(\)\);/);
  assert.match(view, /'Anonymous Student'::text AS author_label/);
  assert.doesNotMatch(view, /reviewer_user_id|moderated_by|moderated_at|auth.uid\(\) IS NULL|OR\s+true/i);
  const helper = sql.split('AS $eligibility$')[1].split('$eligibility$;')[0];
  assert.match(helper, /SELECT EXISTS/);
  assert.match(helper, /u.id=auth.uid\(\)/);
  // No NULL-identity fallback: SQL equality cannot match a user for NULL auth.uid().
  assert.doesNotMatch(helper, /auth.uid\(\) IS NULL|OR\s+true/i);
});
