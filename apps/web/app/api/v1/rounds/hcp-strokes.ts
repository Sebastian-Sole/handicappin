/**
 * The SERVER-SIDE `hcpStrokes` derivation — contract §2's named build
 * dependency, the one "which neither 002 nor this contract specifies".
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `submit-scorecard.ts` persists the CLIENT-supplied `hcpStrokes` verbatim
 * (`hcpStrokes: score.hcpStrokes` in `scoreInserts`), and — more importantly —
 * feeds it into the in-transaction calculation that produces the 201's
 * `adjustedPlayedScore` / `adjustedGrossScore` / `scoreDifferential`.
 * `calculateHoleAdjustedScore` caps each hole at
 * `min(par + 5, par + 2 + score.hcpStrokes)`, so a client that submits
 * `hcpStrokes: 0` on every hole gets each hole capped at par + 2 — a LOWER
 * adjusted score, a LOWER differential, and a better handicap. That is a live
 * handicap-manipulation vector on the one surface a third party can write to.
 *
 * The asynchronous recomputation does re-derive (`addHcpStrokesToScores` in
 * `supabase/functions/handicap-shared/utils.ts`), so the corruption is
 * eventually corrected — but "eventually" is exactly what §5 tells clients
 * NOT to rely on, and the 201 body is contractual.
 *
 * ── Why the derivation is here and not inside the service ─────────────────
 * §2 asks for "a server-side `hcpStrokes` derivation step BEFORE the service
 * call", which is what this is. Deriving inside `submitScorecard` instead
 * would put a behavioural change into the code path the web and native submit
 * flows also run — a second, deeper change to shared write logic inside the
 * riskiest task in the plan. This module changes nothing for those paths.
 *
 * The cost of being outside the transaction is named honestly: the service
 * re-reads `profile.handicapIndex` under a row lock and recomputes
 * `courseHandicap` from it, so if the index changes between this read and
 * that one, the derived strokes are one revision stale. The failure is
 * bounded (a stroke on at most a few holes, self-correcting on the next
 * recomputation) and is strictly better than the status quo of trusting the
 * client. Moving the derivation in-transaction is the clean fix when someone
 * next opens the service.
 *
 * ── Why it reuses `addHcpStrokesToScores` rather than reimplementing it ────
 * That function IS the USGA Rule 6.1 allocation the recomputation applies
 * (`fullDivision` to every hole, the remainder to the lowest stroke indices,
 * ties broken by hole id). Reimplementing it here would let the provisional
 * and authoritative allocations drift silently. It matches scores to holes by
 * `holeId`, and a `/v1` submission carries none, so the holes and scores are
 * paired POSITIONALLY first and given synthetic ids equal to their submission
 * position — which reproduces the real tie-break, because real hole ids are
 * assigned in `holeNumber` order and the service slices the same section.
 */

import {
  addHcpStrokesToScores,
  calculateCourseHandicap,
} from "@handicappin/handicap-core";

import type {
  V1RoundSubmissionWithHoles,
} from "@/app/api/v1/rounds/submission-schema";

/**
 * The section-aware slice of the tee's 18 holes, byte-for-byte the rule
 * `submit-scorecard.ts` applies in `getRoundCalculations` and again for the
 * score insert: 18-hole → `0..17`, 9-hole front → `0..8`, 9-hole back →
 * `9..17`. Duplicating the RULE (not the code) is unavoidable across the
 * service boundary; a mismatch would misalign the stroke indices, so the
 * length is asserted by the caller.
 */
export function holesForSection<T>(
  holes: readonly T[],
  holesPlayed: number,
  section: "front" | "back"
): T[] {
  if (holesPlayed === 18) return holes.slice(0, 18);
  if (holesPlayed === 9 && section === "back") return holes.slice(9, 18);
  return holes.slice(0, 9);
}

/**
 * Return a copy of `submission` whose per-hole `hcpStrokes` are derived from
 * the server's own inputs — the account's handicap index and the tee's stroke
 * indices — instead of taken from the client.
 *
 * Returns the submission UNCHANGED when the derivation cannot be performed
 * honestly (no profile row, or a hole slice that does not line up with the
 * submitted scores). Both cases are already fatal a moment later inside the
 * service — a missing profile is `403 plan_required` via the entitlement
 * gate, and a bad slice throws there — so degrading here would only replace a
 * precise error with a vague one.
 */
export function deriveServerHcpStrokes(
  submission: V1RoundSubmissionWithHoles,
  handicapIndex: number | null
): V1RoundSubmissionWithHoles {
  if (handicapIndex === null || !Number.isFinite(handicapIndex)) {
    return submission;
  }

  const { teePlayed, scores, nineHoleSection } = submission;
  const holesPlayed = scores.length;
  // The service defaults an absent section to "front" (legacy behaviour);
  // matching it here keeps the two allocations on the same holes.
  const section: "front" | "back" = nineHoleSection ?? "front";

  const sectionHoles = holesForSection(teePlayed.holes, holesPlayed, section);
  if (sectionHoles.length !== holesPlayed) {
    return submission;
  }

  const courseHandicap = calculateCourseHandicap(
    handicapIndex,
    teePlayed,
    holesPlayed,
    section
  );

  // Synthetic ids = submission position. `addHcpStrokesToScores` pairs on
  // `score.holeId === hole.id` and tie-breaks equal stroke indices on `id`;
  // position ordering reproduces the real hole-id ordering because hole rows
  // are inserted in `holeNumber` order within the sliced section.
  const positionalHoles = sectionHoles.map((hole, position) => ({
    ...hole,
    id: position,
  }));
  const positionalScores = scores.map((score, position) => ({
    ...score,
    holeId: position,
  }));

  const derived = addHcpStrokesToScores(
    positionalHoles,
    positionalScores,
    courseHandicap,
    holesPlayed
  );

  return {
    ...submission,
    scores: scores.map((score, position) => ({
      ...score,
      hcpStrokes: derived[position]?.hcpStrokes ?? score.hcpStrokes,
    })),
  };
}
