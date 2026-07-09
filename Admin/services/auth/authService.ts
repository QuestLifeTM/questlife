import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { SUPABASE_CONFIG_ERROR } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { upsertOwnProfile } from "@/services/profile/profileService";
import { AuthProviderName } from "@/types/auth";
import { AdminLoginState } from "@/types/content";

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

  await acceptAdminInvite();
}

export async function getAdminLoginState(email: string): Promise<AdminLoginState> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc("get_admin_login_state", {
    raw_email: normalizeEmail(email),
  });

  if (error) throw error;

  return data as AdminLoginState;
}

export async function acceptAdminInvite() {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc("accept_admin_invite");

  if (error) throw error;
}

export async function createAdminPassword(email: string, password: string) {
  assertSupabaseConfigured();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
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
    throw new AccountAlreadyExistsError(normalizedEmail);
  }

  if (data.user && isUserEmailVerified(data.user)) {
    await upsertOwnProfile({
      email: normalizedEmail,
      id: data.user.id,
    });
  }

  if (data.session) {
    await acceptAdminInvite();
  }

  return { email: normalizedEmail, needsVerification: !data.session };
}

export async function registerWithEmail(email: string, password: string) {
  assertSupabaseConfigured();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
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
    await acceptAdminInvite();
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
  const { error } = await supabase.auth.signOut();

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
