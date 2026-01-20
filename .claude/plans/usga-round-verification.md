# USGA Round Verification Implementation Plan

## Overview

Implement a USGA-compliant round verification system where another player must attest to a scorecard before it affects the user's handicap index. This is separate from the existing course/tee approval system (data quality) and focuses on scorecard attestation (USGA Rule 5.1a requirement).

## Current State Analysis

### Existing Approval System
- `course.approvalStatus`: Data quality - validates course exists and is legitimate
- `teeInfo.approvalStatus`: Data quality - validates tee ratings are accurate
- `round.approvalStatus`: Cascaded from course/tee via database trigger (`cascade_approval_to_rounds`)

### Handicap Calculation Filter
Currently at `app/api/cron/process-handicap-queue/route.ts:152`:
```typescript
.eq("approvalStatus", "approved")
```

### Key Discoveries
- Rounds auto-approve when both course AND tee are approved (cascade trigger)
- No existing user verification/attestation system
- No concept of "verifier" or "attester" in the schema
- Existing rounds need to be grandfathered as verified

## Desired End State

After implementation:
1. New rounds require a verifier email at submission (unless marked as "solo round")
2. Verifiers receive email with magic link to approve/reject the round
3. Registered Handicappin' users see pending verification requests in-app
4. Navbar shows mail icon with badge when user has pending requests to verify
5. Handicap calculation requires BOTH `approvalStatus === "approved"` AND `userVerified === true`
6. Solo rounds are auto-verified (temporary until user base grows)
7. Existing rounds are grandfathered as verified

### Verification Flow Diagram
```
Player submits round
        ↓
    Solo round? ──Yes──→ Auto-verified (userVerified = true)
        │
       No
        ↓
Verifier email provided
        ↓
Round created with userVerified = false
        ↓
Verification request created with unique token
        ↓
Email sent to verifier with magic link
        ↓
    ┌───────────────────────────────────────┐
    │         Verifier clicks link          │
    │                  ↓                    │
    │  Is verifier a registered user?       │
    │     │                    │            │
    │    Yes                  No            │
    │     ↓                    ↓            │
    │  Redirect to         Public           │
    │  in-app page      verification page   │
    │     │                    │            │
    │     └────────┬───────────┘            │
    │              ↓                        │
    │     Approve or Reject?                │
    │        │           │                  │
    │     Approve      Reject               │
    │        ↓           ↓                  │
    │  userVerified   Player notified       │
    │  = true         Can resubmit          │
    │        ↓        with new verifier     │
    │  Handicap                             │
    │  recalculated                         │
    └───────────────────────────────────────┘
```

## What We're NOT Doing

