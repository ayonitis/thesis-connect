// Allowlisted Auth codes only: never interpolate upstream messages or diagnostics.
export function validateRegistrationPassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[!-/:-@[-`{-~]/.test(password)) return "Password must include at least one punctuation or special character.";
  return null;
}

export function authErrorMessage(error: unknown, action: "signup" | "signin" | "resend" | "password"): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; status?: unknown } : {};
  if (value.status === 429 || value.code === "over_request_rate_limit" || value.code === "over_email_send_rate_limit") {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  switch (value.code) {
    case "user_already_exists": case "email_exists":
      return "An account already exists for this email. Sign in or reset your password.";
    case "email_not_confirmed":
      return "Please verify your email before signing in. Open your confirmation email or request another on the Verify Email page.";
    case "weak_password":
      return "Use at least 10 characters including punctuation. Your password must also meet the university account security requirements.";
    case "email_address_invalid": case "validation_failed":
      return "Check your email address and the required fields, then try again.";
    case "email_address_not_authorized":
      return "This email cannot receive confirmation right now. Contact support if it is your BRAC University address.";
    case "invalid_credentials":
      return "The email or password is incorrect. Try again or reset your password.";
    case "signup_disabled":
      return "New registrations are currently unavailable. Please try again later.";
    case "otp_expired":
      return "This confirmation link has expired. Request a new verification email.";
    default:
      if (action === "signup") return "Registration is temporarily unavailable. Please try again later or contact support if it continues.";
      if (action === "resend") return "We could not send a verification email. Try again later or contact support.";
      if (action === "password") return "Your password could not be updated. Try again or request a new recovery link.";
      return "Sign-in is temporarily unavailable. Please try again later.";
  }
}
