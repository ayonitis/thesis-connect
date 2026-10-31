import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safeInternalPath(path: string | null, fallback = "/") {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  return path;
}

function sanitizeReason(value: string | null) {
  if (!value) return null;
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return cleaned.slice(0, 80);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");
  const next = safeInternalPath(requestUrl.searchParams.get("next"), "/");

  if (oauthError) {
    const signInUrl = new URL("/sign-in", requestUrl.origin);
    signInUrl.searchParams.set("error", "oauth_cancelled_or_failed");

    const reason = sanitizeReason(oauthError) ?? sanitizeReason(oauthErrorDescription);
    if (reason) {
      signInUrl.searchParams.set("reason", reason);
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[auth/callback] OAuth provider error", {
        oauthError: sanitizeReason(oauthError),
        reason,
      });
    }

    return NextResponse.redirect(signInUrl);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[auth/callback] Code exchange failed", {
        reason: sanitizeReason(error.message),
      });
    }

    const signInUrl = new URL("/sign-in", requestUrl.origin);
    signInUrl.searchParams.set("error", "auth_callback_failed");

    const reason = sanitizeReason(error.message);
    if (reason) {
      signInUrl.searchParams.set("reason", reason);
    }

    return NextResponse.redirect(signInUrl);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
      }

      const verifiedUrl = new URL("/verify-email", requestUrl.origin);
      verifiedUrl.searchParams.set("status", "verified");
      return NextResponse.redirect(verifiedUrl);
    }

    const verifyUrl = new URL("/verify-email", requestUrl.origin);
    verifyUrl.searchParams.set("error", "invalid_or_expired_link");
    return NextResponse.redirect(verifyUrl);
  }

  const verifyUrl = new URL("/verify-email", requestUrl.origin);
  verifyUrl.searchParams.set("error", "missing_callback_params");
  return NextResponse.redirect(verifyUrl);
}
