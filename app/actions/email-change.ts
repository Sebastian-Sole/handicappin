"use server";

import { createServerComponentClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyOTPHash } from "@/lib/otp-utils";
import { logger } from "@/lib/logging";

const OTP_MAX_ATTEMPTS = 5;

interface VerifyEmailChangeResult {
  success: boolean;
  error?: string;
}

export async function verifyEmailChangeOtp(
  email: string,
  otp: string
): Promise<VerifyEmailChangeResult> {
  try {
    const supabase = await createServerComponentClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate inputs
    if (!email || !otp) {
      return { success: false, error: "Email and OTP are required" };
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return { success: false, error: "Invalid OTP format" };
    }

    // Lookup pending change by user's current email (old_email)
    const { data: pendingChange, error: lookupError } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("old_email", email)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lookupError || !pendingChange) {
      return {
        success: false,
        error: "No pending email change found for this email",
      };
    }

    const { user_id, new_email } = pendingChange;

    // Check expiration
    const now = new Date();
    // Parse timestamp correctly - Postgres stores timestamps without timezone
    // but they're actually in UTC, so we need to append 'Z' if missing
    const expiresAtString = pendingChange.expires_at;
    const expiresAt = new Date(
      expiresAtString.endsWith("Z") ? expiresAtString : `${expiresAtString}Z`
    );

    if (now > expiresAt) {
      // Clean up expired record
      await supabase
        .from("pending_email_changes")
        .delete()
        .eq("user_id", user_id);

      return {
        success: false,
        error:
          "Verification code has expired. Please request a new email change.",
      };
    }

    // Check rate limit
    if (pendingChange.verification_attempts >= OTP_MAX_ATTEMPTS) {
      return {
        success: false,
        error:
          "Too many verification attempts. Please request a new email change.",
      };
    }

    // Verify OTP against stored hash
    const isValid = await verifyOTPHash(otp, pendingChange.token_hash);

    if (!isValid) {
      // Increment attempts on failure
      await supabase
        .from("pending_email_changes")
        .update({
          verification_attempts: pendingChange.verification_attempts + 1,
        })
        .eq("user_id", user_id);

      const remainingAttempts =
        OTP_MAX_ATTEMPTS - (pendingChange.verification_attempts + 1);

      return {
        success: false,
        error: `Invalid verification code. ${remainingAttempts} attempt${
          remainingAttempts !== 1 ? "s" : ""
        } remaining.`,
      };
    }

    // OTP is valid! Update email using admin client
    const supabaseAdmin = createAdminClient();

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email: new_email,
      });

    if (authUpdateError) {
      logger.error("Failed to update auth.users email", {
        error: authUpdateError.message,
        userId: user_id,
      });
      return {
        success: false,
        error: "Failed to update email. Please try again or contact support.",
      };
    }

    // First, verify the row still exists before attempting delete
    // Delete pending change record (success!) - use admin client to bypass RLS
    const { error: deleteError } = await supabaseAdmin
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user_id)
      .select();

    // Verify it was actually deleted
    if (deleteError) {
      logger.error("Failed to delete pending email change", {
        error: deleteError.message,
        userId: user_id,
      });
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in verifyEmailChangeOtp", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