- Multi-verifier support (only one verifier per round)
- Verification expiration (requests stay pending indefinitely)
- Self-verification (except solo rounds)
- Verifier account requirements (any email works)
- Historical verification editing (can't change verifier after submission)
- Verification for 9-hole rounds differently than 18-hole (same process)

## Implementation Approach

We'll implement this in 5 phases:
1. **Database Schema** - Add verification table and modify round table
2. **Backend API** - tRPC procedures and public verification endpoint
3. **Email Integration** - Verification request and notification emails
4. **Handicap Calculation** - Update filter to require both approvals
5. **Frontend UI** - Scorecard form, verification page, navbar icon

---

## Phase 1: Database Schema Changes

### Overview
Add new `round_verification` table and `userVerified`/`isSoloRound` columns to `round` table.

### Changes Required

#### 1. Database Migration

**File**: `supabase/migrations/[timestamp]_add_round_verification.sql`

```sql
-- Migration: Add USGA round verification system
-- Purpose: Track scorecard attestation by playing partners per USGA Rule 5.1a

-- Add verification columns to round table
alter table public.round
  add column "userVerified" boolean default false not null,
  add column "isSoloRound" boolean default false not null;

-- Grandfather existing rounds as verified
update public.round set "userVerified" = true where "userVerified" = false;

-- Create round verification requests table
create table public.round_verification (
  id serial primary key,
  round_id integer not null references public.round(id) on delete cascade,
  verifier_email text not null,
  verifier_user_id uuid references public.profile(id) on delete set null,
  status text not null default 'pending',
  token text not null unique,
  rejection_reason text,
  created_at timestamp default current_timestamp not null,
  verified_at timestamp,
  constraint round_verification_status_check check (status in ('pending', 'approved', 'rejected'))
);

-- Indexes for round_verification
create index idx_round_verification_round_id on public.round_verification(round_id);
create index idx_round_verification_verifier_email on public.round_verification(verifier_email);
create index idx_round_verification_verifier_user_id on public.round_verification(verifier_user_id);
create index idx_round_verification_token on public.round_verification(token);
create index idx_round_verification_status on public.round_verification(status);

-- RLS policies for round_verification
alter table public.round_verification enable row level security;

-- Round owners can view verification requests for their rounds
create policy "Round owners can view their verification requests"
  on public.round_verification
  for select
  to authenticated
  using (
    round_id in (
      select id from public.round where "userId" = auth.uid()::uuid
    )
  );

-- Verifiers can view requests assigned to them (by email match or user_id)
create policy "Verifiers can view requests assigned to them"
  on public.round_verification
  for select
  to authenticated
  using (
    verifier_user_id = auth.uid()::uuid
    or verifier_email in (
      select email from public.profile where id = auth.uid()::uuid
    )
  );

-- Comment on table
comment on table public.round_verification is 'Tracks USGA-compliant scorecard verification requests where playing partners attest to round scores.';
```

#### 2. Drizzle Schema Update

**File**: `db/schema.ts`

Add to `round` table definition (after line 240):
```typescript
userVerified: boolean().default(false).notNull(),
isSoloRound: boolean().default(false).notNull(),
```

Add new table definition (after `round` table):
```typescript
export const roundVerification = pgTable(
  "round_verification",
  {
    id: serial().primaryKey().notNull(),
    roundId: integer("round_id").notNull(),
    verifierEmail: text("verifier_email").notNull(),
    verifierUserId: uuid("verifier_user_id"),
    status: text().$type<"pending" | "approved" | "rejected">().default("pending").notNull(),
    token: text().notNull().unique(),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    verifiedAt: timestamp("verified_at"),
  },
  (table) => [
    index("idx_round_verification_round_id").on(table.roundId),
    index("idx_round_verification_verifier_email").on(table.verifierEmail),
    index("idx_round_verification_verifier_user_id").on(table.verifierUserId),
    index("idx_round_verification_token").on(table.token),
    index("idx_round_verification_status").on(table.status),
    foreignKey({
      columns: [table.roundId],
      foreignColumns: [round.id],
      name: "round_verification_round_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.verifierUserId],
      foreignColumns: [profile.id],
      name: "round_verification_verifier_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("Round owners can view their verification requests", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(round_id in (select id from public.round where "userId" = auth.uid()::uuid))`,
    }),
    pgPolicy("Verifiers can view requests assigned to them", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(verifier_user_id = auth.uid()::uuid or verifier_email in (select email from public.profile where id = auth.uid()::uuid))`,
    }),
  ]
);

export const roundVerificationSchema = createSelectSchema(roundVerification);
export type RoundVerification = InferSelectModel<typeof roundVerification>;
```

#### 3. Drizzle Relations Update

**File**: `db/relations.ts`

Add relation for round:
```typescript
export const roundVerificationRelations = relations(roundVerification, ({ one }) => ({
  round: one(round, {
    fields: [roundVerification.roundId],
    references: [round.id],
  }),
  verifierUser: one(profile, {
    fields: [roundVerification.verifierUserId],
    references: [profile.id],
  }),
}));
```

Update round relations to include verification:
```typescript
export const roundRelations = relations(round, ({ one, many }) => ({
  // ... existing relations ...
  verification: one(roundVerification, {
    fields: [round.id],
    references: [roundVerification.roundId],
  }),
}));
```

### Success Criteria

#### Automated Verification:
- [ ] Migration runs successfully: `pnpm supabase db push`
- [ ] TypeScript types generate: `pnpm gen:types`
- [ ] Build passes: `pnpm build`
- [ ] Existing rounds have `userVerified = true` after migration

#### Manual Verification:
- [ ] Query `round` table in Supabase dashboard, verify new columns exist
- [ ] Query `round_verification` table exists with correct schema
- [ ] RLS policies work correctly (test with different user contexts)

---

## Phase 2: Backend API

### Overview
Create tRPC procedures for verification workflow and public API endpoint for magic link verification.

### Changes Required

#### 1. Verification Token Utilities

**File**: `lib/verification-token.ts` (new file)

```typescript
import { randomBytes, createHash } from "crypto";

/**
 * Generate a secure verification token
 * Returns both the raw token (for URL) and hash (for storage)
 */
export function generateVerificationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

/**
 * Hash a token for comparison
 */
export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate verification URL
 */
export function getVerificationUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${baseUrl}/verify-round?token=${encodeURIComponent(token)}`;
}
```

#### 2. Scorecard Schema Update

**File**: `types/scorecard.ts`

Update `scorecardSchema` to include verifier email and solo round flag:
```typescript
export const scorecardSchema = z.object({
  userId: z.string().uuid(),
  course: courseSchema,
  teePlayed: teeSchema,
  scores: z.array(scoreSchema),
  teeTime: z.string().datetime(),
  approvalStatus: z.literal("pending").or(z.literal("approved")),
  notes: z.string().optional(),
  // New fields for verification
  isSoloRound: z.boolean().default(false),
  verifierEmail: z.string().email().optional(),
}).refine(
  (data) => data.isSoloRound || (data.verifierEmail && data.verifierEmail.length > 0),
  {
    message: "Verifier email is required unless this is a solo round",
    path: ["verifierEmail"],
  }
);
```

#### 3. Round Router Updates

**File**: `server/api/routers/round.ts`

Update `submitScorecard` mutation to handle verification:

After round insertion (around line 437), add verification request creation:
```typescript
// Handle verification based on solo round status
if (input.isSoloRound) {
  // Solo rounds are auto-verified
  await db
    .update(round)
    .set({ userVerified: true, isSoloRound: true })
    .where(eq(round.id, newRoundId));
} else if (input.verifierEmail) {
  // Create verification request
  const { token, hash } = generateVerificationToken();

  // Check if verifier is a registered user
  const [verifierUser] = await db
    .select({ id: profile.id })
    .from(profile)
    .where(eq(profile.email, input.verifierEmail))
    .limit(1);

  await db.insert(roundVerification).values({
    roundId: newRoundId,
    verifierEmail: input.verifierEmail,
    verifierUserId: verifierUser?.id ?? null,
    token: hash,
    status: "pending",
  });

  // Send verification email (will implement in Phase 3)
  await sendVerificationEmail({
    toEmail: input.verifierEmail,
    playerName: ctx.user.email, // or fetch profile name
    courseName: coursePlayed.name,
    playedAt: input.teeTime,
    score: totalStrokes,
    verificationUrl: getVerificationUrl(token),
  });
}
```

#### 4. New Verification Router

**File**: `server/api/routers/verification.ts` (new file)

```typescript
import { z } from "zod";
import { createTRPCRouter, authedProcedure, publicProcedure } from "../trpc";
import { roundVerification, round, profile, course } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { hashVerificationToken } from "@/lib/verification-token";

