import { z } from "https://esm.sh/zod@3.24.1";

export const passwordResetJwtPayloadSchema = z.object({
    user_id: z.string(),
    exp: z.number(),
    metadata: z.object({
        type: z.string(),
    }),
    email: z.string(),
});

export type PasswordResetJwtPayload = z.infer<
    typeof passwordResetJwtPayloadSchema
>;
