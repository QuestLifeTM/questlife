import { secureAuthStorage } from "@/lib/secureAuthStorage";

const ONBOARDING_USERNAME_DRAFT_KEY = "questlife.onboarding.username-draft.v1";

/** Stores a local draft only; it never reserves or creates a username remotely. */
export async function getOnboardingUsernameDraft() {
  return secureAuthStorage.getItem(ONBOARDING_USERNAME_DRAFT_KEY);
}

export async function saveOnboardingUsernameDraft(username: string) {
  await secureAuthStorage.setItem(ONBOARDING_USERNAME_DRAFT_KEY, username);
}

export async function clearOnboardingUsernameDraft() {
  await secureAuthStorage.removeItem(ONBOARDING_USERNAME_DRAFT_KEY);
}
