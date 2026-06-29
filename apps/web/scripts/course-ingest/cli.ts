#!/usr/bin/env tsx
/**
 * course-ingest CLI — raw scraped JSON -> validated DO-block SQL.
 *
 *   pnpm --filter web exec tsx scripts/course-ingest/cli.ts <raw.json> [flags]
 *
 * Flags:
 *   --print        Print SQL to stdout; do not write a file.
 *   --approve      Mark course + tees 'approved' (default: 'pending' — review first).
 *   --out <dir>    Output dir (default: <repo>/scripts/sql/_staging).
 *   --json         Emit a machine-readable {ok, findings, sqlPath} report to stdout.
 *
 * Exit code is non-zero when validation finds an ERROR (SQL is not written).
 * WARN findings never block — they are for human/agent review.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { rawCourseSchema } from "./contract";
import { emitSql, slugify } from "./emit-sql";
import { normalize } from "./normalize";
import { validate, type Finding } from "./validate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const SEED_SQL_DIR = join(REPO_ROOT, "scripts/sql");

function parseArgs(argv: string[]) {
  const flags = { print: false, approve: false, json: false, out: "" };
  let input = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--print") flags.print = true;
    else if (a === "--approve") flags.approve = true;
    else if (a === "--json") flags.json = true;
    else if (a === "--out") flags.out = argv[++i];
    else if (!a.startsWith("--")) input = a;
  }
  return { input, flags };
}

function existingCourseNames(): string[] {
  const names: string[] = [];
  if (!existsSync(SEED_SQL_DIR)) return names;
  for (const f of readdirSync(SEED_SQL_DIR)) {
    if (!f.endsWith(".sql")) continue;
    const header = readFileSync(join(SEED_SQL_DIR, f), "utf8")
      .split("\n")
      .find((l) => l.startsWith("-- Course:"));
    if (header) names.push(header.replace("-- Course:", "").trim());
  }
  return names;
}

const ICON: Record<string, string> = { error: "✖", warn: "⚠", info: "ℹ" };

function printReport(name: string, findings: Finding[]) {
  console.error(`\nCourse: ${name}`);
  if (findings.length === 0) {
    console.error("  ✔ clean — no findings");
    return;
  }
  for (const f of findings) {
    const where = f.path ? ` [${f.path}]` : "";
    console.error(`  ${ICON[f.level]} ${f.level.toUpperCase()} (${f.code})${where}: ${f.message}`);
  }
}

function main() {
  const { input, flags } = parseArgs(process.argv.slice(2));
  if (!input) {
    console.error("Usage: cli.ts <raw.json> [--print] [--approve] [--out <dir>] [--json]");
    process.exit(2);
  }

  const rawText = input === "-" ? readFileSync(0, "utf8") : readFileSync(input, "utf8");
  const raw = rawCourseSchema.parse(JSON.parse(rawText));
  if (flags.approve) raw.approvalStatus = "approved";

  const { resolved, meta } = normalize(raw);
  const result = validate(resolved, meta, existingCourseNames());
  const sql = emitSql(resolved, { nineHole: raw.isNineHole });

  let sqlPath = "";
  if (result.ok && !flags.print) {
    const outDir = flags.out ? resolve(flags.out) : join(SEED_SQL_DIR, "_staging");
    mkdirSync(outDir, { recursive: true });
    sqlPath = join(outDir, `${slugify(resolved.name)}.sql`);
    writeFileSync(sqlPath, sql);
  }

  if (flags.json) {
    console.log(JSON.stringify({ ok: result.ok, findings: result.findings, sqlPath }, null, 2));
  } else {
    printReport(resolved.name, result.findings);
    if (flags.print) {
      console.error("\n--- SQL ---");
      console.log(sql);
    } else if (result.ok) {
      console.error(`\n✔ wrote ${sqlPath} (approvalStatus='${raw.approvalStatus}')`);
    } else {
      console.error("\n✖ validation failed — SQL not written. Fix the ERROR findings above.");
    }
  }

  process.exit(result.ok ? 0 : 1);
}

main();
