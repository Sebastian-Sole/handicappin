import { z } from "zod";

/**
 * Schema for a single AI-extracted tee from a scorecard image.
 * All fields are nullable — null means "could not confidently extract."
 */
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

/**
 * Schema for the scorecard image extraction request body.
 */
export const extractScorecardRequestSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().min(1),
});

export type ExtractScorecardRequest = z.infer<typeof extractScorecardRequestSchema>;

/**
 * Schema for the full extraction response — an array of tees.
 * A single image may contain multiple tees (e.g., Red, White, Blue).
 */
export const extractionResponseSchema = z.object({
  tees: z.array(extractedTeeSchema),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

// Course rating front/back 9 should be roughly half the 18-hole total.
// A front 9 rating above this threshold is likely a misplaced 18-hole total.
const MAX_REASONABLE_NINE_HOLE_COURSE_RATING = 45;
// Slope ratings are typically 55-155
const MAX_REASONABLE_NINE_HOLE_SLOPE_RATING = 155;

/**
 * Post-processes AI extraction results to fix common AI mistakes:
 * 1. Splits slash-separated tee names (e.g., "M/W") into separate gendered tees
 * 2. Detects when front9/back9 ratings are actually misplaced 18-hole totals
 * 3. Detects when front9/back9 ratings are actually gendered (mens/ladies) splits
 */
export function postProcessExtractedTees(tees: ExtractedTee[]): ExtractedTee[] {
  const processed: ExtractedTee[] = [];

  for (const tee of tees) {
    const splitTees = handleSlashSeparatedTeeName(tee);
    for (const splitTee of splitTees) {
      processed.push(fixMisplacedRatings(splitTee));
    }
  }

  return processed;
}

/**
 * If a tee name contains "/" (e.g., "M/W"), the AI has likely confused column
 * headers with a tee name. Split into two tees with shared hole data.
 */
function handleSlashSeparatedTeeName(tee: ExtractedTee): ExtractedTee[] {
  const name = tee.teeName ?? "";
  if (!name.includes("/")) return [tee];

  const parts = name.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return [tee];

  // Check if the two parts look like gender labels (M/W, Men/Women, etc.)
  const genderAliases: Record<string, "mens" | "ladies"> = {
    m: "mens", men: "mens", mens: "mens", male: "mens",
    w: "ladies", women: "ladies", womens: "ladies", ladies: "ladies",
    f: "ladies", female: "ladies",
  };

  const gender1 = genderAliases[parts[0].toLowerCase()];
  const gender2 = genderAliases[parts[1].toLowerCase()];

  if (!gender1 || !gender2 || gender1 === gender2) return [tee];

  // The front9/back9 values are likely gendered splits, not actual front/back 9.
  // Positional mapping: first column (front9 fields) → gender1, second column (back9 fields) → gender2
  const entry1: ExtractedTee = {
    teeName: null, // No specific tee color known
    gender: gender1,
    distanceMeasurement: tee.distanceMeasurement,
    courseRatingFront9: null,
    courseRatingBack9: null,
    courseRating18: tee.courseRatingFront9,
    slopeRatingFront9: null,
    slopeRatingBack9: null,
    slopeRating18: tee.slopeRatingFront9,
    holes: tee.holes,
  };

  const entry2: ExtractedTee = {
    teeName: null,
    gender: gender2,
    distanceMeasurement: tee.distanceMeasurement,
    courseRatingFront9: null,
    courseRatingBack9: null,
    courseRating18: tee.courseRatingBack9,
    slopeRatingFront9: null,
    slopeRatingBack9: null,
    slopeRating18: tee.slopeRatingBack9,
    holes: tee.holes,
  };

  return [entry1, entry2];
}

/**
 * Detects and fixes common AI rating mistakes:
 * 1. Front9/back9 values that are actually 18-hole totals (course rating > 45)
 * 2. Equal front9/back9 values when the total is null (duplicated total)
 * 3. Equal slope front9/back9 when slope18 is null (duplicated total)
 */
function fixMisplacedRatings(tee: ExtractedTee): ExtractedTee {
  const fixed = { ...tee };

  // --- Course ratings ---

  const hasBothCourseNine =
    fixed.courseRatingFront9 !== null && fixed.courseRatingBack9 !== null;
  const bothCourseNineHigh =
    hasBothCourseNine &&
    fixed.courseRatingFront9! > MAX_REASONABLE_NINE_HOLE_COURSE_RATING &&
    fixed.courseRatingBack9! > MAX_REASONABLE_NINE_HOLE_COURSE_RATING;

  if (bothCourseNineHigh && fixed.courseRating18 === null) {
    if (fixed.courseRatingFront9 === fixed.courseRatingBack9) {
      // Equal and both too high → duplicated 18-hole total
      fixed.courseRating18 = fixed.courseRatingFront9;
    }
    // Whether equal or different (gendered), clear both — they're not real front/back values
    fixed.courseRatingFront9 = null;
    fixed.courseRatingBack9 = null;
  } else {
    // Only one is too high
    if (
      fixed.courseRatingFront9 !== null &&
      fixed.courseRatingFront9 > MAX_REASONABLE_NINE_HOLE_COURSE_RATING &&
      fixed.courseRating18 === null
    ) {
      fixed.courseRating18 = fixed.courseRatingFront9;
      fixed.courseRatingFront9 = null;
    }
    if (
      fixed.courseRatingBack9 !== null &&
      fixed.courseRatingBack9 > MAX_REASONABLE_NINE_HOLE_COURSE_RATING &&
      fixed.courseRating18 === null
    ) {
      fixed.courseRating18 = fixed.courseRatingBack9;
      fixed.courseRatingBack9 = null;
    }
  }

  // --- Slope ratings ---

  const hasBothSlopeNine =
    fixed.slopeRatingFront9 !== null && fixed.slopeRatingBack9 !== null;

  // If both slope front9 and back9 are equal and slope18 is null,
  // the AI likely duplicated the 18-hole total into both fields
  if (
    hasBothSlopeNine &&
    fixed.slopeRatingFront9 === fixed.slopeRatingBack9 &&
    fixed.slopeRating18 === null
  ) {
    fixed.slopeRating18 = fixed.slopeRatingFront9;
    fixed.slopeRatingFront9 = null;
    fixed.slopeRatingBack9 = null;
  } else {
    // Individual checks for obviously wrong values (> 155)
    if (
      fixed.slopeRatingFront9 !== null &&
      fixed.slopeRatingFront9 > MAX_REASONABLE_NINE_HOLE_SLOPE_RATING &&
      fixed.slopeRating18 === null
    ) {
      fixed.slopeRating18 = fixed.slopeRatingFront9;
      fixed.slopeRatingFront9 = null;
    }
    if (
      fixed.slopeRatingBack9 !== null &&
      fixed.slopeRatingBack9 > MAX_REASONABLE_NINE_HOLE_SLOPE_RATING &&
      fixed.slopeRating18 === null
    ) {
      fixed.slopeRating18 = fixed.slopeRatingBack9;
      fixed.slopeRatingBack9 = null;
    }
  }

  return fixed;
}

/**
 * JSON schema for OpenAI structured output — mirrors extractionResponseSchema.
 * Must be a top-level object for the Responses API.
 */
export const OPENAI_EXTRACTION_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    tees: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          teeName: { type: ["string", "null"] as const },
          gender: {
            type: ["string", "null"] as const,
            enum: ["mens", "ladies", null],
          },
          distanceMeasurement: {
            type: ["string", "null"] as const,
            enum: ["meters", "yards", null],
          },
          courseRatingFront9: { type: ["number", "null"] as const },
          courseRatingBack9: { type: ["number", "null"] as const },
          courseRating18: { type: ["number", "null"] as const },
          slopeRatingFront9: { type: ["number", "null"] as const },
          slopeRatingBack9: { type: ["number", "null"] as const },
          slopeRating18: { type: ["number", "null"] as const },
          holes: {
            type: ["array", "null"] as const,
            items: {
              type: "object" as const,
              properties: {
                holeNumber: { type: "number" as const },
                par: { type: ["number", "null"] as const },
                hcp: { type: ["number", "null"] as const },
                distance: { type: ["number", "null"] as const },
              },
              required: ["holeNumber", "par", "hcp", "distance"] as const,
              additionalProperties: false as const,
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
        ] as const,
        additionalProperties: false as const,
      },
    },
  },
  required: ["tees"] as const,
  additionalProperties: false as const,
};

