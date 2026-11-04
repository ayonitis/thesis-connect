import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export class CookiePersistenceError extends Error {
  readonly code = "AUTH_COOKIE_PERSISTENCE_FAILED";
  constructor() { super("Authentication session could not be saved. Please try again."); }
}

async function createContext(writable: boolean) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication configuration is unavailable.");
  let cookieWriteFailed = false;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        // Server Components are read-only; proxy handles refresh persistence there.
        // Route handlers MUST use createRouteClient and check its persistence state.
        if (!writable) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          cookieWriteFailed = true;
          throw new CookiePersistenceError();
        }
      },
    },
  });
  return {
    supabase,
    assertCookiePersistence() {
      // Sticky: catches failures even if the Auth SDK converts a thrown adapter error.
      if (cookieWriteFailed) throw new CookiePersistenceError();
    },
  };
}

export async function createClient(): Promise<SupabaseClient> {
  return (await createContext(false)).supabase;
}

export async function createRouteClient() {
  return createContext(true);
}
