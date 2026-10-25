import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { validateUsername } from "@/validation/username";
import { upsertOwnProfile } from "@/services/profile/profileService";
import { AuthProviderName } from "@/types/auth";
import { rememberEmail } from "@/services/auth/rememberedEmail";

WebBrowser.maybeCompleteAuthSession();

const webAppOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "https://app.myquestlife.app";
const isWeb = Platform.OS === "web";

const appAuthRedirectTo = isWeb
  ? `${webAppOrigin}/auth/callback`
  : AuthSession.makeRedirectUri({
      scheme: "questlife",
      path: "auth/callback",
    });

const appResetPasswordRedirectTo = isWeb
  ? `${webAppOrigin}/reset-password`
  : AuthSession.makeRedirectUri({
      scheme: "questlife",
      path: "reset-password",
    });

// Auth emails land on a branded web handoff before securely forwarding their
// one-time code into the installed app. These URLs must exactly match the
// production Supabase Auth redirect allow-list.
const emailAuthRedirectTo = isWeb ? appAuthRedirectTo : "https://www.myquestlife.app/auth/callback";
const emailResetPasswordRedirectTo = isWeb ? appResetPasswordRedirectTo : "https://www.myquestlife.app/auth/reset-password";

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

/** Starts the passwordless email entry flow used by the welcome sheet. */
export async function sendEmailSignInLink(email: string) {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: emailAuthRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) throw error;
}

export async function isUsernameAvailable(username: string) {
  return (await checkUsernameAvailability(username)).available;
}

export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; reason?: string }> {
  assertSupabaseConfigured();
  const validation = validateUsername(username);
  if (!validation.valid) return { available: false, reason: validation.message };
  const { data, error } = await supabase.functions.invoke("username-availability", {
    body: { username },
  });

  if (error) throw error;
  if (!data || typeof data.available !== "boolean") throw new Error("Invalid username availability response.");
  return { available: data.available, reason: typeof data.reason === "string" ? data.reason : undefined };
}

export async function registerWithEmail(email: string, username: string, firstName: string, lastName: string, password: string) {
  assertSupabaseConfigured();
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) throw new Error(usernameValidation.message);
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: normalizedUsername,
      },
      emailRedirectTo: emailAuthRedirectTo,
    },
  });

  if (error) {
    if (isAlreadyRegisteredError(error)) {
      throw new AccountAlreadyExistsError(normalizedEmail);
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
      redirectTo: emailResetPasswordRedirectTo,
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
      redirectTo: appAuthRedirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, appAuthRedirectTo);
  if (result.type !== "success") {
    return;
  }

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code;

  if (typeof code === "string") {
    await exchangeAuthCodeForSession(code);
  }
}
