import { requireBracUser } from "@/lib/auth/require-brac-user";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const authHeaders = new Map<string, string>();
  const env = getSupabaseEnv();

  if (!env) {
    return { response, user: null, eligible: false, profileStatus: "unknown" as const };
  }

  const { url, publishableKey } = env;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        // Installed SSR package supplies anti-cache headers alongside session cookies.
        Object.entries(headersToSet).forEach(([name, value]) => {
          if (["cache-control", "expires", "pragma"].includes(name.toLowerCase())) authHeaders.set(name, value);
        });
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const pending = response.cookies.getAll();
        response = NextResponse.next({ request });
        authHeaders.forEach((value, name) => response.headers.set(name, value));
        pending.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let user;
  try {
    const identity = await supabase.auth.getUser();
    if (identity.error || !identity.data.user) return { response, user: null, eligible: false, profileStatus: "unknown" as const };
    user = identity.data.user;
  } catch { return { response, user: null, eligible: false, profileStatus: "unknown" as const }; }
  try { user = await requireBracUser(supabase); }
  catch { return { response, user, eligible: false, profileStatus: "unknown" as const }; }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("department")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { response, user, eligible: true, profileStatus: "unknown" as const };
  }

  return {
    response,
    user,
    eligible: true,
    profileStatus: profile?.department ? ("complete" as const) : ("incomplete" as const),
  };
}
