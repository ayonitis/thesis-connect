"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        setHasRecoverySession(Boolean(data.session));
      } catch {
        setHasRecoverySession(false);
      }
    };

    void run();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!password || password.length < 8) {
      setError("Please enter a new password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("Password update failed. Check the password requirements or request a new recovery link.");
        return;
      }

      setMessage("Your password has been updated successfully. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to update password right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          fallbackHref="/sign-in"
          title="Reset Password"
          description="Set a new password after opening your recovery email link."
        />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          {hasRecoverySession === false ? (
            <div className="space-y-3 text-sm text-[#4B5563]">
              <p>This reset link is invalid, expired, or missing a valid recovery session.</p>
              <Link href="/forgot-password" className="text-[#2459A9] hover:underline">
                Request a new password recovery email
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">New password</span>
                <input
                  className="tc-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#2F3A4A]">Confirm new password</span>
                <input
                  className="tc-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
              {message ? <p className="text-sm text-[#166534]">{message}</p> : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update password"}
              </Button>

              <p className="text-center text-sm text-[#4B5563]">
                Return to{" "}
                <Link href="/sign-in" className="text-[#2459A9] hover:underline">
                  Sign In
                </Link>
              </p>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
