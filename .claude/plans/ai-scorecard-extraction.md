# AI Scorecard Extraction — Implementation Plan

## Overview

Add a premium "Add with AI" feature that lets users upload an image or PDF of a golf scorecard to auto-fill the tee form fields. Uses OpenAI GPT-4o's vision capabilities to extract structured tee data (ratings, slopes, hole-by-hole par/handicap/distance). Free-tier users see an animated upsell walkthrough instead.

## Current State Analysis

- **Add Course Dialog** (`components/scorecard/add-course-dialog.tsx`): Uses `MultiPageDialog` with course info fields and a `TeeFormContent` section. The tee form is the complex part.
- **Tee Dialog** (`components/scorecard/tee-dialog.tsx`): Standalone add/edit dialog for tees on existing courses. Also renders `TeeFormContent`.
- **Tee Form Content** (`components/scorecard/tee-form-content.tsx`): 3 sections — tee info (name, gender, distance measurement), ratings (course rating + slope for front 9, back 9, total), and 18-hole table (distance, par, handicap per hole).
- **Validation** (`types/scorecard-input.ts`): Zod schemas with cross-field validation (totals must match sums, unique handicap values).
- **Billing**: `hasPremiumAccess()` from `utils/billing/access.ts` checks JWT claims client-side. `FeatureAccess` type with `hasPremiumAccess` boolean.
- **Rate limiting**: Upstash Redis via `lib/rate-limit.ts` with configurable limits per endpoint.
- **No AI or file upload infrastructure exists** — greenfield.

### Key Discoveries:

- `TeeFormContent` accepts `tee: Tee` and `onTeeChange: (updated: Tee) => void` — we can call `onTeeChange` with AI-extracted data to fill the form (`tee-form-content.tsx:22-25`)
- The tee form auto-calculates totals when hole data changes via handlers like `handleDistanceChange`, `handleParChange` — but `onTeeChange` sets the entire tee object at once, so we need to compute totals ourselves in the extraction response
- Premium check is done client-side via `getBillingFromJWT()` + `hasPremiumAccess()` and server-side via `getComprehensiveUserAccess()` (`utils/billing/access.ts:26`, `utils/billing/access-control.ts:12`)
- Rate limiting pattern established in `lib/rate-limit.ts` — we'll add a new limiter for AI extraction

## Desired End State

1. Both the Add Course Dialog (tee page) and standalone Tee Dialog show an "Add with AI" button (sparkle icon)
2. Premium users: clicking opens a file picker (JPG/PNG/PDF), image is sent to server, GPT-4o extracts data, form fields are populated with only the values the AI confidently found
3. Free users: clicking opens a modal with an animated walkthrough showing the feature flow, plus an "Upgrade" CTA button
4. Server-side: API route at `/api/ai/extract-scorecard` handles image processing with auth, premium verification, and rate limiting

### Verification:

- `pnpm build` passes
- `pnpm lint` passes
- Premium users can upload a scorecard image and see form fields populated
- Free users see the upsell modal with animation
- Invalid/unreadable images show a clear error message
- Fields the AI couldn't extract remain at their default (0/empty)

## What We're NOT Doing

- Storing uploaded images (process and discard)
- Multiple tee extraction from a single image (one tee at a time)
- Course info extraction (name, city, country) — users fill that manually
- Training or fine-tuning models
- Supporting video or multi-page PDF scanning

## Implementation Approach

Three phases: (1) API route + OpenAI integration, (2) UI integration with the tee forms, (3) free-user upsell experience. Each phase is verified with `pnpm build && pnpm lint`.

---

## Phase 1: API Route + OpenAI Integration

### Overview

Install OpenAI SDK, create the extraction API route with structured output, add rate limiting, and premium verification.

### Changes Required:

#### 1. Install OpenAI SDK

```bash
pnpm add openai
```

#### 2. Environment Variables

Add to `.env.example`:
```
OPENAI_API_KEY=
```

