export const BRAC_EMAIL_MESSAGE = "Use your BRAC University email ending in @g.bracu.ac.bd (without + aliases).";
export const BRAC_ACCESS_MESSAGE = "Sign in with your verified BRAC University email to continue.";
export type EmailPolicyCode = "EMAIL_REQUIRED" | "EMAIL_MALFORMED" | "EMAIL_PLUS_NOT_ALLOWED" | "EMAIL_DOMAIN_NOT_ALLOWED";
export type EmailPolicyResult = { ok: true; email: string } | { ok: false; code: EmailPolicyCode };

// Input normalization is explicit. Never trim persisted Auth values.
export function normalizeEmailInput(value: string): string {
  return value.replace(/^[\x09-\x0d\x20]+|[\x09-\x0d\x20]+$/g, "");
}

export function validateBracEmail(value: unknown, userInput = false): EmailPolicyResult {
  if (typeof value !== "string" || value.length === 0) return { ok: false, code: "EMAIL_REQUIRED" };
  const email = userInput ? normalizeEmailInput(value) : value;
  if (!email) return { ok: false, code: "EMAIL_REQUIRED" };
  // ASCII dot-atom mailbox: quoted/display-name/Unicode/control syntax is rejected.
  if (email.length > 254 || /[^\x21-\x7e]/.test(email) || email.split("@").length !== 2) {
    return { ok: false, code: "EMAIL_MALFORMED" };
  }
  const [local, domain] = email.split("@");
  if (local.includes("+")) return { ok: false, code: "EMAIL_PLUS_NOT_ALLOWED" };
  if (local.length > 64 || !/^[A-Za-z0-9!#$%&'*\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*\/=?^_`{|}~-]+)*$/.test(local)) {
    return { ok: false, code: "EMAIL_MALFORMED" };
  }
  if (domain.toLowerCase() !== "g.bracu.ac.bd") return { ok: false, code: "EMAIL_DOMAIN_NOT_ALLOWED" };
  return { ok: true, email };
}
