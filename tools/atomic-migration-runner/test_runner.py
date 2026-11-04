"""Synthetic local integration tests; fault injection uses unittest mocks, not runner hooks."""
import json
import os
from pathlib import Path
import select
import socket
import subprocess
import sys
import threading
import time
import unittest
from unittest.mock import patch
import uuid
import psycopg
import runner as mod
from runner import Runner,SyntheticPlan,Rejected,UnknownOutcome,_connect,ledger,reconcile

class CommitProxy:
    def __init__(self,before=False):
        self.before=before;self.hit=threading.Event();self.error=None
        self.listener=socket.socket();self.listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        self.listener.bind(('127.0.0.1',55440));self.listener.listen(1)
        self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()
    def run(self):
        down,up=None,None
        try:
            down,_=self.listener.accept();up=socket.create_connection(('127.0.0.1',55439));committing=False
            while True:
                for sock in select.select([down,up],[],[],5)[0]:
                    b=sock.recv(65536)
                    if not b:return
                    if sock is down:
                        # COMMIT is a standalone simple-query message, not a history parameter.
                        if b==b'Q\x00\x00\x00\x0bCOMMIT\x00':
                            committing=True;self.hit.set()
                            if self.before:return
                        up.sendall(b)
                    elif committing:return  # real TCP acknowledgement loss
                    else:down.sendall(b)
        except BaseException as e:self.error=e
        finally:
            if down:down.close()
            if up:up.close()
            self.listener.close()
    def close(self):
        self.thread.join(5)
        if self.thread.is_alive():raise AssertionError('proxy hung')
        if self.error:raise self.error