export const verificationRouter = createTRPCRouter({
  /**
   * Get pending verification requests for the current user
   * (where they are the verifier)
   */
  getPendingRequests: authedProcedure.query(async ({ ctx }) => {
    const userEmail = ctx.user.email;
    const userId = ctx.user.id;

    const requests = await ctx.db
      .select({
        verification: roundVerification,
        round: round,
        course: course,
        playerProfile: profile,
      })
      .from(roundVerification)
      .innerJoin(round, eq(roundVerification.roundId, round.id))
      .innerJoin(course, eq(round.courseId, course.id))
      .innerJoin(profile, eq(round.userId, profile.id))
      .where(
        and(
          eq(roundVerification.status, "pending"),
          or(
            eq(roundVerification.verifierUserId, userId),
            eq(roundVerification.verifierEmail, userEmail)
          )
        )
      )
      .orderBy(desc(roundVerification.createdAt));

    return requests;
  }),

  /**
   * Get count of pending verification requests for navbar badge
   */
  getPendingCount: authedProcedure.query(async ({ ctx }) => {
    const userEmail = ctx.user.email;
    const userId = ctx.user.id;

    const result = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(roundVerification)
      .where(
        and(
          eq(roundVerification.status, "pending"),
          or(
            eq(roundVerification.verifierUserId, userId),
            eq(roundVerification.verifierEmail, userEmail)
          )
        )
      );

    return result[0]?.count ?? 0;
  }),

  /**
   * Get verification details by token (for public verification page)
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const tokenHash = hashVerificationToken(input.token);

      const [request] = await ctx.db
        .select({
          verification: roundVerification,
          round: round,
          course: course,
          playerProfile: profile,
        })
        .from(roundVerification)
        .innerJoin(round, eq(roundVerification.roundId, round.id))
        .innerJoin(course, eq(round.courseId, course.id))
        .innerJoin(profile, eq(round.userId, profile.id))
        .where(eq(roundVerification.token, tokenHash))
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification request not found or link has expired",
        });
      }

      return {
        id: request.verification.id,
        status: request.verification.status,
        playerName: request.playerProfile.name || request.playerProfile.email,
        playerEmail: request.playerProfile.email,
        courseName: request.course.name,
        courseCity: request.course.city,
        playedAt: request.round.teeTime,
        totalStrokes: request.round.totalStrokes,
        adjustedGrossScore: request.round.adjustedGrossScore,
        scoreDifferential: request.round.scoreDifferential,
        holesPlayed: request.round.holesPlayed,
      };
    }),

  /**
   * Approve a verification request
   */
  approve: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashVerificationToken(input.token);

      const [request] = await ctx.db
        .select()
        .from(roundVerification)
        .where(eq(roundVerification.token, tokenHash))
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification request not found",
        });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This round has already been ${request.status}`,
        });
      }

      // Update verification status
      await ctx.db
        .update(roundVerification)
        .set({
          status: "approved",
          verifiedAt: new Date(),
        })
        .where(eq(roundVerification.id, request.id));

      // Update round userVerified status
      await ctx.db
        .update(round)
        .set({ userVerified: true })
        .where(eq(round.id, request.roundId));

      // This will trigger handicap recalculation via the existing trigger

      return { success: true };
    }),

  /**
   * Reject a verification request
   */
  reject: publicProcedure
    .input(
      z.object({
        token: z.string(),
        reason: z.string().min(1, "Please provide a reason for rejection"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashVerificationToken(input.token);

      const [request] = await ctx.db
        .select({
          verification: roundVerification,
          round: round,
          playerProfile: profile,
        })
        .from(roundVerification)
        .innerJoin(round, eq(roundVerification.roundId, round.id))
        .innerJoin(profile, eq(round.userId, profile.id))
        .where(eq(roundVerification.token, tokenHash))
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification request not found",
        });
      }

      if (request.verification.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This round has already been ${request.verification.status}`,
        });
      }

      // Update verification status
      await ctx.db
        .update(roundVerification)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
          verifiedAt: new Date(),
        })
        .where(eq(roundVerification.id, request.verification.id));

      // Send rejection notification email to player
      await sendRejectionEmail({
        toEmail: request.playerProfile.email,
        playerName: request.playerProfile.name || "Golfer",
        reason: input.reason,
        roundId: request.round.id,
      });

      return { success: true };
    }),

  /**
   * Resend verification request (for round owner)
   */
  resendRequest: authedProcedure
    .input(
      z.object({
        roundId: z.number(),
        newVerifierEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this round
      const [existingRound] = await ctx.db
        .select()
        .from(round)
        .where(
          and(
            eq(round.id, input.roundId),
            eq(round.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingRound) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Round not found",
        });
      }

      if (existingRound.userVerified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This round is already verified",
        });
      }

      // Get existing verification request
      const [existingRequest] = await ctx.db
        .select()
        .from(roundVerification)
        .where(eq(roundVerification.roundId, input.roundId))
        .limit(1);

      const verifierEmail = input.newVerifierEmail || existingRequest?.verifierEmail;

      if (!verifierEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No verifier email provided",
        });
      }

      // Generate new token
      const { token, hash } = generateVerificationToken();

      // Check if verifier is a registered user
      const [verifierUser] = await ctx.db
        .select({ id: profile.id })
        .from(profile)
        .where(eq(profile.email, verifierEmail))
        .limit(1);

      if (existingRequest) {
        // Update existing request with new token
        await ctx.db
          .update(roundVerification)
          .set({
            verifierEmail,
            verifierUserId: verifierUser?.id ?? null,
            token: hash,
            status: "pending",
            rejectionReason: null,
            verifiedAt: null,
          })
          .where(eq(roundVerification.id, existingRequest.id));
      } else {
        // Create new request
        await ctx.db.insert(roundVerification).values({
          roundId: input.roundId,
          verifierEmail,
          verifierUserId: verifierUser?.id ?? null,
          token: hash,
          status: "pending",
        });
      }

      // Send verification email
      await sendVerificationEmail({
        toEmail: verifierEmail,
        playerName: ctx.user.email,
        courseName: "Course", // Would need to join to get this
        playedAt: existingRound.teeTime.toISOString(),
        score: existingRound.totalStrokes,
        verificationUrl: getVerificationUrl(token),
      });

      return { success: true };
    }),
});
```

#### 5. Register Verification Router

**File**: `server/api/root.ts`

Add verification router:
```typescript
import { verificationRouter } from "./routers/verification";

