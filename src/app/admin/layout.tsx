import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin(await createClient());
  } catch {
    redirect("/sign-in?next=/admin&error=admin_access_required");
  }
  return <>{children}</>;
}
