const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(relative) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
    if (name.startsWith(".")) return load(path.posix.join(path.posix.dirname(relative), name) + ".ts");
    throw new Error("Unmocked runtime import forbidden");
  };
  vm.runInNewContext(compiled, { exports, require: localRequire, process: { env: { NODE_ENV: "test" } }, console: { warn() {} } });
  return exports;
}
const api = load("src/lib/data/faculty.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const user = { id: "student-a", email: "student-a@g.bracu.ac.bd", email_confirmed_at: "2026-11-01T00:00:00Z", is_anonymous: false };
function client(business) {
  return { auth: { getUser: async () => ({ data: { user }, error: null }) }, rpc: async (name, args) => name === "current_user_is_brac_eligible" ? { data: true, error: null } : business(name, args) };
}
test("delete sends only review ID to the ownership RPC after eligibility", async () => {
  const calls = [];
  await api.deleteOwnFacultyReview(client(async (...args) => { calls.push(args); return { error: null }; }), "review-a");
  assert.deepEqual(plain(calls), [["delete_own_faculty_review", { p_review_id: "review-a" }]]);
});
test("delete rejection remains safe and cannot report success", async () => {
  await assert.rejects(api.deleteOwnFacultyReview(client(async () => ({ error: { code: "P0001", message: "review not found" } })), "review-b"), /review is unavailable/);
});
test("edit sends only ID and editable content, never author or moderation", async () => {
  const calls=[];
  await api.updateOwnFacultyReview(client(async (...args)=>{calls.push(args);return {error:null};}),"review-a", {marking:8,responsiveness:7,responsibility:9,connection:6,recommendation_letter:10,description:"A constructive review."});
  assert.deepEqual(plain(calls),[["update_own_faculty_review_v2",{p_review_id:"review-a",p_marking:8,p_responsiveness:7,p_responsibility:9,p_connection:6,p_recommendation_letter:10,p_description:"A constructive review."}]]);
});
test("edit validation rejection propagates safe business feedback",async()=>{
  await assert.rejects(api.updateOwnFacultyReview(client(async()=>({error:{code:"P0001",message:"invalid review content"}})),"review-a",{}),/Check the review ratings/);
});
test("own-review lookup uses authenticated identity, not caller-supplied author",async()=>{
  const filters=[];
  const query={select(){return this;},eq(...args){filters.push(args);return this;},async order(){return {data:[],error:null};}};
  const c=client();c.from=name=>{assert.equal(name,"faculty_reviews");return query;};
  const rows=await api.getOwnFacultyReviews(c);
  assert.deepEqual(plain(filters),[["reviewer_user_id","student-a"]]);assert.equal(rows.length,0);
});
test("ineligible caller cannot reach the ownership RPC",async()=>{
  let reached=false;const c=client(async()=>{reached=true;return {error:null};});
  c.auth.getUser=async()=>({data:{user:{...user,email:"student@other.invalid"}},error:null});
  await assert.rejects(api.deleteOwnFacultyReview(c,"review-a"));assert.equal(reached,false);
});
test("forum remains a static placeholder with no unguarded data mutation",()=>{
  const source=fs.readFileSync(path.join(root,"src/app/forum/page.tsx"),"utf8");
  assert.ok(source.includes("Coming Soon"));assert.ok(!/\.rpc\(|\.from\(|fetch\(/.test(source));
});

test("new faculty ratings follow the required order and range", () => {
  const { FACULTY_REVIEW_RATINGS, hasCompleteFacultyRatings } = load("src/lib/faculty-review-ratings.ts");
  assert.deepEqual(plain(FACULTY_REVIEW_RATINGS.map(([, label]) => label)),
    ["Marking", "Responsiveness", "Responsibility", "Connection", "Recommendation Letter"]);
  const all = {marking:1,responsiveness:2,responsibility:3,connection:4,recommendation_letter:10};
  assert.equal(hasCompleteFacultyRatings(all),true);
  for (const key of Object.keys(all)) {
    for (const value of [null, undefined, 0, 11, 4.5]) {
      assert.equal(hasCompleteFacultyRatings({...all,[key]:value}),false);
    }
  }
});

test("legacy and current reviews have separate metrics and averages", () => {
  const {summarizeFacultyReviews} = load("src/lib/faculty-review-ratings.ts");
  const summaries=summarizeFacultyReviews([
    {rating_version:1,clarity:1,responsiveness:1,fairness:1,workload:1},
    {rating_version:2,marking:9,responsiveness:9,responsibility:9,connection:9,recommendation_letter:9},
  ]);
  assert.deepEqual(plain(summaries.map(({version,overall})=>[version,overall])),[[2,9],[1,1]]);
  assert.deepEqual(plain(summaries[1].metrics.map(({label})=>label)),["Clarity","Responsiveness","Fairness","Workload"]);
});

test("create sends the five scores and description through the new RPC", async () => {
  const calls=[];
  const id=await api.createOwnFacultyReview(client(async (...args)=>{calls.push(args);return {data:"new-review",error:null};}),
    {facultyId:"faculty",marking:8,responsiveness:7,responsibility:9,connection:6,recommendation_letter:10,description:"A constructive review."});
  assert.equal(id,"new-review");
  assert.deepEqual(plain(calls),[["create_own_faculty_review_v2",{
    p_faculty_id:"faculty",p_marking:8,p_responsiveness:7,p_responsibility:9,p_connection:6,
    p_recommendation_letter:10,p_description:"A constructive review.",
  }]]);
});

test("own-review reads retain schema version and new rating values", async () => {
  const row={id:"review",faculty_id:"faculty",rating_version:2,marking:9,responsiveness:8,responsibility:7,
    connection:6,recommendation_letter:5,description:"A constructive review.",moderation_status:"published",created_at:"2026-11-11"};
  const c=client();
  c.from=(table)=>table==="faculty_reviews"
    ? {select(columns){assert.match(columns,/rating_version.*recommendation_letter/);return this;},eq(){return this;},order(){return {data:[row],error:null};}}
    : {select(){return this;},in(){return {data:[{id:"faculty",name:"Example",slug:"example"}],error:null};}};
  const [result]=await api.getOwnFacultyReviews(c);
  assert.equal(result.rating_version,2);
  assert.equal(result.recommendation_letter,5);
  assert.equal(result.description,row.description);
});

test("supervisor dataset covers every card and exactly matches import rows", () => {
  const source=JSON.parse(fs.readFileSync(path.join(root,"supabase/reference-data/cse-supervisors.json"),"utf8"));
  const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261111150000_import_cse_thesis_supervisors.sql"),"utf8");
  const quote=(value)=>value===null?"NULL":"'"+value.replaceAll("'","''")+"'";
  const values=source.faculty.map((row)=>"  ("+[row.name,row.designation,row.email].map(quote).join(", ")+")").join(",\n");
  assert.equal(source.sourceEntries,254);
  assert.equal(source.missingSourceEmails,0);
  assert.equal(source.faculty.length,252);
  assert.equal(new Set(source.faculty.map(row=>row.name.trim().replace(/\s+/g," ").toLowerCase())).size,252);
  assert.equal(source.faculty.filter(row=>row.email===null && row.conflictingListings?.length===2).length,2);
  assert(source.faculty.every(row=>row.department==="CSE"));
  assert(source.faculty.every(row => row.email === null || /^[a-z0-9._+-]+@bracu\.ac\.bd$/i.test(row.email)));
  for (const listing of source.faculty.flatMap(row => row.conflictingListings ?? [])) {
    assert.deepEqual(Object.keys(listing).sort(), ["designation", "sourceLinkId"]);
  }
  assert(sql.includes("VALUES\n"+values+";"));
  assert.match(sql,/LOCK TABLE public\.faculty IN SHARE ROW EXCLUSIVE MODE/);
  assert.doesNotMatch(sql,/ON CONFLICT/);
  assert.doesNotMatch(sql,/CREATE (?:OR REPLACE )?VIEW|UPDATE public\.faculty_add_requests/);
});
