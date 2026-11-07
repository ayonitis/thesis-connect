"use client";

import { BRAC_EMAIL_MESSAGE, validateBracEmail } from "@/lib/auth/email-policy";

import { authErrorMessage, validateRegistrationPassword } from "@/lib/auth/auth-feedback";
import { clearRejectedBracSession } from "@/lib/auth/require-brac-user";
import Link from "next/link";
import { useState } from "react";
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

    const emailResult = validateBracEmail(email, true);
    if (!emailResult.ok) {
      setError(BRAC_EMAIL_MESSAGE);
      return;
    }

    const passwordError = validateRegistrationPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/verify-email?status=verified")}`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailResult.email,
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
        setError(authErrorMessage(signUpError, "signup"));
        return;
      }

      // Confirmation-required projects intentionally obscure duplicate-account responses.
      // Do not infer account existence from identities or a fabricated user object.
      if (data.session && !await clearRejectedBracSession(supabase)) {
        setError("Sign out of this session before continuing, then open Verify Email for guidance.");
        return;
      }
      setSuccess("Check your BRAC University inbox for a verification link before signing in. If you already have an account, sign in or reset your password. You can request another link on the Verify Email page.");
      setPassword("");
    } catch {
      setError(authErrorMessage(null, "signup"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/sign-in" title="Create your account" />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
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
                minLength={10}
                aria-describedby="password-guidance"
              />
            </label>

            <p id="password-guidance" className="text-sm text-[#4B5563]">Use at least 10 characters, including punctuation or a special character.</p>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
            {success ? <p className="text-sm text-[#166534]">{success}</p> : null}

            <Button type="button" variant="auth" className="w-full" onClick={handleSignUp} disabled={isLoading}>
              {isLoading ? "Registering..." : "Register with email"}
            </Button>
          </div>

          <p className="mt-4 text-sm text-[#4B5563]">
            <Link href="/verify-email" className="text-[#2459A9] hover:underline">Verify email or resend confirmation</Link><br />
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
