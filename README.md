# Thesis Connect
### A secure academic collaboration platform built for BRAC University students.

Thesis Connect is a full-stack academic collaboration platform designed to simplify the thesis journey for university students. It provides a structured environment where students can discover potential thesis partners, create collaboration rooms, manage applications, explore faculty profiles, and share feedback through a dedicated faculty review system.

Built with **Next.js, TypeScript, Supabase, and PostgreSQL**, the platform goes beyond conventional frontend development, with particular emphasis on backend architecture, authentication, database-level authorization, and data protection.

### Engineering & Security

Security has been a central consideration throughout the development of Thesis Connect. Rather than relying solely on frontend restrictions, the application incorporates database-level security mechanisms designed to enforce access boundaries where the data is stored.

Key engineering considerations include:

- **Authentication & Identity Management:** Supabase Auth integration, Google OAuth, session management, and university-specific access restrictions.
- **PostgreSQL Row-Level Security (RLS):** Database policies designed to control which users can access, create, or modify specific records.
- **Role-Based Authorization:** Permission boundaries for students, administrators, and moderation workflows.
- **Secure Database Operations:** Custom PostgreSQL RPC functions using `SECURITY DEFINER`, identity-aware validation, and restricted function execution permissions.
- **Private Data Protection:** Separation of public-facing information from sensitive student records, application details, and contact information.
- **Database Privilege Hardening:** Controlled direct-write permissions, removal of obsolete write paths, and explicit function `search_path` configuration.
- **Security Auditing:** Structured, read-only database catalog inspection covering RLS policies, function configurations, ownership, privileges, views, triggers, constraints, sequences, and default permissions.

### Development Approach

The project has involved more than implementing individual features. Its development has included database schema design, authentication architecture, backend workflow engineering, security reviews, migration planning, and documentation of database-level access controls.

Security work has been organized into dedicated development phases, including Phase 2B and Phase 4, with additional attention to function hardening and production-readiness verification.

**The objective is to build an application where functionality and security are considered together, rather than treating security as an afterthought.**
