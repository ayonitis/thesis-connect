import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function requireAdmin(supabase: SupabaseClient): Promise<User> {
  const identity = await supabase.auth.getUser();
  const user = identity.data?.user;
  if (identity.error || !user || user.is_anonymous !== false || !user.email_confirmed_at) {
    throw new Error("Administrator access is required.");
  }

  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) throw new Error("Administrator access is required.");
  return user;
}
