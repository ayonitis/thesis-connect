// Offline tests of actual source with explicit boundary doubles. No app/server/SQL startup.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { assertOriginalDefinition } = require('./helpers/assert-original-definition.cjs');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
globalThis.fetch = () => { throw new Error('NETWORK FORBIDDEN'); };

function load(file, overrides = {}, cache = new Map(), runtime = {}) {
  if (cache.has(file)) return cache.get(file);
  const compiledUnit = { exports: {} }; cache.set(file, compiledUnit.exports);
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, cache, runtime);
    if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), name) + '.ts', overrides, cache, runtime);
    throw new Error('Unmocked import forbidden: ' + name);
  };
  vm.runInNewContext(source, { exports: compiledUnit.exports, module: compiledUnit, require: localRequire, URL, process: { env: { NODE_ENV: 'test' } }, console: { error() {}, warn() {} }, ...runtime }, { filename: file, timeout: 2000 });
  return compiledUnit.exports;
}
const policy = load('src/lib/auth/email-policy.ts');
const guard = load('src/lib/auth/require-brac-user.ts');
const feedback = load('src/lib/auth/auth-feedback.ts');
const goodUser = () => ({ id: 'synthetic-id-not-a-real-user', email: 'Student.Name@g.bracu.ac.bd', email_confirmed_at: '2026-11-01T12:00:00Z', is_anonymous: false });
function client(options = {}) {
  const calls = { rpc: [], tables: [], cleanup: 0, exchange: 0, otp: 0 };
  let user = options.user === undefined ? goodUser() : options.user;
  let session = options.user === null ? null : { access_token: 'existing-session' };
  const api = {
    auth: {
      async getUser() { if (options.authThrow) throw Error('private'); return { data: { user }, error: options.authError ? { message: 'private' } : null }; },
      async signOut(scope) { calls.cleanup++; calls.cleanupScope = scope; if (options.cleanupThrow) throw Error('private'); if (!options.cleanupError) session = null; return { error: options.cleanupError ? {} : null }; },
      async getSession() { return {data: {session: options.changedSession ? {access_token:'different-session'} : session},error:null}; },
      async exchangeCodeForSession() { calls.exchange++; if(options.exchangeThrow) throw Error('private'); if(!options.exchangeError) session={access_token:'new-flow-session'}; return { data:{session:options.exchangeError?null:session}, error: options.exchangeError ? {} : null }; },
      async verifyOtp() { calls.otp++; if(!options.otpError) session={access_token:'new-flow-session'}; return { data:{session:options.otpError?null:session}, error: options.otpError ? {} : null }; },
    },
    async rpc(name) { calls.rpc.push(name); if(options.rpcThrow) throw Error('private'); return { data: name === 'is_admin' ? (options.admin ?? false) : Object.hasOwn(options, 'eligible') ? options.eligible : true, error: options.rpcError ? { message: 'private' } : null }; },
    from(table) {
      calls.tables.push(table);
      const chain = { then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
      return new Proxy(chain, { get(target, key) { return key === 'then' ? target.then : () => new Proxy(chain, this); } });
    },
  };
  return { api, calls, changeUser(next) { user = next; } };
}

const valid = ['student@g.bracu.ac.bd','Student.Name@G.BRACU.AC.BD',"o'neil@g.bracu.ac.bd",'a_b-c@g.bracu.ac.bd','a'.repeat(64)+'@g.bracu.ac.bd'];
const invalid = ['', null, undefined, 42, 'student+thesis@g.bracu.ac.bd','student@g.bracu.ac.bd.evil','student@sub.g.bracu.ac.bd','student@bracu.ac.bd','student@g.bracu.ac.bd.','student@@g.bracu.ac.bd','@g.bracu.ac.bd','Student <student@g.bracu.ac.bd>','"student"@g.bracu.ac.bd','stu dent@g.bracu.ac.bd','student\t@g.bracu.ac.bd','student\n@g.bracu.ac.bd',' student@g.bracu.ac.bd','student@g.bracu.ac.bd ','student@g.brÐ°cu.ac.bd','studÃ©nt@g.bracu.ac.bd','studentï¼ g.bracu.ac.bd','student\u200b@g.bracu.ac.bd','student\0@g.bracu.ac.bd','student\u007f@g.bracu.ac.bd','.student@g.bracu.ac.bd','student.@g.bracu.ac.bd','stu..dent@g.bracu.ac.bd','a'.repeat(65)+'@g.bracu.ac.bd','student@g.bracu.ac.bd\n'];
valid.forEach((value, i) => test('mailbox accepts allowed vector '+i, () => { assert.equal(policy.validateBracEmail(value).ok, true); assert.equal(policy.validateBracEmail(value).email, value); }));
invalid.forEach((value, i) => test('mailbox rejects attack/malformed vector '+i, () => assert.equal(policy.validateBracEmail(value).ok, false)));
test('only surrounding ASCII whitespace normalized for user input, local part unchanged', () => {
  const input=' \t\r\nStudent.Name@G.BRACU.AC.BD\v\f ';
  assert.equal(policy.validateBracEmail(input, true).email, 'Student.Name@G.BRACU.AC.BD');
  assert.equal(policy.validateBracEmail(input).ok, false);
  assert.equal(policy.validateBracEmail('\u00a0student@g.bracu.ac.bd', true).ok, false);
});
test('stable policy codes', () => {
  assert.equal(policy.validateBracEmail('').code,'EMAIL_REQUIRED');
  assert.equal(policy.validateBracEmail('a+b@g.bracu.ac.bd').code,'EMAIL_PLUS_NOT_ALLOWED');
  assert.equal(policy.validateBracEmail('a@other.test').code,'EMAIL_DOMAIN_NOT_ALLOWED');
  assert.equal(policy.validateBracEmail('a@@g.bracu.ac.bd').code,'EMAIL_MALFORMED');
});
test('guard allows verified current user only after exact boolean DB approval', async () => {
  const c=client(); assert.equal((await guard.requireBracUser(c.api)).id,goodUser().id);
  assert.deepEqual(c.calls.rpc,['current_user_is_brac_eligible']);
});
for (const [name,opts,code] of [
  ['missing',{user:null},'AUTH_REQUIRED'],['auth error',{authError:true},'AUTH_UNAVAILABLE'],['auth exception',{authThrow:true},'AUTH_UNAVAILABLE'],
  ['anonymous',{user:{...goodUser(),is_anonymous:true}},'ANONYMOUS_OR_UNKNOWN'],['unknown anonymous',{user:{...goodUser(),is_anonymous:undefined}},'ANONYMOUS_OR_UNKNOWN'],
  ['unconfirmed',{user:{...goodUser(),email_confirmed_at:null}},'EMAIL_UNVERIFIED'],['bad confirmation',{user:{...goodUser(),email_confirmed_at:'not-a-date'}},'EMAIL_UNVERIFIED'],
  ['unauthorized existing',{user:{...goodUser(),email:'x@other.test'}},'EMAIL_INELIGIBLE'],['persisted whitespace',{user:{...goodUser(),email:' student@g.bracu.ac.bd'}},'EMAIL_INELIGIBLE'],
  ['DB false',{eligible:false},'ELIGIBILITY_DENIED'],['DB unknown',{eligible:null},'ELIGIBILITY_DENIED'],['DB string',{eligible:'true'},'ELIGIBILITY_DENIED'],
  ['DB error',{rpcError:true},'ELIGIBILITY_UNAVAILABLE'],['DB exception',{rpcThrow:true},'ELIGIBILITY_UNAVAILABLE'],
]) test('guard denies '+name, async()=> {const c=client(opts); await assert.rejects(guard.requireBracUser(c.api), e=>e.code===code && !e.message.includes('private'));});
test('admin/moderator metadata never exempts unauthorized primary email',async()=>{
  for(const role of ['admin','moderator']) { const c=client({user:{...goodUser(),email:'x@other.test',app_metadata:{role},user_metadata:{eligible:true}}}); await assert.rejects(guard.requireBracUser(c.api)); }
});
test('email change and stale Auth response cannot use cached eligibility', async()=>{
  const c=client(); await guard.requireBracUser(c.api); c.changeUser({...goodUser(),email:'x@other.test'}); await assert.rejects(guard.requireBracUser(c.api));
  const stale=client({eligible:false}); await assert.rejects(guard.requireBracUser(stale.api));
  const fresh=client(); await guard.requireBracUser(fresh.api); await guard.requireBracUser(fresh.api); assert.equal(fresh.calls.rpc.length,2);
});
test('cleanup failures stay explicit and never throw private errors',async()=>{
  for(const options of [{cleanupThrow:true},{cleanupError:true}]) assert.equal(await guard.clearRejectedBracSession(client(options).api),false);
  assert.equal(await guard.clearRejectedBracSession(client().api),true);
});

// Execute the actual handler AST in a controlled scope, not the React application.
function handler(file,name,scope){
  const source=read(file); const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX); let arrow;
  function visit(n){ if(ts.isVariableDeclaration(n) && n.name.getText(ast)===name) arrow=n.initializer.getText(ast); ts.forEachChild(n,visit); } visit(ast); assert.ok(arrow);
  const js=ts.transpileModule('module.exports = '+arrow,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const compiledUnit={exports:{}};vm.runInNewContext(js,{...scope,module:compiledUnit,encodeURIComponent,Error},{timeout:2000});return compiledUnit.exports;
}
function flowScope(c){
  const state={errors:[],success:[],destinations:[],signup:[],login:[],oauth:[]};
  c.api.auth.signUp=async payload=>{state.signup.push(payload);return {data:{session:null},error:null};};
  c.api.auth.signInWithPassword=async payload=>{state.login.push(payload);return {error:null};};
  c.api.auth.signInWithOAuth=async payload=>{state.oauth.push(payload);return {error:null};};
  return { state, scope:{...policy,...guard,...feedback,email:'student@g.bracu.ac.bd',fullName:'Test',password:'synthetic-password',nextPath:'/partners/my-rooms',window:{location:{origin:'http://test.invalid'}},createClient:()=>c.api,setError:v=>state.errors.push(v),setSuccess:v=>state.success.push(v),setIsLoading:()=>{},setIsEmailLoading:()=>{},setIsGoogleLoading:()=>{},setPassword:()=>{},setDone:v=>{state.done=v;},router:{push:v=>state.destinations.push(v),replace:v=>state.destinations.push(v),refresh:()=>{}}} };
}
test('signup handler allows input with ASCII outer whitespace without requiring confirmation at creation',async()=>{
  const f=flowScope(client());f.scope.email=' student@g.bracu.ac.bd\t';await handler('src/app/sign-up/page.tsx','handleSignUp',f.scope)();assert.equal(f.state.signup.length,1);assert.equal(f.state.signup[0].email,'student@g.bracu.ac.bd');
});
test('signup handler rejects unauthorized and plus inputs before Auth call',async()=>{
  for(const email of ['x@other.test','x+y@g.bracu.ac.bd']){const f=flowScope(client());f.scope.email=email;await handler('src/app/sign-up/page.tsx','handleSignUp',f.scope)();assert.equal(f.state.signup.length,0);assert.ok(f.state.errors.at(-1));}
});
test('password login checks eligibility before routing',async()=>{
  for(const eligible of [true,false]){const f=flowScope(client({eligible}));await handler('src/app/sign-in/page.tsx','handleEmailSignIn',f.scope)();assert.equal(f.state.login.length,1);assert.equal(f.state.destinations.length,eligible?1:0);}
});
test('unconfirmed password login cannot enter app even if Auth returns a session',async()=>{
  const c=client({user:{...goodUser(),email_confirmed_at:null}}),f=flowScope(c);await handler('src/app/sign-in/page.tsx','handleEmailSignIn',f.scope)();assert.deepEqual(f.state.destinations,['/verify-email?error=email_confirmation_required']);assert.equal(c.calls.cleanup,1);
});
test('Google initiation uses current app callback and no claimed domain security hint',async()=>{
  const f=flowScope(client());await handler('src/app/sign-in/page.tsx','handleGoogleSignIn',f.scope)();assert.equal(f.state.oauth[0].provider,'google');assert.ok(f.state.oauth[0].options.redirectTo.startsWith('http://test.invalid/auth/callback?next='));
});
function callback(c){return load('src/app/auth/callback/route.ts',{'next/server':{NextResponse:{redirect:url=>({location:url.href})}},'@/lib/supabase/server':{createRouteClient:async()=>({supabase:c.api,assertCookiePersistence(){}})}}).GET;}
test('actual callback allows eligible exchanged code',async()=>{const c=client();const result=await callback(c)({url:'http://test.invalid/auth/callback?code=synthetic&next=/partners/my-rooms'});assert.equal(result.location,'http://test.invalid/partners/my-rooms');assert.equal(c.calls.exchange,1);});
for(const opts of [{eligible:false},{rpcThrow:true},{user:{...goodUser(),email:'x@other.test'}},{user:{...goodUser(),email_confirmed_at:null}},{exchangeError:true},{exchangeThrow:true},{eligible:false,cleanupThrow:true}]){
  test('callback denies and attempts cleanup: '+JSON.stringify(opts),async()=>{const c=client(opts);const result=await callback(c)({url:'http://test.invalid/auth/callback?code=synthetic&next=/admin/faculty'});assert.ok(new URL(result.location).pathname === '/sign-in' && new URL(result.location).searchParams.has('error'));assert.equal(c.calls.cleanup,opts.exchangeError||opts.exchangeThrow?0:1);});
}
test('OTP confirmation and recovery branch uses eligibility',async()=>{
  for(const type of ['signup','recovery']){const c=client();const r=await callback(c)({url:'http://test.invalid/auth/callback?token_hash=synthetic&type='+type});assert.ok(r.location.includes(type==='recovery'?'/reset-password':'/verify-email?status=verified'));assert.equal(c.calls.otp,1);}
});
test('callback rejects missing/malformed/provider error without leaking reason',async()=>{
  for(const query of ['','?error=secret-provider-detail','?token_hash=synthetic&type=invalid']){const c=client();const r=await callback(c)({url:'http://test.invalid/auth/callback'+query});assert.ok(r.location.includes('brac_access_required'));assert.ok(!r.location.includes('secret'));}
});
test('redirect validation rejects external/normalization attacks',()=>{
  const {getSafeInternalRedirectPath:f}=load('src/lib/auth/redirect.ts');
  for(const p of ['https://evil.test','//evil.test','/\\evil.test','/\nevil.test',' /admin']) assert.equal(f(p),'/');
  assert.equal(f('/faculty?tab=reviews'),'/faculty?tab=reviews');
});
test('protected data helpers deny before table or business-RPC access',async()=>{
  const excluded=new Set(['getFacultyDirectory','getFacultyBySlug','listPublicPartnerRooms','getPublicPartnerRoomById']);
  for(const file of ['profile','faculty','partner-rooms']){
    const exports=load('src/lib/data/'+file+'.ts');
    for(const [name,fn] of Object.entries(exports)){
      if(excluded.has(name)||typeof fn!=='function')continue;
      const c=client({eligible:false});await assert.rejects(fn(c.api,{},{}),e=>e.code==='ELIGIBILITY_DENIED',name);
      assert.deepEqual(c.calls.tables,[],name);assert.deepEqual(c.calls.rpc,['current_user_is_brac_eligible'],name);
    }
  }
});
test('public room and faculty projection loaders still run; unauthorized review view never read',async()=>{
  const c=client({user:null});const rooms=load('src/lib/data/partner-rooms.ts');await rooms.listPublicPartnerRooms(c.api);await rooms.getPublicPartnerRoomById(c.api,'synthetic');
  const faculty=load('src/lib/data/faculty.ts');const result=await faculty.getFacultyDirectory(c.api);assert.equal(result.canViewReviews,false);assert.ok(c.calls.tables.includes('faculty_public'));assert.ok(c.calls.tables.includes('partner_rooms_public'));assert.ok(!c.calls.tables.includes('faculty_reviews_public'));
});
test('server layout independently denies errors without rendering protected children',async()=>{
  let rendered=false; const layout=load('src/components/auth/protected-brac-layout.tsx',{'next/navigation':{redirect:where=>{throw Error(where);}},'@/lib/supabase/server':{createClient:async()=>client({rpcError:true}).api},'react/jsx-runtime':{jsx:()=>{rendered=true;},Fragment:'fragment'}}).default;
  await assert.rejects(layout({children:'protected'}),/brac_access_required/);assert.equal(rendered,false);
});
test('proxy denies protected paths for missing/ineligible users independently of data helpers',async()=>{
  const routes=['/admin','/admin/faculty','/profile/complete','/partners/create','/partners/my-rooms','/partners/id/join','/faculty/post-review','/faculty/id/review'];
  const proxy=load('src/proxy.ts',{'next/server':{NextResponse:{redirect:url=>({location:url.href,cookies:{set(){}}}),next:()=>({public:true})}},'@/lib/supabase/proxy':{updateSession:async()=>({response:{public:true,cookies:{getAll:()=>[]},headers:{get:()=>null}},user:null,eligible:false,profileStatus:'unknown'})}}).proxy;
  for(const route of routes){const result=await proxy({nextUrl:new URL('http://test.invalid'+route),url:'http://test.invalid'+route});assert.ok(result.location.includes('/sign-in?next='),route);}
  assert.equal((await proxy({nextUrl:new URL('http://test.invalid/faculty'),url:'http://test.invalid/faculty'})).public,true);
});
test('unknown profile state cannot pass profile-required proxy routes',async()=>{
  const proxy=load('src/proxy.ts',{'next/server':{NextResponse:{redirect:url=>({location:url.href,cookies:{set(){}}})}},'@/lib/supabase/proxy':{updateSession:async()=>({response:{cookies:{getAll:()=>[]},headers:{get:()=>null}},user:goodUser(),eligible:true,profileStatus:'unknown'})}}).proxy;
  const result=await proxy({nextUrl:new URL('http://test.invalid/partners/create'),url:'http://test.invalid/partners/create'});assert.ok(result.location.includes('/profile/complete?next='));
});
test('student route groups install independent server BRAC layouts',()=>{
  for(const route of ['profile/complete','faculty/post-review','faculty/[slug]/review','partners/create','partners/my-rooms','partners/[roomId]/join']) assert.ok(read('src/app/'+route+'/layout.tsx').includes('protected-brac-layout'));
});
test('callback client construction failure denies without revealing exception',async()=>{
  const get=load('src/app/auth/callback/route.ts',{'next/server':{NextResponse:{redirect:url=>({location:url.href})}},'@/lib/supabase/server':{createRouteClient:async()=>{throw Error('private secret');}}}).GET;
  assert.equal((await get({url:'http://test.invalid/auth/callback?code=synthetic'})).location,'http://test.invalid/sign-in?error=brac_access_required');
});

test('admin callback accepts only the dedicated database authorization for admin destinations', async () => {
  const user = {...goodUser(), email: 'ayon3015@gmail.com'};
  const designated = client({user, admin: true});
  const dest = 'https://test.invalid/auth/callback?code=synthetic&next=/admin';
  assert.equal((await callback(designated)( {url: dest} )).location, 'https://test.invalid/admin');
  assert.deepEqual(designated.calls.rpc, ['is_admin']);
  for (const denied of [client(), client({user, admin: 'true'})]) {
    assert.match((await callback(denied)({url: dest})).location, /error=admin_access_required/);
    assert.equal(denied.calls.cleanup, 1);
  }
  const studentPath = dest.replace('next=/admin', 'next=/partners/my-rooms');
  assert.match((await callback(client({user, admin: true}))({url: studentPath})).location, /brac_access_required/);
});

test('confirmed designated account retains the exchanged session while admin assignment is pending', async () => {
  for (const next of ['/', '/admin/faculty']) {
    const c = client({user: {...goodUser(), email: 'AYON3015@gmail.com'}, admin: false});
    const result = await callback(c)({url: 'https://test.invalid/auth/callback?code=synthetic&next=' + next});
    assert.equal(result.location, 'https://test.invalid/sign-in?next=/admin&status=admin_pending');
    assert.deepEqual(c.calls.rpc, ['is_admin']);
    assert.equal(c.calls.cleanup, 0);
    assert.equal((await c.api.auth.getSession()).data.session.access_token, 'new-flow-session');
  }
});

test('admin callback rejects unverified or different identities and does not retain a session on RPC error', async () => {
  const user = {...goodUser(), email: 'ayon3015@gmail.com'};
  for (const options of [
    {user: {...user, email: 'ayon3015+test@gmail.com'}},
    {user: {...user, email: 'other@gmail.com', user_metadata: {email: user.email}}},
    {user: {...user, email_confirmed_at: null}},
    {user: {...user, is_anonymous: true}},
    {user, rpcError: true},
  ]) {
    const c = client(options);
    const result = await callback(c)({url: 'https://test.invalid/auth/callback?code=synthetic&next=/'});
    assert.match(result.location, /brac_access_required/);
    assert.equal(c.calls.cleanup, 1);
  }
});

test('admin server layout denies before rendering and accepts the database-verified admin', async () => {
  const render = (c) => load('src/app/admin/layout.tsx', {
    'next/navigation': {redirect: where => {throw Error(where);}},
    '@/lib/supabase/server': {createClient: async () => c.api},
    'react/jsx-runtime': {jsx: (_type, props) => props.children, Fragment: 'fragment'},
  }).default({children: 'admin dashboard'});
  for (const c of [client(), client({user: null}), client({user: {...goodUser(), email_confirmed_at: null}, admin: true})]) {
    await assert.rejects(render(c), /admin_access_required/);
  }
  assert.equal(await render(client({user: {...goodUser(), email: 'ayon3015@gmail.com'}, admin: true})), 'admin dashboard');
});

test('admin data helpers never call a business RPC or a table for unprivileged users', async () => {
  const admin = load('src/lib/data/admin.ts');
  for (const fn of Object.values(admin)) {
    const c = client();
    await assert.rejects(fn(c.api, 'id', 'hidden'), /Administrator access is required/);
    assert.deepEqual(c.calls.rpc, ['is_admin']);
    assert.deepEqual(c.calls.tables, []);
  }
});

test('designated admin migration uses a live session and leaves student policies and table grants alone', () => {
  const sql = read('supabase/migrations/20261110130000_designated_admin.sql');
  assert.match(sql, /r\.user_id = auth\.uid\(\) AND r\.role = 'admin'/);
  assert.match(sql, /u\.email_confirmed_at IS NOT NULL\s+AND lower\(u\.email COLLATE "C"\) = 'ayon3015@gmail\.com'/);
  assert.match(sql, /JOIN auth\.sessions AS s ON s\.user_id = u\.id/);
  assert.doesNotMatch(sql, /(?:CREATE|ALTER|DROP) POLICY|GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)/);
});

