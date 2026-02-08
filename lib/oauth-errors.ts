/**
 * Shared OAuth error messages used across login and signup components.
 * Error codes are set by the OAuth callback route (app/auth/callback/route.ts).
 */
export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_cancelled: "Sign-in was cancelled. Please try again.",
  oauth_unsupported:
    "This sign-in method is not supported. Please try a different option.",
  oauth_provider_error:
    "Something went wrong with sign-in. Please try again.",
  oauth_no_email:
    "No email address was provided by the sign-in provider. Please try a different sign-in method.",
  oauth_invalid_email:
    "The email address from the sign-in provider is invalid. Please try a different sign-in method.",
  oauth_account_creation_failed:
    "Failed to create your account. Please try again.",
  rate_limit_exceeded:
    "Too many sign-in attempts. Please wait a moment and try again.",
};

const DEFAULT_OAUTH_ERROR =
  "Something went wrong with sign-in. Please try again.";

export function getOAuthErrorMessage(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] ?? DEFAULT_OAUTH_ERROR;
}
