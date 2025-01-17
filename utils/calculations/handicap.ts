import { RoundWithCourse } from "@/types/database";
import { Hole } from "@/types/scorecard";
import { SupabaseClient } from "@supabase/supabase-js";

export const calculateCourseHandicap = (
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
) => {
  // Todo: Number of holes
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
};

/**
 * Calculates the score differential based on the adjusted gross score, course rating, and slope rating.
 *
 * @param adjustedGrossScore - The adjusted gross score of the player.
 * @param courseRating - The course rating of the golf course.
 * @param slopeRating - The slope rating of the golf course.
 * @returns The score differential.
 */
export const calculateScoreDifferential = (
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
) => {
  return (adjustedGrossScore - courseRating) * (113 / slopeRating);
};

/**
 * Calculates the hole-adjusted score for a given hole.
 *
 * @param hole - The hole object containing information about the hole.
 * @param handicapStrokes - The number of handicap strokes for the player (optional).
 * @returns The hole-adjusted score.
 */
export const calculateHoleAdjustedScore = (hole: Hole): number => {
  const maxScore = Math.min(hole.par + 5, hole.par + 2 + hole.hcpStrokes);
  return Math.min(hole.strokes, maxScore);
};

/**
 * Calculates the adjusted played score based on the provided holes.
 * The adjusted score for each hole is calculated as the minimum value between the strokes played, and net double bogey (incl. handicap)
 * The adjusted scores are then summed up to get the final adjusted played score.
 *
 * @param holes - An array of Hole objects representing the holes played.
 * @returns The calculated adjusted played score.
 */

// Todo: Adjust calculation in accordance to hole handicap rules
export const calculateAdjustedPlayedScore = (holes: Hole[]): number => {
  const adjustedScores = holes.map((hole) => {
    return calculateHoleAdjustedScore(hole);
  });
  return adjustedScores.reduce((acc, cur) => acc + cur);
};

// Todo: Can these attributes be manditory?
export const calculateAdjustedGrossScore = (
  holes: Hole[],
  handicapIndex: number,
  slopeRating?: number,
  courseRating?: number,
  par?: number
): number | Error => {
  const initialAdjust = calculateAdjustedPlayedScore(holes);

  if (holes.length === 18) {
    return initialAdjust;
  } else {
    if (!slopeRating || !courseRating || !par) {
      throw new Error(
        "Slope rating, course rating and par are required for calculating adjusted gross score for less than 18 holes"
      );
    }

    // Calculate the predicted amount of strokes for the remaining holes based on the handicap index
    const courseHandicap = calculateCourseHandicap(
      handicapIndex,
      slopeRating!,
      courseRating!,
      par!
    );

    const holesLeft = 18 - holes.length;
    const predictedStrokes = Math.round((courseHandicap / 18) * holesLeft);
    const parForRemainingHoles = holesLeft * (par / 18);
    return initialAdjust + predictedStrokes + parForRemainingHoles;
  }
};

export const calculateInputAdjustedGrossScore = (
  initialAdjust: number,
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number,
  holesPlayed: number
) => {
  const courseHandicap = calculateCourseHandicap(
    handicapIndex,
    slopeRating,
    courseRating,
    par
  );

  const holesLeft = 18 - holesPlayed;
  const predictedStrokes = Math.round((courseHandicap / 18) * holesLeft);
  const parForRemainingHoles = holesLeft * (par / 18);
  return initialAdjust + predictedStrokes + parForRemainingHoles;
};

export const getRelevantDifferentials = (scoreDifferentials: number[]) => {
  if (scoreDifferentials.length <= 5) {
    return scoreDifferentials.slice(0, 1);
  } else if (scoreDifferentials.length >= 6 && scoreDifferentials.length <= 8) {
    return scoreDifferentials.slice(0, 2);
  } else if (
    scoreDifferentials.length >= 9 &&
    scoreDifferentials.length <= 11
  ) {
    return scoreDifferentials.slice(0, 3);
  } else if (
    scoreDifferentials.length >= 12 &&
    scoreDifferentials.length <= 14
  ) {
    return scoreDifferentials.slice(0, 4);
  } else if (
    scoreDifferentials.length >= 15 &&
    scoreDifferentials.length <= 16
  ) {
    return scoreDifferentials.slice(0, 5);
  } else if (
    scoreDifferentials.length >= 17 &&
    scoreDifferentials.length <= 18
  ) {
    return scoreDifferentials.slice(0, 6);
  } else if (scoreDifferentials.length === 19) {
    return scoreDifferentials.slice(0, 7);
  } else {
    return scoreDifferentials.slice(0, 8);
  }
};

