/**
 * Convert a finished RoundSession into the existing round.submitScorecard
 * payload (ScorecardInput). Mirrors app/rounds/add.tsx exactly: hcpStrokes
 * are 0 (the server computes them), approvalStatus is derived from
 * course + tee approval, and the FROZEN tee snapshot goes up as teePlayed
 * (the server backfills holeIds positionally from it).
 */
import type { ScoreInput, ScorecardInput } from "@/lib/scorecard";
import type { RoundSession } from "@/lib/round-session/types";

export type SubmitAs = "18" | "front9" | "back9" | "nine";

export interface ToScorecardOptions {
  /** ISO datetime chosen at review (defaults to session.startedAt there). */
  teeTime: string;
  submitAs: SubmitAs;
}

const entryScores = (
  s: RoundSession,
  start: number,
  end: number,
): ScoreInput[] =>
  s.entries.slice(start, end).map((entry, offset) => {
    if (entry.strokes === null) {
      throw new Error(
        `Hole ${s.displayedHoles[start + offset]?.holeNumber ?? start + offset + 1} has no score`,
      );
    }
    // Detail rides along only for detailed rounds (plan 013), mirroring
    // add.tsx exactly: penalties default to 0 for entered holes (the
    // stepper means "0 unless stated"); putts/fairway are OMITTED when not
    // recorded (keys must survive the pendingSubmit JSON round-trip, so
    // never an explicit undefined). Non-detailed rounds strip everything —
    // byte-identical to the pre-013 payload.
    if (!s.detailed) {
      return { strokes: entry.strokes, hcpStrokes: 0 };
    }
    return {
      strokes: entry.strokes,
      hcpStrokes: 0,
      ...(entry.putts != null ? { putts: entry.putts } : {}),
      ...(entry.fairwayHit != null ? { fairwayHit: entry.fairwayHit } : {}),
      penaltyStrokes: entry.penaltyStrokes ?? 0,
    };
  });

export function toScorecardInput(
  s: RoundSession,
  opts: ToScorecardOptions,
): ScorecardInput {
  const { teeTime, submitAs } = opts;

  let scores: ScoreInput[];
  let nineHoleSection: "front" | "back" | undefined;

  switch (submitAs) {
    case "18":
      if (s.holeCount !== 18) {
        throw new Error("Cannot submit a 9-hole session as 18 holes");
      }
      scores = entryScores(s, 0, 18);
      nineHoleSection = undefined;
      break;
    case "front9":
    case "back9":
      if (s.holeCount !== 18) {
        throw new Error("front9/back9 apply to 18-hole sessions only");
      }
      nineHoleSection = submitAs === "front9" ? "front" : "back";
      scores =
        submitAs === "front9" ? entryScores(s, 0, 9) : entryScores(s, 9, 18);
      break;
    case "nine":
      if (s.holeCount !== 9 || s.nineHoleSection === undefined) {
        throw new Error("'nine' applies to 9-hole sessions only");
      }
      scores = entryScores(s, 0, 9);
      nineHoleSection = s.nineHoleSection;
      break;
  }

  const isAutoApproved =
    s.course.approvalStatus === "approved" &&
    s.tee.approvalStatus === "approved";

  return {
    userId: s.userId,
    course: {
      id: s.course.id,
      name: s.course.name,
      approvalStatus: s.course.approvalStatus,
      country: s.course.country,
      city: s.course.city,
      website: s.course.website,
    },
    teePlayed: s.tee,
    scores,
    teeTime,
    approvalStatus: isAutoApproved ? "approved" : "pending",
    notes: s.notes,
    // Omit the key entirely for 18-hole submits — an explicit `undefined`
    // wouldn't survive the JSON round-trip through the pendingSubmit slot.
    ...(nineHoleSection ? { nineHoleSection } : {}),
  };
}