const adminBanCases = [
  ['no ban', null, true],
  ['current ban', '2026-11-10T12:01:00Z', false],
  ['expired ban', '2026-11-10T11:59:00Z', true],
  ['ban expires at statement start', '2026-11-10T12:00:00Z', true],
];
for (const [label, bannedUntil, expected] of adminBanCases) {
  test('designated admin runtime ban predicate: ' + label, () => {
    const sql = read('supabase/migrations/20261110130000_designated_admin.sql');
    const admin = sql.match(/CREATE OR REPLACE FUNCTION public\.is_admin\(\)[\s\S]*?\$admin\$;/);
    assert.ok(admin);
    assert.match(admin[0], /LANGUAGE sql STABLE SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp\s+SET row_security = off/);
    assert.match(admin[0], /AND \(u\.banned_until IS NULL OR u\.banned_until <= statement_timestamp\(\)\)/);
    assert.match(admin[0], /AND \(s\.not_after IS NULL OR s\.not_after > statement_timestamp\(\)\)/);
    // Model the SQL predicate with all other admin guards satisfied. No SQL is executed.
    const statementStart = Date.parse('2026-11-10T12:00:00Z');
    assert.equal(bannedUntil === null || Date.parse(bannedUntil) <= statementStart, expected);
  });
}