export const appRouter = createTRPCRouter({
  // ... existing routers ...
  verification: verificationRouter,
});
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linting passes: `pnpm lint`
- [ ] Unit tests for token generation pass

#### Manual Verification:
- [ ] Can submit a round with verifier email
- [ ] Can submit a solo round (auto-verified)
- [ ] Verification request is created in database
- [ ] Can fetch pending verification requests
- [ ] Can approve/reject via API

---

## Phase 3: Email Integration

### Overview
Send verification request emails and rejection notification emails using Resend.

### Changes Required

#### 1. Verification Email Template

**File**: `emails/verification-request.tsx` (new file)

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface VerificationRequestEmailProps {
  playerName: string;
  courseName: string;
  playedAt: string;
  score: number;
  verificationUrl: string;
}

export default function VerificationRequestEmail({
  playerName,
  courseName,
  playedAt,
  score,
  verificationUrl,
}: VerificationRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify {playerName}'s golf round at {courseName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Round Verification Request</Heading>

          <Text style={text}>
            {playerName} has requested you verify their golf round:
          </Text>

          <Section style={roundDetails}>
            <Text style={detailText}><strong>Course:</strong> {courseName}</Text>
            <Text style={detailText}><strong>Date:</strong> {new Date(playedAt).toLocaleDateString()}</Text>
            <Text style={detailText}><strong>Score:</strong> {score}</Text>
          </Section>

          <Text style={text}>
            As a playing partner, please confirm that this scorecard is accurate.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Review & Verify Round
            </Button>
          </Section>

          <Text style={footer}>
            If you did not play this round with {playerName}, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px", borderRadius: "8px" };
const heading = { color: "#1a1a1a", fontSize: "24px", fontWeight: "bold", textAlign: "center" as const };
const text = { color: "#4a4a4a", fontSize: "16px", lineHeight: "24px" };
const roundDetails = { backgroundColor: "#f6f9fc", padding: "20px", borderRadius: "8px", margin: "20px 0" };
const detailText = { color: "#1a1a1a", fontSize: "14px", margin: "8px 0" };
const buttonContainer = { textAlign: "center" as const, margin: "30px 0" };
const button = { backgroundColor: "#2563eb", color: "#ffffff", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold" };
const footer = { color: "#8a8a8a", fontSize: "12px", marginTop: "30px" };
```

#### 2. Rejection Notification Email

**File**: `emails/verification-rejected.tsx` (new file)

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface VerificationRejectedEmailProps {
  playerName: string;
  reason: string;
  roundDetailsUrl: string;
}

export default function VerificationRejectedEmail({
  playerName,
  reason,
  roundDetailsUrl,
}: VerificationRejectedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your round verification was not approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Round Verification Update</Heading>

          <Text style={text}>
            Hi {playerName},
          </Text>

          <Text style={text}>
            Unfortunately, your playing partner was unable to verify your recent round.
          </Text>

          <Section style={reasonBox}>
            <Text style={reasonLabel}>Reason provided:</Text>
            <Text style={reasonText}>"{reason}"</Text>
          </Section>

          <Text style={text}>
            You can review the round details and request verification from a different playing partner.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={roundDetailsUrl}>
              View Round Details
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px", borderRadius: "8px" };
const heading = { color: "#1a1a1a", fontSize: "24px", fontWeight: "bold", textAlign: "center" as const };
const text = { color: "#4a4a4a", fontSize: "16px", lineHeight: "24px" };
const reasonBox = { backgroundColor: "#fef2f2", padding: "20px", borderRadius: "8px", margin: "20px 0", borderLeft: "4px solid #ef4444" };
const reasonLabel = { color: "#991b1b", fontSize: "12px", fontWeight: "bold", margin: "0 0 8px 0" };
const reasonText = { color: "#1a1a1a", fontSize: "14px", fontStyle: "italic", margin: "0" };
const buttonContainer = { textAlign: "center" as const, margin: "30px 0" };
const button = { backgroundColor: "#2563eb", color: "#ffffff", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold" };
```

#### 3. Email Service Functions

**File**: `lib/email-service.ts`

Add new email functions:
```typescript
import VerificationRequestEmail from "@/emails/verification-request";
import VerificationRejectedEmail from "@/emails/verification-rejected";

interface SendVerificationEmailParams {
  toEmail: string;
  playerName: string;
  courseName: string;
  playedAt: string;
  score: number;
  verificationUrl: string;
}

export async function sendVerificationEmail(params: SendVerificationEmailParams) {
  const { toEmail, playerName, courseName, playedAt, score, verificationUrl } = params;

  await resend.emails.send({
    from: "Handicappin' <noreply@handicappin.com>",
    to: toEmail,
    subject: `Verify ${playerName}'s golf round at ${courseName}`,
    react: VerificationRequestEmail({
      playerName,
      courseName,
      playedAt,
      score,
      verificationUrl,
    }),
  });
}