#### 3. Extraction Response Schema

**File**: `lib/scorecard-extraction.ts` (new)

Define a Zod schema for the AI extraction response. Fields are nullable — `null` means "could not extract." Also define the OpenAI prompt.

```typescript
import z from "zod";

// Schema for what the AI returns — all fields nullable to indicate "not found"
export const extractedTeeSchema = z.object({
  teeName: z.string().nullable(),
  gender: z.enum(["mens", "ladies"]).nullable(),
  distanceMeasurement: z.enum(["meters", "yards"]).nullable(),
  courseRatingFront9: z.number().nullable(),
  courseRatingBack9: z.number().nullable(),
  courseRating18: z.number().nullable(),
  slopeRatingFront9: z.number().nullable(),
  slopeRatingBack9: z.number().nullable(),
  slopeRating18: z.number().nullable(),
  holes: z
    .array(
      z.object({
        holeNumber: z.number(),
        par: z.number().nullable(),
        hcp: z.number().nullable(),
        distance: z.number().nullable(),
      })
    )
    .nullable(),
});

export type ExtractedTee = z.infer<typeof extractedTeeSchema>;

export const SCORECARD_EXTRACTION_PROMPT = `You are extracting golf scorecard/tee information from an image.

Extract the following data if visible. Return null for any field you cannot confidently read:

- teeName: The tee color/name (e.g., "RED", "WHITE", "BLUE", "YELLOW", "BLACK")
- gender: "mens" or "ladies" — infer from tee name if not explicit (RED/forward tees are typically "ladies")
- distanceMeasurement: "meters" or "yards"
- courseRatingFront9: Front 9 course rating (decimal, typically 30-45)
- courseRatingBack9: Back 9 course rating (decimal, typically 30-45)
- courseRating18: Total 18-hole course rating (decimal, typically 60-80)
- slopeRatingFront9: Front 9 slope rating (integer, typically 55-155)
- slopeRatingBack9: Back 9 slope rating (integer, typically 55-155)
- slopeRating18: Total 18-hole slope rating (integer, typically 55-155)
- holes: Array of 18 objects with holeNumber (1-18), par (3-5), hcp (1-18), distance (integer)

Important rules:
- Only return values you can clearly read from the image. Use null for anything uncertain.
- If the image contains multiple tees, extract only the FIRST/most prominent one.
- Course ratings are decimal numbers (e.g., 72.3). Slope ratings are integers (e.g., 130).
- Handicap (hcp) values should be 1-18 and unique across all 18 holes.
- Par values are typically 3, 4, or 5.
- If you can only see 9 holes, return those 9 with correct hole numbers and null for the rest.
- Return the holes array as exactly 18 entries, using null values for holes you cannot read.`;
```

#### 4. Rate Limiter

**File**: `lib/rate-limit.ts`

Add a new rate limiter for AI extraction:

```typescript
const AI_EXTRACTION_LIMIT = parseInt(process.env.RATE_LIMIT_AI_EXTRACTION_PER_MIN || '5', 10);

export const aiExtractionRateLimit = createRateLimiter(AI_EXTRACTION_LIMIT, 'ai-extraction');
```

#### 5. API Route

**File**: `app/api/ai/extract-scorecard/route.ts` (new)