// Six draft-dependent assertions are preserved in tests/private/; see tests/README.md.

test('original SHA-256 values remain exact',()=>{
  const manifest=JSON.parse(read('tests/brac-original-hashes.json'));assert.equal(Object.keys(manifest).length,8);
  for(const [name,hash] of Object.entries(manifest)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'supabase/migrations',name))).digest('hex'),hash,name);
});

// Explicitly NOT run: these require genuine Auth/Postgres and separate authorization.
for(const name of ['Real password signup rejection leaves no Auth/profile row','Real Google first-user insertion and existing-account linking','Real email confirmation and refresh/token behavior','Actual restrictive RLS denial with real JWTs','Actual SECURITY DEFINER RPC denial and retained business checks','Actual owner-privileged faculty_reviews_public eligibility','Actual public projection results and private contact isolation','Minimum role privileges/Auth RLS/helper ownership and managed trigger compatibility','Actual email change concurrency and stale-session rejection','Actual Next/browser cookie cleanup and layout navigation']) test.todo(name);

// Targeted remediation regressions. All boundaries below are doubles, not live services.
function jar(initial = []) {
  const values = new Map(initial.map(c => [c.name, {...c}]));
  return {
    getAll: () => [...values.values()],
    set(name, value, options) {
      const cookie = typeof name === 'object' ? {...name} : {name, value, ...options};
      values.set(cookie.name, cookie);
    },
  };
}
function headerJar() {
  const values=new Map();return {set:(name,value)=>values.set(name.toLowerCase(),value),get:name=>values.get(name.toLowerCase())??null};
}
const nextDouble = {
  next: () => ({kind:'next', cookies:jar(),headers:headerJar()}),
  redirect: (url,init) => {const response={kind:'redirect',location:url.href,cookies:jar(),headers:headerJar()};Object.entries(init?.headers??{}).forEach(([name,value])=>response.headers.set(name,value));return response;},
};
const localRuntime = {process:{env:{NODE_ENV:'test',NEXT_PUBLIC_SUPABASE_URL:'https://offline.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-not-a-key'}}};
function proxyForIdentity(c, emitCookies = false) {
  let cookieAdapter, identityCalls = 0;
  const originalGetUser=c.api.auth.getUser;
  c.api.auth.getUser=async()=>{
    identityCalls++;
    if(emitCookies) cookieAdapter.setAll(identityCalls===1 ? [
      {name:'sb-offline-auth.0',value:'refresh',options:{path:'/',httpOnly:true,secure:true,sameSite:'lax',maxAge:3600}},
      {name:'sb-offline-obsolete',value:'',options:{path:'/',maxAge:0}},
    ] : [{name:'sb-offline-auth.1',value:'chunk',options:{path:'/',secure:true,sameSite:'lax'}}], {'Cache-Control':'private, no-store',Pragma:'no-cache',Expires:'0'});
    return originalGetUser();
  };
  const overrides={'next/server':{NextResponse:nextDouble},'@supabase/ssr':{createServerClient:(_url,_key,options)=>{cookieAdapter=options.cookies;return c.api;}}};
  return {
    proxy:load('src/proxy.ts',overrides,new Map(),localRuntime).proxy,
    update:load('src/lib/supabase/proxy.ts',overrides,new Map(),localRuntime).updateSession,
  };
}
function requestFor(route){return {url:'https://offline.invalid'+route,nextUrl:new URL('https://offline.invalid'+route),cookies:jar()};}

