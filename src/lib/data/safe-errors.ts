export type SafeDataCode = "BUSINESS_RULE" | "ACCESS_DENIED" | "DATA_CONFLICT" | "RELATED_RECORD_UNAVAILABLE" | "DATA_UNAVAILABLE";
type DatabaseError = { message?: string; code?: string };
const businessMessages: Readonly<Record<string, string>> = Object.freeze({
  "authentication required": "Sign in to continue.",
  "complete profile display name and department are required": "Complete your profile name and department first.",
  "profile is required": "Complete your profile first.",
  "invalid room input": "Check the room details and try again.",
  "invalid application input": "Check the application details and try again.",
  "room is not open": "This room is not accepting applications.",
  "host cannot apply to own room": "You cannot apply to your own room.",
  "pending application not found": "This pending application is no longer available.",
  "invalid decision": "Choose a valid decision.",
  "invalid host note": "Check the host note and try again.",
  "application is not pending": "This application has already been decided or withdrawn.",
  "room not found": "This room is unavailable.",
  "not authorized": "You do not have permission to perform this action.",
  "room is closed": "This room is closed.",
  "room has no remaining capacity": "This room has no remaining places.",
  "invalid review content": "Check the review ratings and text.",
  "review not found": "This review is unavailable or cannot be changed by this account.",
  "admin required": "Administrator access is required.",
  "invalid decision note": "Check the decision note and try again.",
  "request is not pending": "This request has already been decided.",
  "request name cannot produce a slug": "Choose a different faculty name.",
  "invalid visibility": "Choose a valid review visibility.",
  "active faculty not found": "This faculty member is unavailable.",
  "review already exists for this faculty": "You have already reviewed this faculty member.",
  "invalid faculty request input": "Check the faculty request details.",
  "a matching faculty request is already pending": "You already have a matching faculty request awaiting review."
});

export class SafeDataError extends Error {
  constructor(public readonly code: SafeDataCode, message: string) { super(message); this.name = "SafeDataError"; }
}

export function toSafeDataError(error: DatabaseError): SafeDataError {
  if (error.code === "P0001" && typeof error.message === "string" && Object.hasOwn(businessMessages, error.message)) {
    return new SafeDataError("BUSINESS_RULE", businessMessages[error.message]);
  }
  if (error.code === "42501") return new SafeDataError("ACCESS_DENIED", "You do not have permission to perform this action.");
  if (error.code === "23505") return new SafeDataError("DATA_CONFLICT", "A matching record already exists. Check your existing records.");
  if (error.code === "23503") return new SafeDataError("RELATED_RECORD_UNAVAILABLE", "A related record is unavailable. Refresh and try again.");
  return new SafeDataError("DATA_UNAVAILABLE", "The request could not be completed. Please try again.");
}

export function throwSafeDataError(error: DatabaseError): never {
  const safe = toSafeDataError(error);
  if (process.env.NODE_ENV === "development") {
    // Fixed enum only: never log raw message, details, hint, SQL, IDs, tokens or user input.
    console.warn("[Thesis Connect data request failed]", { code: safe.code });
  }
  throw safe;
}
