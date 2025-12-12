import { z } from "https://esm.sh/zod@3.24.1";

export const passwordResetJwtPayloadSchema = z.object({
    user_id: z.string().uuid(),
    email: z.string().email(),
    exp: z.number(),
    metadata: z.object({
        type: z.literal("password-reset"),
    }),
});

export type PasswordResetJwtPayload = z.infer<
    typeof passwordResetJwtPayloadSchema
>;

export const emailChangeJwtPayloadSchema = z.object({
  user_id: z.string().uuid(),
  old_email: z.string().email(),
  new_email: z.string().email(),
  exp: z.number(),
  metadata: z.object({
    type: z.literal("email-change-verification"),
  }),
});

export type EmailChangeJwtPayload = z.infer<typeof emailChangeJwtPayloadSchema>;
