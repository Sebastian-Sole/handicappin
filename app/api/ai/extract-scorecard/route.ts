import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { aiExtractionRateLimit, getIdentifier } from "@/lib/rate-limit";
import {
  extractionResponseSchema,
  extractScorecardRequestSchema,
  SCORECARD_EXTRACTION_PROMPT,
  OPENAI_EXTRACTION_JSON_SCHEMA,
  postProcessExtractedTees,
} from "@/lib/scorecard-extraction";
import { validateRequest, successResponse, errorResponse } from "@/lib/api-validation";
import { env } from "@/env";
import { logger } from "@/lib/logging";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_OUTPUT_TOKENS = 4096; // Cap AI response size to control cost

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

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
      return errorResponse(
        "This feature requires a premium subscription",
        403
      );
    }

    // 3. Rate limit check
    const identifier = getIdentifier(request, user.id);
    const {
      success: withinLimit,
      limit,
      remaining,
      reset,
    } = await aiExtractionRateLimit.limit(identifier);

    const rateLimitHeaders: Record<string, string> = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": new Date(reset).toISOString(),
    };

    if (!withinLimit) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
      return errorResponse(
        "Too many requests. Please wait before trying again.",
        429,
        { retryAfter: retryAfterSeconds },
        rateLimitHeaders
      );
    }

    // 4. Parse and validate request body
    const validation = await validateRequest(request, extractScorecardRequestSchema);
    if ("error" in validation) {
      return validation.error;
    }
    const { image, mimeType } = validation.data;

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return errorResponse(
        "Unsupported file type. Please upload a JPG, PNG, WebP, or PDF.",
        400
      );
    }

    // Base64 is ~33% larger than binary
    const approximateFileSize = (image.length * 3) / 4;
    if (approximateFileSize > MAX_FILE_SIZE_BYTES) {
      return errorResponse("File too large. Maximum size is 10MB.", 400);
    }

    // 5. Call OpenAI GPT-4.1 Mini with structured output
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const isPdf = mimeType === "application/pdf";

    // PDFs use input_file; images use input_image
    const fileContent = isPdf
      ? {
          type: "input_file" as const,
          file_data: `data:${mimeType};base64,${image}`,
          filename: "scorecard.pdf",
        }
      : {
          type: "input_image" as const,
          image_url: `data:${mimeType};base64,${image}`,
          detail: "high" as const,
        };

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: SCORECARD_EXTRACTION_PROMPT },
            fileContent,
          ],
        },
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: "scorecard_extraction",
          strict: true,
          schema: OPENAI_EXTRACTION_JSON_SCHEMA,
        },
      },
    });

    // 6. Parse and validate the AI response
    const parsed = JSON.parse(response.output_text);

    const validated = extractionResponseSchema.parse(parsed);

    // 7. Post-process to fix common AI mistakes
    const postProcessed = postProcessExtractedTees(validated.tees);

    return successResponse({ tees: postProcessed }, rateLimitHeaders);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse(
        "Failed to parse AI response. Please try again.",
        500
      );
    }
    logger.error("AI extraction error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(
      "Failed to extract scorecard data. Please try again or enter the data manually."
    );
  }
}
