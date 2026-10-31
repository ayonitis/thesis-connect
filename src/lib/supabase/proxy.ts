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
  const env = getSupabaseEnv();

  if (!env) {
    return { response, user: null, profileStatus: "unknown" as const };
  }

  const { url, publishableKey } = env;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, user: null, profileStatus: "unknown" as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("department")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { response, user, profileStatus: "unknown" as const };
  }

  return {
    response,
    user,
    profileStatus: profile?.department ? ("complete" as const) : ("incomplete" as const),
  };
}