class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before={x['file']:mod.digest((mod.SOURCE/x['file']).read_bytes()) for x in mod.approved_manifest()}
        cls.plan=SyntheticPlan()
    @classmethod
    def tearDownClass(cls):
        cls.plan.close()
        after={x['file']:mod.digest((mod.SOURCE/x['file']).read_bytes()) for x in mod.approved_manifest()}
        if cls.before!=after:raise AssertionError('ORIGINAL FILES CHANGED')
    def setUp(self):
        self.db='atomic_proto_'+uuid.uuid4().hex
        self.admin=psycopg.connect(host='127.0.0.1',port=55439,dbname='postgres',user=mod.OWNER,autocommit=True)
        self.admin.execute(psycopg.sql.SQL('CREATE DATABASE {}').format(psycopg.sql.Identifier(self.db)))
        self.runners=[]
    def tearDown(self):
        for r in self.runners:r.close()
        self.admin.execute(psycopg.sql.SQL('DROP DATABASE {} WITH (FORCE)').format(psycopg.sql.Identifier(self.db)))
        self.admin.close()
    def runner(self,**kwargs):
        r=Runner(self.db,self.plan,**kwargs);self.runners.append(r);return r
    def setup_ledger(self):
        with _connect(self.db) as c:ledger(c,create=True)
    def mutate(self,sql,params=None):
        with _connect(self.db) as c:c.execute(sql,params)
    def empty(self):
        with _connect(self.db) as c:
            self.assertEqual(mod.rows(c),[]);mod.catalog(c,0)
    def stopped(self,r):
        self.assertTrue(r._c.closed)
        with self.assertRaises(Rejected):r.next()
    def test_success_all_eight_same_pid_lock_and_history(self):
        r=self.runner();pid=r.pid
        for i in range(8):
            self.assertEqual(r.next(),'COMMITTED');self.assertEqual(r.pid,pid);r._continuity()
            self.assertEqual(mod.rows(r._c),mod.expected_rows(self.plan,i+1))
        r.close()
        self.assertEqual(reconcile(self.db,self.plan),{'status':'CONSISTENT_PREFIX','committed':8,'resume_authorized':False})
    def test_exact_cli_ledger_column_order(self):
        self.setup_ledger()
        with _connect(self.db) as c:
            self.assertEqual(c.execute("SELECT attname FROM pg_attribute WHERE attrelid='supabase_migrations.schema_migrations'::regclass AND attnum>0 ORDER BY attnum").fetchall(),[('version',),('statements',),('name',)])
        self.runner().next()
    def test_alternate_column_order(self):
        self.mutate('CREATE SCHEMA supabase_migrations')
        self.mutate('CREATE TABLE supabase_migrations.schema_migrations(name text,version text PRIMARY KEY,statements text[])')
        self.runner().next()
    def test_ledger_trigger_suppression_rejected(self):
        self.setup_ledger()
        self.mutate("CREATE FUNCTION supabase_migrations.suppress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$")
        self.mutate('CREATE TRIGGER suppress BEFORE INSERT ON supabase_migrations.schema_migrations FOR EACH ROW EXECUTE FUNCTION supabase_migrations.suppress()')
        with self.assertRaises(Rejected):self.runner()
        self.empty()
    def test_ledger_rule_rejected(self):
        self.setup_ledger();self.mutate('CREATE RULE suppress AS ON INSERT TO supabase_migrations.schema_migrations DO INSTEAD NOTHING')
        with self.assertRaises(Rejected):self.runner()
        self.empty()
    def test_ledger_rls_rejected(self):
        self.setup_ledger();self.mutate('ALTER TABLE supabase_migrations.schema_migrations ENABLE ROW LEVEL SECURITY')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_force_rls_rejected(self):
        self.setup_ledger();self.mutate('ALTER TABLE supabase_migrations.schema_migrations FORCE ROW LEVEL SECURITY')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_owner_rejected(self):
        self.setup_ledger()
        # Fixture-only prerequisite under a non-superuser database owner. Revoke
        # the temporary grant before checking that the changed owner is rejected.
        self.mutate('GRANT CREATE ON SCHEMA supabase_migrations TO pg_database_owner')
        self.mutate('ALTER TABLE supabase_migrations.schema_migrations OWNER TO pg_database_owner')
        self.mutate('REVOKE CREATE ON SCHEMA supabase_migrations FROM pg_database_owner')
        with self.assertRaises(Rejected):self.runner()
    def test_schema_owner_rejected(self):
        self.setup_ledger();self.mutate('ALTER SCHEMA supabase_migrations OWNER TO pg_database_owner')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_view_rejected(self):
        self.mutate('CREATE SCHEMA supabase_migrations');self.mutate('CREATE VIEW supabase_migrations.schema_migrations AS SELECT NULL::text version,NULL::text name,NULL::text[] statements')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_materialized_view_rejected(self):
        self.mutate('CREATE SCHEMA supabase_migrations');self.mutate('CREATE MATERIALIZED VIEW supabase_migrations.schema_migrations AS SELECT NULL::text version,NULL::text name,NULL::text[] statements')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_wrong_array_type_rejected(self):
        self.mutate('CREATE SCHEMA supabase_migrations');self.mutate('CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements integer[])')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_wrong_scalar_types(self):
        for definition in ('version bigint PRIMARY KEY,name text,statements text[]','version text PRIMARY KEY,name integer,statements text[]'):
            with self.subTest(definition=definition):
                self.mutate('CREATE SCHEMA supabase_migrations')
                self.mutate('CREATE TABLE supabase_migrations.schema_migrations('+definition+')')
                with self.assertRaises(Rejected):self.runner()
                self.mutate('DROP SCHEMA supabase_migrations CASCADE')
    def test_ledger_missing_primary_key(self):
        self.mutate('CREATE SCHEMA supabase_migrations');self.mutate('CREATE TABLE supabase_migrations.schema_migrations(version text NOT NULL,name text,statements text[])')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_unlogged_rejected(self):
        self.mutate('CREATE SCHEMA supabase_migrations');self.mutate('CREATE UNLOGGED TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[])')
        with self.assertRaises(Rejected):self.runner()
    def test_schema_acl_rejected(self):
        self.setup_ledger();self.mutate('GRANT USAGE ON SCHEMA supabase_migrations TO PUBLIC')
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_extra_constraint_rejected(self):
        self.setup_ledger();self.mutate("ALTER TABLE supabase_migrations.schema_migrations ADD CHECK(version<>'x')")
        with self.assertRaises(Rejected):self.runner()
    def test_ledger_acl_rejected(self):
        self.setup_ledger();self.mutate('GRANT SELECT ON supabase_migrations.schema_migrations TO PUBLIC')
        with self.assertRaises(Rejected):self.runner()
    def test_column_acl_rejected(self):
        self.setup_ledger();self.mutate('GRANT SELECT(version) ON supabase_migrations.schema_migrations TO PUBLIC')
        with self.assertRaises(Rejected):self.runner()
    def test_unrelated_history(self):
        self.setup_ledger();self.mutate("INSERT INTO supabase_migrations.schema_migrations VALUES('19990101000000',ARRAY['x'],'unexpected')")
        with self.assertRaises(Rejected):self.runner()
    def test_out_of_order_history(self):
        r=self.runner();m=self.plan.items[1]
        self.mutate('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(%s,%s,%s)',(m.version,m.name,list(m.statements)))
        with self.assertRaises(Rejected):r.next()
        self.stopped(r)
    def test_changed_prefix_contents(self):
        r=self.runner();r.next();self.mutate("UPDATE supabase_migrations.schema_migrations SET name='tampered'")
        with self.assertRaises(Rejected):r.next()
        self.stopped(r)
    def test_duplicate_version_rejected(self):
        r=self.runner();r.next();r.index=0
        with self.assertRaises(Rejected):r.next()
        self.stopped(r)
    def test_modified_manifest(self):
        # Filesystem boundary simulation, no actual modification of approved artifacts.
        real=Path.read_bytes
        def tamper(p):return b'{}' if p==mod.ROOT/'manifest.json' else real(p)
        r=self.runner()
        with patch.object(Path,'read_bytes',tamper),self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_substituted_file_and_replacement_hash(self):
        from dataclasses import replace
        old=self.plan.items
        m=old[0];original=m.path.read_bytes();new=b'BEGIN; SELECT 1; COMMIT;'
        try:
            m.path.write_bytes(new)
            self.plan.items=(replace(m,raw=new,sha256=mod.digest(new)),*old[1:])
            with self.assertRaises(Rejected):self.runner()
        finally:m.path.write_bytes(original);self.plan.items=old
    def test_plan_order_substitution(self):
        from dataclasses import replace
        old=self.plan.items
        try:
            self.plan.items=tuple(reversed(old))
            with self.assertRaises(Rejected):self.runner()
        finally:self.plan.items=old
        try:
            self.plan.items=(replace(old[0],path=mod.SOURCE/old[0].filename),*old[1:])
            with self.assertRaises(Rejected):self.runner()
        finally:self.plan.items=old
    def test_extra_fixture_file(self):
        p=self.plan.root/'unexpected.sql'
        try:
            p.write_bytes(b'SELECT 1')
            with self.assertRaises(Rejected):self.runner()
        finally:p.unlink()
    def test_original_execution_impossible(self):
        with self.assertRaises(Rejected):Runner(self.db,mod.original_plan())
    def test_source_overlap_and_original_protection(self):
        before={p: p.read_bytes() for p in mod.SOURCE.glob('*.sql')}
        for path in (mod.SOURCE,mod.SOURCE.parent,mod.SOURCE/'child'):
            with self.assertRaises(Rejected):mod.no_source_overlap(path)
        with patch.object(mod,'WORK',mod.SOURCE),self.assertRaises(Rejected):SyntheticPlan()
        forbidden=mod.SOURCE/('must_not_create_'+uuid.uuid4().hex)
        with patch.object(mod,'WORK',forbidden),self.assertRaises(Rejected):SyntheticPlan()
        self.assertFalse(forbidden.exists())
        self.assertEqual(before,{p:p.read_bytes() for p in before})
    def test_junction_overlap(self):
        with mod.safe_scratch() as temp:
            junction=Path(temp)/'junction'
            subprocess.run(['cmd','/c','mklink','/J',str(junction),str(mod.SOURCE)],check=True,capture_output=True)
            try:
                with self.assertRaises(Rejected):mod.no_source_overlap(junction)
                with self.assertRaises(Rejected):mod.canonical(junction)
            finally:junction.rmdir()
    def test_symlink_overlap(self):
        with mod.safe_scratch() as temp:
            link=Path(temp)/'link'
            try:os.symlink(mod.SOURCE,link,target_is_directory=True)
            except OSError as e:
                if getattr(e,'winerror',None)==1314:self.skipTest('Windows account lacks symlink privilege; junction test is real, symlink flag test is simulated')
                raise
            try:
                with self.assertRaises(Rejected):mod.no_source_overlap(link)
                with self.assertRaises(Rejected):mod.canonical(link)
            finally:link.unlink()
    def test_symlink_rejected_simulated(self):
        with mod.safe_scratch() as temp:
            p=Path(temp)/'symlink';p.mkdir();real=Path.is_symlink
            def linked(path):return path==p or real(path)
            with patch.object(Path,'is_symlink',linked),self.assertRaises(Rejected):mod.canonical(p)
    def test_utf8_split_chunks(self):
        # Actual pipe writes split every UTF-8 sequence. No SQL execution.
        text="BEGIN; SELECT 'বাংলা 😀 café'; COMMIT;"
        node=mod.verify_artifacts()
        p=subprocess.Popen([str(node),'--experimental-transform-types',str(mod.ROOT/'parse.mjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        for b in text.encode('utf8'):
            p.stdin.write(bytes([b]));p.stdin.flush();time.sleep(.001)
        p.stdin.close();out=p.stdout.read();err=p.stderr.read();p.stdout.close();p.stderr.close();self.assertEqual(p.wait(),0,err)
        self.assertEqual(''.join(t['raw'] for t in json.loads(out)['tokens']).encode('utf8'),text.encode('utf8'))
    def test_utf8_forced_buffer_chunks(self):
        # Deterministic one-byte Buffer chunks; does not rely on OS pipe coalescing.
        text="SELECT 'বাংলা 😀 café';"
        script=f"import {{decodeUtf8Chunks}} from {json.dumps((mod.ROOT/'parse.mjs').as_uri())}; const bytes=Buffer.from({json.dumps(text)}); async function* chunks(){{for(const b of bytes)yield Buffer.from([b]);}} process.stdout.write(await decodeUtf8Chunks(chunks()));"
        node=mod.verify_artifacts()
        result=subprocess.run([str(node),'--experimental-transform-types','--input-type=module','-e',script],capture_output=True,check=True)
        self.assertEqual(result.stdout,text.encode('utf8'))
    def test_invalid_boundaries(self):
        for raw in [b'SELECT 1',b'BEGIN; SELECT 1;',b'BEGIN; SELECT 1; COMMIT; SELECT 2;',b'BEGIN; ROLLBACK; COMMIT;',b'BEGIN; RESET ROLE; COMMIT;']:
            with self.subTest(raw=raw),self.assertRaises(Rejected):mod.validate_sql(raw)
        quoted=b"BEGIN; /* nested; /* inner; */ */ CREATE FUNCTION public.f() RETURNS text LANGUAGE sql AS $body$ SELECT 'a;''b'; $body$; COMMIT;"
        statements,executable=mod.validate_sql(quoted)
        self.assertEqual(len(executable),3)
        self.assertIn("SELECT 'a;''b';",executable[1])
    def test_lock_contention(self):
        r=self.runner()
        with self.assertRaises(Rejected):self.runner()
        r._continuity()
    def test_lock_loss(self):
        r=self.runner();r._c.execute('SELECT pg_advisory_unlock_all()')
        with self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_lock_loss_before_commit(self):
        r=self.runner();real=psycopg.Connection.execute
        def execute(c,q,*a,**k):
            result=real(c,q,*a,**k)
            if c is r._c and q==mod.INSERT:real(c,'SELECT pg_advisory_unlock_all()')
            return result
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_backend_terminated_no_reconnect(self):
        r=self.runner();self.admin.execute('SELECT pg_terminate_backend(%s)',(r.pid,))
        with self.assertRaises((psycopg.Error,Rejected)):r.next()
        self.stopped(r);self.empty()
    def test_backend_identity_changed(self):
        r=self.runner();r.pid+=1
        with self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_sql_failure_rolls_back(self):
        r=self.runner();self.mutate('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
        # Real SQL error after CREATE inside runner-owned transaction.
        real=psycopg.Connection.execute
        def execute(c,query,*a,**k):
            result=real(c,query,*a,**k)
            if c is r._c and isinstance(query,str) and query.startswith('CREATE TABLE public.probe_0'):
                real(c,'SELECT 1/0')
            return result
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(psycopg.errors.DivisionByZero):r.next()
        self.stopped(r);self.empty()
    def test_history_insert_failure_rolls_back(self):
        r=self.runner();real=psycopg.Connection.execute
        def execute(c,q,*a,**k):
            if c is r._c and q==mod.INSERT:
                real(c,"ALTER TABLE supabase_migrations.schema_migrations ADD CONSTRAINT injected_failure CHECK(version='never')")
            return real(c,q,*a,**k)
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(psycopg.errors.CheckViolation):r.next()
        self.stopped(r);self.empty()
    def test_insert_rowcount_guard(self):
        r=self.runner();real=psycopg.Connection.execute
        class Zero:
            rowcount=0
        def execute(c,q,*a,**k):
            if c is r._c and q==mod.INSERT:return Zero()
            return real(c,q,*a,**k)
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_insert_contents_guard(self):
        r=self.runner();real=psycopg.Connection.execute
        class Wrong:
            rowcount=1
            def fetchall(self):return [('wrong','wrong',[])]
        def execute(c,q,*a,**k):
            if c is r._c and q==mod.INSERT:
                real(c,q,*a,**k);return Wrong()
            return real(c,q,*a,**k)
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(Rejected):r.next()
        self.stopped(r);self.empty()
    def test_keyboard_interrupt_before_commit(self):
        r=self.runner();real=r._continuity;calls=0
        def interrupt():
            nonlocal calls
            calls+=1
            if calls==3:raise KeyboardInterrupt('test interrupt before COMMIT')
            real()
        with patch.object(r,'_continuity',interrupt),self.assertRaises(KeyboardInterrupt):r.next()
        self.stopped(r);self.empty()
    def test_system_exit_before_commit(self):
        r=self.runner();real=psycopg.Connection.execute
        def execute(c,q,*a,**k):
            result=real(c,q,*a,**k)
            if c is r._c and q==mod.INSERT:raise SystemExit('test exit')
            return result
        with patch.object(psycopg.Connection,'execute',execute),self.assertRaises(SystemExit):r.next()
        self.stopped(r);self.empty()
    def test_actual_process_kill_rolls_back(self):
        self.setup_ledger()
        script='''
import time, sys
from unittest.mock import patch
import psycopg
import runner as m
p=m.SyntheticPlan()
r=m.Runner(sys.argv[1],p)
real=psycopg.Connection.execute
def execute(c,q,*a,**k):
    result=real(c,q,*a,**k)
    if c is r._c and q==m.INSERT:
        print(r.pid,flush=True)
        time.sleep(30)
    return result
with patch.object(psycopg.Connection,'execute',execute):r.next()
'''
        p=subprocess.Popen([sys.executable,'-u','-c',script,self.db],cwd=mod.ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            # Child stops after the real parameterized INSERT, before COMMIT.
            ready=p.stdout.readline().strip()
            if not ready:
                self.fail(p.stderr.read())
            backend=int(ready);p.kill();p.wait(timeout=5)
            end=time.monotonic()+5
            while self.admin.execute('SELECT count(*) FROM pg_stat_activity WHERE pid=%s',(backend,)).fetchone()[0]:
                if time.monotonic()>end:raise AssertionError('killed child backend remains')
                time.sleep(.01)
            self.empty()
            self.assertEqual(reconcile(self.db,self.plan)['committed'],0)
        finally:
            if p.poll() is None:p.kill();p.wait(timeout=5)
            p.stdout.close();p.stderr.close()
    def test_cleanup_failure_preserves_original(self):
        r=self.runner();real=psycopg.Connection.execute;original=ValueError('original failure')
        def execute(c,q,*a,**k):
            if c is r._c and q==mod.INSERT:raise original
            if c is r._c and q=='ROLLBACK':raise OSError('cleanup failure')
            return real(c,q,*a,**k)
        with patch.object(psycopg.Connection,'execute',execute):
            with self.assertRaises(ValueError) as caught:r.next()
        self.assertIs(caught.exception,original);self.stopped(r);self.empty()
    def test_real_tcp_unknown_committed_reconciliation(self):self._network(False,1)
    def test_real_tcp_unknown_rollback_reconciliation(self):self._network(True,0)
    def _network(self,before,count):
        self.setup_ledger();proxy=CommitProxy(before);r=self.runner(tcp_test=True)
        try:
            with self.assertRaises(UnknownOutcome):r.next()
            self.assertTrue(proxy.hit.is_set());self.stopped(r)
        finally:r.close();proxy.close()
        # Wait for server socket cleanup only; never retry any migration.
        end=time.monotonic()+5
        while self.admin.execute('SELECT count(*) FROM pg_stat_activity WHERE pid=%s',(r.pid,)).fetchone()[0]:
            if time.monotonic()>end:raise AssertionError('backend failed to exit')
            time.sleep(.01)
        self.assertEqual(reconcile(self.db,self.plan)['committed'],count)
        self.assertEqual(r.state,'UNKNOWN')
    def test_reconcile_rejects_live_runner(self):
        self.runner()
        with self.assertRaises(Rejected):reconcile(self.db,self.plan)
    def test_reconcile_mismatch(self):
        self.setup_ledger();self.mutate('CREATE TABLE public.unexpected(id int)')
        with self.assertRaises(Rejected):reconcile(self.db,self.plan)
    def test_original_parser_integrity(self):
        evidence=[]
        approved=mod.approved_manifest()
        # The ninth blocked draft must NOT silently enter this closed eight-file
        # runner. Preserve its rejection while separately parsing approved bytes.
        if {p.name for p in mod.SOURCE.glob('*.sql')}!={x['file'] for x in approved}:
            with self.assertRaisesRegex(Rejected,'unexpected migration file'):mod.original_plan()
        for item in approved:
            path=mod.canonical(mod.SOURCE/item['file'])
            self.assertEqual(path.parent,mod.canonical(mod.SOURCE))
            raw=path.read_bytes();self.assertEqual(mod.digest(raw),item['sha256'])
            statements,_=mod.validate_sql(raw)
            evidence.append({'file':item['file'],'sha256':mod.digest(raw),'statements':len(statements),'status':'PASS','executed':False})
        self.assertEqual(len(evidence),8)
        (mod.ROOT/'integrity-results.json').write_text(json.dumps(evidence,indent=2))
    def test_artifact_tamper_rejected(self):
        real=Path.read_bytes
        for filename in ('runtime-lock.json','parse.mjs','vendor/sql-split.ts'):
            def tamper(p):return b'changed' if p==mod.ROOT/filename else real(p)
            with self.subTest(filename=filename),patch.object(Path,'read_bytes',tamper),self.assertRaises(Rejected):mod.verify_artifacts()
    def test_dependency_file_tamper(self):
        real=Path.read_bytes
        target=Path(psycopg.__file__).resolve()
        def tamper(p):return b'changed' if p.resolve()==target else real(p)
        with patch.object(Path,'read_bytes',tamper),self.assertRaises(Rejected):mod.verify_dependencies()

if __name__=='__main__':unittest.main(verbosity=2)
