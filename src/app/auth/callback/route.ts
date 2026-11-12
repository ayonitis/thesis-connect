import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/server";
import { requireBracUser, clearRejectedBracSession } from "@/lib/auth/require-brac-user";
import { getSafeInternalRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = (destination: URL) => NextResponse.redirect(destination, {
    headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" },
  });
  const next = getSafeInternalRedirectPath(url.searchParams.get("next"), "/");
  const destination = new URL(next, url.origin);
  const isAdminPath = destination.pathname === "/admin" || destination.pathname.startsWith("/admin/");
  const denied = () => redirect(new URL(
    isAdminPath ? "/sign-in?next=/admin&error=admin_access_required" : "/sign-in?error=brac_access_required",
    url.origin,
  ));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const otpTypes = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
  // Unrelated GETs must never mutate an existing session or even construct an Auth client.
  if (url.searchParams.has("error") || (!code && !(tokenHash && type && otpTypes.includes(type)))) return denied();
  let context;
  try { context = await createRouteClient(); }
  catch { return denied(); }
  const { supabase, assertCookiePersistence } = context;
  let establishedToken: string | null = null;
  let cleanupAttempted = false;
  const rejectFlow = async () => {
    if (establishedToken && !cleanupAttempted) {
      cleanupAttempted = true;
      try {
        // Never clear a different session that may have replaced this callback's session.
        const current = await supabase.auth.getSession();
        if (!current.error && current.data.session?.access_token === establishedToken) {
          const cleared = await clearRejectedBracSession(supabase, assertCookiePersistence);
          if (!cleared) {
            return redirect(new URL("/sign-in?error=session_cleanup_failed", url.origin));
          }
        }
      } catch {
        return redirect(new URL("/sign-in?error=session_cleanup_failed", url.origin));
      }
    }
    return denied();
  };
  try {
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as EmailOtpType });
    // A rejected/throwing exchange is not proof that a new session was established.
    if (result.error) return await rejectFlow();
    establishedToken = result.data.session?.access_token || null;
    assertCookiePersistence();
    if (code && (isAdminPath || next === "/")) {
      if (!establishedToken) return await rejectFlow();
      const { data, error } = await supabase.auth.getUser(establishedToken);
      if (error || !data.user) return await rejectFlow();

      const user = data.user;
      if (user.email?.toLowerCase() === "ayon3015@gmail.com" &&
          user.is_anonymous === false && user.email_confirmed_at &&
          Number.isFinite(Date.parse(user.email_confirmed_at))) {
        const admin = await supabase.rpc("is_admin");
        assertCookiePersistence();
        if (admin.error || typeof admin.data !== "boolean") return await rejectFlow();
        if (admin.data) return redirect(isAdminPath ? destination : new URL("/admin", url.origin));

        // Keep the verified Auth session available for operator bootstrap.
        return redirect(new URL("/sign-in?next=/admin&status=admin_pending", url.origin));
      }

      if (isAdminPath) return await rejectFlow();
    }
    await requireBracUser(supabase);
    assertCookiePersistence();
    if (!code) {
      return redirect(new URL(type === "recovery" ? "/reset-password" : "/verify-email?status=verified", url.origin));
    }
    return redirect(destination);
  } catch {
    return await rejectFlow();
  }
}
