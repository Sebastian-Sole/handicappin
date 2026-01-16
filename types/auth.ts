import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(3),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const passwordResetPayloadSchema = z.object({
  metadata: z.object({
    type: z.literal("password-reset"),
  }),
  email: z.string().email(),
  user_id: z.string(),
  exp: z.number(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  otp: z.string().length(6, "Code must be 6 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type PasswordResetPayload = z.infer<typeof passwordResetPayloadSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

export type signupSchema = z.infer<typeof signupSchema>;
