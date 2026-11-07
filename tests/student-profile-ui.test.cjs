// Offline tests of actual helpers/components with synthetic SDK/React boundaries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, overrides = {}, cache = new Map(), runtime = {}) {
  if (cache.has(file)) return cache.get(file);
  const unit = { exports: {} }; cache.set(file, unit.exports);
  const source = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const resolve = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'react/jsx-runtime') return require(name);
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? 'src/'+name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      const target = ['.ts','.tsx'].map(ext => base+ext).find(f => fs.existsSync(path.join(root,f)));
      return load(target, overrides, cache, runtime);
    }
    throw Error('Unmocked import forbidden: '+name);
  };
  vm.runInNewContext(source, { module: unit, exports: unit.exports, require: resolve,
    URL, URLSearchParams, console: { warn() {}, error() {} }, process: { env: { NODE_ENV:'test' } }, ...runtime }, { filename:file });
  return unit.exports;
}
const completion = load('src/lib/profile-completion.ts');
const profile = { displayName:'Synthetic Student', department:'CSE' };
const student = { studentId:'synthetic-id' };
const details = { cgpa:3.5, currentSemester:'9th', bracLike:'The campus' };
test('completed persisted profile is complete on repeated logins', () => {
  for (let i=0;i<3;i++) assert.equal(completion.isStudentProfileComplete(profile,student,details),true);
});
for (const [name, a,b,c] of [
  ['missing profile',null,student,details], ['missing full name',{...profile,displayName:''},student,details],
  ['missing department',{...profile,department:null},student,details], ['missing private row',profile,null,details],
  ['missing student ID',profile,{studentId:''},details], ['missing details',profile,student,null],
  ['missing CGPA',profile,student,{...details,cgpa:null}], ['missing semester',profile,student,{...details,currentSemester:''}],
  ['missing response',profile,student,{...details,bracLike:' '}], ['zero CGPA',profile,student,{...details,cgpa:0}],
]) test('completion: '+name,()=>assert.equal(completion.isStudentProfileComplete(a,b,c),name==='zero CGPA'||name==='missing response'));
test('legacy NULL new fields remain incomplete; completion cannot bypass required details',()=>{
  assert.equal(completion.isStudentProfileComplete(profile,student,null),false);
  assert.equal(completion.isStudentProfileComplete(profile,student,{cgpa:null,currentSemester:null,bracLike:null}),false);
});
for (const cgpa of [-1,4.1,4.5,40,NaN,Infinity,3.555,3.500000001,null]) test('reject invalid CGPA '+cgpa,()=>assert.throws(()=>completion.validateStudentProfileDetails({...details,cgpa})));
for (const extra of [{currentSemester:' '},{currentSemester:'a'.repeat(41)},{bracLike:'a'.repeat(501)}]) {
  test('reject invalid profile detail '+JSON.stringify(Object.keys(extra)),()=>assert.throws(()=>completion.validateStudentProfileDetails({...details,...extra})));
}
test('semester remains free text and CGPA zero is valid',()=>assert.doesNotThrow(()=>completion.validateStudentProfileDetails({...details,cgpa:0,currentSemester:'9th/10th/11th'})));
function proxy(status, signedIn=true) {
  const headers = { get:()=>null };
  return load('src/proxy.ts',{
    'next/server':{NextResponse:{next:()=>({kind:'next'}),redirect:url=>({kind:'redirect',location:url.href,cookies:{set(){}},headers:{set(){}}})}},
    '@/lib/supabase/proxy':{updateSession:async()=>({response:{kind:'next',cookies:{getAll:()=>[]},headers},user:signedIn?{id:'synthetic'}:null,eligible:signedIn,profileStatus:status})},
  }).proxy;
}
const request = route=>({url:'https://offline.invalid'+route,nextUrl:new URL('https://offline.invalid'+route)});
test('first-login landing sends incomplete student to shared setup',async()=>assert.match((await proxy('incomplete')(request('/'))).location,/\/profile\/complete\?next=/));
test('completed student goes directly to room creation',async()=>assert.equal((await proxy('complete')(request('/partners/create'))).kind,'next'));
test('incomplete room author uses same setup and retains intended destination',async()=>assert.match((await proxy('incomplete')(request('/partners/create'))).location,/next=%2Fpartners%2Fcreate/));
test('completed onboarding URL returns home; profile edit remains reachable',async()=>{
  assert.equal((await proxy('complete')(request('/profile/complete'))).location,'https://offline.invalid/');
  assert.equal((await proxy('complete')(request('/profile'))).kind,'next');
});
test('incomplete profile edit remains reachable without redirect loop',async()=>assert.equal((await proxy('incomplete')(request('/profile'))).kind,'next'));
test('signed-out profile is protected; OAuth callback and recovery remain reachable',async()=>{
  assert.match((await proxy('unknown',false)(request('/profile'))).location,/sign-in/);
  for(const route of ['/auth/callback?code=synthetic','/verify-email','/reset-password','/sign-out']) assert.equal((await proxy('incomplete')(request(route))).kind,'next');
});
function dataClient(error) {
  const calls=[];
  const api={from(table){calls.push(['from',table]);const q={
    select(columns){this.columns=columns;calls.push(['select',columns]);return this;},
    eq(...args){calls.push(['eq',...args]);return this;},
    update(values){calls.push(['update',values]);return this;},insert(values){calls.push(['insert',values]);return this;},
    async maybeSingle(){return this.columns.includes('cgpa')?{data:error?null:{user_id:'own',student_id:'s',cgpa:'3.50',current_semester:'9th',brac_like:'Campus'},error:error??null}:{data:{user_id:'own',student_id:'s'},error:null};},
    async single(){return {data:{user_id:'own',student_id:'s'},error:null};},
  };return q;}};
  return {api,calls};
}
const data = load('src/lib/data/profile.ts',{'@/lib/auth/require-brac-user':{requireBracUser:async()=>({id:'own'})}});
test('extended profile loader converts persisted CGPA and filters by current identity',async()=>{
  const c=dataClient();const result=await data.getCurrentStudentProfile(c.api);
  assert.equal(result.details.cgpa,3.5);
  assert.ok(c.calls.some(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]==='own'));
});
test('missing new columns fail explicitly instead of treating a partial profile as complete',async()=>{
  await assert.rejects(data.getCurrentStudentProfile(dataClient({code:'42703',message:'cgpa missing'}).api));
});
test('permission errors do not masquerade as missing schema',async()=>assert.rejects(data.getCurrentStudentProfile(dataClient({code:'42501',message:'private'}).api),/permission/));
test('private saves require all new fields, with no legacy ID-only success',async()=>{
  const c=dataClient();await assert.rejects(data.updateCurrentStudentPrivate(c.api,'id'));
  assert.ok(!c.calls.some(call=>['update','insert'].includes(call[0])));
});
test('approved extended save uses private fields and no caller identity override',async()=>{
  const c=dataClient();await data.updateCurrentStudentPrivate(c.api,'id',details);
  const values=c.calls.find(call=>call[0]==='update')[1];assert.equal(values.cgpa,3.5);assert.equal(values.current_semester,'9th');assert.equal(values.brac_like,'The campus');assert.equal(values.user_id,undefined);
});
test('invalid details cannot reach a database write',async()=>{
  const c=dataClient();await assert.rejects(data.updateCurrentStudentPrivate(c.api,'id',{...details,cgpa:9}));assert.ok(!c.calls.some(call=>['update','insert'].includes(call[0])));
});
test('navigation changes on synthetic SDK subscription events and unsubscribes on cleanup',async()=>{
  let value, effect, listener, unsubscribed=false;
  const nav=load('src/components/auth/auth-navigation.tsx',{
    react:{useState:initial=>{if(value===undefined)value=initial;return [value,next=>{value=next;}];},useEffect:fn=>{effect=fn;}},
    '@/components/ui/button':{LinkButton:()=>null},
    '@/lib/supabase/client':{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic'}},error:null}),onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}};}}})},
  }).AuthNavigation;
  assert.equal(nav().props.role,'status');const cleanup=effect();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nav().props.href,'/profile');assert.equal(nav().props.variant,'profile');assert.equal(nav().props.className,undefined);listener('SIGNED_OUT',null);assert.equal(nav().props.href,'/sign-in');assert.equal(nav().props.variant,'auth');assert.equal(nav().props.className,undefined);
  listener('SIGNED_IN',{user:{id:'synthetic'}});assert.equal(nav().props.href,'/profile');cleanup();assert.equal(unsubscribed,true);
});
test('five profile inputs are required and the BRAC response is optional',()=>{
  const form=read('src/components/profile/student-profile-form.tsx');
  for(const label of ['Full Name','Student ID','Department','CGPA','Current Semester','One thing you like about BRAC University']) assert.ok(form.includes(label));
  assert.match(form,/type="text" placeholder="9th\/10th\/11th"/);assert.match(form,/rows=\{3\}/);
  assert.doesNotMatch(form,/detailsAvailable|profile-details-note|Additional profile details aren/);assert.match(form,/getCurrentStudentProfile/);
  assert.equal((form.match(/\brequired(?:\s|\s*\/?>)/g)||[]).length,5);assert.match(form,/saveCurrentStudentProfile/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|type="email"|type="tel"|type="file"/);
  assert.match(read('src/app/profile/layout.tsx'),/protected-brac-layout/);
});
test('wordmark is not clipped and all three home panels use identical grey',()=>{
  const home=read('src/app/page.tsx');assert.doesNotMatch(home,/typing-track|tone=/);
  assert.match(home,/aria-label="THESIS CONNECT"/);assert.match(home,/whitespace-nowrap/);assert.doesNotMatch(home,/<span className="block">(?:THESIS|CONNECT)/);assert.equal((home.match(/bg-\[#F6F7F9\]/g)||[]).length,2);
  assert.match(home,/<AuthNavigation \/>/);
});
test('primary and light-blue buttons match while sign-in actions explicitly use black auth variant',()=>{
  const buttons=read('src/components/ui/button.tsx');
  const primary=buttons.match(/primary:\s+"([^"]+)"/)[1];const light=buttons.match(/lightBlue:\s+"([^"]+)"/)[1];assert.equal(primary,light);
  assert.match(buttons,/auth:\s+"bg-black text-white/);
  const signin=read('src/app/sign-in/page.tsx');assert.equal((signin.match(/variant="auth"/g)||[]).length,2);
  assert.doesNotMatch(signin,/AuthStatus|Access student-specific features once authentication is fully configured/);
});

test('shared light-blue states and black Auth buttons meet normal-text contrast',()=>{
  function luminance(hex) {
    const rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
    return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  }
  function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+0.05)/(values[1]+0.05);}
  for(const background of ['A9D8F7','95CDED','84C1E6']) assert.ok(contrast(background,'191C21')>=4.5);
  for(const background of ['000000','242424','333333']) assert.ok(contrast(background,'FFFFFF')>=4.5);
});

test('one root watermark reaches every route without covering content or intercepting input',()=>{
  const layout=read('src/app/layout.tsx'), css=read('src/app/globals.css');
  assert.match(layout,/<div className="tc-app-background">\{children\}<\/div>/);
  assert.match(css,/\.tc-app-background > \.min-h-screen\s*\{\s*background-color: transparent;/);
  assert.match(css,/\.tc-app-background::before,\s*\.tc-watermark-dark::before\s*\{[^}]*pointer-events: none;[^}]*user-select: none;[^}]*z-index: -1;[^}]*opacity: 0\.12;/);
  assert.match(css,/\.tc-app-background\s*\{[^}]*isolation: isolate;/);
  assert.equal((css.match(/url\("\/branding\/brac-university-monogram.svg"\)/g)||[]).length,1);
  assert.match(css,/@media \(max-width: 40rem\)/);
  assert.match(css,/background-size: min\(78vw, 46rem\) auto/);
  assert.match(css,/background-size: 88vw auto/);
  assert.doesNotMatch(read('src/app/page.tsx'),/tc-watermark-dark/);
  assert.match(read('src/app/page.tsx'),/<section className="rounded-\[34px\] bg-\[#1D1D1D\]/);
  assert.match(css,/filter: brightness\(0\) invert\(1\)/);
});
test('link defaults are layered so dark primary button text wins over hero inheritance',()=>{
  assert.match(read('src/app/globals.css'),/@layer base\s*\{\s*a\s*\{\s*color: inherit;\s*text-decoration: none;\s*\}\s*\}/);
});
test('local SVG is the original downloaded logo with preserved proportions and no active content',()=>{
  const asset=fs.readFileSync(path.join(root,'public/branding/brac-university-monogram.svg'));
  assert.equal(require('node:crypto').createHash('sha256').update(asset).digest('hex'),
    'b73ae4fa9589ead85e7353a682c3c7fd1ca42284afdb6cb7143aece4ba8a1398');
  const svg=asset.toString('utf8');assert.match(svg,/viewBox="0 0 250 240"/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\son[a-z]+\s*=/i);
  for(const href of svg.matchAll(/(?:xlink:)?href="([^"]*)"/g)) assert.ok(href[1].startsWith('#'));
});

test('dedicated Profile variant has the exact requested palette and accessible focus',()=>{
  const buttons=read('src/components/ui/button.tsx');
  const profileStyle=buttons.match(/profile:\s+"([^"]+)"/)[1];
  for(const token of ['bg-[#FFFFFF]','text-[#000000]','border-[#D1D5DB]','hover:bg-[#F3F4F6]','active:bg-[#E5E7EB]','focus-visible:ring-[#2459A9]']) assert.ok(profileStyle.includes(token));
  assert.match(buttons,/focus-visible:ring-2 focus-visible:ring-offset-2/);
  const nav=read('src/components/auth/auth-navigation.tsx');
  assert.match(nav,/variant=\{signedIn \? "profile" : "auth"\}/);
  assert.doesNotMatch(nav,/text-black!|variant=\{signedIn \? "secondary"/);
});
test('actual homepage header renders authenticated Profile with the dedicated white palette',()=>{
  const React=require('react');
  const Home=load('src/app/page.tsx',{
    react:{...React,useState:()=>[true,()=>{}],useEffect(){}},
    'next/link':{__esModule:true,default:props=>React.createElement('a',props)},
    '@/lib/supabase/client':{createClient(){throw Error('Network forbidden');}},
  }).default;
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(Home));
  const header=html.match(/<section[^>]*bg-\[#1D1D1D\][^>]*>([\s\S]*?)<\/section>/)[1];
  const profile=header.match(/<a\b[^>]*href="\/profile"[^>]*>Profile<\/a>/)[0];
  for(const token of ['bg-[#FFFFFF]','text-[#000000]','border-[#D1D5DB]','hover:bg-[#F3F4F6]','active:bg-[#E5E7EB]']) assert.ok(profile.includes(token));
  assert.ok(!profile.includes('bg-[#A9D8F7]'));
});

for(const input of ['0','0.00','4','4.00','3.50','.50',' 3.25 ']) {
  test('decimal input accepts '+JSON.stringify(input),()=>assert.equal(completion.parseProfileCgpa(input),Number(input)));
}
for(const input of ['',' ','3.555','3.500','4.001','-0.1','4.01','NaN','Infinity','3e0','0x3','abc']) {
  test('decimal input rejects '+JSON.stringify(input),()=>assert.throws(()=>completion.parseProfileCgpa(input)));
}
test('completion validates lengths/precision, not just nonempty new fields',()=>{
  for(const extra of [{cgpa:3.555},{currentSemester:'a'.repeat(41)},{bracLike:'a'.repeat(501)}]) {
    assert.equal(completion.isStudentProfileComplete(profile,student,{...details,...extra}),false);
  }
});

function persistedClient({ privateExists=true, failWrite=null }={}) {
  const records={
    profiles:{own:{user_id:'own',display_name:'Before',department:'CSE'},other:{user_id:'other',display_name:'Other',department:'EEE'}},
    student_private:{...(privateExists?{own:{user_id:'own',student_id:'old',cgpa:null,current_semester:null,brac_like:null}}:{}),other:{user_id:'other',student_id:'other-id',cgpa:4,current_semester:'10th',brac_like:'Other answer'}},
  };
  const calls=[];
  const api={from(table){const q={filters:{},action:null,values:null,
    select(){return this;},eq(k,v){this.filters[k]=v;return this;},
    update(values){this.action='update';this.values=values;return this;},
    insert(values){this.action='insert';this.values=values;return this;},
    async maybeSingle(){calls.push({table,action:'select',filters:{...this.filters}});return {data:records[table][this.filters.user_id]??null,error:null};},
    async single(){
      calls.push({table,action:this.action,filters:{...this.filters},values:{...this.values}});
      if(table===failWrite)return {data:null,error:{code:'42501',message:'private diagnostic never displayed'}};
      const id=this.action==='insert'?this.values.user_id:this.filters.user_id;
      if(!id || (this.action==='update'&&!records[table][id]))return {data:null,error:{code:'PGRST116'}};
      records[table][id]={...records[table][id],...this.values};return {data:{...records[table][id]},error:null};
    },
  };return q;}};
  return {api,records,calls};
}
const input={displayName:' New Name ',studentId:' new-id ',department:'CSE',details:{cgpa:3.75,currentSemester:' 9th ',bracLike:' Campus life '}};
test('actual data adapters save/reload all six fields with trimmed private text',async()=>{
  const c=persistedClient();await data.saveCurrentStudentProfile(c.api,input);
  const publicRow=await data.getCurrentProfile(c.api),privateRow=await data.getCurrentStudentProfile(c.api);
  assert.equal(publicRow.displayName,'New Name');assert.equal(publicRow.department,'CSE');assert.equal(privateRow.student.studentId,'new-id');
  assert.equal(privateRow.details.cgpa,3.75);assert.equal(privateRow.details.currentSemester,'9th');assert.equal(privateRow.details.bracLike,'Campus life');
  assert.equal(completion.isStudentProfileComplete(publicRow,privateRow.student,privateRow.details),true);
  assert.equal(c.records.profiles.other.display_name,'Other');assert.equal(c.records.student_private.other.brac_like,'Other answer');
  for(const call of c.calls.filter(call=>call.action==='update'))assert.equal(call.filters.user_id,'own');
});
test('blank BRAC response saves as NULL and permits profile completion',async()=>{
  const c=persistedClient();
  await data.saveCurrentStudentProfile(c.api,{...input,details:{...input.details,cgpa:4,bracLike:'   '}});
  const profile=await data.getCurrentProfile(c.api);
  const saved=await data.getCurrentStudentProfile(c.api);
  assert.equal(saved.details.bracLike,null);
  assert.equal(completion.isStudentProfileComplete(profile,saved.student,saved.details),true);
});

test('new private record insert derives identity internally',async()=>{
  const c=persistedClient({privateExists:false});await data.saveCurrentStudentProfile(c.api,{...input,userId:'other'});
  const insert=c.calls.find(call=>call.action==='insert');assert.equal(insert.values.user_id,'own');assert.equal(c.records.student_private.own.student_id,'new-id');
});
test('edit and fresh-adapter reload preserve persisted details across simulated relogin',async()=>{
  const c=persistedClient();await data.saveCurrentStudentProfile(c.api,input);
  const fresh=()=>load('src/lib/data/profile.ts',{'@/lib/auth/require-brac-user':{requireBracUser:async()=>({id:'own'})}});
  for(let login=0;login<2;login++) {
    const sessionData=fresh();const a=await sessionData.getCurrentProfile(c.api),b=await sessionData.getCurrentStudentProfile(c.api);
    assert.equal(completion.isStudentProfileComplete(a,b.student,b.details),true);
  }
  await fresh().saveCurrentStudentProfile(c.api,{...input,displayName:'Updated',department:'CS',details:{cgpa:0,currentSemester:'10th/11th',bracLike:'Friends'}});
  const a=await fresh().getCurrentProfile(c.api),b=await fresh().getCurrentStudentProfile(c.api);
  assert.equal(a.displayName,'Updated');assert.equal(a.department,'CS');assert.equal(b.details.cgpa,0);assert.equal(b.details.currentSemester,'10th/11th');assert.equal(b.details.bracLike,'Friends');
});
test('first write failure rejects and never writes public profile',async()=>{
  const c=persistedClient({failWrite:'student_private'});await assert.rejects(data.saveCurrentStudentProfile(c.api,input));
  assert.equal(c.records.profiles.own.display_name,'Before');assert.ok(!c.calls.some(call=>call.table==='profiles'&&call.action==='update'));
});
test('second write failure rejects partial save; never returns success',async()=>{
  const c=persistedClient({failWrite:'profiles'});let success=false;
  await assert.rejects(data.saveCurrentStudentProfile(c.api,input).then(()=>{success=true;}));
  assert.equal(success,false);assert.equal(c.records.student_private.own.cgpa,3.75);assert.equal(c.records.profiles.own.display_name,'Before');
});
test('invalid public input is rejected before either table write',async()=>{
  for(const extra of [{displayName:' '},{studentId:''},{department:'invalid'},{displayName:'a'.repeat(101)}]) {
    const c=persistedClient();await assert.rejects(data.saveCurrentStudentProfile(c.api,{...input,...extra}));
    assert.ok(!c.calls.some(call=>['update','insert'].includes(call.action)));
  }
});
function profileFormHarness(client,{onboarding=false,clearSession=async()=>false}={}) {
  const state=[];let cursor=0,effect;const navigation=[];
  const Form=load('src/components/profile/student-profile-form.tsx',{
    react:{useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=next;}];},useEffect:fn=>{effect=fn;}},
    'next/navigation':{useRouter:()=>({replace:url=>navigation.push(url),refresh(){}})},
    '@/components/layout/footer':{Footer:()=>null},'@/components/layout/page-header':{PageHeader:()=>null},'@/components/ui/button':{Button:()=>null},
    '@/lib/supabase/client':{createClient:()=>client.api},'@/lib/auth/require-brac-user':{requireBracUser:async()=>({id:'own'}),clearRejectedBracSession:clearSession},
  },new Map(),{window:{location:{search:'?next=%2Fpartners%2Fcreate'}}}).StudentProfileForm;
  const render=()=>{cursor=0;return Form({onboarding});};
  function nodes(n,list=[]) {if(Array.isArray(n)){for(const x of n)nodes(x,list);}else if(n&&typeof n==='object'&&n.props){list.push(n);nodes(n.props.children,list);}return list;}
  const find=type=>nodes(render()).filter(n=>n.type===type);
  return {render,find,navigation,async initialize(){render();effect();await new Promise(resolve=>setImmediate(resolve));},
    fill(){const inputs=find('input');for(const [i,v] of ['New Name','new-id','3.75','9th'].entries())inputs[i].props.onChange({target:{value:v}});find('select')[0].props.onChange({target:{value:'CSE'}});find('textarea')[0].props.onChange({target:{value:'Campus life'}});},
    async save(){await find('form')[0].props.onSubmit({preventDefault(){}});},
    all(){return nodes(render());},
  };
}
test('actual form loads editable required fields and reports success only after full save',async()=>{
  const c=persistedClient();const h=profileFormHarness(c);await h.initialize();h.fill();await h.save();
  assert.equal(h.find('input').length,4);assert.ok(h.find('input').every(n=>n.props.required));
  assert.ok(h.all().some(n=>n.props.role==='status'&&n.props.children==='Your profile has been saved.'));
  assert.equal(c.records.student_private.own.cgpa,3.75);
});
for(const failWrite of ['student_private','profiles'])test('actual onboarding form cannot navigate or show success after '+failWrite+' failure',async()=>{
  const h=profileFormHarness(persistedClient({failWrite}),{onboarding:true});await h.initialize();h.fill();await h.save();
  assert.equal(h.navigation.length,0);assert.ok(h.all().some(n=>n.props.role==='alert'));
  assert.ok(!h.all().some(n=>n.props.role==='status'&&String(n.props.children).includes('saved')));
});
test('actual onboarding form returns to room creation after six-field save',async()=>{
  const h=profileFormHarness(persistedClient(),{onboarding:true});await h.initialize();h.fill();await h.save();assert.deepEqual(h.navigation,['/partners/create']);
});
test('new migration only adds nullable private fields and preserves RLS/grants',()=>{
  const migration=read('supabase/migrations/20261106120000_student_private_profile_details.sql');
  assert.match(migration,/ADD COLUMN cgpa numeric\(3,2\)/);assert.match(migration,/ADD COLUMN current_semester text/);assert.match(migration,/ADD COLUMN brac_like text/);
  assert.match(migration,/CHECK \(cgpa IS NULL OR cgpa BETWEEN 0 AND 4\)/);
  assert.match(migration,/char_length\(btrim\(current_semester\)\) BETWEEN 1 AND 40/);assert.match(migration,/char_length\(btrim\(brac_like\)\) BETWEEN 1 AND 500/);
  assert.equal((migration.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((migration.match(/^COMMIT;$/gm)||[]).length,1);
  assert.match(migration,/polname='brac_eligibility'/);assert.match(migration,/relowner='postgres'::regrole AND relrowsecurity/);
  assert.doesNotMatch(migration,/^\s*(?:GRANT|REVOKE|CREATE POLICY|DROP|UPDATE|INSERT|DELETE|ALTER ROLE)\b/gmi);
  assert.doesNotMatch(migration,/ADD COLUMN[^,\n]*(?:DEFAULT|NOT NULL)/i);
  assert.doesNotMatch(migration,/CREATE (?:OR REPLACE )?(?:VIEW|FUNCTION)|ALTER TABLE auth\./i);
});
test('previous BRAC eligibility migration remains byte-for-byte pinned',()=>{
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'supabase/migrations/20261105120000_brac_email_eligibility.sql'))).digest('hex'),
    '40b5e262ec80af3d9be0fdc003dccbc8ce8d2541d2ed130c9acc395ba48e5de1');
});

