# Contact Page Rework - Implementation Plan

## Overview

Transform the basic contact page into a comprehensive, SEO-optimized page with a working contact form, multiple content sections, FAQ section with structured data, and enhanced metadata.

## Current State Analysis

**Current Page (`app/contact/page.tsx`):**
- Basic static text with mailto link
- Minimal SEO (only title/description)
- No structured data
- Inconsistent email addresses
- Poor UX - forces email client usage

**Key Issues:**
- No contact form
- No FAQ section
- Missing OpenGraph metadata
- No JSON-LD structured data
- Layout doesn't match site design (about page style)

## Desired End State

A fully-featured contact page with:
1. Working contact form with rate limiting (3 submissions per minute per IP)
2. Email notifications to admin + confirmation to user
3. Multiple sections: Hero, Contact Form, FAQ, Direct Contact
4. FAQ section with FAQJsonLd structured data
5. ContactPage JSON-LD for SEO
6. Enhanced metadata (OpenGraph, description)
7. Response time SLA displayed
8. Consistent visual design with about page

### Verification:
- Form submits successfully and sends emails
- Rate limiting blocks excessive submissions
- All metadata renders correctly (check with SEO tools)
- JSON-LD validates with Google's Rich Results Test
- Page is responsive on mobile/tablet/desktop

## What We're NOT Doing

- Adding CAPTCHA (rate limiting is sufficient for now)
- Building a ticketing system
- Adding file attachments
- Creating an admin dashboard for messages
- Storing messages in database (email-only approach)

## Implementation Approach

Use existing infrastructure:
- tRPC for type-safe API
- Upstash Redis for rate limiting
- Resend for email delivery
- React Hook Form + Zod for form validation
- Existing UI components (Card, Input, Textarea, Button, Badge)

---

## Phase 1: Backend Infrastructure

### Overview
Create tRPC contact router with rate limiting and email sending functionality.

### Changes Required:

#### 1. Add Contact Rate Limiter

**File**: `lib/rate-limit.ts`
**Changes**: Add contact form rate limiter (3 per minute per IP)

```typescript
const CONTACT_LIMIT = parseInt(process.env.RATE_LIMIT_CONTACT_PER_MIN || '3', 10);

export const contactRateLimit = createRateLimiter(CONTACT_LIMIT, 'contact');
```

#### 2. Create Contact Router

**File**: `server/api/routers/contact.ts` (new file)
**Changes**: Create new tRPC router for contact form submission

```typescript
import { z } from "zod";
import { publicProcedure, createTRPCRouter } from "../trpc";
import { TRPCError } from "@trpc/server";
import { contactRateLimit, getIdentifier } from "@/lib/rate-limit";
import { sendContactFormEmail, sendContactConfirmationEmail } from "@/lib/email-service";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});

export const contactRouter = createTRPCRouter({
  submit: publicProcedure
    .input(contactFormSchema)
    .mutation(async ({ input, ctx }) => {
      // Rate limiting
      const identifier = getIdentifier(ctx.headers as unknown as Request);
      const { success } = await contactRateLimit.limit(identifier);

      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many contact form submissions. Please try again later.",
        });
      }

      // Send emails
      await sendContactFormEmail(input);
      await sendContactConfirmationEmail({ to: input.email, name: input.name });

      return { success: true };
    }),
});
```

#### 3. Register Contact Router

**File**: `server/api/root.ts`
**Changes**: Import and register the contact router

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] tRPC procedure is accessible
- [ ] Rate limiting blocks after 3 requests

---

## Phase 2: Email Templates

### Overview
Create email templates for contact form notifications.

### Changes Required:

#### 1. Contact Form Notification Email (to admin)

**File**: `emails/contact-form.tsx` (new file)
**Changes**: Create email template for admin notification

#### 2. Contact Confirmation Email (to user)

**File**: `emails/contact-confirmation.tsx` (new file)
**Changes**: Create confirmation email template

#### 3. Add Email Service Functions

**File**: `lib/email-service.ts`
**Changes**: Add sendContactFormEmail and sendContactConfirmationEmail functions

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`

#### Manual Verification:
- [ ] Email templates render correctly (preview in browser)

---

## Phase 3: Contact Form Component

### Overview
Build the client-side contact form with validation and submission handling.

### Changes Required:

#### 1. Contact Form Component

**File**: `components/contact/contact-form.tsx` (new file)
**Changes**: Create form component with React Hook Form + Zod

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Form validates inputs correctly
- [ ] Form submits successfully
- [ ] Toast notifications appear
- [ ] Loading state works

---

## Phase 4: Page Redesign

### Overview
Rework the contact page with multiple sections matching the about page design.

### Changes Required:

#### 1. Rewrite Contact Page

**File**: `app/contact/page.tsx`
**Changes**: Complete redesign with sections:
- Hero section with Badge and description
- Contact form section
- FAQ section
- Direct contact section with email and response time

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Page layout matches design
- [ ] Responsive on mobile/tablet/desktop
- [ ] All sections render correctly

---

## Phase 5: SEO Enhancement

### Overview
Add structured data and enhanced metadata for SEO.

### Changes Required:

#### 1. Add ContactPage JSON-LD Component

**File**: `components/seo/json-ld.tsx`
**Changes**: Add ContactPageJsonLd component

#### 2. Update Page Metadata

**File**: `app/contact/page.tsx`
**Changes**: Enhanced metadata with OpenGraph

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] JSON-LD validates with Google Rich Results Test
- [ ] OpenGraph preview looks correct
- [ ] FAQ structured data renders

---

## Testing Strategy

### Manual Testing Steps:
1. Submit contact form with valid data - should succeed
2. Submit contact form 4+ times quickly - should be rate limited
3. Submit with invalid email - should show validation error
4. Check email inbox for both admin and confirmation emails
5. Test responsive design on mobile
6. Validate structured data with Google Rich Results Test

## References

- About page for design patterns: `app/about/page.tsx`
- Email templates: `emails/welcome.tsx`
- Rate limiting: `lib/rate-limit.ts`
- tRPC patterns: `server/api/routers/auth.ts`
- JSON-LD patterns: `components/seo/json-ld.tsx`
