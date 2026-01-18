# GDPR Account Control Implementation Plan

## Overview

Implement GDPR-compliant account control features that give users full control over their data. This includes the ability to export all their data in JSON format and permanently delete their account (including automatic Stripe subscription cancellation).

## Current State Analysis

**Existing User Data Tables with Cascade Delete:**
- `profile` - Core user data, handicap, billing fields
- `round` - Golf rounds (FK → profile, cascade delete)
- `score` - Individual hole scores (FK → profile, cascade delete)
- `stripeCustomers` - Stripe customer mapping (FK → profile, cascade delete)
- `emailPreferences` - Notification settings (FK → profile, cascade delete)
- `pendingEmailChanges` - Email verification workflow (FK → profile, cascade delete)
- `handicapCalculationQueue` - Calculation queue (FK → profile, cascade delete)
- `webhookEvents` - Stripe webhook history (FK → profile, SET NULL) - preserved for audit

**Key Infrastructure Already in Place:**
- RLS policies allow users to delete their own profile (`db/schema.ts:90-95`)
- OTP verification system exists for email changes (edge functions)
- Email service via Resend is configured
- Supabase admin client for auth operations

**What's Missing:**
- Data export API endpoint and UI
- Account deletion API endpoint and UI
- Stripe subscription cancellation on deletion
- OTP verification for account deletion
- Deletion confirmation email template

## Desired End State

After implementation:
1. Users can click "Export Data" and receive a JSON download of all their data
2. Users can request account deletion, receive an OTP via email, verify it, and their account is permanently deleted
3. Active Stripe subscriptions are automatically cancelled before account deletion
4. Users receive a confirmation email after their account is deleted
5. All features are accessible from the existing Settings tab in the profile page

### Verification:
- Data export returns comprehensive JSON with profile, rounds, scores, and preferences
- Account deletion with active subscription properly cancels in Stripe before deleting
- OTP flow works correctly with 6-digit code
- Confirmation email is sent after successful deletion
- Database cascade deletes remove all user data except webhook audit logs

## What We're NOT Doing

- PDF or CSV export formats (JSON only for simplicity)
- Waiting/recovery period (immediate deletion)
- Password re-entry confirmation (OTP via email instead)
- New database tables for deletion requests (immediate deletion, no staging)
- Admin override/force delete functionality
- Batch export/deletion tools

## Implementation Approach

The implementation follows a layered approach:
1. **Phase 1**: Data Export - Simple JSON export API and UI
2. **Phase 2**: Account Deletion Backend - tRPC procedures, Stripe cancellation, Supabase auth deletion
3. **Phase 3**: OTP Verification Flow - Edge function for deletion OTP, verification
4. **Phase 4**: UI Integration - Settings tab updates with export button and deletion flow

---

## Phase 1: Data Export Feature

### Overview
Create a tRPC endpoint to gather all user data and return it as a downloadable JSON file.

### Changes Required:

#### 1. Create Data Export tRPC Procedure

**File**: `server/api/routers/auth.ts`
**Changes**: Add new `exportUserData` query procedure

```typescript
// Add to existing imports
import { db } from "@/db";
import { profile, round, score, emailPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

// Add new procedure to authRouter
exportUserData: authedProcedure.query(async ({ ctx }) => {
  const userId = ctx.user.id;

  // Fetch profile data
  const profileData = await db.select().from(profile).where(eq(profile.id, userId)).limit(1);

  // Fetch all rounds with course info
  const roundsData = await db.query.round.findMany({
    where: eq(round.userId, userId),
    with: {
      course: true,
      tee: true,
    },
  });

  // Fetch all scores
  const scoresData = await db.select().from(score).where(eq(score.userId, userId));

  // Fetch email preferences
  const preferencesData = await db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).limit(1);

  // Construct export object
  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: profileData[0] ? {
      id: profileData[0].id,
      email: profileData[0].email,
      name: profileData[0].name,
      handicapIndex: profileData[0].handicapIndex,
      initialHandicapIndex: profileData[0].initialHandicapIndex,
      verified: profileData[0].verified,
      createdAt: profileData[0].createdAt,
      planSelected: profileData[0].planSelected,
      planSelectedAt: profileData[0].planSelectedAt,
    } : null,
    rounds: roundsData.map(r => ({
      id: r.id,
      playedAt: r.teeTime,
      courseName: r.course?.name,
      courseCity: r.course?.city,
      courseCountry: r.course?.country,
      teeName: r.tee?.name,
      teeGender: r.tee?.gender,
      holesPlayed: r.holesPlayed,
      totalStrokes: r.totalStrokes,
      adjustedGrossScore: r.adjustedGrossScore,
      scoreDifferential: r.scoreDifferential,
      courseHandicap: r.courseHandicap,
      courseRatingUsed: r.courseRatingUsed,
      slopeRatingUsed: r.slopeRatingUsed,
      notes: r.notes,
      createdAt: r.createdAt,
    })),
    scores: scoresData.map(s => ({
      id: s.id,
      roundId: s.roundId,
      holeId: s.holeId,
      strokes: s.strokes,
      hcpStrokes: s.hcpStrokes,
    })),
    emailPreferences: preferencesData[0] ? {
      featureUpdates: preferencesData[0].featureUpdates,
    } : null,
    totalRounds: roundsData.length,
  };

  return exportData;
}),
```

