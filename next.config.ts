import type { NextConfig } from "next";

// Preview is exclusively bound to the approved development project. Validate
// before NEXT_PUBLIC values are frozen into browser bundles; never echo values.
if (process.env.VERCEL_ENV === "preview") {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://sbwhdayinxaiarxsjpsp.supabase.co") {
    throw new Error("Preview requires the approved development Supabase URL.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "")) {
    throw new Error("Preview requires a development Supabase publishable key.");
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
