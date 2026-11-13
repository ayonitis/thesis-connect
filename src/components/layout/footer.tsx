import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/how-to-use", label: "How to Use" },
  { href: "/guidelines-privacy", label: "Guidelines & Privacy" },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[#E0E2E6] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-[#191C21]">Thesis Connect</p>
          <p className="mt-1 text-[#646A73]">An independent student platform for the BRAC University community.</p>
        </div>
        <nav aria-label="Footer links" className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded-sm py-2 font-medium text-[#374151] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
