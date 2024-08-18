import { calculateCourseHandicap } from "../../utils/calculations/handicap";
import { expect, test } from "vitest";

const HANDICAP_INDEX = 54;
const COURSE_RATING = 50.3;
const SLOPE_RATING = 82;
const PAR_VALUE = 54;
const COURSE_HANDICAP_CALCULATION = 35.485840708;

test("calculates course handicap", () => {
  expect(
    calculateCourseHandicap(
      HANDICAP_INDEX,
      SLOPE_RATING,
      COURSE_RATING,
      PAR_VALUE
    )
  ).toBe(Math.round(COURSE_HANDICAP_CALCULATION));
});
