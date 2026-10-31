export function getSafeInternalRedirectPath(input: string | null | undefined, fallback = "/") {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  return input;
}
