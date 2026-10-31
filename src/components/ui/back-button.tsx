"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
};

export function BackButton({ fallbackHref }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    const hasSameOriginReferrer =
      typeof document !== "undefined" &&
      document.referrer &&
      document.referrer.startsWith(window.location.origin);

    if (window.history.length > 1 && hasSameOriginReferrer) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#D7DBE2] bg-white px-3 py-1.5 text-sm text-[#384150] transition hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2459A9] focus-visible:ring-offset-2"
    >
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
