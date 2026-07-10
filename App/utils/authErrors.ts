import { AuthError } from "@supabase/supabase-js";

import {
  AccountAlreadyExistsError,
  EmailAlreadyConfirmedError,
  EmailNotVerifiedError,
  EmailVerificationDisabledError,
  UsernameUnavailableError,
} from "@/services/auth/authService";

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof EmailNotVerifiedError) {
    return "Please verify your email before signing in.";
  }

  if (error instanceof EmailVerificationDisabledError) {
    return "Email verification is not enabled for this project. Please check your authentication settings.";
  }

  if (error instanceof AccountAlreadyExistsError) {
    return "An account with this email already exists.";
  }

  if (error instanceof EmailAlreadyConfirmedError) {
    return "This email is already confirmed. Please log in.";
  }

  if (error instanceof UsernameUnavailableError) {
    return "That username is already taken.";
  }

  const message =
    error instanceof AuthError || error instanceof Error
      ? error.message.toLowerCase()
      : "";

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with this email already exists.";
  }

  if (message.includes("already confirmed")) {
    return "This email is already confirmed. Please log in.";
  }

  if (message.includes("invalid email")) {
    return "Enter a valid email address.";
  }

  if (message.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }

  if (message.includes("otp") || message.includes("token")) {
    return "The verification link is invalid or expired.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  if (message.includes("rate") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (message.includes("jwt") || message.includes("session")) {
    return "Your session expired. Please sign in again.";
  }

  return "Something went wrong. Please try again.";
}
