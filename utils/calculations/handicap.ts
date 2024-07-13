import { Hole } from "@/types/round";

export const calculateCourseHandicap = (
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
) => {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
};

export const calculateScoreDifferential = (
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
) => {
  return ((adjustedGrossScore - courseRating) * 113) / slopeRating;
};

export const calculateAdjustedGrossScore = (holes: Hole[]) => {
  const adjustedScores = holes.map((hole) => {
    const adjustedScore = Math.min(hole.strokes, hole.par + 4);
    return adjustedScore;
  });
  return adjustedScores.reduce((acc, cur) => acc + cur);
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
  let differentials: number[] = [];
  if (scoreDifferentials.length < 20) {
    differentials = getRelevantDifferentials(sortedDifferentials);
  } else {
    differentials = sortedDifferentials.slice(0, 8);
  }
  return Math.round(
    differentials.reduce((acc, cur) => acc + cur) / differentials.length
  );
};

export const calculatePlayingHandicap = (courseHandicap: number) => {
  return Math.round(courseHandicap * 0.95);
};
