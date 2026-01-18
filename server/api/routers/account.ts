import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../trpc";
import { cancelAllUserSubscriptions } from "@/lib/stripe-account";
import { createHash } from "crypto";
import { Resend } from "resend";
import { AccountDeletionOtpEmail } from "@/emails/account-deletion-otp";
import { AccountDeletedEmail } from "@/emails/account-deleted";
import { createAdminClient } from "@/utils/supabase/admin";
import { deletionRateLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";
import { OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS } from "@/lib/otp-constants";
import { storeOtp, getOtp, incrementAttempts, deleteOtp } from "@/lib/otp-store";
import { generateOTP } from "@/lib/otp-utils";
import * as Sentry from "@sentry/nextjs";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const otp = generateOTP();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in Redis (overwrite any existing)
    await storeOtp(userId, {
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
        react: AccountDeletionOtpEmail({ otp, email: userEmail, expiresInMinutes: OTP_EXPIRY_MINUTES }),
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: "account_deletion",
          step: "send_otp_email",
        },
        contexts: {
          account: {
            userId,
            email: userEmail,
          },
        },
        level: "error",
      });
      await deleteOtp(userId);
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

      // Get stored OTP from Redis
      const stored = await getOtp(userId);

      if (!stored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No deletion request found. Please request a new verification code.",
        });
      }

      // Check expiry
      if (new Date() > stored.expiresAt) {
        await deleteOtp(userId);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new one.",
        });
      }

      // Check attempts
      if (stored.attempts >= OTP_MAX_ATTEMPTS) {
        await deleteOtp(userId);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many incorrect attempts. Please request a new verification code.",
        });
      }

      // Verify OTP
      const inputHash = hashOtp(input.otp);
      if (inputHash !== stored.hash) {
        const remainingAttempts = OTP_MAX_ATTEMPTS - stored.attempts - 1;
        await incrementAttempts(userId);

        // Warn when approaching max attempts (potential brute force or confused user)
        if (remainingAttempts <= 1) {
          Sentry.captureMessage("Account deletion OTP approaching max attempts", {
            level: "warning",
            tags: {
              operation: "account_deletion",
              step: "otp_verification",
            },
            contexts: {
              account: {
                userId,
                email: userEmail,
                remainingAttempts,
                totalAttempts: stored.attempts + 1,
              },
            },
          });
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Incorrect verification code. ${remainingAttempts} attempts remaining.`,
        });
      }

      // OTP verified - proceed with deletion
      await deleteOtp(userId);

      // Wrap entire deletion flow in a Sentry span for performance tracking
      return await Sentry.startSpan(
        {
          op: "account.deletion",
          name: "Delete User Account",
        },
        async (span) => {
          span.setAttribute("userId", userId);
          span.setAttribute("email", userEmail);

          // Step 1: Cancel all Stripe subscriptions
          const stripeResult = await Sentry.startSpan(
            {
              op: "stripe.cancel_subscriptions",
              name: "Cancel Stripe Subscriptions",
            },
            async (stripeSpan) => {
              const result = await cancelAllUserSubscriptions(userId);
              stripeSpan.setAttribute("success", result.success);
              stripeSpan.setAttribute("cancelledCount", result.cancelledCount);
              return result;
            }
          );

          if (!stripeResult.success) {
            // CRITICAL: Do NOT continue deletion if Stripe cancellation fails
            // Stripe will continue charging the payment method on file indefinitely
            console.error("Failed to cancel subscriptions:", stripeResult.error);

            Sentry.captureException(new Error(stripeResult.error ?? "Unknown Stripe cancellation error"), {
              tags: {
                operation: "account_deletion",
                step: "stripe_cancellation",
                financial_risk: "true",
                deletion_blocked: "true",
              },
              contexts: {
                account: {
                  userId,
                  email: userEmail,
                },
                stripe: {
                  error: stripeResult.error,
                  cancelledCount: stripeResult.cancelledCount,
                },
              },
              level: "error",
            });

            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to cancel your subscription. Please contact support at support@handicappin.com before deleting your account.",
            });
          }

          const supabaseAdmin = createAdminClient();

          // Step 2: Delete rounds first (BEFORE profile)
          // This is necessary because the round table has an AFTER DELETE trigger that
          // tries to INSERT into handicap_calculation_queue. If we delete profile first,
          // the cascade-delete of rounds would fire the trigger, but the FK constraint
          // would fail because profile is already gone.
          // By deleting rounds while profile exists, the trigger can create queue entries,
          // which will then cascade-delete when we delete the profile.
          const { error: roundsDeleteError } = await Sentry.startSpan(
            {
              op: "db.delete",
              name: "Delete User Rounds",
            },
            async () => {
              const result = await supabaseAdmin
                .from("round")
                .delete()
                .eq("userId", userId);
              return result;
            }
          );

          if (roundsDeleteError) {
            Sentry.captureException(roundsDeleteError, {
              tags: {
                operation: "account_deletion",
                step: "delete_rounds",
              },
              contexts: {
                account: {
                  userId,
                  email: userEmail,
                },
                database: {
                  table: "round",
                  error: roundsDeleteError.message,
                  code: roundsDeleteError.code,
                },
              },
              level: "error",
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to delete account. Please try again.",
            });
          }

          // Step 3: Delete profile using Supabase admin client (bypasses RLS)
          // This cascades to remaining related data (handicap_calculation_queue, etc.)
          const { error: profileDeleteError } = await Sentry.startSpan(
            {
              op: "db.delete",
              name: "Delete User Profile",
            },
            async () => {
              const result = await supabaseAdmin
                .from("profile")
                .delete()
                .eq("id", userId);
              return result;
            }
          );

          if (profileDeleteError) {
            Sentry.captureException(profileDeleteError, {
              tags: {
                operation: "account_deletion",
                step: "delete_profile",
              },
              contexts: {
                account: {
                  userId,
                  email: userEmail,
                },
                database: {
                  table: "profile",
                  error: profileDeleteError.message,
                  code: profileDeleteError.code,
                },
              },
              level: "error",
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to delete account. Please try again.",
            });
          }

          // Step 4: Delete auth user from Supabase
          const { error: authDeleteError } = await Sentry.startSpan(
            {
              op: "auth.delete",
              name: "Delete Auth User",
            },
            async () => {
              const result = await supabaseAdmin.auth.admin.deleteUser(userId);
              return result;
            }
          );

          if (authDeleteError) {
            // Profile already deleted, so we can't really recover here
            // The auth user will be orphaned but that's acceptable
            Sentry.captureException(authDeleteError, {
              tags: {
                operation: "account_deletion",
                step: "delete_auth_user",
                orphaned_auth: "true",
              },
              contexts: {
                account: {
                  userId,
                  email: userEmail,
                },
                auth: {
                  error: authDeleteError.message,
                  code: authDeleteError.code,
                },
              },
              level: "warning",
            });
          }

          // Step 5: Send confirmation email
          try {
            await Sentry.startSpan(
              {
                op: "email.send",
                name: "Send Deletion Confirmation Email",
              },
              async () => {
                await resend.emails.send({
                  from: "Handicappin' <noreply@handicappin.com>",
                  to: userEmail,
                  subject: "Your account has been deleted",
                  react: AccountDeletedEmail({ email: userEmail }),
                });
              }
            );
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                operation: "account_deletion",
                step: "send_confirmation_email",
              },
              contexts: {
                account: {
                  userId,
                  email: userEmail,
                },
              },
              level: "warning",
            });
            // Don't fail the deletion for this
          }

          span.setAttribute("subscriptionsCancelled", stripeResult.cancelledCount);

          return {
            success: true,
            message: "Your account has been permanently deleted.",
            subscriptionsCancelled: stripeResult.cancelledCount,
          };
        }
      );
    }),

  // Cancel deletion request (clear OTP)
  cancelDeletion: authedProcedure.mutation(async ({ ctx }) => {
    await deleteOtp(ctx.user.id);
    return { success: true };
  }),
});
