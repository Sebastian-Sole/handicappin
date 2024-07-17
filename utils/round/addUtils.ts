import { toast } from "@/components/ui/use-toast";
import { addRoundFormSchema, RoundMutation } from "@/types/round";
import { z } from "zod";
import {
  calculateAdjustedPlayedScore,
  calculateAdjustedGrossScore,
  calculateScoreDifferential,
} from "../calculations/handicap";
import { Tables } from "@/types/supabase";

export const translateRound = (
  values: z.infer<typeof addRoundFormSchema>,
  profile: Tables<"Profile">
): RoundMutation | null => {
  console.log("SUBMITTING FORM");
  console.log(values);

  const { courseRating, par, slope } = values.courseInfo;

  const isInputParNine = values.holes.length === 9;

  const getFirstNineHolesPar = values.holes
    .slice(0, 9)
    .reduce((acc, cur) => acc + cur.par, 0);

  const nineHolePar = isInputParNine ? par : getFirstNineHolesPar;

  const eighteenHolePar = isInputParNine ? par * 2 : par;

  const adjustedPlayedScore = calculateAdjustedPlayedScore(values.holes);

  console.log("Adjusted played score: ", adjustedPlayedScore);

  // Todo: Input correct par for course with data for 18 holes
  const adjustedGrossScore = calculateAdjustedGrossScore(
    values.holes,
    profile.handicapIndex,
    slope,
    courseRating,
    eighteenHolePar
  );

  if (adjustedGrossScore instanceof Error) {
    console.error("Error calculating adjusted gross score");
    console.error(adjustedGrossScore);
    toast({
      title: "❌ Error calculating adjusted gross score",
      description: "Please fill in all the required fields",
    });
    return null;
  }

  const scoreDiff = calculateScoreDifferential(
    adjustedGrossScore,
    courseRating,
    slope
  );

  return {
    userId: values.userId,
    courseInfo: values.courseInfo,
    holes: values.holes,
    adjustedPlayedScore,
    adjustedGrossScore,
    scoreDifferential: scoreDiff,
    totalStrokes: values.holes.reduce((acc, cur) => acc + cur.strokes, 0),
    existingHandicapIndex: profile.handicapIndex,
    teeTime: values.date ?? new Date(),
    courseRating,
    slopeRating: slope,
    nineHolePar,
    eighteenHolePar,
    parPlayed: par,
  };
};
