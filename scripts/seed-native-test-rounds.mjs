/**
 * Seed rounds for the native-goal test user THROUGH THE APP'S REAL WRITE
 * PATH (tRPC round.submitScorecard against the local web server), per the
 * handoff's test-data strategy (§7b). Reference data (an approved course +
 * tee + holes) is read from the local Supabase REST API; the writes all go
 * through the web server so handicap math, queue processing, and RLS run
 * exactly as in production.
 *
 * Usage: node scripts/seed-native-test-rounds.mjs [count]
 */

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const API_BASE = "http://localhost:3000";
const EMAIL = "native-goal-test@handicappin.local";
const PASSWORD = "NativeGoal2026!";

const count = Number(process.argv[2] ?? 3);

async function supabaseGet(path, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken ?? ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`REST ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  // 1. Real sign-in for a bearer token.
  const tokenRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    },
  );
  if (!tokenRes.ok) throw new Error(`sign-in failed: ${tokenRes.status}`);
  const { access_token, user } = await tokenRes.json();
  console.log(`signed in as ${user.email} (${user.id})`);

  // 2. Reference data: first approved course with an approved 18-hole tee.
  const courses = await supabaseGet(
    "course?select=*&approvalStatus=eq.approved&limit=5",
    access_token,
  );
  let course = null;
  let tee = null;
  let holes = null;
  for (const c of courses) {
    const tees = await supabaseGet(
      `teeInfo?select=*&courseId=eq.${c.id}&approvalStatus=eq.approved&isArchived=eq.false&limit=3`,
      access_token,
    );
    for (const t of tees) {
      const hs = await supabaseGet(
        `hole?select=*&teeId=eq.${t.id}&order=holeNumber.asc`,
        access_token,
      );
      if (hs.length === 18) {
        course = c;
        tee = t;
        holes = hs;
        break;
      }
    }
    if (course) break;
  }
  if (!course || !tee || !holes) throw new Error("no approved course/tee/holes found");
  console.log(`course: ${course.name} — tee: ${tee.name} (${tee.gender})`);

  // 3. Submit rounds through tRPC (superjson envelope: {json: ...}).
  for (let i = 0; i < count; i++) {
    const daysAgo = (count - i) * 7;
    const teeTime = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    teeTime.setHours(9 + i, 30, 0, 0);

    const scores = holes.map((hole, idx) => ({
      strokes: hole.par + ((idx + i) % 3), // bogey-ish golf, varies per round
      hcpStrokes: 0,
    }));

    const payload = {
      userId: user.id,
      course: {
        id: course.id,
        name: course.name,
        approvalStatus: "approved",
        country: course.country,
        city: course.city,
        website: course.website ?? "",
      },
      teePlayed: {
        id: tee.id,
        name: tee.name,
        gender: tee.gender,
        courseRating18: tee.courseRating18,
        slopeRating18: tee.slopeRating18,
        courseRatingFront9: tee.courseRatingFront9,
        slopeRatingFront9: tee.slopeRatingFront9,
        courseRatingBack9: tee.courseRatingBack9,
        slopeRatingBack9: tee.slopeRatingBack9,
        outPar: tee.outPar,
        inPar: tee.inPar,
        totalPar: tee.totalPar,
        outDistance: tee.outDistance,
        inDistance: tee.inDistance,
        totalDistance: tee.totalDistance,
        distanceMeasurement: tee.distanceMeasurement,
        approvalStatus: "approved",
        courseId: course.id,
        holes: holes.map((h) => ({
          id: h.id,
          teeId: h.teeId,
          holeNumber: h.holeNumber,
          par: h.par,
          hcp: h.hcp,
          distance: h.distance,
        })),
      },
      scores,
      teeTime: teeTime.toISOString(),
      approvalStatus: "approved",
      notes: `Seeded test round ${i + 1}`,
    };

    const res = await fetch(`${API_BASE}/api/trpc/round.submitScorecard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ json: payload }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`round ${i + 1} failed: ${res.status} ${body.slice(0, 400)}`);
    }
    console.log(`round ${i + 1} submitted (${teeTime.toDateString()})`);
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