for(const [name,options] of [
  ['eligible',{}],['ineligible',{user:{...goodUser(),email:'x@other.test'},eligible:false}],
  ['unverified',{user:{...goodUser(),email_confirmed_at:null}}],['RPC unavailable',{rpcError:true}],['already signed out',{user:null}],
]) test('M1 explicit local sign-out works for '+name,async()=>{
  const c=client(options), f=flowScope(c);
  const result=await proxyForIdentity(c).proxy(requestFor('/sign-out'));
  assert.equal(result.kind,'next');assert.equal(c.calls.rpc.length,0);
  await handler('src/app/sign-out/page.tsx','handleSignOut',f.scope)();
  assert.equal(f.state.done,true);assert.equal(f.state.destinations.at(-1),'/sign-in');
  assert.equal(c.calls.cleanup,1);assert.equal(c.calls.cleanupScope.scope,'local');
  assert.equal((await c.api.auth.getSession()).data.session,null);
});
test('M1 ineligible identity stays authenticated but cannot access protected data',async()=>{
  const c=client({eligible:false}), runners=proxyForIdentity(c);
  const result=await runners.update(requestFor('/faculty'));
  assert.equal(result.user.id,goodUser().id);assert.equal(result.eligible,false);
  const protectedResult=await runners.proxy(requestFor('/partners/create'));
  assert.ok(protectedResult.location.includes('/sign-in?next='));assert.equal(c.calls.tables.length,0);
});
test('M1 sign-out failure never claims completion or redirects',async()=>{
  const c=client({cleanupError:true}),f=flowScope(c);
  await handler('src/app/sign-out/page.tsx','handleSignOut',f.scope)();
  assert.notEqual(f.state.done,true);assert.equal(f.state.destinations.length,0);assert.ok(f.state.errors.at(-1));
});

