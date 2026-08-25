import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { upsertOwnProfile } from "@/services/profile/profileService";
import { AuthProviderName } from "@/types/auth";
import { rememberEmail } from "@/services/auth/rememberedEmail";

WebBrowser.maybeCompleteAuthSession();

const appAuthRedirectTo = AuthSession.makeRedirectUri({
  scheme: "questlife",
  path: "auth/callback",
});

const appResetPasswordRedirectTo = AuthSession.makeRedirectUri({
  scheme: "questlife",
  path: "reset-password",
});

// Email links first show a branded handoff page, then forward the one-time
// code to the installed app. Keep OAuth app-first because it must complete in
// the same native browser session.
const emailAuthRedirectTo = "https://myquestlife.app/auth/callback";
const emailResetPasswordRedirectTo = "https://myquestlife.app/auth/reset-password";

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

  await rememberEmail(normalizedEmail);
}

export async function registerWithEmail(email: string, firstName: string, password: string) {
  assertSupabaseConfigured();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        first_name: firstName.trim(),
      },
      emailRedirectTo: emailAuthRedirectTo,
    },
  });

  if (error) {
    // Do not disclose whether this address belongs to an existing account.
    // Supabase can intentionally return this response when email confirmation
    // is enabled to prevent account enumeration.
    if (isAlreadyRegisteredError(error)) {
      return { email: normalizedEmail };
    }

    throw error;
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
    await rememberEmail(data.user.email);
    await upsertOwnProfile({
      email: normalizeEmail(data.user.email),
      id: data.user.id,
    });
  }

  return data;
}

/** Exchanges a password-recovery code and requires a newly issued session. */
export async function exchangePasswordRecoveryCode(code: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    throw error ?? new Error("PASSWORD_RECOVERY_SESSION_MISSING");
  }

  return data;
}

export async function resendSignupConfirmationLink(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resend({
    email: normalizeEmail(email),
    type: "signup",
    options: {
      emailRedirectTo: emailAuthRedirectTo,
    },
  });

  if (error) {
    if (isAlreadyConfirmedError(error)) {
      // Keep resend responses neutral so this endpoint cannot reveal whether
      // an address already belongs to a confirmed account.
      return;
    }

    throw error;
  }
}

export async function sendPasswordReset(email: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    {
      redirectTo: emailResetPasswordRedirectTo,
    },
  );

  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  assertSupabaseConfigured();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error("AUTHENTICATED_USER_REQUIRED");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  // Preserve the current device's new session while ending sessions that may
  // remain active elsewhere after a recovery-based password change.
  await supabase.auth.signOut({ scope: "others" });
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
      redirectTo: appAuthRedirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("OAUTH_URL_MISSING");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, appAuthRedirectTo);
  if (result.type !== "success") {
    return;
  }

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code;

  if (typeof code === "string") {
    await exchangeAuthCodeForSession(code);
    return;
  }

  throw new Error("OAUTH_CALLBACK_INVALID");
}
