"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function AuthNavigation() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let changed = false;
    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        changed = true;
        if (active) setSignedIn(Boolean(session?.user));
      });
      void supabase.auth.getUser().then(({ data, error }) => {
        if (active && !changed) setSignedIn(!error && Boolean(data.user));
      }).catch(() => { if (active && !changed) setSignedIn(false); });
      return () => { active = false; data.subscription.unsubscribe(); };
    } catch {
      // No private configuration details belong in the navigation.
      void Promise.resolve().then(() => { if (active) setSignedIn(false); });
    }
    return () => { active = false; };
  }, []);

  if (signedIn === null) return <span className="px-4 py-2 text-sm text-white/80" role="status">Loading account…</span>;
  // Navigation is presentation only; profile routes retain server Auth/BRAC guards.
  return <LinkButton href={signedIn ? "/profile" : "/sign-in"} variant={signedIn ? "profile" : "auth"}>
    {signedIn ? "Profile" : "Sign In"}
  </LinkButton>;
}
