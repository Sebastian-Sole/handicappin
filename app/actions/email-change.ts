"use server";

import {
  createServerComponentClient,
  createAdminClient,
} from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyOTPHash } from "@/lib/otp-utils";

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
      console.log("[DEBUG] No pending change found:", { lookupError, email });
      return {
        success: false,
        error: "No pending email change found for this email",
      };
    }

    console.log("[DEBUG] Found pending change:", {
      user_id: pendingChange.user_id,
      created_at: pendingChange.created_at,
      expires_at: pendingChange.expires_at,
      attempts: pendingChange.verification_attempts,
    });

    const { user_id, new_email } = pendingChange;

    // Check expiration
    const now = new Date();
    // Parse timestamp correctly - Postgres stores timestamps without timezone
    // but they're actually in UTC, so we need to append 'Z' if missing
    const expiresAtString = pendingChange.expires_at;
    const expiresAt = new Date(
      expiresAtString.endsWith("Z") ? expiresAtString : `${expiresAtString}Z`
    );

    console.log("[DEBUG] Expiry check:", {
      now: now.toISOString(),
      expiresAtRaw: expiresAtString,
      expiresAt: expiresAt.toISOString(),
      nowTime: now.getTime(),
      expiresAtTime: expiresAt.getTime(),
      isExpired: now > expiresAt,
      hoursRemaining: ((expiresAt.getTime() - now.getTime()) / 1000 / 60 / 60).toFixed(2),
    });

    if (now > expiresAt) {
      // Clean up expired record
      await supabase
        .from("pending_email_changes")
        .delete()
        .eq("user_id", user_id);

      return {
        success: false,
        error: "Verification code has expired. Please request a new email change.",
      };
    }

    // Check rate limit
    if (pendingChange.verification_attempts >= OTP_MAX_ATTEMPTS) {
      return {
        success: false,
        error: "Too many verification attempts. Please request a new email change.",
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
      console.error("Failed to update auth.users email:", authUpdateError);
      return {
        success: false,
        error: "Failed to update email. Please try again or contact support.",
      };
    }

    // First, verify the row still exists before attempting delete
    const { data: beforeDelete, error: beforeError } = await supabaseAdmin
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user_id);

    console.log("[DEBUG] Row before delete:", {
      beforeDelete,
      beforeError,
      user_id,
    });

    // Delete pending change record (success!) - use admin client to bypass RLS
    console.log("[DEBUG] Attempting to delete pending change for user:", user_id);

    const { data: deleteData, error: deleteError, count } = await supabaseAdmin
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user_id)
      .select();

    console.log("[DEBUG] Delete result:", {
      deleteData,
      deleteError,
      count,
      user_id,
    });

    // Verify it was actually deleted
    const { data: afterDelete, error: afterError } = await supabaseAdmin
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user_id);

    console.log("[DEBUG] Row after delete:", {
      afterDelete,
      afterError,
    });

    if (deleteError) {
      console.error("[ERROR] Failed to delete pending email change:", deleteError);
      // Don't fail the whole operation - email was updated successfully
    } else if (!deleteData || deleteData.length === 0) {
      console.warn("[WARNING] Delete executed but no rows were deleted for user:", user_id);
      console.warn("[WARNING] This might be an RLS issue or the row doesn't exist");
    } else {
      console.log("[SUCCESS] Deleted pending email change:", deleteData);
    }

    // Revalidate profile page
    revalidatePath(`/profile/${user_id}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error in verifyEmailChangeOtp:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
