import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (process.env.VERCEL_ENV === "preview") {
  let developmentTarget = false;
  try {
    const target = new URL(databaseUrl);
    const ref = "sbwhdayinxaiarxsjpsp";
    const direct = target.hostname === `db.${ref}.supabase.co`;
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(target.hostname)
      && decodeURIComponent(target.username).endsWith(`.${ref}`);
    developmentTarget = ["postgres:", "postgresql:"].includes(target.protocol)
      && (direct || pooler);
  } catch { /* Invalid configuration fails closed without disclosing the URL. */ }
  if (!developmentTarget) throw new Error("Preview requires the approved development database target.");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
