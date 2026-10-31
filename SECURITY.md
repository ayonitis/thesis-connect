# Security Policy

Thesis Connect uses Supabase Auth, PostgreSQL RLS, constrained public views, database validation, and authenticated RPCs. This is a source-level engineering design, not a security certification or production-verification claim.

- Sessions are handled by SSR-aware Supabase clients; client input does not establish authorization identity.
- `app_roles` and `auth.uid()`-based helpers support database-side role checks. Administrator assignment is a trusted operator process, not a client API.
- Phase 2B uses RLS and separates public directory/room data from private student, application, and contact data.
- SECURITY DEFINER RPCs use fixed search paths, explicit EXECUTE grants, input validation, and ownership/admin checks.
- Phase 4 removes legacy direct review/request writes in favor of reviewed RPCs.

Do not commit `.env.local`, service-role keys, OAuth secrets, database credentials, private keys, dumps, audit exports, or production data. Report vulnerabilities privately to the repository maintainer without public exploit details, credentials, or user data.