test('M2 unsolicited callback GET preserves an existing eligible session',async()=>{
  for(const query of ['','?error=unrelated','?token_hash=synthetic&type=invalid']){
    const c=client();let constructed=0;
    const get=load('src/app/auth/callback/route.ts',{
      'next/server':{NextResponse:nextDouble},'@/lib/supabase/server':{createRouteClient:async()=>{constructed++;return {supabase:c.api,assertCookiePersistence(){}};}}
    }).GET;
    await get({url:'https://offline.invalid/auth/callback'+query});
    assert.equal(c.calls.cleanup,0);assert.equal(constructed,0);
    assert.equal((await c.api.auth.getSession()).data.session.access_token,'existing-session');
  }
});
test('M2 failed code/OTP exchange does not clear prior session',async()=>{
  for(const [options,query] of [[{exchangeError:true},'?code=synthetic'],[{exchangeThrow:true},'?code=synthetic'],[{otpError:true},'?token_hash=synthetic&type=signup']]){
    const c=client(options);await callback(c)({url:'https://offline.invalid/auth/callback'+query});
    assert.equal(c.calls.cleanup,0);assert.equal((await c.api.auth.getSession()).data.session.access_token,'existing-session');
  }
});
test('M2 rejected established session is cleared; replacement session is preserved',async()=>{
  const rejected=client({eligible:false});await callback(rejected)({url:'https://offline.invalid/auth/callback?code=synthetic'});
  assert.equal(rejected.calls.cleanup,1);assert.equal((await rejected.api.auth.getSession()).data.session,null);
  const replaced=client({eligible:false,changedSession:true});await callback(replaced)({url:'https://offline.invalid/auth/callback?code=synthetic'});
  assert.equal(replaced.calls.cleanup,0);assert.equal((await replaced.api.auth.getSession()).data.session.access_token,'different-session');
});
test('M2 failed cleanup remains denied and reports cleanup failure safely',async()=>{
  const c=client({eligible:false,cleanupThrow:true});const result=await callback(c)({url:'https://offline.invalid/auth/callback?code=synthetic&next=/admin/faculty'});
  assert.ok(result.location.includes('error=session_cleanup_failed'));assert.ok(!result.location.includes('/admin/faculty'));
});