```typescript
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { aiExtractionRateLimit, getIdentifier } from "@/lib/rate-limit";
import {
  extractedTeeSchema,
  SCORECARD_EXTRACTION_PROMPT,
} from "@/lib/scorecard-extraction";
import { successResponse, errorResponse } from "@/lib/api-validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    // 2. Premium check
    const access = await getComprehensiveUserAccess(user.id);
    if (!access.hasPremiumAccess) {
      return errorResponse("This feature requires a premium subscription", 403);
    }

    // 3. Rate limit check
    const identifier = getIdentifier(request, user.id);
    const { success: withinLimit, limit, remaining, reset } =
      await aiExtractionRateLimit.limit(identifier);

    const rateLimitHeaders = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": new Date(reset).toISOString(),
    };

    if (!withinLimit) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
      return errorResponse("Too many requests", 429, {
        retryAfter: retryAfterSeconds,
      });
    }

    // 4. Parse request body
    const body = await request.json();
    const { image, mimeType } = body as {
      image: string; // base64
      mimeType: string;
    };

    if (!image || !mimeType) {
      return errorResponse("Missing image or mimeType", 400);
    }

    // Validate mime type
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      return errorResponse(
        "Unsupported file type. Please upload a JPG, PNG, WebP, or PDF.",
        400
      );
    }

    // Check approximate file size (base64 is ~33% larger than binary)
    const approximateSize = (image.length * 3) / 4;
    if (approximateSize > MAX_FILE_SIZE) {
      return errorResponse("File too large. Maximum size is 10MB.", 400);
    }

    // 5. Call OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: SCORECARD_EXTRACTION_PROMPT },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${image}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "scorecard_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              teeName: { type: ["string", "null"] },
              gender: { type: ["string", "null"], enum: ["mens", "ladies", null] },
              distanceMeasurement: {
                type: ["string", "null"],
                enum: ["meters", "yards", null],
              },
              courseRatingFront9: { type: ["number", "null"] },
              courseRatingBack9: { type: ["number", "null"] },
              courseRating18: { type: ["number", "null"] },
              slopeRatingFront9: { type: ["number", "null"] },
              slopeRatingBack9: { type: ["number", "null"] },
              slopeRating18: { type: ["number", "null"] },
              holes: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  properties: {
                    holeNumber: { type: "number" },
                    par: { type: ["number", "null"] },
                    hcp: { type: ["number", "null"] },
                    distance: { type: ["number", "null"] },
                  },
                  required: ["holeNumber", "par", "hcp", "distance"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "teeName",
              "gender",
              "distanceMeasurement",
              "courseRatingFront9",
              "courseRatingBack9",
              "courseRating18",
              "slopeRatingFront9",
              "slopeRatingBack9",
              "slopeRating18",
              "holes",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    // 6. Parse and validate response
    const outputText = response.output_text;
    const parsed = JSON.parse(outputText);
    const validated = extractedTeeSchema.parse(parsed);

    return successResponse(validated, rateLimitHeaders);
  } catch (error) {
    console.error("AI extraction error:", error);
    return errorResponse("Failed to extract scorecard data. Please try again or enter the data manually.");
  }
}
```

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] OpenAI SDK installed in dependencies

#### Manual Verification:

- [ ] API route returns 401 for unauthenticated requests
- [ ] API route returns 403 for free-tier users
- [ ] API route returns extracted data for a valid scorecard image
- [ ] API route returns null fields for unclear/missing data

---

## Phase 2: UI Integration — "Add with AI" Button

### Overview

Add the "Add with AI" button to both `TeeFormContent` (used in Add Course Dialog) and `TeeDialog`. Premium users get the file picker and extraction flow. This phase focuses only on premium users — the free-user upsell comes in Phase 3.

### Changes Required:

#### 1. Scorecard Image Upload Component

**File**: `components/scorecard/scorecard-image-upload.tsx` (new)

A reusable component that handles file selection, preview, upload to the API, and returns extracted data. It accepts `onExtracted: (tee: Partial<Tee>) => void` callback.

