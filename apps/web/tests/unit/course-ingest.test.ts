import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { rawCourseSchema } from "../../scripts/course-ingest/contract";
import { emitSql } from "../../scripts/course-ingest/emit-sql";
import { normalize } from "../../scripts/course-ingest/normalize";
import { validate } from "../../scripts/course-ingest/validate";

function loadRaw(name: string) {
  const url = new URL(
    `../../scripts/course-ingest/fixtures/${name}`,
    import.meta.url,
  );
  return rawCourseSchema.parse(JSON.parse(readFileSync(url, "utf8")));
}

describe("course-ingest pipeline", () => {
  it("9-hole par-3 (Ballerud): expands to 18, derives nine-ratings, passes with warnings", () => {
    const raw = loadRaw("ballerud.raw.json");
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []); // [] => deterministic (no fs dedup)

    expect(result.ok).toBe(true);
    expect(meta.nineHoleExpanded).toBe(true);
    expect(meta.fabricatedNineRatings).toBe(true);
    expect(result.findings.some((f) => f.code === "ratings:fabricated-nine")).toBe(true);
    expect(result.findings.every((f) => f.level !== "error")).toBe(true);

    const tee = resolved.tees![0];
    expect(tee.courseRating18).toBe(26.4);
    expect(tee.courseRatingFront9).toBe(13.2); // derived = 26.4 / 2
    expect(tee.outPar).toBe(27);
    expect(tee.totalPar).toBe(54);
    expect(tee.totalDistance).toBe(1768);
    expect(tee.holes).toHaveLength(18);
    // back-nine stroke index = front + 1 (9->18 expansion)
    expect(tee.holes![9].hcp).toBe(tee.holes![0].hcp + 1);
  });

  it("18-hole multi-tee with real nine-ratings: clean run, no findings", () => {
    const raw = loadRaw("test-links-18.raw.json");
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []);

    expect(result.ok).toBe(true);
    expect(meta.nineHoleExpanded).toBe(false);
    expect(meta.fabricatedNineRatings).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(resolved.tees).toHaveLength(2);
    expect(resolved.tees!.map((t) => t.gender)).toEqual(["mens", "ladies"]);
  });

  it("emits seed-compatible DO-block SQL", () => {
    const raw = loadRaw("test-links-18.raw.json");
    const { resolved } = normalize(raw);
    const sql = emitSql(resolved, { nineHole: false });

    expect(sql).toContain("do $$");
    expect(sql).toContain("insert into public.course");
    expect(sql).toContain('insert into public."teeInfo"');
    expect((sql.match(/returning id into v_tee_id_/g) || []).length).toBe(2);
    expect((sql.match(/insert into public\.hole/g) || []).length).toBe(36);
    expect(sql.trimEnd().endsWith("end $$;")).toBe(true);
  });

  it("hard-fails a stroke-index collision (structural error, not a warning)", () => {
    const raw = loadRaw("test-links-18.raw.json");
    raw.strokeIndexMen[17] = 1; // duplicate 1, drop 18 -> no longer a permutation
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []);

    expect(result.ok).toBe(false);
    expect(
      result.findings.some(
        (f) => f.level === "error" && (f.code === "hcp:permutation" || f.code.startsWith("zod:")),
      ),
    ).toBe(true);
  });

  it("per-tee par override: ladies tee stores its own par; men's tee untouched", () => {
    const raw = loadRaw("test-links-18.raw.json");
    // UK case: ladies play hole 1 as a par 5 where men play par 4 -> par 73.
    const ladiesPars = [...raw.pars];
    ladiesPars[0] = 5;
    raw.tees[1].pars = ladiesPars; // Red / ladies
    const { resolved } = normalize(raw);

    const mens = resolved.tees!.find((t) => t.gender === "mens")!;
    const ladies = resolved.tees!.find((t) => t.gender === "ladies")!;

    expect(ladies.holes![0].par).toBe(5);
    expect(ladies.outPar).toBe(37);
    expect(ladies.totalPar).toBe(73);
    // the override is scoped to its tee — men's par is still the course default
    expect(mens.holes![0].par).toBe(4);
    expect(mens.totalPar).toBe(72);
  });

  it("per-tee stroke-index override applies to that tee only and stays valid", () => {
    const raw = loadRaw("test-links-18.raw.json");
    // a distinct but valid 1..18 permutation (rotate by 8)
    const customSi = Array.from({ length: 18 }, (_, i) => ((i + 8) % 18) + 1);
    raw.tees[0].strokeIndex = customSi; // White / mens
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []);

    expect(result.ok).toBe(true);
    const mens = resolved.tees!.find((t) => t.gender === "mens")!;
    expect(mens.holes!.map((h) => h.hcp)).toEqual(customSi);
  });

  it("rejects a per-tee pars array whose length doesn't match the course", () => {
    const raw = loadRaw("test-links-18.raw.json");
    const bad = JSON.parse(JSON.stringify(raw));
    bad.tees[1].pars = [4, 5, 3]; // 3 entries on an 18-hole course
    expect(() => rawCourseSchema.parse(bad)).toThrow();
  });

  it("flags a 9-hole rating mis-stored in the 18-round field (regulation course)", () => {
    const raw = loadRaw("test-links-18.raw.json");
    raw.tees[0].courseRating18 = 33.0; // a 9-hole figure on a regulation par-72 course
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []);
    expect(result.findings.some((f) => f.code === "ratings:suspect-18-field")).toBe(true);
  });

  it("does NOT flag a genuine par-3 course's legitimately low rating", () => {
    const raw = loadRaw("ballerud.raw.json"); // all par-3, CR ~26
    const { resolved, meta } = normalize(raw);
    const result = validate(resolved, meta, []);
    expect(result.findings.some((f) => f.code === "ratings:suspect-18-field")).toBe(false);
  });
});
