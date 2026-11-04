const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('@esbuild-kit/core-utils');
const resolveFrom = path.dirname(require.resolve('@esbuild-kit/core-utils'));
const fixture = path.join(__dirname, 'dependency-fixture.ts');
function evaluate(code) {
  const compiledUnit = { exports: {} };
  vm.runInNewContext(code, { module: compiledUnit, exports: compiledUnit.exports,
    h: (tag, props, ...children) => ({ tag, children }) }, { timeout: 2000 });
  return compiledUnit.exports;
}
test('core-utils resolves the patched esbuild dependency', () => {
  const location = require.resolve('esbuild/package.json', { paths: [resolveFrom] });
  assert.equal(JSON.parse(fs.readFileSync(location, 'utf8')).version, '0.25.12');
});
test('patched core-utils compiles and executes synchronous TypeScript', () => {
  const result = core.transformSync('export const answer: number = 42;', fixture, { format: 'cjs', loader: 'ts' });
  assert.equal(evaluate(result.code).answer, 42);
});
test('patched core-utils compiles TSX', () => {
  const result = core.transformSync('export const node = <div>safe</div>;', `${fixture}x`,
    { format: 'cjs', loader: 'tsx', jsx: 'transform', jsxFactory: 'h' });
  assert.equal(evaluate(result.code).node.tag, 'div');
});
test('patched core-utils compiles asynchronous TypeScript', async () => {
  const result = await core.transform('export const answer: number = 7;', fixture, { format: 'cjs', loader: 'ts' });
  assert.equal(evaluate(result.code).answer, 7);
});
test('patched core-utils preserves source map output', async () => {
  const sync = core.transformSync('export const answer: number = 42;', fixture, { format: 'cjs', loader: 'ts' });
  const asyncResult = await core.transform('export const answer: number = 7;', fixture, { format: 'cjs', loader: 'ts' });
  assert.ok(sync.map);
  assert.ok(asyncResult.map);
});
test('patched core-utils rejects invalid TypeScript', () => {
  assert.throws(() => core.transformSync('const = ;', fixture, { loader: 'ts' }));
});

// Actual deployment source, transpiled in memory. No HTTP, Auth or SQL runs.
function loadDeploymentSource(file, env = {}, imports = {}) {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const unit = { exports: {} };
  vm.runInNewContext(code, { module: unit, exports: unit.exports,
    process: { env }, Response, URL,
    require(name) {
      if (!Object.hasOwn(imports, name)) throw new Error('Unexpected deployment import');
      if (imports[name] instanceof Error) throw imports[name];
      return imports[name];
    },
  }, { timeout: 2000 });
  return unit.exports;
}
const previewEnv = { VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sbwhdayinxaiarxsjpsp.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only' };

test('Preview accepts the development URL and publishable-key format', () => {
  assert.ok(loadDeploymentSource('next.config.ts', previewEnv).default);
});
for (const url of [undefined, 'https://other-project.supabase.co', 'http://sbwhdayinxaiarxsjpsp.supabase.co',
  'https://sbwhdayinxaiarxsjpsp.supabase.co.evil.test']) {
  test('Preview rejects missing or substituted development URL: ' + String(url), () => {
    assert.throws(() => loadDeploymentSource('next.config.ts', { ...previewEnv,
      NEXT_PUBLIC_SUPABASE_URL: url }), /approved development Supabase URL/);
  });
}
test('Preview rejects missing or secret-style keys without echoing them', () => {
  for (const key of [undefined, '', 'sb_secret_synthetic_not_a_credential']) {
    assert.throws(() => loadDeploymentSource('next.config.ts', { ...previewEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), /^Error: Preview requires a development Supabase publishable key\.$/);
  }
});
test('local config loading does not impose a hosted Preview configuration', () => {
  assert.ok(loadDeploymentSource('next.config.ts').default);
});
test('health route loads without database config and safely handles initialization failure', async () => {
  const route = loadDeploymentSource('src/app/api/health/route.ts', {}, {
    'drizzle-orm': { sql() { throw Error('query must not execute'); } },
    '@/db': Error('synthetic private connection details'),
  });
  assert.equal(route.runtime, 'nodejs');
  const response = await route.GET();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: false });
});
test('health preserves success and conceals query failures without caching', async () => {
  for (const failed of [false, true]) {
    let calls = 0;
    const route = loadDeploymentSource('src/app/api/health/route.ts', {}, {
      'drizzle-orm': { sql(parts) { return parts.join(''); } },
      '@/db': { db: { async execute(query) { calls++; assert.equal(query, 'select 1');
        if (failed) throw Error('synthetic private query error'); } } },
    });
    const response = await route.GET();
    assert.equal(calls, 1);
    assert.equal(response.status, failed ? 500 : 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: !failed });
  }
});

test('Preview database rejects wrong-project and local targets before constructing a pool', () => {
  for (const url of ['postgresql://synthetic@localhost:5432/unused',
    'postgresql://synthetic@db.other-project.supabase.co/postgres',
    'postgresql://synthetic.other-project@aws-0-test.pooler.supabase.com/postgres',
    'postgresql://synthetic@db.sbwhdayinxaiarxsjpsp.supabase.co.evil.test/postgres', 'malformed']) {
    let pools = 0;
    assert.throws(() => loadDeploymentSource('src/db/index.ts', {
      VERCEL_ENV: 'preview', DATABASE_URL: url,
    }, { 'drizzle-orm/node-postgres': { drizzle() {} },
      pg: { Pool: class { constructor() { pools++; } } } }), /approved development database target/);
    assert.equal(pools, 0);
  }
});
test('Preview database accepts approved direct and project-qualified pooler targets', () => {
  for (const url of ['postgresql://synthetic@db.sbwhdayinxaiarxsjpsp.supabase.co/postgres',
    'postgresql://synthetic.sbwhdayinxaiarxsjpsp@aws-0-test.pooler.supabase.com/postgres']) {
    let pools = 0;
    loadDeploymentSource('src/db/index.ts', { VERCEL_ENV: 'preview', DATABASE_URL: url }, {
      'drizzle-orm/node-postgres': { drizzle() { return {}; } },
      pg: { Pool: class { constructor() { pools++; } } },
    });
    assert.equal(pools, 1);
  }
});