Key behaviors:
- Hidden file input triggered by the "Add with AI" button
- Accepts: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`
- Shows loading spinner during extraction
- On success: converts `ExtractedTee` → partial `Tee` object (only non-null fields), calls `onExtracted`
- On error: shows inline error message
- Computes totals (outPar, inPar, totalPar, outDistance, inDistance, totalDistance) from extracted hole data

```typescript
// Conversion logic (pseudocode):
function extractedTeeToPartialTee(extracted: ExtractedTee, currentTee: Tee): Tee {
  const updated = { ...currentTee };

  if (extracted.teeName !== null) updated.name = extracted.teeName;
  if (extracted.gender !== null) updated.gender = extracted.gender;
  if (extracted.distanceMeasurement !== null) updated.distanceMeasurement = extracted.distanceMeasurement;

  // Ratings — only set non-null values
  if (extracted.courseRatingFront9 !== null) updated.courseRatingFront9 = extracted.courseRatingFront9;
  if (extracted.courseRatingBack9 !== null) updated.courseRatingBack9 = extracted.courseRatingBack9;
  if (extracted.courseRating18 !== null) updated.courseRating18 = extracted.courseRating18;
  if (extracted.slopeRatingFront9 !== null) updated.slopeRatingFront9 = extracted.slopeRatingFront9;
  if (extracted.slopeRatingBack9 !== null) updated.slopeRatingBack9 = extracted.slopeRatingBack9;
  if (extracted.slopeRating18 !== null) updated.slopeRating18 = extracted.slopeRating18;

  // Holes — merge non-null values into existing holes
  if (extracted.holes) {
    const newHoles = currentTee.holes?.map((existingHole, index) => {
      const extractedHole = extracted.holes?.find(h => h.holeNumber === index + 1);
      if (!extractedHole) return existingHole;
      return {
        ...existingHole,
        par: extractedHole.par ?? existingHole.par,
        hcp: extractedHole.hcp ?? existingHole.hcp,
        distance: extractedHole.distance ?? existingHole.distance,
      };
    }) ?? [];

    updated.holes = newHoles;

    // Recompute totals from hole data
    updated.outPar = newHoles.slice(0, 9).reduce((sum, h) => sum + (h.par || 0), 0);
    updated.inPar = newHoles.slice(9, 18).reduce((sum, h) => sum + (h.par || 0), 0);
    updated.totalPar = updated.outPar + updated.inPar;
    updated.outDistance = newHoles.slice(0, 9).reduce((sum, h) => sum + (h.distance || 0), 0);
    updated.inDistance = newHoles.slice(9, 18).reduce((sum, h) => sum + (h.distance || 0), 0);
    updated.totalDistance = updated.outDistance + updated.inDistance;
  }

  return updated;
}
```

#### 2. Integrate into TeeFormContent

**File**: `components/scorecard/tee-form-content.tsx`

Add the "Add with AI" button at the top of the form, next to the "Heads up!" alert. The button triggers the `ScorecardImageUpload` component.

```tsx
// At the top of TeeFormContent, before the Alert:
<div className="flex items-center justify-between">
  <ScorecardImageUpload
    currentTee={tee}
    onExtracted={onTeeChange}
    isPremium={isPremium}  // new prop
  />