export const SCORECARD_EXTRACTION_PROMPT = `You are extracting golf scorecard/tee information from an image or document.

IMPORTANT: If this is a multi-page PDF or document, examine ALL pages thoroughly. The scorecard, slope table, or rating information may be on ANY page — not necessarily the first. Ignore irrelevant pages (e.g., course descriptions, advertisements, rules) and focus on pages containing tables.

Golf scorecard data is almost always presented in TABLE format. Look for:
- Scorecard tables: rows/columns with hole numbers (1-18), par, handicap (HCP/SI), and distances per tee color
- Slope/rating tables: rows per tee color with course rating and slope rating columns, often split by front 9, back 9, and total
- The tee names are usually color names (Red, White, Blue, Yellow, Black) shown as row headers or color-coded rows

Extract ALL tees visible across all pages. Many scorecards show multiple tees (e.g., Red, White, Blue, Yellow, Black). Return each tee as a separate entry in the tees array. Combine data from different pages for the same tee (e.g., hole data from a scorecard page and ratings from a slope table page).

For each tee, extract the following data if visible. Return null for any field you cannot confidently read:

- teeName: The tee color/name (e.g., "Red", "White", "Blue", "Yellow", "Black")
- gender: "mens" or "ladies" — infer from tee name if not explicit (Red/forward tees are typically "ladies")
- distanceMeasurement: "meters" or "yards"
- courseRatingFront9: Front 9 course rating (decimal, typically 30-45)
- courseRatingBack9: Back 9 course rating (decimal, typically 30-45)
- courseRating18: Total 18-hole course rating (decimal, typically 60-80)
- slopeRatingFront9: Front 9 slope rating (integer, typically 55-155)
- slopeRatingBack9: Back 9 slope rating (integer, typically 55-155)
- slopeRating18: Total 18-hole slope rating (integer, typically 55-155)
- holes: Array of 18 objects with holeNumber (1-18), par (3-5), hcp (1-18), distance (integer)

CRITICAL — Gendered ratings on a single physical tee:
- Many scorecards show ONE set of holes (par, distances, handicap) but SEPARATE course/slope ratings for "Mens"/"M" and "Ladies"/"W"/"Women".
- Common table layouts: columns labeled "M" and "W" (or "Men" and "Women") next to course rating and slope rating rows. These are NOT tee names — they are gender columns.
- "M/W" or "Men/Women" appearing as column headers does NOT mean there is a tee called "M/W". It means the ratings differ by gender.
- In this case, you MUST create TWO separate tee entries: one with gender="mens" and one with gender="ladies".
- Both entries share the SAME hole data (par, hcp, distances) but have DIFFERENT course ratings and slope ratings.
- Do NOT put the mens rating in courseRatingFront9 and the ladies rating in courseRatingBack9. Those fields are ONLY for front 9 vs back 9 splits, NOT for gendered splits.
- courseRatingFront9/Back9 refer to the rating for holes 1-9 and holes 10-18 respectively, NOT mens vs ladies.
- If the document only has one set of holes with no tee color name, use teeName=null for both entries.

Document type awareness:
- A SCORECARD typically contains hole-by-hole data (par, handicap, distances) and sometimes course/slope ratings.
- A SLOPE TABLE or RATING CARD is a dedicated table listing course ratings and slope ratings per tee, often split by front 9, back 9, and total. It is the authoritative source for rating data.
- If both a scorecard and a dedicated slope/rating table are visible in the same document, ALWAYS prefer the values from the dedicated slope/rating table for course ratings and slope ratings, as they are more accurate.

Combo/combination tees:
- Some courses have "combo" tees (e.g., "Gold/White Combo", "White/Green Combo", "Green/Red Combo").
- A combo tee means the golfer plays the FRONT 9 from one tee and the BACK 9 from another. For example, "Gold/White Combo" = front 9 distances from Gold tee, back 9 distances from White tee.
- The FIRST color in the combo name provides the FRONT 9 (holes 1-9) distances.
- The SECOND color in the combo name provides the BACK 9 (holes 10-18) distances.
- Par and handicap values are the same across all tees (they are course properties), so copy them from any tee.
- Combo tees have their OWN course rating and slope rating values in the rating table — use those, do NOT average the component tees.
- If the scorecard shows distances for the component tees (e.g., Gold and White rows), construct the combo tee's hole data by taking front 9 from the first tee and back 9 from the second tee.
- Treat each combo tee as its own separate entry in the tees array with its own teeName (e.g., "Gold/White Combo").

Important rules:
- Search ALL pages of the document for relevant golf data.
- Extract ALL tees visible, not just one. Each unique (tee color, gender) combination is a separate entry.
- Only return values you can clearly read. Use null for anything uncertain.
- Course ratings are decimal numbers (e.g., 72.3). Slope ratings are integers (e.g., 130).
- Handicap (hcp) values should be 1-18 and unique across all 18 holes for each tee.
- Par values are typically 3, 4, or 5.
- If you can only see 9 holes, return those 9 with correct hole numbers and null for the rest.
- Return the holes array as exactly 18 entries per tee, using null values for holes you cannot read.
- If the document only contains rating/slope information without hole data, return the tees with ratings and null for holes.
- If no tees can be found at all, return an empty tees array.
- Use consistent tee names: prefer the color name (e.g., "White", "Red", "Blue") over generic names like "Men" or "Mens".`;
