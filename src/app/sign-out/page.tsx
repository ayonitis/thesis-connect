"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import { clearRejectedBracSession } from "@/lib/auth/require-brac-user";
import { createClient } from "@/lib/supabase/client";

export default function SignOutPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const cleared = await clearRejectedBracSession(supabase);
      if (!cleared) {
        setError("Unable to clear this session. Please try signing out again.");
        return;
      }

      setDone(true);
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="Sign Out" description="End your session." />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5">
          {!done ? (
            <>
              <p className="text-sm text-[#4B5563]">Confirm to sign out from your current session.</p>
              {error ? <p className="mt-3 text-sm text-[#B42318]">{error}</p> : null}
              <Button type="button" className="mt-4" onClick={handleSignOut} disabled={isLoading}>
                {isLoading ? "Signing out..." : "Confirm sign out"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-[#14532D]">You have been signed out.</p>
              <LinkButton href="/sign-in" variant="secondary" className="mt-4">
                Return to sign in
              </LinkButton>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
