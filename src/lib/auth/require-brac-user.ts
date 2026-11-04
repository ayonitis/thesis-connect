import type { SupabaseClient, User } from "@supabase/supabase-js";
import { BRAC_ACCESS_MESSAGE, validateBracEmail } from "./email-policy";

export type EligibilityCode = "AUTH_REQUIRED" | "AUTH_UNAVAILABLE" | "ANONYMOUS_OR_UNKNOWN" | "EMAIL_UNVERIFIED" | "EMAIL_INELIGIBLE" | "ELIGIBILITY_UNAVAILABLE" | "ELIGIBILITY_DENIED";
export class BracEligibilityError extends Error {
  constructor(public readonly code: EligibilityCode) { super(BRAC_ACCESS_MESSAGE); this.name = "BracEligibilityError"; }
}

// Server callers MUST supply the cookie-bound server client, not a service-role client.
// Also reusable by browser loaders as defense in depth. No cached result or caller flags.
export async function requireBracUser(supabase: SupabaseClient): Promise<User> {
  let result;
  try { result = await supabase.auth.getUser(); }
  catch { throw new BracEligibilityError("AUTH_UNAVAILABLE"); }
  if (result.error) throw new BracEligibilityError("AUTH_UNAVAILABLE");
  const user = result.data?.user;
  if (!user) throw new BracEligibilityError("AUTH_REQUIRED");
  if (user.is_anonymous !== false) throw new BracEligibilityError("ANONYMOUS_OR_UNKNOWN");
  if (!validateBracEmail(user.email).ok) throw new BracEligibilityError("EMAIL_INELIGIBLE");
  if (!user.email_confirmed_at || !Number.isFinite(Date.parse(user.email_confirmed_at))) {
    throw new BracEligibilityError("EMAIL_UNVERIFIED");
  }
  // This narrowly exposed no-argument RPC reads CURRENT auth.users state in SQL.
  // Missing migration, permission failure and non-boolean responses all deny access.
  let eligibility;
  try { eligibility = await supabase.rpc("current_user_is_brac_eligible"); }
  catch { throw new BracEligibilityError("ELIGIBILITY_UNAVAILABLE"); }
  if (eligibility.error) throw new BracEligibilityError("ELIGIBILITY_UNAVAILABLE");
  if (eligibility.data !== true) throw new BracEligibilityError("ELIGIBILITY_DENIED");
  return user;
}

export async function clearRejectedBracSession(
  supabase: SupabaseClient,
  assertCookiePersistence: () => void = () => {},
): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    assertCookiePersistence();
    if (error) return false;
    const current = await supabase.auth.getSession();
    assertCookiePersistence();
    return !current.error && current.data.session === null;
  } catch { return false; }
}