interface SendRejectionEmailParams {
  toEmail: string;
  playerName: string;
  reason: string;
  roundId: number;
}

export async function sendRejectionEmail(params: SendRejectionEmailParams) {
  const { toEmail, playerName, reason, roundId } = params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  await resend.emails.send({
    from: "Handicappin' <noreply@handicappin.com>",
    to: toEmail,
    subject: "Your round verification was not approved",
    react: VerificationRejectedEmail({
      playerName,
      reason,
      roundDetailsUrl: `${baseUrl}/rounds/${roundId}`,
    }),
  });
}
```

### Success Criteria

#### Automated Verification:
- [ ] Email templates render correctly: `pnpm email:dev`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Verification request email sends and renders correctly
- [ ] Rejection notification email sends and renders correctly
- [ ] Magic link in email works and redirects to verification page

---

## Phase 4: Handicap Calculation Update

### Overview
Update handicap calculation to require both `approvalStatus === "approved"` AND `userVerified === true`.

### Changes Required

#### 1. Update Cron Job Filter

**File**: `app/api/cron/process-handicap-queue/route.ts`

Update the round fetch query (around line 148-153):
```typescript
// 2. Fetch all approved AND verified rounds for user
const { data: userRoundsRaw, error: roundsError } = await supabase
  .from("round")
  .select("*")
  .eq("userId", userId)
  .eq("approvalStatus", "approved")
  .eq("userVerified", true)  // NEW: Also require user verification
  .order("teeTime", { ascending: true });