</div>
```

This requires adding an `isPremium` prop to `TeeFormContent`:

```typescript
interface TeeFormContentProps {
  tee: Tee;
  onTeeChange: (updated: Tee) => void;
  isPremium?: boolean;  // new
}
```

#### 3. Pass Premium Status Through

**File**: `components/scorecard/add-course-dialog.tsx`

Add `isPremium` prop and pass it to `TeeFormContent`.

**File**: `components/scorecard/tee-dialog.tsx`

Add `isPremium` prop and pass it to `TeeFormContent`.

**File**: `components/scorecard/golf-scorecard.tsx`

Determine premium status (from session JWT) and pass down to the dialogs. Use existing `getBillingFromJWT` + `hasPremiumAccess` pattern.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes

#### Manual Verification:

- [ ] "Add with AI" button (sparkle icon) visible on tee form in Add Course Dialog
- [ ] "Add with AI" button visible on standalone Tee Dialog
- [ ] Clicking opens file picker for premium users
- [ ] Uploading a scorecard image populates form fields
- [ ] Fields the AI couldn't extract remain at default (0/empty)
- [ ] Loading spinner shows during extraction
- [ ] Error message shows for invalid/unreadable images
- [ ] Existing validation badge correctly shows remaining issues after AI fill

---

## Phase 3: Free-User Upsell Experience

### Overview

When a free-tier user clicks "Add with AI," show an animated walkthrough modal that demonstrates the feature's value and includes an "Upgrade" CTA.

### Changes Required:

#### 1. Upsell Dialog Component

**File**: `components/scorecard/ai-upsell-dialog.tsx` (new)

A dialog with a step-by-step animated walkthrough showing:
1. **Step 1**: "Upload your scorecard" — animated mockup of dragging an image
2. **Step 2**: "AI reads the details" — animated scanning/processing visual
3. **Step 3**: "Form fills automatically" — animated form fields populating

Uses CSS animations (Tailwind `animate-*` classes) for the visual effects. Each step auto-advances on a timer (2-3 seconds) or the user can click through.

Below the animation:
- Brief description text
- "Upgrade to Premium" button linking to `/upgrade`
- "Maybe later" dismiss button

```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Add with AI
      </DialogTitle>
    </DialogHeader>

    {/* Animated walkthrough area */}
    <div className="relative h-64 overflow-hidden rounded-lg bg-muted">
      {/* Step animations rendered here based on currentStep */}
    </div>

    {/* Step indicators */}
    <div className="flex justify-center gap-2">
      {steps.map((_, i) => <dot active={i === currentStep} />)}
    </div>

    {/* Step description */}
    <p className="text-center text-sm text-muted-foreground">
      {steps[currentStep].description}
    </p>

    {/* CTA */}
    <div className="flex flex-col gap-2">
      <Button asChild>
        <Link href="/upgrade">Upgrade to Premium</Link>
      </Button>
      <Button variant="ghost" onClick={close}>
        Maybe later
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

#### 2. Wire Up Premium Gate in ScorecardImageUpload

When `isPremium` is false, clicking the "Add with AI" button opens the upsell dialog instead of the file picker.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes

#### Manual Verification:

- [ ] Free user clicks "Add with AI" → sees animated upsell dialog
- [ ] Animation shows 3 steps with auto-advance
- [ ] "Upgrade to Premium" button navigates to `/upgrade`
- [ ] "Maybe later" closes the dialog
- [ ] Premium user still gets the normal file picker flow (no regression)

---

## Testing Strategy

### Unit Tests:

- `extractedTeeToPartialTee` conversion function — test with full data, partial data, all nulls
- Zod schema validation for `extractedTeeSchema` — valid and invalid inputs

### Integration Tests:

- API route auth check (401 for unauthed)
- API route premium check (403 for free tier)
- API route rate limiting (429 after limit exceeded)

### Manual Testing Steps:

1. Upload a clear scorecard photo — verify all fields populate
2. Upload a blurry/partial image — verify only confident fields populate
3. Upload a PDF scorecard — verify extraction works
4. Upload a non-scorecard image — verify graceful error
5. Test as free user — verify upsell dialog appears
6. Test rate limiting — submit 6 rapid requests, verify 6th is blocked

## Performance Considerations

- Base64 encoding increases payload by ~33% — for a 5MB image, that's ~6.7MB request body. This is acceptable for a single-shot API call.
- OpenAI API call takes 3-8 seconds typically — loading state is essential.
- No image storage means no cleanup needed.
- Rate limit of 5/min prevents abuse while allowing normal usage.

## References

- Tee form component: `components/scorecard/tee-form-content.tsx`
- Tee validation schema: `types/scorecard-input.ts:23-124`
- Add Course Dialog: `components/scorecard/add-course-dialog.tsx`
- Tee Dialog: `components/scorecard/tee-dialog.tsx`
- Premium access check (client): `utils/billing/access.ts:26`
- Premium access check (server): `utils/billing/access-control.ts:12`
- Rate limiting: `lib/rate-limit.ts`
- API validation utilities: `lib/api-validation.ts`
