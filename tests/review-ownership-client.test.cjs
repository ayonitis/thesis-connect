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
  await api.updateOwnFacultyReview(client(async (...args)=>{calls.push(args);return {error:null};}),"review-a", {clarity:8,responsiveness:7,fairness:9,workload:6,description:"A constructive review."});
  assert.deepEqual(plain(calls),[["update_own_faculty_review",{p_review_id:"review-a",p_clarity:8,p_responsiveness:7,p_fairness:9,p_workload:6,p_description:"A constructive review."}]]);
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