test('profile Logout clears the current session before navigating home',async()=>{
  const client=persistedClient();
  let finish;
  const h=profileFormHarness(client,{clearSession:api=>{
    assert.equal(api,client.api);
    return new Promise(resolve=>{finish=resolve;});
  }});
  await h.initialize();
  const row=h.all().find(n=>n.props.className==='grid grid-cols-2 gap-3');
  const [save,logout]=row.props.children;
  assert.equal(save.props.type,'submit');
  assert.equal(save.props.children,'Save');
  assert.equal(logout.props.type,'button');
  const pending=logout.props.onClick();
  assert.deepEqual(h.navigation,[]);
  assert.equal(h.all().find(n=>n.props.children==='Save').props.disabled,true);
  finish(true);
  await pending;
  assert.deepEqual(h.navigation,['/']);
  assert.ok(!client.calls.some(call=>['update','insert'].includes(call.action)));
});

test('profile Logout failure reports an error and permits a retry',async()=>{
  const h=profileFormHarness(persistedClient());
  await h.initialize();
  await h.all().find(n=>n.props.children==='Logout').props.onClick();
  assert.deepEqual(h.navigation,[]);
  assert.ok(h.all().some(n=>n.props.role==='alert'&&n.props.children==='Unable to sign out. Please try again.'));
  assert.equal(h.all().find(n=>n.props.children==='Logout').props.disabled,false);
});

test('profile onboarding retains its single save action',async()=>{
  const h=profileFormHarness(persistedClient(),{onboarding:true});
  await h.initialize();
  assert.ok(h.all().some(n=>n.props.type==='submit'&&n.props.children==='Save and continue'));
  assert.ok(!h.all().some(n=>n.props.children==='Logout'));
});