#### 2. Create Data Export UI Component

**File**: `components/profile/data-export-section.tsx` (new file)
**Changes**: Create new component for data export button

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";

export function DataExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportMutation = api.auth.exportUserData.useQuery(undefined, {
    enabled: false, // Don't auto-fetch
    refetchOnWindowFocus: false,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.refetch();

      if (result.data) {
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `handicappin-data-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Export complete",
          description: "Your data has been downloaded.",
        });
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-xl font-semibold mb-2">Export Your Data</h3>
      <p className="text-muted-foreground mb-4">
        Download a copy of all your data including your profile, rounds, and scores in JSON format.
      </p>
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </>
        )}
      </Button>
    </div>
  );
}
```

#### 3. Integrate into Settings Tab

**File**: `components/profile/tabs/settings-tab.tsx`
**Changes**: Import and add DataExportSection component after existing sections

```typescript
// Add import at top
import { DataExportSection } from "../data-export-section";

// Add after the Theme Section div (around line 178), before the Save Button
<DataExportSection />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] tRPC type inference works for new procedure

#### Manual Verification:
- [ ] Clicking "Export Data" downloads a JSON file
- [ ] JSON contains all expected fields (profile, rounds, scores, preferences)
- [ ] Export works for users with 0 rounds
- [ ] Export works for users with many rounds
- [ ] File name includes current date

---

## Phase 2: Account Deletion Backend

### Overview
Create the backend infrastructure for account deletion including Stripe subscription cancellation and Supabase auth user deletion.

### Changes Required:

#### 1. Create Stripe Subscription Cancellation Utility

**File**: `lib/stripe-account.ts` (new file)
**Changes**: Create utility for cancelling all user subscriptions

```typescript
import { stripe } from "./stripe";
import { db } from "@/db";
import { stripeCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Cancel all active Stripe subscriptions for a user
 * Returns true if successful or if no subscriptions exist
 */
export async function cancelAllUserSubscriptions(userId: string): Promise<{
  success: boolean;
  cancelledCount: number;
  error?: string;
}> {
  try {
    // Get user's Stripe customer ID
    const customer = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (!customer || customer.length === 0) {
      // No Stripe customer - nothing to cancel
      return { success: true, cancelledCount: 0 };
    }

    const customerId = customer[0].stripeCustomerId;

    // Get all active/trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
    });

    const activeSubscriptions = subscriptions.data.filter(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    // Cancel each subscription immediately (not at period end)
    let cancelledCount = 0;
    for (const subscription of activeSubscriptions) {
      await stripe.subscriptions.cancel(subscription.id, {
        prorate: false, // Don't issue refunds
      });
      cancelledCount++;
    }

    return { success: true, cancelledCount };
  } catch (error) {
    console.error("Failed to cancel subscriptions:", error);
    return {
      success: false,
      cancelledCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete Stripe customer record (optional - can keep for audit)
 * Note: We don't actually delete from Stripe, just remove our mapping
 */
export async function cleanupStripeCustomer(userId: string): Promise<boolean> {
  try {
    await db
      .delete(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId));
    return true;
  } catch (error) {
    console.error("Failed to cleanup Stripe customer:", error);
    return false;
  }
}
```

#### 2. Create Account Deletion Email Template

**File**: `emails/account-deleted.tsx` (new file)
**Changes**: Create React Email template for deletion confirmation

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface AccountDeletedEmailProps {
  email: string;
}

export const AccountDeletedEmail = ({ email }: AccountDeletedEmailProps) => (
  <Html>
    <Head />
    <Preview>Your Handicappin&apos; account has been deleted</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Account Deleted</Heading>
        <Text style={text}>
          This email confirms that your Handicappin&apos; account associated with{" "}
          <strong>{email}</strong> has been permanently deleted.
        </Text>
        <Text style={text}>
          All your data including your profile, rounds, and scores have been removed from our systems.
          {" "}Any active subscriptions have been cancelled.
        </Text>
        <Text style={text}>
          If you did not request this deletion, please contact us immediately at{" "}
          <Link href="mailto:support@handicappin.com" style={link}>
            support@handicappin.com
          </Link>
        </Text>
        <Text style={footer}>
          We&apos;re sorry to see you go. If you ever want to return, you&apos;re always welcome to create a new account.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  marginBottom: "64px",
  borderRadius: "8px",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.25",
  marginBottom: "24px",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};

const footer = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.5",
  marginTop: "32px",
};

export default AccountDeletedEmail;
```

#### 3. Create Deletion OTP Email Template

**File**: `emails/account-deletion-otp.tsx` (new file)
**Changes**: Create React Email template for deletion OTP

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface AccountDeletionOtpEmailProps {
  otp: string;
}

export const AccountDeletionOtpEmail = ({ otp }: AccountDeletionOtpEmailProps) => (
  <Html>
    <Head />
    <Preview>Confirm your account deletion - {otp}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm Account Deletion</Heading>
        <Text style={text}>
          You requested to permanently delete your Handicappin&apos; account.
        </Text>
        <Text style={text}>
          <strong>This action cannot be undone.</strong> All your data including your profile,
          rounds, and scores will be permanently deleted. Any active subscriptions will be cancelled.
        </Text>
        <Text style={codeText}>
          Your verification code is:
        </Text>
        <Text style={code}>{otp}</Text>
        <Text style={text}>
          This code will expire in 10 minutes.
        </Text>
        <Text style={footer}>
          If you did not request this deletion, you can safely ignore this email. Your account will remain active.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  marginBottom: "64px",
  borderRadius: "8px",
};

const h1 = {
  color: "#dc2626",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.25",
  marginBottom: "24px",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const codeText = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "8px",
};

const code = {
  backgroundColor: "#fee2e2",
  borderRadius: "8px",
  color: "#dc2626",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "0.25em",
  padding: "16px 24px",
  textAlign: "center" as const,
  marginBottom: "24px",
};

const footer = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.5",
  marginTop: "32px",
};

export default AccountDeletionOtpEmail;
```

#### 4. Create Account Deletion tRPC Procedures

**File**: `server/api/routers/account.ts` (new file)
**Changes**: Create new router for account operations

```typescript
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../trpc";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cancelAllUserSubscriptions } from "@/lib/stripe-account";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { AccountDeletionOtpEmail } from "@/emails/account-deletion-otp";
import { AccountDeletedEmail } from "@/emails/account-deleted";
import { createAdminClient } from "@/utils/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory OTP store (for production, use Redis or database)
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
      throw new Error("User email not found");
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
        react: AccountDeletionOtpEmail({ otp }),
      });
    } catch (error) {
      console.error("Failed to send deletion OTP email:", error);
      deletionOtpStore.delete(userId);
      throw new Error("Failed to send verification email. Please try again.");
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
        throw new Error("User email not found");
      }

      // Get stored OTP
      const stored = deletionOtpStore.get(userId);

      if (!stored) {
        throw new Error("No deletion request found. Please request a new verification code.");
      }

      // Check expiry
      if (new Date() > stored.expiresAt) {
        deletionOtpStore.delete(userId);
        throw new Error("Verification code has expired. Please request a new one.");
      }

      // Check attempts
      if (stored.attempts >= MAX_OTP_ATTEMPTS) {
        deletionOtpStore.delete(userId);
        throw new Error("Too many incorrect attempts. Please request a new verification code.");
      }

      // Verify OTP
      const inputHash = hashOtp(input.otp.toUpperCase());
      if (inputHash !== stored.hash) {
        stored.attempts++;
        throw new Error(`Incorrect verification code. ${MAX_OTP_ATTEMPTS - stored.attempts} attempts remaining.`);
      }

      // OTP verified - proceed with deletion
      deletionOtpStore.delete(userId);

      // Step 1: Cancel all Stripe subscriptions
      const stripeResult = await cancelAllUserSubscriptions(userId);
      if (!stripeResult.success) {
        console.error("Failed to cancel subscriptions during account deletion:", stripeResult.error);
        // Continue with deletion anyway - subscriptions will fail to renew
      }

      // Step 2: Delete profile (cascades to all related data)
      await db.delete(profile).where(eq(profile.id, userId));

      // Step 3: Delete auth user from Supabase
      const supabaseAdmin = createAdminClient();
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.error("Failed to delete auth user:", authDeleteError);
        // Profile already deleted, so we can't really recover here
        // The auth user will be orphaned but that's acceptable
      }

      // Step 4: Send confirmation email
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
```

#### 5. Register Account Router

**File**: `server/api/root.ts`
**Changes**: Import and add accountRouter to the app router

```typescript
// Add import
import { accountRouter } from "./routers/account";