/**
 * Retrieves the rounds which contribute to the handicap index calculation based on the number of rounds provided.
 *
 * @param rounds - An array of rounds with course information.
 * @returns An array of handicap contributing rounds based on the number of rounds provided.
 */
export function getRelevantRounds(rounds: RoundWithCourse[]) {
  if (rounds.length <= 5) {
    return rounds.sort((a, b) => a.scoreDifferential - b.scoreDifferential);
  } else if (rounds.length >= 6 && rounds.length <= 8) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 2);
  } else if (rounds.length >= 9 && rounds.length <= 11) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 3);
  } else if (rounds.length >= 12 && rounds.length <= 14) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 4);
  } else if (rounds.length >= 15 && rounds.length <= 16) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 5);
  } else if (rounds.length >= 17 && rounds.length <= 18) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 6);
  } else if (rounds.length === 19) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 7);
  } else {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 8);
  }
}

/**
 * Calculates the handicap index based on the given score differentials.
 *
 * @param scoreDifferentials - An array of score differentials relevant to the handicap index calculation.
 * @returns The calculated handicap index, in accordance to USGA.
 */
export const calculateHandicapIndex = (scoreDifferentials: number[]) => {
  const sortedDifferentials = scoreDifferentials.sort((a, b) => a - b);

  let differentials: number[] = getRelevantDifferentials(sortedDifferentials);
  const handicapCalculation =
    Math.round(
      (differentials.reduce((acc, cur) => acc + cur) / differentials.length) *
        10
    ) / 10;
  return applyHandicapAdjustement(handicapCalculation, scoreDifferentials);
};

export const calculatePlayingHandicap = (courseHandicap: number) => {
  return Math.round(courseHandicap * 0.95);
};

export async function getLowestHandicapIndex(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data: rounds, error } = await supabase
    .from("Round")
    .select("updatedHandicapIndex, teeTime")
    .eq("userId", userId)
    .gte(
      "teeTime",
      new Date(
        new Date().setFullYear(new Date().getFullYear() - 1)
      ).toISOString()
    )
    .order("updatedHandicapIndex", { ascending: true });

  if (error) {
    throw new Error(
      `Error fetching historical handicap indices: ${error.message}`
    );
  }

  if (!rounds.length) {
    throw new Error("No rounds found in the past 12 months");
  }

  return rounds[0].updatedHandicapIndex;
}

export const calculateCappedHandicapIndex = (
  newHandicapIndex: number,
  lowestHandicapIndex: number
): number => {
  const SOFT_CAP_THRESHOLD = 3.0;
  const HARD_CAP_THRESHOLD = 5.0;

  const increase = newHandicapIndex - lowestHandicapIndex;

  if (increase <= SOFT_CAP_THRESHOLD) {
    return newHandicapIndex;
  }

  if (increase > SOFT_CAP_THRESHOLD && increase <= HARD_CAP_THRESHOLD) {
    const x =
      lowestHandicapIndex +
      SOFT_CAP_THRESHOLD +
      (increase - SOFT_CAP_THRESHOLD) / 2;
    return x;
  }
  return lowestHandicapIndex + HARD_CAP_THRESHOLD;
};

/**
 * Applies handicap adjustment based on the length of a calculation in accordance to USGA.
 * @param handicapCalculation - The original handicap calculation.
 * @param scoreDifferentials - The score differentials relevant to the handicap calculation.
 * @returns The adjusted handicap calculation.
 */
function applyHandicapAdjustement(
  handicapCalculation: number,
  scoreDifferentials: number[]
) {
  const numberOfDifferentials = scoreDifferentials.length;
  if (numberOfDifferentials <= 3) {
    return handicapCalculation - 2;
  }
  if (numberOfDifferentials == 4 || numberOfDifferentials == 6) {
    return handicapCalculation - 1;
  }
  return handicapCalculation;
}
