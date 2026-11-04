"""Fail-closed LOCAL ONLY prototype. Original application SQL has no execution entry point."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import sys
from importlib.metadata import version
from functools import lru_cache
from dataclasses import dataclass
import psycopg
from psycopg.pq import TransactionStatus

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[1] / 'supabase' / 'migrations'
WORK = ROOT / '.work'
MANIFEST_SHA = '84f86528aeb6b811f41b7cea533dd7069663500d0041f63d87c314e87582b9b5'
LOCK = 7426021220001
OWNER = 'prototype_owner'
INSERT = 'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(%s,%s,%s) RETURNING version,name,statements'
RUNTIME_LOCK_SHA = '14b664470351982003b23c6972d84ab6d1ee5c10e06391b173b772283b4e3736'

class Rejected(Exception): pass
class UnknownOutcome(Exception): pass
def digest(data): return hashlib.sha256(data).hexdigest()

def verify_artifacts():
    raw=(ROOT/'runtime-lock.json').read_bytes()
    if digest(raw)!=RUNTIME_LOCK_SHA:raise Rejected('runtime lock changed')
    lock=json.loads(raw)
    for filename,expected in lock['artifacts'].items():
        if digest((ROOT/filename).read_bytes())!=expected:raise Rejected('artifact integrity: '+filename)
    node=Path(lock['node']['path'])
    if digest(node.read_bytes())!=lock['node']['sha256']:raise Rejected('Node binary changed')
    if subprocess.check_output([str(node),'--version']).decode().strip()!=lock['node']['version']:raise Rejected('Node version changed')
    return node

def verify_dependencies():
    lock=json.loads((ROOT/'runtime-lock.json').read_bytes())
    if sys.version.split()[0]!=lock['python_version']:raise Rejected('Python runtime version changed')
    for package,expected in lock['python_packages'].items():
        if version(package)!=expected:raise Rejected('dependency version changed')
    inventory=json.loads((ROOT/'python-files.lock.json').read_bytes())
    base=Path(psycopg.__file__).resolve().parent.parent
    for filename,expected in inventory.items():
        if digest((base/filename).read_bytes())!=expected:raise Rejected('dependency file changed: '+filename)

def parse(content):
    node=verify_artifacts()
    return json.loads(_parse_cached(str(node),content))

@lru_cache(maxsize=64)
def _parse_cached(node,content):
    p=subprocess.run([str(node),'--experimental-transform-types',str(ROOT/'parse.mjs')],input=content.encode('utf8'),capture_output=True,check=True,timeout=30)
    return p.stdout.decode('utf8')

def head(sql):
    s=sql.lstrip('\ufeff \t\r\n')
    while True:
        if s.startswith('--'):
            m=re.search(r'[\r\n]',s)
            if not m:return ''
            s=s[m.end():].lstrip()
        elif s.startswith('/*'):
            i,depth=2,1
            while i<len(s) and depth:
                if s[i:i+2]=='/*':depth+=1;i+=2
                elif s[i:i+2]=='*/':depth-=1;i+=2
                else:i+=1
            if depth:raise Rejected('unclosed comment')
            s=s[i:].lstrip()
        else:return s.strip()

def validate_sql(raw):
    p=parse(raw.decode('utf8',errors='strict'))
    if ''.join(t['raw'] for t in p['tokens']).encode('utf8')!=raw:raise Rejected('parser byte roundtrip')
    executable=tuple(s for s in p['statements'] if head(s))
    if len(executable)<3 or head(executable[0]).upper()!='BEGIN' or head(executable[-1]).upper()!='COMMIT':raise Rejected('expected BEGIN/body/COMMIT')
    for s in executable[1:-1]:
        h=head(s).upper()
        if re.match(r'^(BEGIN|START|COMMIT|END|ABORT|ROLLBACK|SAVEPOINT|RELEASE|PREPARE|DISCARD|CALL|DO|SET|RESET)\b',h):raise Rejected('transaction/session control')
        if re.match(r'^(VACUUM|CLUSTER|ALTER SYSTEM)\b',h) or re.search(r'\bINDEX\s+CONCURRENTLY\b',h):raise Rejected('nontransactional SQL')
        if re.search(r'\bSUPABASE_MIGRATIONS\b|PG_ADVISORY',h):raise Rejected('ledger/lock SQL')
    return tuple(p['statements']),executable

def canonical(path):
    p=Path(path).absolute()
    for part in (p,*p.parents):
        if part.is_symlink() or part.is_junction():raise Rejected('link/junction path')
    return p.resolve(strict=True)

def no_source_overlap(path):
    p=Path(path).resolve()
    if p==SOURCE or p in SOURCE.parents or SOURCE in p.parents:raise Rejected('scratch/source overlap')
    return p

def safe_scratch():
    canonical(SOURCE)
    no_source_overlap(WORK)  # reject before even creating a directory
    WORK.mkdir(parents=True,exist_ok=True)
    no_source_overlap(canonical(WORK))
    return tempfile.TemporaryDirectory(prefix='exclusive_atomic_',dir=WORK)

@dataclass(frozen=True)
class Migration:
    filename:str
    version:str
    name:str
    path:Path
    sha256:str
    statements:tuple
    executable:tuple
    raw:bytes

def approved_manifest():
    b=(ROOT/'manifest.json').read_bytes()
    if digest(b)!=MANIFEST_SHA:raise Rejected('approved manifest changed')
    return json.loads(b)['files']

def original_plan():
    """Read-only integrity/parse operation. Cannot be passed to Runner."""
    root=canonical(SOURCE);items=approved_manifest()
    if len(items)!=8 or [x['file'] for x in items]!=sorted(x['file'] for x in items):raise Rejected('approved order')
    result=[]
    for item in items:
        p=canonical(root/item['file'])
        if p.parent!=root or p.name!=item['file']:raise Rejected('canonical path mismatch')
        b=p.read_bytes()
        if digest(b)!=item['sha256']:raise Rejected('original hash mismatch')
        statements,executable=validate_sql(b);v,n=p.stem.split('_',1)
        result.append(Migration(p.name,v,n,p,item['sha256'],statements,executable,b))
    if {p.name for p in root.glob('*.sql')}!={m.filename for m in result}:raise Rejected('unexpected migration file')
    return tuple(result)

class SyntheticPlan:
    """Closed deterministic fixtures. No caller SQL, paths or replacement hashes."""
    def __init__(self):
        self._temp=safe_scratch();self.root=canonical(self._temp.name);items=[]
        for i,item in enumerate(approved_manifest()):
            b=f'BEGIN; CREATE TABLE public.probe_{i}(id integer); COMMIT;'.encode();p=self.root/item['file']
            with p.open('xb') as f:f.write(b)
            statements,executable=validate_sql(b);v,n=p.stem.split('_',1)
            items.append(Migration(p.name,v,n,p,digest(b),statements,executable,b))
        self.items=tuple(items)
    def verify(self):
        approved=approved_manifest()
        if tuple(m.filename for m in self.items)!=tuple(x['file'] for x in approved):raise Rejected('plan order changed')
        if {p.name for p in self.root.iterdir()}!={m.filename for m in self.items}:raise Rejected('unexpected fixture file')
        for i,m in enumerate(self.items):
            expected=f'BEGIN; CREATE TABLE public.probe_{i}(id integer); COMMIT;'.encode()
            if canonical(m.path)!=self.root/m.filename or m.path.read_bytes()!=expected or m.raw!=expected or m.sha256!=digest(expected):raise Rejected('substituted fixture')
            s,e=validate_sql(expected);v,n=m.filename[:-4].split('_',1)
            if (m.version,m.name,m.statements,m.executable)!=(v,n,s,e):raise Rejected('modified plan payload')
    def close(self):self._temp.cleanup()

def _connect(database,port=55439):
    if not re.fullmatch(r'atomic_proto_[a-z0-9_]+',database) or port not in (55439,55440):raise Rejected('local fixture target required')
    return psycopg.connect(host='127.0.0.1',port=port,dbname=database,user=OWNER,autocommit=True,sslmode='disable',connect_timeout=3,application_name='atomic_local_prototype')

def ledger(c,create=False):
    schema=c.execute("SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname='supabase_migrations'").fetchone()
    if schema is None:
        if not create:raise Rejected('missing ledger schema')
        with c.transaction():
            c.execute('CREATE SCHEMA supabase_migrations')
            c.execute('CREATE TABLE supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY)')
            c.execute('ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN statements text[]')
            c.execute('ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN name text')
        schema=(OWNER,)
    if schema!=(OWNER,):raise Rejected('ledger schema owner')
    r=c.execute("SELECT relkind,relpersistence,relowner::regrole::text,relrowsecurity,relforcerowsecurity,relispartition,reloptions FROM pg_class WHERE oid=to_regclass('supabase_migrations.schema_migrations')").fetchone()
    if r!=('r','p',OWNER,False,False,False,None):raise Rejected('ledger relation configuration')
    columns=c.execute("SELECT attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,atthasdef,attisdropped FROM pg_attribute WHERE attrelid='supabase_migrations.schema_migrations'::regclass AND attnum>0").fetchall()
    if sorted(columns)!=sorted([('version','text',True,'','',False,False),('name','text',False,'','',False,False),('statements','text[]',False,'','',False,False)]):raise Rejected('ledger columns')
    cons=c.execute("SELECT contype,condeferrable,condeferred,convalidated,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='supabase_migrations.schema_migrations'::regclass").fetchall()
    if cons!=[('p',False,False,True,'PRIMARY KEY (version)')]:raise Rejected('ledger constraints')
    for sql in ["SELECT count(*) FROM pg_trigger WHERE tgrelid='supabase_migrations.schema_migrations'::regclass",
                "SELECT count(*) FROM pg_rewrite WHERE ev_class='supabase_migrations.schema_migrations'::regclass",
                "SELECT count(*) FROM pg_policy WHERE polrelid='supabase_migrations.schema_migrations'::regclass",
                "SELECT count(*) FROM pg_inherits WHERE inhrelid='supabase_migrations.schema_migrations'::regclass OR inhparent='supabase_migrations.schema_migrations'::regclass"]:
        if c.execute(sql).fetchone()[0]:raise Rejected('ledger triggers/rules/policies/inheritance')
    idx=c.execute("SELECT indisprimary,indisunique,indisvalid,indisready,indimmediate,indexprs IS NULL,indpred IS NULL FROM pg_index WHERE indrelid='supabase_migrations.schema_migrations'::regclass").fetchall()
    if idx!=[(True,True,True,True,True,True,True)]:raise Rejected('ledger indexes')
    for sql in ["SELECT count(*) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='supabase_migrations.schema_migrations'::regclass AND (a.grantee<>c.relowner OR a.grantor<>c.relowner)",
                "SELECT count(*) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='supabase_migrations' AND (a.grantee<>n.nspowner OR a.grantor<>n.nspowner)",
                "SELECT count(*) FROM pg_attribute t JOIN pg_class c ON c.oid=t.attrelid CROSS JOIN LATERAL aclexplode(t.attacl) a WHERE c.oid='supabase_migrations.schema_migrations'::regclass AND (a.grantee<>c.relowner OR a.grantor<>c.relowner)"]:
        if c.execute(sql).fetchone()[0]:raise Rejected('unexpected ledger ACL')
    if c.execute("SELECT current_user,has_schema_privilege(current_user,'supabase_migrations','USAGE'),has_table_privilege(current_user,'supabase_migrations.schema_migrations','SELECT') AND has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT') AND has_table_privilege(current_user,'supabase_migrations.schema_migrations','UPDATE')").fetchone()!=(OWNER,True,True):raise Rejected('ledger privileges')

def rows(c):return c.execute('SELECT version,name,statements FROM supabase_migrations.schema_migrations ORDER BY version').fetchall()
def expected_rows(plan,count):return [(m.version,m.name,list(m.statements)) for m in plan.items[:count]]
def catalog(c,count):
    names=c.execute("SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname").fetchall()
    if names!=[(f'probe_{i}','r',OWNER) for i in range(count)]:raise Rejected('post/prefix catalog mismatch')
    for i in range(count):
        if c.execute("SELECT attname,format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid=%s::regclass AND attnum>0",(f'public.probe_{i}',)).fetchall()!=[('id','integer')]:raise Rejected('catalog column mismatch')

class Runner:
    def __init__(self,database,plan,*,tcp_test=False):
        if type(plan) is not SyntheticPlan:raise Rejected('only closed synthetic fixture plans may execute')
        self._c=None;self.plan=plan;self.state='NEW';self.index=0;self.database=database
        try:
            plan.verify();verify_artifacts();verify_dependencies();self._c=_connect(database,55440 if tcp_test else 55439)
            if not self._c.execute('SELECT pg_try_advisory_lock(%s)',(LOCK,)).fetchone()[0]:raise Rejected('migration lock unavailable')
            self.pid=self._c.info.backend_pid
            self.identity=self._c.execute('SELECT current_database(),current_user,session_user,host(inet_server_addr()),inet_server_port()').fetchone()
            if self.identity!=(database,OWNER,OWNER,'127.0.0.1',55439):raise Rejected('backend identity')
            ledger(self._c,create=True);self._prefix(0);self.state='READY'
        except BaseException:
            self.state='FAILED';self.close();raise
    def __enter__(self):return self
    def __exit__(self,*args):self.close()
    def close(self):
        c=self._c
        if c is not None:
            try:
                if not c.closed:
                    if c.info.transaction_status!=TransactionStatus.IDLE:c.execute('ROLLBACK')
                    c.execute('SELECT pg_advisory_unlock(%s)',(LOCK,))
            except BaseException:pass
            finally:
                try:c.close()
                except BaseException:pass
        if self.state not in ('FAILED','UNKNOWN'):self.state='CLOSED'
    def _continuity(self):
        c=self._c
        if c.closed or c.info.backend_pid!=self.pid:raise Rejected('backend changed/lost')
        if c.execute('SELECT current_database(),current_user,session_user,host(inet_server_addr()),inet_server_port()').fetchone()!=self.identity:raise Rejected('backend identity changed')
        held=c.execute("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND classid=%s::oid AND objid=%s::oid AND objsubid=1 AND granted",(LOCK>>32,LOCK&0xffffffff)).fetchone()[0]
        if held!=1:raise Rejected('advisory lock lost')
    def _prefix(self,count):
        ledger(self._c)
        if rows(self._c)!=expected_rows(self.plan,count):raise Rejected('unexpected history prefix')
        catalog(self._c,count)
    def next(self):
        if self.state!='READY':raise Rejected('runner is permanently stopped')
        committing=False
        try:
            self.plan.verify();verify_artifacts();self._continuity();self._prefix(self.index)
            if self.index==8:self.state='DONE';return 'DONE'
            m=self.plan.items[self.index];c=self._c
            c.execute(m.executable[0]);c.execute('LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT');self._prefix(self.index)
            for s in m.executable[1:-1]:c.execute(s)
            self._continuity();ledger(c)
            if c.info.transaction_status!=TransactionStatus.INTRANS:raise Rejected('transaction escaped')
            cursor=c.execute(INSERT,(m.version,m.name,list(m.statements)))
            if cursor.rowcount!=1 or cursor.fetchall()!=[(m.version,m.name,list(m.statements))]:raise Rejected('history INSERT result')
            if rows(c)!=expected_rows(self.plan,self.index+1):raise Rejected('history exact contents')
            catalog(c,self.index+1);self._continuity();self.plan.verify();committing=True
            cur=c.execute(m.executable[-1])
            if cur.statusmessage!='COMMIT' or c.info.transaction_status!=TransactionStatus.IDLE:raise Rejected('COMMIT completion not confirmed')
            self.plan.verify();self._continuity();self._prefix(self.index+1);self.index+=1
            return 'COMMITTED'
        except BaseException as exc:
            self.state='UNKNOWN' if committing else 'FAILED';self.close()
            if committing:raise UnknownOutcome('explicit reconciliation required; never replay automatically') from exc
            raise
    def run(self):
        try:
            while self.index<8:self.next()
            self.state='DONE'
        finally:self.close()

def reconcile(database,plan):
    """Explicit inspection with NEW exclusive session lock; never applies/repairs."""
    if type(plan) is not SyntheticPlan:raise Rejected('synthetic plan required')
    plan.verify();c=_connect(database)
    try:
        if not c.execute('SELECT pg_try_advisory_lock(%s)',(LOCK,)).fetchone()[0]:raise Rejected('prior backend/runner still holds lock')
        c.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        ledger(c);actual=rows(c)
        for count in range(9):
            if actual==expected_rows(plan,count):
                catalog(c,count)
                return {'status':'CONSISTENT_PREFIX','committed':count,'resume_authorized':False}
        raise Rejected('history/catalog mismatch; manual investigation, no repair')
    finally:c.close()
