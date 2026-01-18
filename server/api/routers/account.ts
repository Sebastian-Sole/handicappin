import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../trpc";
import { cancelAllUserSubscriptions } from "@/lib/stripe-account";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { AccountDeletionOtpEmail } from "@/emails/account-deletion-otp";
import { AccountDeletedEmail } from "@/emails/account-deleted";
import { createAdminClient } from "@/utils/supabase/admin";
import { deletionRateLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory OTP store (for production scale, consider Redis)
// Key: userId, Value: { hash, expiresAt, attempts }
const deletionOtpStore = new Map<string, {
  hash: string;
  expiresAt: Date;
  attempts: number;
}>();

const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export const accountRouter = createTRPCRouter({
  // Request account deletion - sends OTP email
  requestDeletion: authedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userEmail = ctx.user.email;

    if (!userEmail) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User email not found",
      });
    }

    // Rate limit check
    const { success: rateLimitSuccess } = await deletionRateLimit.limit(userId);
    if (!rateLimitSuccess) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many deletion requests. Please try again later.",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP (overwrite any existing)
    deletionOtpStore.set(userId, {
      hash: otpHash,
      expiresAt,
      attempts: 0,
    });

    // Send OTP email
    try {
      await resend.emails.send({
        from: "Handicappin' <noreply@handicappin.com>",
        to: userEmail,
        subject: "Confirm your account deletion",
        react: AccountDeletionOtpEmail({ otp, email: userEmail }),
      });
    } catch (error) {
      console.error("Failed to send deletion OTP email:", error);
      deletionOtpStore.delete(userId);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send verification email. Please try again.",
      });
    }

    return {
      success: true,
      message: "Verification code sent to your email",
      expiresAt: expiresAt.toISOString(),
    };
  }),

  // Verify OTP and delete account
  confirmDeletion: authedProcedure
    .input(z.object({ otp: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const userEmail = ctx.user.email;

      if (!userEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User email not found",
        });
      }

      // Get stored OTP
      const stored = deletionOtpStore.get(userId);

      if (!stored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No deletion request found. Please request a new verification code.",
        });
      }

      // Check expiry
      if (new Date() > stored.expiresAt) {
        deletionOtpStore.delete(userId);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new one.",
        });
      }

      // Check attempts
      if (stored.attempts >= MAX_OTP_ATTEMPTS) {
        deletionOtpStore.delete(userId);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many incorrect attempts. Please request a new verification code.",
        });
      }

      // Verify OTP
      const inputHash = hashOtp(input.otp.toUpperCase());
      if (inputHash !== stored.hash) {
        stored.attempts++;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Incorrect verification code. ${MAX_OTP_ATTEMPTS - stored.attempts} attempts remaining.`,
        });
      }

      // OTP verified - proceed with deletion
      deletionOtpStore.delete(userId);

      // Step 1: Cancel all Stripe subscriptions
      const stripeResult = await cancelAllUserSubscriptions(userId);
      if (!stripeResult.success) {
        console.error("Failed to cancel subscriptions during account deletion:", stripeResult.error);
        // Continue with deletion anyway - subscriptions will fail to renew
      }

      const supabaseAdmin = createAdminClient();

      // Step 2: Delete rounds first (BEFORE profile)
      // This is necessary because the round table has an AFTER DELETE trigger that
      // tries to INSERT into handicap_calculation_queue. If we delete profile first,
      // the cascade-delete of rounds would fire the trigger, but the FK constraint
      // would fail because profile is already gone.
      // By deleting rounds while profile exists, the trigger can create queue entries,
      // which will then cascade-delete when we delete the profile.
      const { error: roundsDeleteError } = await supabaseAdmin
        .from("round")
        .delete()
        .eq("userId", userId);

      if (roundsDeleteError) {
        console.error("Failed to delete rounds:", roundsDeleteError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete account. Please try again.",
        });
      }

      // Step 3: Delete profile using Supabase admin client (bypasses RLS)
      // This cascades to remaining related data (handicap_calculation_queue, etc.)
      const { error: profileDeleteError } = await supabaseAdmin
        .from("profile")
        .delete()
        .eq("id", userId);

      if (profileDeleteError) {
        console.error("Failed to delete profile:", profileDeleteError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete account. Please try again.",
        });
      }

      // Step 4: Delete auth user from Supabase
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.error("Failed to delete auth user:", authDeleteError);
        // Profile already deleted, so we can't really recover here
        // The auth user will be orphaned but that's acceptable
      }

      // Step 5: Send confirmation email
      try {
        await resend.emails.send({
          from: "Handicappin' <noreply@handicappin.com>",
          to: userEmail,
          subject: "Your account has been deleted",
          react: AccountDeletedEmail({ email: userEmail }),
        });
      } catch (error) {
        console.error("Failed to send deletion confirmation email:", error);
        // Don't fail the deletion for this
      }

      return {
        success: true,
        message: "Your account has been permanently deleted.",
        subscriptionsCancelled: stripeResult.cancelledCount,
      };
    }),

  // Cancel deletion request (clear OTP)
  cancelDeletion: authedProcedure.mutation(async ({ ctx }) => {
    deletionOtpStore.delete(ctx.user.id);
    return { success: true };
  }),
});
