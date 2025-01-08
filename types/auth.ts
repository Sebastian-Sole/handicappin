import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(3),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const passwordResetPayloadSchema = z.object({
  metadata: z.object({
    type: z.literal("password-reset"),
  }),
  email: z.string().email(),
  user_id: z.string(),
  exp: z.number(),
});

export type PasswordResetPayload = z.infer<typeof passwordResetPayloadSchema>;

export type signupSchema = z.infer<typeof signupSchema>;
