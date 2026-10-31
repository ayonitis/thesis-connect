import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="About Thesis Connect" />
        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5 text-sm text-[#4B5563]">
          <p>
            Thesis Connect is a student-centered platform concept for finding thesis teammates and exploring supervision experiences.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
