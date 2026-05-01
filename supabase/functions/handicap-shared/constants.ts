// Mirror of packages/handicap-core/src/constants.ts.
// The Deno edge runtime can't import from the workspace package, so this file
// is the single source of truth for handicap constants used by edge functions.
// Keep these values in sync with packages/handicap-core/src/constants.ts.

export const EXCEPTIONAL_ROUND_THRESHOLD = 7;
export const MAX_SCORE_DIFFERENTIAL = 54;
export const ESR_WINDOW_SIZE = 20;
