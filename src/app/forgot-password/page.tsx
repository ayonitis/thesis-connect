"use client";

import { useState } from "react";
import { AuthStatus } from "@/components/auth/auth-status";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleResetRequest = async () => {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "If an account exists for this email, a password recovery link has been sent. Please check your inbox.",
      );
    } catch {
      setError("Unable to send recovery instructions right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/sign-in" title="Password Recovery" description="Request a recovery link for your account email." />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <AuthStatus />
          <label className="mt-4 block text-sm">
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

          {error ? <p className="mt-3 text-sm text-[#B42318]">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-[#166534]">{success}</p> : null}

          <Button type="button" className="mt-4 w-full" onClick={handleResetRequest} disabled={isLoading}>
            {isLoading ? "Sending..." : "Send recovery link"}
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
