/**
 * Mask email address for security notifications
 * Example: john.doe@example.com → jo****@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "***@***.***";

  const atIndex = email.indexOf("@");
  if (atIndex === -1) return "***@***.***";

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  // Show first 2 characters of local part
  const visibleChars = Math.min(2, localPart.length);
  const masked = localPart.slice(0, visibleChars) + "****";

  return masked + domain;
}
