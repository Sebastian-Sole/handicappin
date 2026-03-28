import { describe, expect, test } from "vitest";
import {
  postProcessExtractedTees,
  type ExtractedTee,
} from "@/lib/scorecard-extraction";

/**
 * Helper to create an ExtractedTee with sensible defaults.
 * Override only the fields relevant to each test.
 */
function createTee(overrides: Partial<ExtractedTee> = {}): ExtractedTee {
  return {
    teeName: "White",
    gender: "mens",
    distanceMeasurement: "yards",
    courseRatingFront9: null,
    courseRatingBack9: null,
    courseRating18: null,
    slopeRatingFront9: null,
    slopeRatingBack9: null,
    slopeRating18: null,
    holes: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fixMisplacedRatings (tested via postProcessExtractedTees)
// ---------------------------------------------------------------------------

describe("fixMisplacedRatings", () => {
  // --- Course ratings ---

  test("moves courseRatingFront9 above 45 to courseRating18 when 18 is null", () => {
    const input = createTee({ courseRatingFront9: 72.3 });
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRating18).toBe(72.3);
    expect(result.courseRatingFront9).toBeNull();
  });

  test("moves courseRatingBack9 above 45 to courseRating18 when 18 is null", () => {
    const input = createTee({ courseRatingBack9: 71.1 });
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRating18).toBe(71.1);
    expect(result.courseRatingBack9).toBeNull();
  });

  test("clears equal front/back9 course ratings above 45 and sets courseRating18", () => {
    const input = createTee({
      courseRatingFront9: 72.3,
      courseRatingBack9: 72.3,
    });
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRating18).toBe(72.3);
    expect(result.courseRatingFront9).toBeNull();
    expect(result.courseRatingBack9).toBeNull();
  });

  test("clears unequal front/back9 course ratings above 45 without setting courseRating18", () => {
    // When both are above 45 but different (likely gendered values), both are cleared
    // but courseRating18 is NOT set because they differ
    const input = createTee({
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
    });
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRating18).toBeNull();
    expect(result.courseRatingFront9).toBeNull();
    expect(result.courseRatingBack9).toBeNull();
  });

  test("does not move front9 course rating when it is below 45", () => {
    const input = createTee({ courseRatingFront9: 35.2, courseRatingBack9: 36.1 });
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRatingFront9).toBe(35.2);
    expect(result.courseRatingBack9).toBe(36.1);
    expect(result.courseRating18).toBeNull();
  });

  test("does not overwrite existing courseRating18", () => {
    const input = createTee({
      courseRatingFront9: 72.3,
      courseRating18: 71.0,
    });
    const [result] = postProcessExtractedTees([input]);

    // courseRating18 already set, so front9 stays as-is
    expect(result.courseRating18).toBe(71.0);
    expect(result.courseRatingFront9).toBe(72.3);
  });

  // --- Slope ratings ---

  test("moves duplicate slope front9/back9 to slopeRating18 when 18 is null", () => {
    const input = createTee({
      slopeRatingFront9: 130,
      slopeRatingBack9: 130,
    });
    const [result] = postProcessExtractedTees([input]);

    expect(result.slopeRating18).toBe(130);
    expect(result.slopeRatingFront9).toBeNull();
    expect(result.slopeRatingBack9).toBeNull();
  });

  test("does not merge different slope front9/back9 values within range", () => {
    const input = createTee({
      slopeRatingFront9: 128,
      slopeRatingBack9: 132,
    });
    const [result] = postProcessExtractedTees([input]);

    expect(result.slopeRatingFront9).toBe(128);
    expect(result.slopeRatingBack9).toBe(132);
    expect(result.slopeRating18).toBeNull();
  });

  test("moves slopeRatingFront9 above 155 to slopeRating18 when 18 is null", () => {
    const input = createTee({ slopeRatingFront9: 160 });
    const [result] = postProcessExtractedTees([input]);

    expect(result.slopeRating18).toBe(160);
    expect(result.slopeRatingFront9).toBeNull();
  });

  test("does not overwrite existing slopeRating18", () => {
    const input = createTee({
      slopeRatingFront9: 130,
      slopeRatingBack9: 130,
      slopeRating18: 125,
    });
    const [result] = postProcessExtractedTees([input]);

    // slopeRating18 already set, equal values but 18 is not null
    expect(result.slopeRating18).toBe(125);
    expect(result.slopeRatingFront9).toBe(130);
    expect(result.slopeRatingBack9).toBe(130);
  });

  test("leaves all-null ratings untouched", () => {
    const input = createTee();
    const [result] = postProcessExtractedTees([input]);

    expect(result.courseRatingFront9).toBeNull();
    expect(result.courseRatingBack9).toBeNull();
    expect(result.courseRating18).toBeNull();
    expect(result.slopeRatingFront9).toBeNull();
    expect(result.slopeRatingBack9).toBeNull();
    expect(result.slopeRating18).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// handleSlashSeparatedTeeName (tested via postProcessExtractedTees)
// ---------------------------------------------------------------------------

describe("handleSlashSeparatedTeeName", () => {
  test("splits M/W into separate mens and ladies tees", () => {
    const input = createTee({
      teeName: "M/W",
      gender: null,
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
      slopeRatingFront9: 130,
      slopeRatingBack9: 125,
    });
    const results = postProcessExtractedTees([input]);

    expect(results).toHaveLength(2);
    expect(results[0].gender).toBe("mens");
    expect(results[1].gender).toBe("ladies");
  });

  test("assigns front9 values to mens tee, back9 values to ladies tee as 18-hole ratings", () => {
    const input = createTee({
      teeName: "Men/Women",
      gender: null,
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
      slopeRatingFront9: 130,
      slopeRatingBack9: 125,
    });
    const results = postProcessExtractedTees([input]);

    const mensTee = results.find((t) => t.gender === "mens")!;
    const ladiesTee = results.find((t) => t.gender === "ladies")!;

    // The split assigns front9 → mens 18-hole, back9 → ladies 18-hole
    expect(mensTee.courseRating18).toBe(72.3);
    expect(mensTee.slopeRating18).toBe(130);
    expect(ladiesTee.courseRating18).toBe(68.5);
    expect(ladiesTee.slopeRating18).toBe(125);

    // Front9/back9 should be cleared on both
    expect(mensTee.courseRatingFront9).toBeNull();
    expect(mensTee.courseRatingBack9).toBeNull();
    expect(ladiesTee.courseRatingFront9).toBeNull();
    expect(ladiesTee.courseRatingBack9).toBeNull();
  });

  test("sets teeName to null for both split tees", () => {
    const input = createTee({
      teeName: "M/W",
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
    });
    const results = postProcessExtractedTees([input]);

    expect(results[0].teeName).toBeNull();
    expect(results[1].teeName).toBeNull();
  });

  test("preserves shared hole data on both split tees", () => {
    const holes = [
      { holeNumber: 1, par: 4, hcp: 7, distance: 380 },
      { holeNumber: 2, par: 3, hcp: 15, distance: 165 },
    ];
    const input = createTee({
      teeName: "M/W",
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
      holes,
    });
    const results = postProcessExtractedTees([input]);

    expect(results[0].holes).toEqual(holes);
    expect(results[1].holes).toEqual(holes);
  });

  test("returns original tee when name has no slash", () => {
    const input = createTee({ teeName: "Blue" });
    const results = postProcessExtractedTees([input]);

    expect(results).toHaveLength(1);
    expect(results[0].teeName).toBe("Blue");
  });

  test("returns original tee when slash parts are same gender", () => {
    const input = createTee({ teeName: "Men/Male" });
    const results = postProcessExtractedTees([input]);

    // Same gender on both sides → not a gendered split, return as-is
    expect(results).toHaveLength(1);
    expect(results[0].teeName).toBe("Men/Male");
  });

  test("returns original tee when slash parts are not recognized gender aliases", () => {
    const input = createTee({ teeName: "Gold/White" });
    const results = postProcessExtractedTees([input]);

    expect(results).toHaveLength(1);
    expect(results[0].teeName).toBe("Gold/White");
  });

  test("handles W/M order correctly (ladies first in name)", () => {
    const input = createTee({
      teeName: "W/M",
      gender: null,
      courseRatingFront9: 68.5,
      courseRatingBack9: 72.3,
      slopeRatingFront9: 125,
      slopeRatingBack9: 130,
    });
    const results = postProcessExtractedTees([input]);

    expect(results).toHaveLength(2);

    const mensTee = results.find((t) => t.gender === "mens")!;
    const ladiesTee = results.find((t) => t.gender === "ladies")!;

    // W is first → gender1=ladies (position 1, gets front9 fields)
    // M is second → gender2=mens (position 2, gets back9 fields)
    // Positional mapping: entry1 gets courseRatingFront9, entry2 gets courseRatingBack9
    expect(results[0].gender).toBe("ladies");
    expect(ladiesTee.courseRating18).toBe(68.5); // front9 value (position 1)
    expect(mensTee.courseRating18).toBe(72.3); // back9 value (position 2)
  });
});

// ---------------------------------------------------------------------------
// postProcessExtractedTees (integration of both sub-functions)
// ---------------------------------------------------------------------------

describe("postProcessExtractedTees", () => {
  test("processes multiple tees independently", () => {
    const tees = [
      createTee({ teeName: "White", courseRatingFront9: 72.3 }),
      createTee({ teeName: "Red", courseRatingFront9: 35.2 }),
    ];
    const results = postProcessExtractedTees(tees);

    expect(results).toHaveLength(2);

    // White: front9 was above 45, should be moved to 18
    expect(results[0].courseRating18).toBe(72.3);
    expect(results[0].courseRatingFront9).toBeNull();

    // Red: front9 was below 45, should stay
    expect(results[1].courseRatingFront9).toBe(35.2);
    expect(results[1].courseRating18).toBeNull();
  });

  test("splits gendered tees and then fixes ratings on each", () => {
    // M/W split will create two tees, each should have ratings fixed
    const input = createTee({
      teeName: "M/W",
      courseRatingFront9: 72.3,
      courseRatingBack9: 68.5,
      slopeRatingFront9: 130,
      slopeRatingBack9: 125,
    });
    const results = postProcessExtractedTees([input]);

    expect(results).toHaveLength(2);

    // After split, each tee has the value placed in courseRating18
    // fixMisplacedRatings should not alter already-correct 18-hole values
    for (const tee of results) {
      expect(tee.courseRating18).not.toBeNull();
      expect(tee.courseRatingFront9).toBeNull();
      expect(tee.courseRatingBack9).toBeNull();
    }
  });

  test("returns empty array for empty input", () => {
    expect(postProcessExtractedTees([])).toEqual([]);
  });
});
