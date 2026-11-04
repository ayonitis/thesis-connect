export function getSafeInternalRedirectPath(input: string | null | undefined, fallback = "/") {
  if (!input) return fallback;
  if (/[\\\x00-\x20\x7f]/.test(input)) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  return input;
}
