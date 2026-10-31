import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title="Community Guidelines" />
        <section className="rounded-2xl border border-[#E0E2E6] bg-white p-5 text-sm text-[#4B5563]">
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide respectful, constructive, and experience-based feedback.</li>
            <li>Avoid sharing private personal information in public fields.</li>
            <li>Use room and review forms honestly and responsibly.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
