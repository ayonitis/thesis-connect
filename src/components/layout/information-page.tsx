import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/layout/page-header";

export function InformationPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader fallbackHref="/" title={title} />
        <div className="space-y-8 leading-relaxed text-[#4B5563]">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
