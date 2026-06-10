import { CalculatorMeta } from "@/types/calculators";

// Registry of all available calculators
export const CALCULATOR_REGISTRY: CalculatorMeta[] = [
  // Core Calculators
  {
    id: "course-handicap",
    name: "Course Handicap",
    description: "Calculate your course handicap for a specific set of tees",
    category: "core",
    inputs: [
      "handicapIndex",
      "slopeRating",
      "courseRating",
      "par",
      "holesPlayed",
    ],
    outputs: ["courseHandicap"],
    usgaLink:
      "https://www.usga.org/handicapping/roh/Content/rules/6%201a%2018%20holes.htm",
  },
  {
    id: "score-differential",
    name: "Score Differential",
    description: "Calculate the differential for a round you played",
    category: "core",
    inputs: ["adjustedGrossScore", "courseRating", "slopeRating"],
    outputs: ["scoreDifferential"],
    usgaLink:
      "https://www.usga.org/handicapping/roh/rules-of-handicapping.html#cshid=rule51a",
  },
  {
    id: "handicap-index",
    name: "Handicap Index",
    description: "Calculate your handicap index from your score differentials",
    category: "core",
    inputs: [], // Uses scoreDifferentials array
    outputs: ["handicapIndex"],
    usgaLink:
      "https://www.usga.org/handicapping/roh/Content/rules/5%201a%20Calculation%20of%20a%20Score%20Differential18Hole.htm",
  },
  {
    id: "net-score",
    name: "Net Score",
    description: "Calculate your net score after applying handicap strokes",
    category: "core",
    inputs: ["adjustedGrossScore", "courseHandicap"],
    outputs: [],
  },
  // Advanced Calculators
  {
    id: "playing-handicap",
    name: "Playing Handicap",
    description: "Calculate strokes received for different formats of play",
    category: "advanced",
    inputs: ["courseHandicap"],
    outputs: ["playingHandicap"],
    usgaLink:
      "https://www.usga.org/handicapping/roh/rules-of-handicapping.html#cshid=rule6",
  },
  {
    id: "what-if-scenario",
    name: "What-If Scenario",
    description: "See how a hypothetical round would affect your handicap",
    category: "advanced",
    inputs: ["handicapIndex", "courseRating", "slopeRating"],
    outputs: ["scoreDifferential", "handicapIndex"],
  },
  {
    id: "exceptional-score",
    name: "Exceptional Score Reduction",
    description: "Understand when and how ESR applies to your handicap",
    category: "advanced",
    inputs: ["handicapIndex", "scoreDifferential"],
    outputs: [],
    usgaLink:
      "https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/topics/exceptional-score-reduction.html",
  },
  {
    id: "target-score",
    name: "Target Score",
    description: "Find what score you need to reach a target handicap index",
    category: "advanced",
    inputs: ["handicapIndex", "courseRating", "slopeRating"],
    outputs: [],
  },
  // Educational Calculators
  {
    id: "handicap-caps",
    name: "Soft & Hard Cap Visualizer",
    description: "See how caps limit handicap increases over time",
    category: "educational",
    inputs: ["handicapIndex", "lowHandicapIndex"],
    outputs: [],
    usgaLink:
      "https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/topics/soft-cap-hard-cap.html",
  },
  {
    id: "nine-hole-equivalency",
    name: "9-Hole Equivalency",
    description:
      "Understand how 9-hole rounds convert to 18-hole differentials",
    category: "educational",
    inputs: [
      "handicapIndex",
      "courseRating",
      "slopeRating",
      "par",
      "adjustedGrossScore",
    ],
    outputs: ["scoreDifferential"],
    usgaLink:
      "https://www.usga.org/handicapping/roh/rules-of-handicapping.html#cshid=rule51b",
  },
  {
    id: "strokes-received",
    name: "Strokes Received",
    description: "See which holes you receive handicap strokes on",
    category: "educational",
    inputs: ["courseHandicap"],
    outputs: [],
  },
  {
    id: "max-score",
    name: "Maximum Hole Score",
    description:
      "See your max score per hole for handicap purposes (Net Double Bogey)",
    category: "educational",
    inputs: ["courseHandicap"],
    outputs: [],
    usgaLink:
      "https://www.usga.org/handicapping/roh/Content/rules/3%201a%20Before%20a%20Handicap%20Index%20Has%20Been%20Established.htm",
  },
];

export function getCalculatorsByCategory(category: CalculatorMeta["category"]) {
  return CALCULATOR_REGISTRY.filter((calc) => calc.category === category);
}

export function getCalculatorById(id: string): CalculatorMeta | undefined {
  return CALCULATOR_REGISTRY.find((calc) => calc.id === id);
}

export function getCalculatorByIdOrThrow(id: string): CalculatorMeta {
  const calculator = CALCULATOR_REGISTRY.find((calc) => calc.id === id);
  if (!calculator) {
    throw new Error(`Calculator '${id}' not found in registry`);
  }
  return calculator;
}