```

#### 2. Update Edge Function (if exists)

**File**: `supabase/functions/process-handicap-queue/index.ts`

Apply same filter change if this edge function is used.

#### 3. Add Database Trigger for Verification

**File**: `supabase/migrations/[timestamp]_verification_handicap_trigger.sql`

```sql
-- Trigger handicap recalculation when a round is verified
create or replace function public.enqueue_handicap_on_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  round_user_id uuid;
begin
  -- Get the user ID for this round
  select "userId" into round_user_id
  from public.round
  where id = new.round_id;

  -- Only enqueue if verification was approved
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.handicap_calculation_queue (user_id, event_type, status, attempts)
    values (round_user_id, 'round_verified', 'pending', 0)
    on conflict (user_id) do update set
      event_type = 'round_verified',
      status = 'pending',
      attempts = 0,
      last_updated = current_timestamp;
  end if;

  return new;
end;
$$;

create trigger trigger_handicap_on_verification
  after update on public.round_verification
  for each row
  when (new.status = 'approved' and old.status = 'pending')
  execute function public.enqueue_handicap_on_verification();
```

### Success Criteria

#### Automated Verification:
- [ ] Migration runs: `pnpm supabase db push`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Unverified rounds do not affect handicap calculation
- [ ] Verified rounds are included in handicap calculation
- [ ] Verifying a round triggers handicap recalculation

---

## Phase 5: Frontend UI

### Overview
Update scorecard submission form, create verification page, and add navbar notification icon.

### Changes Required

#### 1. Update Scorecard Form

**File**: `components/scorecard/golf-scorecard.tsx`

Add verifier email field and solo round checkbox to the submission form:

```tsx
// Add to form state (around line 50)
const [isSoloRound, setIsSoloRound] = useState(false);
const [verifierEmail, setVerifierEmail] = useState("");

