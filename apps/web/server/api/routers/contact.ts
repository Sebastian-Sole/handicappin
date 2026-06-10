import { z } from "zod";
import { publicProcedure, createTRPCRouter } from "../trpc";
import { TRPCError } from "@trpc/server";
import { contactRateLimit } from "@/lib/rate-limit";
import {
  sendContactFormEmail,
  sendContactConfirmationEmail,
} from "@/lib/email-service";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const contactRouter = createTRPCRouter({
  submit: publicProcedure
    .input(contactFormSchema)
    .mutation(async ({ input, ctx }) => {
      // Extract IP for rate limiting (unauthenticated endpoint)
      const forwarded = ctx.headers.get("x-forwarded-for");
      const realIp = ctx.headers.get("x-real-ip");
      const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
      const identifier = `ip:${ip}`;

      // Check rate limit
      const { success } = await contactRateLimit.limit(identifier);

      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Too many contact form submissions. Please try again in a minute.",
        });
      }

      // Send notification email to admin
      const adminResult = await sendContactFormEmail({
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
      });

      if (!adminResult.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send your message. Please try again later.",
        });
      }

      // Send confirmation email to user
      await sendContactConfirmationEmail({
        to: input.email,
        name: input.name,
      });

      return { success: true };
    }),
});
