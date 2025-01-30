export const CONSTANTS = {
  NINE_HOLES: 9,
  EIGHTEEN_HOLES: 18,
  MAX_SCORE_LENGTH: 2,
  MIN_SCORE: 0,
  MIN_HANDICAP: 1,
  MAX_HANDICAP: 18,
  MIN_PAR: 1,
  MAX_PAR: 5,
  MIN_DISTANCE: 1,
  MAX_DISTANCE: 700,
} as const;

export const BREAKPOINTS = {
  TABLE_WIDTH: {
    DEFAULT: "270px",
    SM: "350px",
    MD: "600px",
    LG: "725px",
    XL: "975px",
    "2XL": "1225px",
    "3XL": "1600px",
  },
} as const;
