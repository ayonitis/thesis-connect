import { redirect } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { StudentProfileForm } from "@/components/profile/student-profile-form";
import { LinkButton } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requireBracUser } from "@/lib/auth/require-brac-user";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient().catch(() => redirect("/sign-in?error=brac_access_required"));
  const admin = await requireAdmin(supabase).then(() => true, () => false);
  if (admin) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader fallbackHref="/" title="Profile" />
          <section className="rounded-2xl border border-[#E0E2E6] p-5">
            <h2 className="mb-3 font-semibold">Administrator account</h2>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/admin" variant="primary">Admin Panel</LinkButton>
              <LinkButton href="/sign-out" variant="secondary">Sign out</LinkButton>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  try {
    await requireBracUser(supabase);
  } catch {
    redirect("/sign-in?error=brac_access_required");
  }
  return <StudentProfileForm />;
}
