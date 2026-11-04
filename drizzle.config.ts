import { defineConfig } from "drizzle-kit";

// Explicit process configuration only. Never auto-load the production .env.local.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("An explicitly configured DATABASE_URL is required for database tooling.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: databaseUrl },
});
