import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[a-z]/, "Password needs a lowercase letter.")
  .regex(/[A-Z]/, "Password needs an uppercase letter.")
  .regex(/\d/, "Password needs a number.");

const username = z
  .string()
  .trim()
  .min(1, "Username is required.")
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be 20 characters or less.")
  .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only.");

const name = (label: string) => z
  .string()
  .trim()
  .min(1, `${label} is required.`)
  .max(80, `${label} must be 80 characters or less.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    email,
    firstName: name("First name"),
    lastName: name("Last name"),
    password,
    username,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    password,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