test('M4 refresh and deletion cookies survive protected redirect with options and chunks',async()=>{
  const c=client({eligible:false}), result=await proxyForIdentity(c,true).proxy(requestFor('/partners/create'));
  assert.equal(result.kind,'redirect');const cookies=result.cookies.getAll();
  assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.equal(result.headers.get('Pragma'),'no-cache');
  assert.equal(cookies.length,3);const refreshed=cookies.find(c=>c.name==='sb-offline-auth.0');
  assert.equal(refreshed.value,'refresh');assert.equal(refreshed.httpOnly,true);assert.equal(refreshed.secure,true);assert.equal(refreshed.sameSite,'lax');assert.equal(refreshed.path,'/');assert.equal(refreshed.maxAge,3600);
  assert.equal(cookies.find(c=>c.name==='sb-offline-obsolete').maxAge,0);assert.equal(cookies.find(c=>c.name==='sb-offline-auth.1').value,'chunk');
});
test('M4 profile redirect also preserves refresh cookie mutations',async()=>{
  const c=client(), result=await proxyForIdentity(c,true).proxy(requestFor('/partners/create'));
  assert.ok(result.location.includes('/profile/complete?next='));assert.equal(result.cookies.getAll().length,3);
});
function routeContext(options={}) {
  const c=client(options);let adapter,writes=0;
  const store=jar();const originalSet=store.set;
  store.set=(...args)=>{writes++;if(options.writeFailure)throw Error('private cookie detail');originalSet(...args);};
  const mod=load('src/lib/supabase/server.ts',{
    'next/headers':{cookies:async()=>store},
    '@supabase/ssr':{createServerClient:(_url,_key,config)=>{adapter=config.cookies;return c.api;}},
  },new Map(),localRuntime);
  return {c,mod,store,getAdapter:()=>adapter,getWrites:()=>writes};
}
test('M4 read-only Server Component context never pretends to persist cookies',async()=>{
  const f=routeContext({writeFailure:true});await f.mod.createClient();
  f.getAdapter().setAll([{name:'sb-offline',value:'refresh',options:{path:'/'}}]);assert.equal(f.getWrites(),0);
});
test('M4 writable route context records sticky cookie failure and cleanup cannot report success',async()=>{
  const f=routeContext({writeFailure:true}), context=await f.mod.createRouteClient();
  assert.throws(()=>f.getAdapter().setAll([{name:'sb-offline',value:'',options:{path:'/',maxAge:0}}]),/could not be saved/);
  assert.throws(()=>context.assertCookiePersistence(),/could not be saved/);
  assert.equal(await guard.clearRejectedBracSession(f.c.api,context.assertCookiePersistence),false);
});
test('M4 successful writable cleanup persists deletion before redirect',async()=>{
  const f=routeContext(), context=await f.mod.createRouteClient();const original=f.c.api.auth.signOut;
  f.c.api.auth.signOut=async options=>{const result=await original(options);f.getAdapter().setAll([{name:'sb-offline',value:'',options:{path:'/',httpOnly:true,maxAge:0}}]);return result;};
  assert.equal(await guard.clearRejectedBracSession(f.c.api,context.assertCookiePersistence),true);
  const response=nextDouble.redirect(new URL('https://offline.invalid/sign-in'));
  f.store.getAll().forEach(c=>response.cookies.set(c));
  assert.equal(response.cookies.getAll()[0].maxAge,0);assert.equal(response.cookies.getAll()[0].httpOnly,true);
});
test('M4 callback denies when persistence fails even if SDK reports successful exchange',async()=>{
  const c=client({eligible:false});
  const get=load('src/app/auth/callback/route.ts',{'next/server':{NextResponse:nextDouble},'@/lib/supabase/server':{createRouteClient:async()=>({supabase:c.api,assertCookiePersistence(){throw Error('cookie persistence failed');}})}}).GET;
  const result=await get({url:'https://offline.invalid/auth/callback?code=synthetic'});
  assert.ok(result.location.includes('session_cleanup_failed'));assert.equal(c.calls.cleanup,1);
});
test('M4 cleanup does not claim success if local SDK still has a session',async()=>{
  const c=client();c.api.auth.signOut=async()=>({error:null});
  assert.equal(await guard.clearRejectedBracSession(c.api),false);
});
test('L1 preservation assertion rejects case-only SQL literal changes using approved source and a synthetic replacement',()=>{
  const original=read('supabase/migrations/20261028190100_phase_2b_rls_and_views.sql').match(/CREATE FUNCTION public\.is_admin\([\s\S]*?\$\$;/)[0];
  const replacement=original.replace(/^CREATE FUNCTION/i,'CREATE OR REPLACE FUNCTION').replace('SELECT EXISTS','SELECT thesis_connect_private.current_user_is_brac_eligible() AND EXISTS');
  assert.notEqual(replacement,original);
  assertOriginalDefinition(replacement,original,'is_admin');
  assert.throws(()=>assertOriginalDefinition(replacement.replace("'admin'","'Admin'"),original,'is_admin'));
});
test('L2 sensitive error payloads become fixed safe messages',()=>{
  const safe=load('src/lib/data/safe-errors.ts');
  const error=safe.toSafeDataError({code:'XX000',message:'SELECT secret FROM private_table; token=PRIVATE',details:'private user',hint:'credential'});
  assert.equal(error.code,'DATA_UNAVAILABLE');assert.equal(error.message,'The request could not be completed. Please try again.');
  assert.ok(!JSON.stringify(error).includes('PRIVATE'));
  for(const dataModule of ['faculty','profile','partner-rooms'])assert.ok(!/throw new Error\(\w+\.message\)/.test(read('src/lib/data/'+dataModule+'.ts')));
});
test('L2 expected business failures remain useful without passing through database text',()=>{
  const safe=load('src/lib/data/safe-errors.ts');
  for(const [message,expected] of [
    ['room has no remaining capacity','This room has no remaining places.'],
    ['review already exists for this faculty','You have already reviewed this faculty member.'],
    ['a matching faculty request is already pending','You already have a matching faculty request awaiting review.'],
  ]){const result=safe.toSafeDataError({code:'P0001',message});assert.equal(result.code,'BUSINESS_RULE');assert.equal(result.message,expected);}
  assert.equal(safe.toSafeDataError({code:'23505',message:'constraint secret'}).code,'DATA_CONFLICT');
  assert.equal(safe.toSafeDataError({code:'42501',message:'SQL detail'}).code,'ACCESS_DENIED');
  assert.equal(safe.toSafeDataError({code:'P0001',message:'unknown internal detail'}).code,'DATA_UNAVAILABLE');
});
test('L2 development diagnostics contain only fixed enum, never raw details',()=>{
  const logs=[];
  const safe=load('src/lib/data/safe-errors.ts',{},new Map(),{process:{env:{NODE_ENV:'development'}},console:{warn:(...args)=>logs.push(args)}});
  assert.throws(()=>safe.throwSafeDataError({code:'SECRET',message:'token=PRIVATE SQL',details:'private user'}),/could not be completed/);
  assert.equal(logs.length,1);assert.equal(logs[0][1].code,'DATA_UNAVAILABLE');assert.ok(!JSON.stringify(logs).includes('PRIVATE'));assert.ok(!JSON.stringify(logs).includes('SECRET'));
});
test('L2 actual data loaders sanitize database boundary errors',async()=>{
  const failure={message:'SELECT password FROM secret_relation; PRIVATE',code:'XX000'};
  const response={data:null,error:failure};
  const c=client();c.api.from=()=>{const chain=new Proxy({then:resolve=>Promise.resolve(response).then(resolve)},{get(target,key){return key==='then'?target.then:()=>chain;}});return chain;};
  for(const [file,fn,args] of [['profile','getCurrentProfile',[]],['faculty','getFacultyDirectory',[]],['partner-rooms','listPublicPartnerRooms',[]]]){
    await assert.rejects(load('src/lib/data/'+file+'.ts')[fn](c.api,...args),e=>e.code==='DATA_UNAVAILABLE'&&!e.message.includes('PRIVATE'));
  }
});


test('M4 callback redirects carry anti-cache headers even for malformed requests',async()=>{
  const get=load('src/app/auth/callback/route.ts',{'next/server':{NextResponse:nextDouble},'@/lib/supabase/server':{createRouteClient:async()=>{throw Error('must not be called');}}}).GET;
  const response=await get({url:'https://offline.invalid/auth/callback'});
  assert.ok(response.headers.get('Cache-Control').includes('no-store'));assert.equal(response.headers.get('Pragma'),'no-cache');assert.equal(response.headers.get('Expires'),'0');
});

test('recovery and confirmation handlers do not expose raw Auth failures',async()=>{
  for(const [file,name,method] of [
    ['src/app/forgot-password/page.tsx','handleResetRequest','resetPasswordForEmail'],
    ['src/app/verify-email/page.tsx','handleResend','resend'],
    ['src/app/reset-password/page.tsx','handleSubmit','updateUser'],
  ]){
    const c=client(),f=flowScope(c);c.api.auth[method]=async()=>({error:{message:'PRIVATE provider or SQL details'}});
    Object.assign(f.scope,{confirmPassword:'synthetic-password',setMessage:()=>{},setResendMessage:()=>{},setResendError:value=>f.state.errors.push(value)});
    await handler(file,name,f.scope)({preventDefault(){}});
    assert.ok(f.state.errors.at(-1));assert.ok(!f.state.errors.at(-1).includes('PRIVATE'));
  }
});


test('signup rejects weak passwords before any Auth request', async()=>{
  for(const password of ['Short!','LongPassword123']) {
    const f=flowScope(client()); f.scope.password=password;
    await handler('src/app/sign-up/page.tsx','handleSignUp',f.scope)();
    assert.equal(f.state.signup.length,0);assert.ok(f.state.errors.at(-1));
  }
});
test('signup maps rate limits and duplicate codes without exposing diagnostics', async()=>{
  for(const [code,expected] of [['over_email_send_rate_limit',/wait/],['user_already_exists',/already exists/]]) {
    const c=client(),f=flowScope(c);
    c.api.auth.signUp=async()=>({data:{session:null},error:{code,message:'PRIVATE synthetic database detail'}});
    await handler('src/app/sign-up/page.tsx','handleSignUp',f.scope)();
    assert.match(f.state.errors.at(-1),expected);assert.ok(!f.state.errors.at(-1).includes('PRIVATE'));
  }
});
test('unconfirmed sign-in routes only to verification guidance without protected navigation', async()=>{
  const c=client(),f=flowScope(c);
  c.api.auth.signInWithPassword=async()=>({error:{code:'email_not_confirmed',message:'PRIVATE'}});
  await handler('src/app/sign-in/page.tsx','handleEmailSignIn',f.scope)();
  assert.deepEqual(f.state.destinations,['/verify-email?error=email_confirmation_required']);
  assert.match(f.state.errors.at(-1),/verify/);assert.equal(c.calls.rpc.length,0);
});


test('eligibility service errors do not blame the email or navigate into the app', async()=>{
  const c=client({rpcError:true}),f=flowScope(c);
  await handler('src/app/sign-in/page.tsx','handleEmailSignIn',f.scope)();
  assert.deepEqual(f.state.destinations,[]);assert.equal(c.calls.cleanup,1);
  assert.match(f.state.errors.at(-1),/temporarily unavailable/);
});

test('admin Add Faculty uses the guarded RPC and normalizes optional input', async () => {
  const c = client({user: {...goodUser(), email: 'ayon3015@gmail.com'}, admin: true});
  const rpc = c.api.rpc;
  const requests = [];
  c.api.rpc = async (name, args) => {
    if (name === 'admin_add_faculty') requests.push(args);
    return rpc(name, args);
  };
  const {addFaculty} = load('src/lib/data/admin.ts');
  const input = {name: '  Example Faculty  ', department: 'CSE', designation: ' Lecturer ', email: ' ', summaryNote: ' A note '};
  await addFaculty(c.api, input);
  assert.deepEqual(c.calls.rpc, ['is_admin', 'admin_add_faculty']);
  assert.deepEqual({...requests[0]}, {
    p_name: 'Example Faculty', p_department: 'CSE', p_designation: 'Lecturer', p_email: null, p_summary_note: 'A note',
  });
  assert.deepEqual(c.calls.tables, []);

  c.api.rpc = (name, args) => name === 'admin_add_faculty'
    ? Promise.resolve({error: {code: '23505', message: 'raw database detail'}})
    : rpc(name, args);
  await assert.rejects(addFaculty(c.api, input), /already exists in that department/);
});

test('Add Faculty migration relies on existing duplicate protection and leaves public email projection alone', () => {
  const sql = read('supabase/migrations/20261111120000_admin_add_faculty.sql');
  const baseline = read('supabase/migrations/20261028190000_phase_2b_schema.sql');
  assert.match(baseline, /create unique index faculty_unique_normalized_name_department_idx\s+on public\.faculty \(lower\(btrim\(name\)\), department\)/i);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp/);
  assert.match(sql, /IF public\.is_admin\(\) IS DISTINCT FROM true[\s\S]*?42501[\s\S]*?INSERT INTO public\.faculty/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role;[\s\S]*?GRANT EXECUTE[\s\S]*?TO authenticated;/);
  assert.doesNotMatch(sql, /(?:CREATE|ALTER|DROP) (?:POLICY|VIEW)|ON CONFLICT/);
});

