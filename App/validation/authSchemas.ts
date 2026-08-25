import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .regex(/[a-z]/, "Password needs a lowercase letter.")
  .regex(/[A-Z]/, "Password needs an uppercase letter.")
  .regex(/\d/, "Password needs a number.")
  .regex(/[^A-Za-z0-9]/, "Password needs a special character.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const signUpPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    password: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password."),
    password: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type LoginForm = z.infer<typeof loginSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type SignUpPasswordForm = z.infer<typeof signUpPasswordSchema>;