// Add to JSX before submit button
<div className="space-y-4 border-t pt-4 mt-4">
  <h4 className="font-medium">Round Verification</h4>
  <p className="text-sm text-muted-foreground">
    Per USGA rules, another player must verify your scorecard.
  </p>

  <div className="flex items-center space-x-2">
    <Checkbox
      id="solo-round"
      checked={isSoloRound}
      onCheckedChange={(checked) => {
        setIsSoloRound(checked === true);
        if (checked) setVerifierEmail("");
      }}
    />
    <Label htmlFor="solo-round">I played solo (no verification needed)</Label>
  </div>

  {!isSoloRound && (
    <div className="space-y-2">
      <Label htmlFor="verifier-email">Playing Partner's Email</Label>
      <Input
        id="verifier-email"
        type="email"
        placeholder="partner@example.com"
        value={verifierEmail}
        onChange={(e) => setVerifierEmail(e.target.value)}
        required={!isSoloRound}
      />
      <p className="text-xs text-muted-foreground">
        They will receive an email to verify your round.
      </p>
    </div>
  )}
</div>

// Update submission data
const submissionData: Scorecard = {
  ...data,
  isSoloRound,
  verifierEmail: isSoloRound ? undefined : verifierEmail,
  // ... rest of data
};
```

#### 2. Create Verification Page

**File**: `app/verify-round/page.tsx` (new file)

```tsx
import { Suspense } from "react";
import { VerificationContent } from "@/components/verification/verification-content";

export default function VerifyRoundPage() {
  return (
    <div className="container max-w-2xl py-8">
      <Suspense fallback={<VerificationSkeleton />}>
        <VerificationContent />
      </Suspense>
    </div>
  );
}

function VerificationSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/2" />
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}
```

#### 3. Verification Content Component

**File**: `components/verification/verification-content.tsx` (new file)

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { FormFeedback } from "@/components/ui/form-feedback";

export function VerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);

  const { data, isLoading, error } = api.verification.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const approveMutation = api.verification.approve.useMutation({
    onSuccess: () => setResult("approved"),
  });

  const rejectMutation = api.verification.reject.useMutation({
    onSuccess: () => setResult("rejected"),
  });

  if (!token) {
    return <FormFeedback type="error" message="Invalid verification link" />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return <FormFeedback type="error" message={error?.message ?? "Verification not found"} />;
  }

  if (data.status !== "pending") {
    return (
      <Card>
        <CardContent className="pt-6">
          <FormFeedback
            type="info"
            message={`This round has already been ${data.status}`}
          />
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          {result === "approved" ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">Round Verified!</h2>
              <p className="text-muted-foreground mt-2">
                Thank you for verifying {data.playerName}'s round.
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">Round Rejected</h2>
              <p className="text-muted-foreground mt-2">
                {data.playerName} has been notified.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Golf Round</CardTitle>
        <CardDescription>
          {data.playerName} has requested you verify their scorecard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Course</p>
            <p className="font-medium">{data.courseName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">
              {new Date(data.playedAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="font-medium">{data.totalStrokes}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Holes</p>
            <p className="font-medium">{data.holesPlayed}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Adjusted Gross</p>
            <p className="font-medium">{data.adjustedGrossScore}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Differential</p>
            <p className="font-medium">{data.scoreDifferential.toFixed(1)}</p>
          </div>
        </div>

        {showRejectForm ? (
          <div className="space-y-4">
            <Textarea
              placeholder="Please explain why you cannot verify this round..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate({ token, reason: rejectionReason })}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Rejection
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <Button
              className="flex-1"
              onClick={() => approveMutation.mutate({ token })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify Round
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRejectForm(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cannot Verify
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 4. Create Verification Requests Page

**File**: `app/verification-requests/page.tsx` (new file)

```tsx
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/utils/supabase/server";
import { VerificationRequestsList } from "@/components/verification/verification-requests-list";

export default async function VerificationRequestsPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-2xl font-bold mb-6">Verification Requests</h1>
      <p className="text-muted-foreground mb-8">
        Review and verify rounds from players who have listed you as a playing partner.
      </p>
      <VerificationRequestsList />
    </div>
  );
}
```

#### 5. Verification Requests List Component

**File**: `components/verification/verification-requests-list.tsx` (new file)

```tsx
"use client";

import { api } from "@/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Calendar, MapPin } from "lucide-react";
import Link from "next/link";

