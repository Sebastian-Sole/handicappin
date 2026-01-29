// Calculator field types for interoperability
export type CalculatorFieldType =
  | "handicapIndex"
  | "courseHandicap"
  | "playingHandicap"
  | "scoreDifferential"
  | "adjustedGrossScore"
  | "courseRating"
  | "slopeRating"
  | "par"
  | "holesPlayed"
  | "lowHandicapIndex";

// Calculator metadata for registry
export interface CalculatorMeta {
  id: string;
  name: string;
  description: string;
  category: "core" | "advanced" | "educational";
  inputs: CalculatorFieldType[];
  outputs: CalculatorFieldType[];
  usgaLink?: string;
}

// Shared values state
export interface CalculatorValues {
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  scoreDifferential: number | null;
  adjustedGrossScore: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  par: number | null;
  holesPlayed: 9 | 18;
  lowHandicapIndex: number | null;
  // For handicap index calculation
  scoreDifferentials: number[];
}
