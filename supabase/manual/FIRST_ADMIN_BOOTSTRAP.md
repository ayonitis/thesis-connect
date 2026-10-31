# Manual first-admin bootstrap — controlled operator procedure

This is intentionally not a migration, seed, frontend action, or automated script. Do not perform it until the read-only remote verification output has been reconciled and the proposed migrations have been separately approved.

1. A trusted project operator independently identifies the intended, already-created Auth user UUID in the Supabase Dashboard. Do not copy an ID from an untrusted request.
2. Confirm a matching `public.profiles` row exists. Existing Auth users may need a separately reviewed profile-backfill before this step.
3. In the Supabase SQL Editor, under trusted operator access, execute exactly one reviewed statement after replacing the placeholder:

```sql
insert into public.app_roles (user_id, role, granted_by)
values ('REPLACE_WITH_TRUSTED_AUTH_USER_UUID', 'admin', null);
```

4. Independently verify the resulting role, record the operator, target UUID, timestamp, and approval ticket in the organization’s access-control record.

The SQL Editor owner can bypass RLS. Never expose this procedure, a target UUID, dashboard access, or role-grant capability to ordinary users. No role is created by the application or by these migrations automatically.
