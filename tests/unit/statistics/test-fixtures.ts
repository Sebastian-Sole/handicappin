/**
 * Test fixtures for statistics tests
 * Provides mock data generators for ScorecardWithRound and related types
 */

import type { ScorecardWithRound, Hole, Score } from "@/types/scorecard-input";
import type { Tables } from "@/types/supabase";

type RoundRow = Tables<"round">;

interface MockScorecardOptions {
  teeTime?: string;
  scoreDifferential?: number;
  adjustedGrossScore?: number;
  totalStrokes?: number;
  existingHandicapIndex?: number;
  updatedHandicapIndex?: number;
  exceptionalScoreAdjustment?: number;
  courseId?: number;
  courseName?: string;
  courseCity?: string;
  courseCountry?: string;
  scores?: Score[];
  holes?: Hole[];
}

/**
 * Creates a mock scorecard with round data for testing
 */
export function createMockScorecard(
  options: MockScorecardOptions = {}
): ScorecardWithRound {
  const {
    teeTime = "2024-01-15T10:00:00Z",
    scoreDifferential = 12.5,
    adjustedGrossScore = 85,
    totalStrokes = 85,
    existingHandicapIndex = 12.0,
    updatedHandicapIndex = 12.5,
    exceptionalScoreAdjustment = 0,
    courseId = 1,
    courseName = "Test Golf Club",
    courseCity = "Test City",
    courseCountry = "USA",
    scores = createMockScores(),
    holes = createMockHoles(),
  } = options;

  const round: RoundRow = {
    id: Math.floor(Math.random() * 10000),
    userId: "test-user-id",
    courseId,
    teeId: 1,
    teeTime,
    adjustedGrossScore,
    adjustedPlayedScore: adjustedGrossScore,
    totalStrokes,
    scoreDifferential,
    courseHandicap: Math.round(existingHandicapIndex),
    existingHandicapIndex,
    updatedHandicapIndex,
    exceptionalScoreAdjustment,
    parPlayed: 72,
    approvalStatus: "approved",
    notes: null,
    createdAt: new Date().toISOString(),
  };

  return {
    userId: "test-user-id",
    course: {
      id: courseId,
      name: courseName,
      city: courseCity,
      country: courseCountry,
      approvalStatus: "approved",
      tees: undefined, // Not needed for statistics calculations
    },
    teePlayed: {
      id: 1,
      name: "Blue Tees",
      gender: "mens",
      courseRating18: 72.0,
      slopeRating18: 130,
      courseRatingFront9: 36.0,
      slopeRatingFront9: 130,
      courseRatingBack9: 36.0,
      slopeRatingBack9: 130,
      outPar: 36,
      inPar: 36,
      totalPar: 72,
      outDistance: 3400,
      inDistance: 3400,
      totalDistance: 6800,
      distanceMeasurement: "yards",
      approvalStatus: "approved",
      holes,
    },
    scores,
    teeTime,
    approvalStatus: "approved",
    round,
  };
}

/**
 * Creates mock holes for 18-hole course
 */
export function createMockHoles(): Hole[] {
  const parSequence = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
  const distanceSequence = [
    380, 165, 520, 410, 390, 185, 430, 530, 400, 415, 175, 510, 395, 420, 195,
    440, 540, 385,
  ];

  return parSequence.map((par, index) => ({
    id: index + 1,
    teeId: 1,
    holeNumber: index + 1,
    par,
    hcp: ((index % 18) + 1) as number,
    distance: distanceSequence[index],
  }));
}

/**
 * Creates mock scores for 18 holes
 */
export function createMockScores(overrides?: Partial<Score>[]): Score[] {
  const defaultScores = Array.from({ length: 18 }, (_, index) => ({
    id: index + 1,
    roundId: 1,
    holeId: index + 1,
    strokes: 5, // Bogey golf
    hcpStrokes: index < 9 ? 1 : 0,
  }));

  if (overrides) {
    return defaultScores.map((score, index) => ({
      ...score,
      ...(overrides[index] || {}),
    }));
  }

  return defaultScores;
}

/**
 * Creates mock 9-hole scores
 */
export function createMock9HoleScores(): Score[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    roundId: 1,
    holeId: index + 1,
    strokes: 5,
    hcpStrokes: 1,
  }));
}

/**
 * Creates multiple scorecards with varying data
 */
export function createMockScorecardSet(count: number): ScorecardWithRound[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date("2024-01-01");
    date.setDate(date.getDate() + index * 7); // Weekly rounds

    return createMockScorecard({
      teeTime: date.toISOString(),
      scoreDifferential: 10 + Math.random() * 5,
      adjustedGrossScore: 80 + Math.floor(Math.random() * 15),
      courseId: (index % 5) + 1, // Rotate through 5 courses
    });
  });
}

/**
 * Creates a scorecard for a specific day of the week
 * @param dayIndex 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function createScorecardForDayOfWeek(
  dayIndex: number,
  options: MockScorecardOptions = {}
): ScorecardWithRound {
  // Find a date that falls on the specified day
  const baseDate = new Date("2024-01-07"); // This is a Sunday (0)
  const daysToAdd = dayIndex;
  baseDate.setDate(baseDate.getDate() + daysToAdd);

  return createMockScorecard({
    ...options,
    teeTime: baseDate.toISOString(),
  });
}

/**
 * Creates a scorecard for a specific time of day
 * @param hour Hour in 24-hour format (0-23)
 */
export function createScorecardForTimeOfDay(
  hour: number,
  options: MockScorecardOptions = {}
): ScorecardWithRound {
  const date = new Date("2024-01-15");
  date.setHours(hour, 0, 0, 0);

  return createMockScorecard({
    ...options,
    teeTime: date.toISOString(),
  });
}

/**
 * Creates scores with specific scoring outcomes
 */
export function createScoringScenario(
  scenario: "eagle" | "birdie" | "par" | "bogey" | "double" | "triple"
): Score[] {
  const scoreOffset: Record<string, number> = {
    eagle: -2,
    birdie: -1,
    par: 0,
    bogey: 1,
    double: 2,
    triple: 3,
  };

  const parSequence = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];

  return parSequence.map((par, index) => ({
    id: index + 1,
    roundId: 1,
    holeId: index + 1,
    strokes: par + scoreOffset[scenario],
    hcpStrokes: 0,
  }));
}
