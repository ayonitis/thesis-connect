"use client";

export function AuthStatus() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <p
      className={`rounded-xl border px-3 py-2 text-xs ${
        hasSupabase ? "border-[#B7DEC2] bg-[#EDF9F0] text-[#14532D]" : "border-[#F0D9A8] bg-[#FFF8E8] text-[#92400E]"
      }`}
    >
      {hasSupabase
        ? "Supabase authentication is configured through environment variables."
        : "Authentication UI is connected to Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable live sign-in."}
    </p>
  );
}
