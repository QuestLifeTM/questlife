export const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;

export type UsernameValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; message: string };

/**
 * Client-side feedback only. The database trigger is the source of truth for
 * creation and changes, so this must stay aligned with the server policy.
 */
export function validateUsername(value: string): UsernameValidationResult {
  if (!value) return { valid: false, message: "Choose a username to continue." };
  if (value.length < 3) return { valid: false, message: "Username must be at least 3 characters." };
  if (value.length > 20) return { valid: false, message: "Username must be 20 characters or less." };
  if (!USERNAME_PATTERN.test(value)) return { valid: false, message: "Username can only contain letters, numbers, . and _." };
  if (/^[._]|[._]$/.test(value)) return { valid: false, message: "Username cannot start or end with . or _." };
  if (/[._]{2}/.test(value)) return { valid: false, message: "Username cannot contain consecutive symbols." };
  return { valid: true, normalized: value.toLowerCase() };
}