export function VerificationRequestsList() {
  const { data: requests, isLoading } = api.verification.getPendingRequests.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">
            No pending verification requests
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.verification.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {request.playerProfile.name || request.playerProfile.email}
            </CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {request.course.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(request.round.teeTime).toLocaleDateString()}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Score: </span>
                  <span className="font-medium">{request.round.totalStrokes}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Holes: </span>
                  <span className="font-medium">{request.round.holesPlayed}</span>
                </div>
              </div>
              <Link href={`/verify-round?token=${request.verification.token}`}>
                <Button size="sm">Review</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### 6. Navbar Notification Icon

**File**: `components/layout/navbar-verification-icon.tsx` (new file)

```tsx
"use client";

import { api } from "@/trpc/react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function NavbarVerificationIcon() {
  const { data: count } = api.verification.getPendingCount.useQuery(undefined, {
    refetchInterval: 60000, // Refetch every minute
  });

  if (!count || count === 0) {
    return null;
  }

  return (
    <Link
      href="/verification-requests"
      className="relative p-2 hover:bg-accent rounded-md"
      title="Pending verification requests"
    >
      <Mail className="h-5 w-5" />
      <Badge
        variant="destructive"
        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
      >
        {count > 9 ? "9+" : count}
      </Badge>
    </Link>
  );
}
```

#### 7. Update Navbar Component

**File**: `components/layout/header.tsx` (or wherever navbar is defined)

Add the verification icon to the navbar (near user menu):
```tsx
import { NavbarVerificationIcon } from "./navbar-verification-icon";

// In the navbar JSX, add before user menu:
<NavbarVerificationIcon />
```

#### 8. Update Rounds Table to Show Verification Status

**File**: `components/dashboard/roundsTable.tsx`

Add verification status column or badge:
```tsx
// Add to table header
<TableHead>Status</TableHead>

// Add to table row
<TableCell>
  {round.userVerified ? (
    <Badge variant="outline" className="text-green-600 border-green-600">
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
      Pending
    </Badge>
  )}
</TableCell>
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `pnpm build`
- [ ] Linting passes: `pnpm lint`
- [ ] Type checking passes: `pnpm type-check`

#### Manual Verification:
- [ ] Scorecard form shows verifier email field
- [ ] Solo round checkbox works and hides email field
- [ ] Cannot submit non-solo round without verifier email
- [ ] Verification requests page shows pending requests
- [ ] Navbar icon appears when user has pending requests
- [ ] Navbar icon disappears when no pending requests
- [ ] Public verification page works with magic link
- [ ] Can approve a round via verification page
- [ ] Can reject a round with reason via verification page
- [ ] Rounds table shows verification status
- [ ] Rejected rounds can be resubmitted with new verifier

---

## Testing Strategy

### Unit Tests

**File**: `tests/unit/verification-token.test.ts`
- Test token generation creates unique tokens
- Test token hashing is consistent
- Test URL generation includes correct base URL

**File**: `tests/unit/scorecard-schema.test.ts`
- Test validation requires verifier email when not solo
- Test validation allows empty verifier email when solo

### Integration Tests

**File**: `tests/integration/verification-flow.test.ts`
- Test complete verification approval flow
- Test complete verification rejection flow
- Test handicap recalculation after verification

### Manual Testing Steps

1. Submit a round with verifier email
2. Check email received by verifier
3. Click magic link and verify round appears
4. Approve round and verify success state
5. Check player's handicap recalculates
6. Submit another round
7. Reject round with reason
8. Check player receives rejection email
9. Resend verification with new email
10. Test solo round auto-verification
11. Test navbar icon shows/hides correctly

---

## Performance Considerations

- `getPendingCount` query should be optimized with proper indexes (added in migration)
- Consider caching the count on client with React Query's `staleTime`
- Email sending should be async/queued for better UX (already using Resend)

## Migration Notes

- Existing rounds are grandfathered as `userVerified = true`
- No data migration needed beyond the initial `UPDATE` in the migration
- New rounds default to `userVerified = false`

## References

- USGA Rule 5.1a: Scorecard Responsibility
- Existing approval cascade trigger: `supabase/migrations/20251011121805_cascade_approval_rounds.sql`
- Handicap queue processor: `app/api/cron/process-handicap-queue/route.ts`
- OTP verification pattern (for reference): `supabase/functions/verify-signup-otp/index.ts`
