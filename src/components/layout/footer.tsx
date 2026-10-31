"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#E0E2E6] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[#646A73] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Thesis Connect is intended for BRAC University students and is not affiliated with or endorsed by BRAC University.
        </p>
        <nav aria-label="Footer links" className="flex items-center gap-4">
          <Link className="hover:text-[#191C21]" href="/about">
            About
          </Link>
          <Link className="hover:text-[#191C21]" href="/community-guidelines">
            Community Guidelines
          </Link>
          <Link className="hover:text-[#191C21]" href="/privacy">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
