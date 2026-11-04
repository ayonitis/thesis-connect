import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBracUser } from "@/lib/auth/require-brac-user";

// Independent server boundary: protected pages do not rely on proxy execution.
export default async function ProtectedBracLayout({ children }: { children: ReactNode }) {
  try { await requireBracUser(await createClient()); }
  catch { redirect("/sign-in?error=brac_access_required"); }
  return <>{children}</>;
}
