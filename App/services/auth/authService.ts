import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { upsertOwnProfile } from "@/services/profile/profileService";
import { AuthProviderName } from "@/types/auth";

WebBrowser.maybeCompleteAuthSession();

export const authRedirectTo = AuthSession.makeRedirectUri({
  scheme: "questlife",
  path: "auth/callback",
});

export const resetPasswordRedirectTo = AuthSession.makeRedirectUri({
  scheme: "questlife",
  path: "reset-password",
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
}

export class EmailNotVerifiedError extends Error {
  email: string;

  constructor(email: string) {
    super("EMAIL_NOT_VERIFIED");
    this.email = email;
    this.name = "EmailNotVerifiedError";
  }
}

export class EmailVerificationDisabledError extends Error {
  constructor() {
    super("EMAIL_VERIFICATION_DISABLED");
    this.name = "EmailVerificationDisabledError";
  }
}

export class AccountAlreadyExistsError extends Error {
  email: string;

  constructor(email: string) {
    super("ACCOUNT_ALREADY_EXISTS");
    this.email = email;
    this.name = "AccountAlreadyExistsError";
  }
}

export class EmailAlreadyConfirmedError extends Error {
  constructor() {
    super("EMAIL_ALREADY_CONFIRMED");
    this.name = "EmailAlreadyConfirmedError";
  }
}

export class UsernameUnavailableError extends Error {
  constructor() {
    super("USERNAME_UNAVAILABLE");
    this.name = "UsernameUnavailableError";
  }
}

export type RegistrationAccountState = "available" | "unverified" | "verified" | "invalid_email";

export function isUserEmailVerified(user: {
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
}) {
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

function isEmailNotConfirmedError(error: { message?: string }) {
  return error.message?.toLowerCase().includes("email not confirmed") ?? false;
}

function isAlreadyRegisteredError(error: { message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return message.includes("already registered") || message.includes("already exists");
}

function isAlreadyConfirmedError(error: { message?: string }) {
  return error.message?.toLowerCase().includes("already confirmed") ?? false;
}

export async function signInWithEmail(email: string, password: string) {
  assertSupabaseConfigured();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      await resendSignupConfirmationLink(normalizedEmail);
      throw new EmailNotVerifiedError(normalizedEmail);
    }

    throw error;
  }

  if (data.user && !isUserEmailVerified(data.user)) {
    await supabase.auth.signOut();
    await resendSignupConfirmationLink(normalizedEmail);
    throw new EmailNotVerifiedError(normalizedEmail);
  }
}

export async function getRegistrationAccountState(email: string): Promise<RegistrationAccountState> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_public_account_registration_state", {
    raw_email: normalizeEmail(email),
  });

  if (error) throw error;

  const status = (data as { status?: RegistrationAccountState } | null)?.status;
  return status ?? "available";
}

export async function isUsernameAvailable(username: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("is_username_available", {
    raw_username: username.trim(),
  });

  if (error) throw error;
  return Boolean(data);
}

export async function registerWithEmail(email: string, username: string, password: string) {
  assertSupabaseConfigured();
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username.trim();
  const [accountState, usernameAvailable] = await Promise.all([
    getRegistrationAccountState(normalizedEmail),
    isUsernameAvailable(normalizedUsername),
  ]);

  if (accountState === "verified") {
    throw new AccountAlreadyExistsError(normalizedEmail);
  }

  if (!usernameAvailable) {
    throw new UsernameUnavailableError();
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        username: normalizedUsername,
      },
      emailRedirectTo: authRedirectTo,
    },
  });

  if (error) {
    if (isAlreadyRegisteredError(error)) {
      throw new AccountAlreadyExistsError(normalizedEmail);
    }

    throw error;
  }

  if (data.user && data.user.identities?.length === 0) {
    const state = await getRegistrationAccountState(normalizedEmail);
    if (state === "unverified") {
      throw new EmailNotVerifiedError(normalizedEmail);
    }
    throw new AccountAlreadyExistsError(normalizedEmail);
  }

  if (data.session || (data.user && isUserEmailVerified(data.user))) {
    await supabase.auth.signOut();
    throw new EmailVerificationDisabledError();
  }

  return { email: normalizedEmail };
}

export async function exchangeAuthCodeForSession(code: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  if (data.user?.email && isUserEmailVerified(data.user)) {
    await upsertOwnProfile({
      email: normalizeEmail(data.user.email),
      id: data.user.id,
    });
  }

  return data;
}

export async function resendSignupConfirmationLink(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resend({
    email: normalizeEmail(email),
    type: "signup",
    options: {
      emailRedirectTo: authRedirectTo,
    },
  });

  if (error) {
    if (isAlreadyConfirmedError(error)) {
      throw new EmailAlreadyConfirmedError();
    }

    throw error;
  }
}

export async function sendPasswordReset(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    {
      redirectTo: resetPasswordRedirectTo,
    },
  );

  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  assertSupabaseConfigured();
  // A device-level logout is the expected behavior for the in-app account action.
  // It clears this app's persisted session without unexpectedly ending sessions on
  // the user's other phones, tablets, or browsers.
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
}

export async function openOAuth(provider: AuthProviderName) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo);
  if (result.type !== "success") {
    return;
  }

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code;

  if (typeof code === "string") {
    await exchangeAuthCodeForSession(code);
  }
}
