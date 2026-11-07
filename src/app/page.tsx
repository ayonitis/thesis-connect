import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { AuthNavigation } from "@/components/auth/auth-navigation";

export const dynamic = "force-dynamic";

function LogoMark() {
  return (
    <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center sm:h-12 sm:w-12 rounded-xl border border-white/35 bg-white/10 text-white">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
        <path d="M6 10.5V16c0 1.2 2.6 2.5 6 2.5s6-1.3 6-2.5v-5.5" />
        <path d="M12 11v7.5" />
      </svg>
    </div>
  );
}

function HomePanel({
  title,
  description,
  href,
  action,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#D9DDE4] bg-[#F6F7F9] p-6 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(25,28,33,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2459A9] focus-visible:ring-offset-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold leading-tight text-[#191C21]">{title}</h2>
          <p className="mt-3 max-w-[46ch] text-sm text-[#48505C]">{description}</p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#1d1d1d] bg-white text-[#1D1D1D]">
          {icon}
        </div>
      </div>
      <span className="mt-8 inline-flex text-sm font-medium text-[#1E4B8F] group-hover:underline">{action}</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <section className="rounded-[34px] bg-[#1D1D1D] p-6 text-white sm:p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LogoMark />
              <p aria-label="THESIS CONNECT" className="m-0 whitespace-nowrap font-sans text-[clamp(0.875rem,3.5vw,1.25rem)] font-semibold leading-none tracking-[0.04em]">
                THESIS CONNECT
              </p>
            </div>
            <AuthNavigation />
          </div>

          <div className="mt-12 max-w-3xl">
            <h1 className="text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.04] text-white">A better way to begin your thesis.</h1>
            <p className="mt-4 max-w-2xl text-base text-white/82 sm:text-lg">
              Find your research partner. Learn from student experiences. Make informed decisions about your thesis journey.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[34px] border border-[#E0E2E6] bg-white p-5 sm:p-6 lg:p-7">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.72fr]">
            <HomePanel
              title="Find your thesis partner"
              description="Connect with students who share your research goals and are looking for compatible teammates."
              href="/partners"
              action="Explore partner rooms"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M7.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M16.5 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M3.5 18.5c.6-2.2 2.7-3.5 5.2-3.5 1.4 0 2.7.4 3.6 1.2" />
                  <path d="M12.3 19c.7-1.7 2.4-2.8 4.4-2.8 1.6 0 3 .7 3.8 1.8" />
                </svg>
              }
            />

            <HomePanel
              title="Supervisor reviews"
              description="Explore student experiences and learn about thesis supervision."
              href="/faculty"
              action="Explore faculty reviews"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M5 6.8A1.8 1.8 0 0 1 6.8 5h10.4A1.8 1.8 0 0 1 19 6.8v10.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 17.2V6.8Z" />
                  <path d="M8 10h8M8 13h8M8 16h5" />
                </svg>
              }
            />

            <Link
              href="/forum"
              className="group flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#D9DDE4] bg-[#F6F7F9] p-6 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(25,28,33,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2459A9] focus-visible:ring-offset-4 lg:min-h-full"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-3xl leading-none text-[#1D1D1D]">Thesis Forum</h2>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[#1D1D1D] bg-white text-[#1D1D1D]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4.5 6.5h15v9h-8l-4 3v-3h-3v-9Z" />
                  </svg>
                </span>
              </div>

              <p className="mt-4 text-sm text-[#4B5563]">Ask questions. Share ideas. Learn together.</p>
              <span className="mt-5 inline-flex w-fit rounded-full border border-[#D6DBE3] bg-white px-3 py-1 text-xs font-semibold tracking-[0.04em] text-[#324053]">
                Coming Soon
              </span>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