// Add to createTRPCRouter object
export const appRouter = createTRPCRouter({
  // ... existing routers
  account: accountRouter,
});
```

#### 6. Create Supabase Admin Client

**File**: `utils/supabase/admin.ts` (new file)
**Changes**: Create admin client for auth operations

```typescript
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Create a Supabase admin client with service role key
 * Use only on the server for admin operations like deleting users
 */
export function createAdminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] tRPC type inference works for new procedures

#### Manual Verification:
- [ ] `requestDeletion` sends OTP email successfully
- [ ] `confirmDeletion` with correct OTP deletes account
- [ ] `confirmDeletion` with wrong OTP increments attempts
- [ ] Active Stripe subscriptions are cancelled
- [ ] Profile and related data is deleted from database
- [ ] Auth user is deleted from Supabase
- [ ] Confirmation email is sent

---

## Phase 3: Account Deletion UI

### Overview
Create the UI components for the account deletion flow in the Settings tab.

### Changes Required:

#### 1. Create Account Deletion Section Component

**File**: `components/profile/account-deletion-section.tsx` (new file)
**Changes**: Create component for account deletion flow

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

type DeletionStep = "initial" | "confirm" | "verify-otp";

export function AccountDeletionSection() {
  const [step, setStep] = useState<DeletionStep>("initial");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const requestDeletionMutation = api.account.requestDeletion.useMutation({
    onSuccess: (data) => {
      setExpiresAt(data.expiresAt);
      setStep("verify-otp");
      setIsLoading(false);
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit code.",
      });
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmDeletionMutation = api.account.confirmDeletion.useMutation({
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      // Redirect to home page
      router.push("/");
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelDeletionMutation = api.account.cancelDeletion.useMutation();

  const handleRequestDeletion = () => {
    setIsLoading(true);
    requestDeletionMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    confirmDeletionMutation.mutate({ otp });
  };

  const handleCancel = () => {
    cancelDeletionMutation.mutate();
    setStep("initial");
    setOtp("");
    setExpiresAt(null);
  };

  return (
    <div className="bg-card rounded-lg border border-destructive/20 p-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xl font-semibold text-destructive">Delete Account</h3>
          <p className="text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
      </div>

      {step === "initial" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This will permanently delete your account including:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Your profile and handicap history</li>
                  <li>All your rounds and scores</li>
                  <li>Your notification preferences</li>
                  <li>Any active subscriptions (will be cancelled)</li>
                </ul>
                <p className="font-medium mt-4">
                  This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRequestDeletion}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {step === "verify-otp" && (
        <div className="space-y-4 mt-4 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <div>
            <Label htmlFor="otp" className="text-destructive font-medium">
              Enter verification code
            </Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              We sent a 6-digit code to your email. Enter it below to confirm deletion.
            </p>
            <Input
              id="otp"
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase().slice(0, 6))}
              className="font-mono text-lg tracking-widest text-center"
              maxLength={6}
              autoComplete="one-time-code"
            />
            {expiresAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Code expires at {new Date(expiresAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2. Integrate into Settings Tab

**File**: `components/profile/tabs/settings-tab.tsx`
**Changes**: Import and add AccountDeletionSection after DataExportSection

```typescript
// Add import at top
import { AccountDeletionSection } from "../account-deletion-section";

// Add after DataExportSection, before the Save Button div
// Around line 180 (after DataExportSection)
<AccountDeletionSection />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Delete Account button appears in Settings tab
- [ ] Clicking button shows confirmation dialog
- [ ] Confirming sends OTP email and shows verification input
- [ ] Entering correct OTP deletes account and redirects
- [ ] Entering wrong OTP shows error with remaining attempts
- [ ] Cancel button returns to initial state
- [ ] UI is visually consistent with rest of settings page

---

## Phase 4: Rate Limiting and Security

### Overview
Add rate limiting to prevent abuse of the deletion OTP system.

### Changes Required:

#### 1. Add Rate Limiting to Account Router

**File**: `server/api/routers/account.ts`
**Changes**: Add rate limiting to requestDeletion mutation

```typescript
// Add import at top
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Add rate limiter configuration
const deletionRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 requests per hour
  analytics: true,
  prefix: "ratelimit:deletion",
});

// Update requestDeletion mutation to include rate limiting
requestDeletion: authedProcedure.mutation(async ({ ctx }) => {
  const userId = ctx.user.id;
  const userEmail = ctx.user.email;

  if (!userEmail) {
    throw new Error("User email not found");
  }

  // Rate limit check
  const { success: rateLimitSuccess, remaining } = await deletionRateLimit.limit(userId);
  if (!rateLimitSuccess) {
    throw new Error("Too many deletion requests. Please try again later.");
  }

  // ... rest of the existing code
}),
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Rate limiting is properly configured

#### Manual Verification:
- [ ] More than 3 requests per hour are blocked
- [ ] Rate limit error message is user-friendly

---

## Testing Strategy

### Unit Tests:

**File**: `test/unit/lib/stripe-account.test.ts`

1. Test `cancelAllUserSubscriptions`:
   - Returns success with 0 count when no customer exists
   - Returns success with correct count when subscriptions cancelled
   - Handles Stripe API errors gracefully

**File**: `test/unit/server/account-router.test.ts`

1. Test OTP generation and hashing
2. Test OTP expiry logic
3. Test attempt counting

### Integration Tests:

**File**: `test/integration/account-deletion.test.ts`

1. Test full deletion flow with mocked Stripe
2. Test cascade deletion of related data
3. Test email sending

### Manual Testing Steps:

1. Create test account with several rounds
2. Add active subscription via Stripe test mode
3. Request account deletion
4. Verify OTP email received
5. Enter OTP and confirm deletion
6. Verify:
   - Redirected to home page
   - Cannot log in with same credentials
   - Confirmation email received
   - Stripe subscription shows as cancelled
   - Database shows no records for user

---

## Performance Considerations

1. **OTP Storage**: Currently using in-memory Map. For production scale:
   - Consider Redis for multi-instance deployments
   - Or use database table with cleanup job

2. **Cascade Deletes**: For users with many rounds/scores:
   - PostgreSQL handles this efficiently
   - No need for batch deletion

3. **Stripe API Calls**:
   - Subscription list and cancel are fast
   - No pagination needed (users typically have 0-1 subscriptions)

---

## Migration Notes

No database migrations required. All new functionality uses:
- Existing tables with existing cascade delete behavior
- In-memory OTP storage (or Redis in production)
- New files/components only

---

## References

- Database schema: `db/schema.ts:28-97` (profile), `db/schema.ts:216-293` (round), `db/schema.ts:298-355` (score)
- Existing OTP pattern: `supabase/functions/request-email-change/index.ts`
- Stripe utilities: `lib/stripe.ts`, `lib/stripe-customer.ts`
- Settings tab: `components/profile/tabs/settings-tab.tsx`
- Email service: `lib/email-service.ts`
