import { secureAuthStorage } from "@/lib/secureAuthStorage";

const REMEMBERED_EMAIL_KEY = "questlife.last-used-email.v1";
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getRememberedEmail() {
  const email = await secureAuthStorage.getItem(REMEMBERED_EMAIL_KEY);
  const normalizedEmail = email ? normalizeEmail(email) : "";
  return EMAIL_PATTERN.test(normalizedEmail) ? normalizedEmail : "";
}

export async function rememberEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalizedEmail)) return;
  await secureAuthStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
}
