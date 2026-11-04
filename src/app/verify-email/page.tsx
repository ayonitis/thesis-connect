"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const errorMap: Record<string, string> = {
  invalid_or_expired_link: "This verification link is invalid or has expired.",
  missing_callback_params: "Verification link is incomplete. Please request a new confirmation email.",
};

export default function VerifyEmailPage() {
  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return { status: null as string | null, error: null as string | null };
    }

    const search = new URLSearchParams(window.location.search);
    return {
      status: search.get("status"),
      error: search.get("error"),
    };
  }, []);

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    setResendError(null);
    setResendMessage(null);

    if (!email.trim()) {
      setResendError("Please enter your email to resend confirmation.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/verify-email?status=verified")}`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo },
      });

      if (error) {
        setResendError("Unable to resend confirmation. Please wait and try again.");
        return;
      }

      setResendMessage("If this account exists and needs confirmation, a new verification email has been sent.");
    } catch {
      setResendError("Unable to resend verification right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/sign-in" title="Verify Email" description="Use your email confirmation link to verify your account." />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <AuthStatus />

          {params.status === "verified" ? (
            <p className="mt-4 text-sm text-[#166534]">Email verified successfully. You can now sign in.</p>
          ) : null}

          {params.error ? (
            <p className="mt-4 text-sm text-[#B42318]">{errorMap[params.error] ?? "Verification failed. Please request a new link."}</p>
          ) : null}

          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block font-medium text-[#2F3A4A]">Email</span>
            <input
              className="tc-input"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          {resendError ? <p className="mt-3 text-sm text-[#B42318]">{resendError}</p> : null}
          {resendMessage ? <p className="mt-3 text-sm text-[#166534]">{resendMessage}</p> : null}

          <Button type="button" className="mt-4 w-full" onClick={handleResend} disabled={isLoading}>
            {isLoading ? "Sending..." : "Resend verification email"}
          </Button>

          <p className="mt-4 text-center text-sm text-[#4B5563]">
            Return to{" "}
            <Link href="/sign-in" className="text-[#2459A9] hover:underline">
              Sign In
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
