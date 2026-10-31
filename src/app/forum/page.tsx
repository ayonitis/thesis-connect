import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/button";

export default function ForumPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="Thesis Forum" />

        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-6">
          <p className="text-[#485262]">
            A dedicated space for thesis-related questions, discussions, and peer support.
          </p>
          <span className="mt-4 inline-flex rounded-full border border-[#D6DBE3] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold tracking-[0.04em] text-[#324053]">
            Coming Soon
          </span>

          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/" variant="secondary">
              Return to homepage
            </LinkButton>
            <LinkButton href="/partners" variant="primary">
              Explore partner rooms
            </LinkButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
