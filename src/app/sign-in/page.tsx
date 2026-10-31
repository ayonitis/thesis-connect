"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthStatus } from "@/components/auth/auth-status";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import { getSafeInternalRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

function prettyReason(reason: string | null) {
  if (!reason) return null;
  return reason.replace(/_/g, " ").trim();
}

function queryErrorMessage(error: string | null, reason: string | null) {
  if (!error) return null;

  if (error === "oauth_cancelled_or_failed") {
    if (reason === "access_denied") {
      return "Google sign-in was cancelled. Please try again if you still want to continue.";
    }

    if (reason === "server_error") {
      return "Google sign-in failed due to a provider configuration or server issue. Please verify OAuth setup.";
    }

    const readableReason = prettyReason(reason);
    if (readableReason && process.env.NODE_ENV !== "production") {
      return `Google sign-in failed: ${readableReason}.`;
    }

    return "Google sign-in was cancelled or failed. Please try again.";
  }

  if (error === "auth_callback_failed") {
    const readableReason = prettyReason(reason);
    if (readableReason && process.env.NODE_ENV !== "production") {
      return `Authentication callback failed: ${readableReason}.`;
    }

    return "Authentication callback failed. Please sign in again.";
  }

  return "Authentication failed. Please try again.";
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryReason, setQueryReason] = useState<string | null>(null);
  const [canShowSignOut, setCanShowSignOut] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const rawNext = search.get("next");

    setNextPath(getSafeInternalRedirectPath(rawNext, "/"));
    setQueryError(search.get("error"));
    setQueryReason(search.get("reason"));

    const run = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setCanShowSignOut(Boolean(user));
      } catch {
        setCanShowSignOut(false);
      }
    };

    void run();
  }, []);

  const handleEmailSignIn = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setIsEmailLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("email not confirmed")) {
          setError("Please verify your email before signing in.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch {
      setError("Google sign-in could not be started. Check Supabase and Google OAuth configuration.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const callbackError = queryErrorMessage(queryError, queryReason);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="Sign In" description="Access student-specific features once authentication is fully configured." />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <AuthStatus />

          <div className="mt-4 space-y-3">
            <Button type="button" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isEmailLoading}>
              {isGoogleLoading ? "Starting Google sign-in..." : "Continue with Google"}
            </Button>

            <div className="relative py-1 text-center text-xs text-[#64748B]">
              <span className="bg-white px-2">or</span>
              <div className="absolute left-0 top-1/2 -z-10 h-px w-full bg-[#E4E7EC]" />
            </div>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Email</span>
              <input
                className="tc-input"
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Password</span>
              <input
                className="tc-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            {callbackError ? <p className="text-sm text-[#B42318]">{callbackError}</p> : null}
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

            <Button type="button" className="w-full" onClick={handleEmailSignIn} disabled={isEmailLoading || isGoogleLoading}>
              {isEmailLoading ? "Signing in..." : "Sign in with email"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/forgot-password" className="text-[#2459A9] hover:underline">
              Forgot password?
            </Link>
            <Link href="/verify-email" className="text-[#2459A9] hover:underline">
              Verify email
            </Link>
          </div>

          <p className="mt-5 text-sm text-[#4B5563]">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-[#2459A9] hover:underline">
              Register with email
            </Link>
          </p>

          {canShowSignOut ? (
            <div className="mt-4 border-t border-[#ECEFF3] pt-4">
              <LinkButton href="/sign-out" variant="secondary">
                Sign out
              </LinkButton>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}
