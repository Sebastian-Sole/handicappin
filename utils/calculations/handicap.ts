import { Hole } from "@/types/round";

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
  console.log("Adjusted Gross Score: ", adjustedGrossScore);
  console.log("Course Rating: ", courseRating);
  console.log("Slope Rating: ", slopeRating);
  console.log(
    "Differential: ",
    (adjustedGrossScore - courseRating) * (113 / slopeRating)
  );
  return (adjustedGrossScore - courseRating) * (113 / slopeRating);
};

/**
 * Calculates the hole-adjusted score for a given hole.
 *
 * @param hole - The hole object containing information about the hole.
 * @param handicapStrokes - The number of handicap strokes for the player (optional).
 * @returns The hole-adjusted score.
 */
export const calculateHoleAdjustedScore = (
  hole: Hole,
  handicapStrokes?: number
): number => {
  return Math.min(hole.strokes, hole.par + 4);
};

/**
 * Calculates the adjusted played score based on the provided holes.
 * The adjusted score for each hole is calculated as the minimum value between the strokes and the par + 4.
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

const getRelevantDifferentials = (scoreDifferentials: number[]) => {
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

export const calculateHandicapIndex = (scoreDifferentials: number[]) => {
  const sortedDifferentials = scoreDifferentials.sort((a, b) => a - b);
  let differentials: number[] = getRelevantDifferentials(sortedDifferentials);
  return (
    Math.round(
      (differentials.reduce((acc, cur) => acc + cur) / differentials.length) *
        10
    ) / 10
  );
};

export const calculatePlayingHandicap = (courseHandicap: number) => {
  return Math.round(courseHandicap * 0.95);
};