test('server profile renders the Admin Panel link only after database authorization', async () => {
  const jsx = (type, props) => ({type, props});
  const render = (c) => load('src/app/profile/page.tsx', {
    'next/navigation': {redirect: where => {throw Error(where);}},
    '@/lib/supabase/server': {createClient: async () => c.api},
    '@/components/layout/footer': {Footer: 'Footer'},
    '@/components/layout/page-header': {PageHeader: 'PageHeader'},
    '@/components/profile/student-profile-form': {StudentProfileForm: 'StudentProfileForm'},
    '@/components/ui/button': {LinkButton: 'LinkButton'},
    'react/jsx-runtime': {jsx, jsxs: jsx},
  }).default();
  const admin = client({user: {...goodUser(), email: 'ayon3015@gmail.com'}, admin: true});
  assert.match(JSON.stringify(await render(admin)), /"href":"\/admin".*"children":"Admin Panel"/);
  assert.deepEqual(admin.calls.rpc, ['is_admin']);
  const student = client();
  assert.equal((await render(student)).type, 'StudentProfileForm');
  const outsider = client({user: {...goodUser(), email: 'ayon3015@gmail.com'}});
  await assert.rejects(render(outsider), /brac_access_required/);
});

test('an authorized non-BRAC admin can leave the dashboard and return with the same session', async () => {
  const c = client({user: {...goodUser(), email: 'ayon3015@gmail.com'}, admin: true});
  const routes = proxyForIdentity(c);
  const layout = load('src/app/admin/layout.tsx', {
    'next/navigation': {redirect: where => {throw Error(where);}},
    '@/lib/supabase/server': {createClient: async () => c.api},
    'react/jsx-runtime': {jsx: (_type, props) => props.children, Fragment: 'fragment'},
  }).default;
  for (const path of ['/admin', '/', '/profile', '/faculty', '/admin']) {
    assert.equal((await routes.proxy(requestFor(path))).kind, 'next', path);
    if (path === '/admin') assert.equal(await layout({children:'dashboard'}), 'dashboard');
  }
  assert.equal((await routes.proxy(requestFor('/profile/complete'))).kind, 'redirect');
  assert.equal((await routes.proxy(requestFor('/partners/create'))).kind, 'redirect');
  assert.equal((await c.api.auth.getSession()).data.session.access_token, 'existing-session');
  assert.equal(c.calls.cleanup, 0);
});

