/**
 * Idempotent loader for staged course-ingest SQL.
 *
 * Applies every scripts/sql/_staging/*.sql (in filename order) to the
 * database. Each staged file is a self-contained `do $$ ... $$` block that
 * inserts one course plus its tees and holes with approvalStatus 'pending'.
 *
 * Idempotency: before executing a file, the course identity (name, city,
 * country — literal strings in the staged format) is parsed from the file's
 * first `insert into public.course` statement; the file is skipped when a
 * row already exists for the (name, country, city) unique key.
 *
 * Provenance: after a file loads, the course row is marked source='ingest'
 * (the staged files are generator output and are never edited; the loader
 * owns provenance).
 *
 * Usage:
 *   node scripts/load-staged-courses.mjs [--dry-run] [--approve]
 *
 *   --dry-run   parse and list every file with its load/skip status;
 *               execute nothing. Degrades without a DB: when DATABASE_URL
 *               is unset or the connection fails, existence is reported as
 *               "unknown (no DB)" and the script still exits 0.
 *   --approve   after loading a file, set approvalStatus='approved' on that
 *               course and its teeInfo rows. Applies ONLY to files loaded in
 *               this run (skipped files are untouched) — the human review
 *               gate: default is pending until an operator approves.
 *
 * Connection: DATABASE_URL (same variable as apps/web/db/index.ts), read
 * from process.env first, then apps/web/.env.local, then apps/web/.env —
 * matching scripts/reconcile-billing.mjs's env convention.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_DIR = join(ROOT, "scripts", "sql", "_staging");

function loadEnv() {
  const env = { ...process.env };
  for (const file of ["apps/web/.env.local", "apps/web/.env"]) {
    try {
      const content = readFileSync(join(ROOT, file), "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && env[match[1]] === undefined) {
          env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // file absent — fine
    }
  }
  return env;
}

/**
 * Parse (name, city, country) from the file's first
 * `insert into public.course (name, city, country, ...) values ('..', ...)`.
 * Values are SQL single-quoted literals ('' is an escaped quote), so names
 * containing apostrophes/commas/ampersands parse correctly.
 */
function parseCourseIdentity(sqlText) {
  const headerRe =
    /insert\s+into\s+public\.course\s*\(\s*name\s*,\s*city\s*,\s*country\b[^)]*\)\s*values\s*\(/i;
  const m = sqlText.match(headerRe);
  if (m === null) {
    throw new Error(
      "no `insert into public.course (name, city, country, ...) values (` statement found"
    );
  }
  const literals = [];
  let current = null; // null = outside a literal
  for (let i = m.index + m[0].length; i < sqlText.length; i++) {
    const char = sqlText[i];
    if (current === null) {
      if (char === "'") {
        current = "";
      } else if (char === ")") {
        break; // end of values(...) before 3 literals
      }
    } else if (char === "'") {
      if (sqlText[i + 1] === "'") {
        current += "'"; // '' → escaped quote
        i++;
      } else {
        literals.push(current);
        current = null;
        if (literals.length === 3) break;
      }
    } else {
      current += char;
    }
  }
  if (literals.length < 3) {
    throw new Error(
      `expected 3 leading string literals (name, city, country), found ${literals.length}`
    );
  }
  const [name, city, country] = literals;
  return { name, city, country };
}

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = args.includes("--dry-run");
  const APPROVE = args.includes("--approve");

  const files = readdirSync(STAGING_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.log(`No .sql files in ${STAGING_DIR} — nothing to do.`);
    return 0;
  }

  const env = loadEnv();
  let sql = null;
  if (env.DATABASE_URL) {
    const candidate = postgres(env.DATABASE_URL, {
      prepare: false,
      max: 1,
      connect_timeout: 5,
      onnotice: () => {}, // staged files `raise notice`; the loader logs its own lines
    });
    try {
      await candidate`select 1`;
      sql = candidate;
    } catch (error) {
      await candidate.end({ timeout: 1 }).catch(() => {});
      if (!DRY_RUN) {
        console.error(`Cannot connect to DATABASE_URL: ${error.message}`);
        return 1;
      }
      console.log(`(no DB: connection failed — ${error.message})`);
    }
  } else if (!DRY_RUN) {
    console.error(
      "DATABASE_URL is not set (env or apps/web/.env.local / apps/web/.env)."
    );
    return 1;
  } else {
    console.log("(no DB: DATABASE_URL is not set)");
  }

  const courseExists = async ({ name, country, city }) => {
    const rows = await sql`
      select 1 from public.course
      where name = ${name} and country = ${country} and city = ${city}
      limit 1
    `;
    return rows.length > 0;
  };

  let loaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    let identity;
    try {
      identity = parseCourseIdentity(
        readFileSync(join(STAGING_DIR, file), "utf8")
      );
    } catch (error) {
      console.error(`FAIL ${file}: ${error.message}`);
      failed++;
      continue;
    }
    const label = `${identity.name} (${identity.city}, ${identity.country})`;

    if (DRY_RUN) {
      if (sql === null) {
        console.log(`WOULD LOAD ${file}: ${label} — existence unknown (no DB)`);
        loaded++;
      } else if (await courseExists(identity)) {
        console.log(`SKIP ${file}: already loaded — ${label}`);
        skipped++;
      } else {
        console.log(
          `WOULD LOAD ${file}: ${label}${APPROVE ? " [would approve]" : ""}`
        );
        loaded++;
      }
      continue;
    }

    if (await courseExists(identity)) {
      console.log(`SKIP ${file}: already loaded`);
      skipped++;
      continue;
    }

    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(STAGING_DIR, file), "utf8"));
        await tx`
          update public.course set "source" = 'ingest'
          where name = ${identity.name}
            and country = ${identity.country}
            and city = ${identity.city}
        `;
        if (APPROVE) {
          await tx`
            update public.course set "approvalStatus" = 'approved'
            where name = ${identity.name}
              and country = ${identity.country}
              and city = ${identity.city}
          `;
          await tx`
            update public."teeInfo" set "approvalStatus" = 'approved'
            where "courseId" in (
              select id from public.course
              where name = ${identity.name}
                and country = ${identity.country}
                and city = ${identity.city}
            )
          `;
        }
      });
      console.log(`LOAD ${file}: ${label}${APPROVE ? " [approved]" : ""}`);
      loaded++;
    } catch (error) {
      console.error(`FAIL ${file}: ${error.message}`);
      failed++;
    }
  }

  if (sql !== null) await sql.end({ timeout: 5 });

  const verb = DRY_RUN ? "would load" : "loaded";
  console.log(
    `\n${files.length} file(s): ${loaded} ${verb}, ${skipped} skipped, ${failed} failed.`
  );
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
