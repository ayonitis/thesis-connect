"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthStatus } from "@/components/auth/auth-status";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    setSuccess(null);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/verify-email?status=verified")}`;
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            // This key is consumed by public.handle_new_user in the Phase 2B schema.
            display_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccess("Registration submitted. Please check your email and verify your account before signing in.");
      setPassword("");
    } catch {
      setError("Unable to register right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/sign-in" title="Create your account" description="Email-based registration interface for Thesis Connect." />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          <AuthStatus />

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Full name</span>
              <input className="tc-input" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Email</span>
              <input className="tc-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#2F3A4A]">Password</span>
              <input
                className="tc-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
            {success ? <p className="text-sm text-[#166534]">{success}</p> : null}

            <Button type="button" className="w-full" onClick={handleSignUp} disabled={isLoading}>
              {isLoading ? "Registering..." : "Register with email"}
            </Button>
          </div>

          <p className="mt-4 text-sm text-[#4B5563]">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[#2459A9] hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