test('faculty deletion requires admin and reports foreign-key blockers without raw details', async () => {
  const {deleteFaculty} = load('src/lib/data/admin.ts');
  const ordinary = client();
  await assert.rejects(deleteFaculty(ordinary.api, 'fixture-id'), /Administrator access/);
  assert.deepEqual(ordinary.calls.rpc, ['is_admin']);

  const admin = client({admin: true});
  const original = admin.api.rpc;
  admin.api.rpc = async (name, args) => {
    if (name === 'admin_delete_faculty') {
      assert.equal(args.p_faculty_id, 'fixture-id');
      return {error: {code:'23503', message:'private database detail'}};
    }
    return original(name, args);
  };
  await assert.rejects(deleteFaculty(admin.api, 'fixture-id'), /cannot be deleted because reviews/);
});

test('faculty delete RPC scopes deletion to one ID and logs only public identifiers', () => {
  const sql = read('supabase/migrations/20261111130000_admin_delete_faculty.sql');
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp/);
  assert.match(sql, /IF public\.is_admin\(\) IS DISTINCT FROM true[\s\S]*?42501[\s\S]*?DELETE FROM public\.faculty\s+WHERE id = p_faculty_id/);
  assert.match(sql, /INSERT INTO public\.moderation_log[\s\S]*?jsonb_build_object\('name', v_name, 'department', v_department, 'slug', v_slug\)/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role;\s+GRANT EXECUTE[\s\S]*?TO authenticated;/);
  assert.equal((sql.match(/\bDELETE FROM\b/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /\b(?:ALTER TABLE|CASCADE)\b/);
});

test('admin dashboard and adapter have no room controls or room RPCs', () => {
  const dashboard = read('src/components/admin/admin-dashboard.tsx');
  const adapter = read('src/lib/data/admin.ts');
  assert.doesNotMatch(dashboard, /room/i);
  assert.doesNotMatch(adapter, /room/i);
  assert.doesNotMatch(adapter, /\.\.\.dashboard\.data/);
  for (const name of ['addFaculty', 'deleteFaculty', 'decideFacultyAddRequest', 'moderateFacultyReview', 'reviewMetrics']) {
    assert.ok(dashboard.includes(name), name);
  }
  assert.match(adapter, /await requireAdmin\(supabase\)/);
});
