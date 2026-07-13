#!/usr/bin/env node

/**
 * Handicap Engine Sync Checker
 *
 * Validates that the handicap math engine in `packages/handicap-core` stays
 * in sync with its hand-maintained Deno mirror in
 * `supabase/functions/handicap-shared`. The Deno edge runtime cannot import
 * workspace packages (see the header comment in
 * supabase/functions/handicap-shared/constants.ts), so
 * process-handicap-queue — the function that computes every user's
 * production handicap — depends on a byte-for-byte copy of the math instead
 * of the package that ships to web/native. This script is the machine-check
 * that keeps that copy honest.
 *
 * File pairs checked:
 * - packages/handicap-core/src/calculations.ts
 *     <-> supabase/functions/handicap-shared/utils.ts
 * - packages/handicap-core/src/constants.ts
 *     <-> supabase/functions/handicap-shared/constants.ts
 * - packages/handicap-core/src/timeline.ts
 *     <-> supabase/functions/handicap-shared/timeline.ts
 *
 * Normalization applied before comparing (in order):
 * 1. Strip all comments (JSDoc/block and line) — headers, doc comments, and
 *    path references (e.g. "packages/handicap-core" vs "handicap-shared")
 *    are expected to differ and are not part of the math.
 * 2. Strip all import statements — Deno uses `.ts`-suffixed relative
 *    imports and a different Zod source; import specifiers are expected to
 *    differ.
 * 3. Remove the EXPLICITLY ALLOWED package-only exports (`RoundLike` type
 *    and `getRelevantRounds` function) from the calculations.ts side only —
 *    these are documented (calculations.ts's own doc comments) as
 *    intentionally absent from the Deno fork, which doesn't need a
 *    Drizzle/Supabase-row-shaped helper. This is an explicit allowlist by
 *    export name, not a fuzzy diff: any OTHER export-level difference is a
 *    real mismatch and fails the check.
 * 4. Collapse all remaining whitespace to single spaces.
 *
 * If everything else — including all arithmetic, function bodies, and the
 * ESR/cap/rolling-index logic in timeline.ts — doesn't match exactly after
 * this normalization, the two implementations have drifted and this script
 * fails with exit code 1.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const PACKAGE_DIR = join(rootDir, "packages/handicap-core/src");
const EDGE_DIR = join(rootDir, "supabase/functions/handicap-shared");

const FILE_PAIRS = [
  {
    label: "calculations.ts <-> utils.ts",
    source: join(PACKAGE_DIR, "calculations.ts"),
    mirror: join(EDGE_DIR, "utils.ts"),
    // Documented, intentional omissions from the Deno fork (see
    // calculations.ts's own doc comments on RoundLike/getRelevantRounds).
    allowedSourceOnlyExports: ["RoundLike", "getRelevantRounds"],
  },
  {
    label: "constants.ts",
    source: join(PACKAGE_DIR, "constants.ts"),
    mirror: join(EDGE_DIR, "constants.ts"),
    allowedSourceOnlyExports: [],
  },
  {
    label: "timeline.ts",
    source: join(PACKAGE_DIR, "timeline.ts"),
    mirror: join(EDGE_DIR, "timeline.ts"),
    allowedSourceOnlyExports: [],
  },
];

/** Strips block comments (incl. JSDoc) and line comments. Avoids treating
 * `https://` inside string literals as a line comment by requiring the
 * `//` not be immediately preceded by `:`. */
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Strips every top-level `import ... ;` statement, regardless of how many
 * lines it spans. Must run AFTER stripComments (a comment could otherwise
 * contain the literal text "import" followed by a semicolon and get
 * mis-matched). */
function stripImports(content) {
  return content.replace(/^\s*import[^;]*;\s*\n?/gm, "");
}

/**
 * Removes a single top-level `export type <name> = ...;` or
 * `export function <name>(...) { ... }` declaration.
 *
 * Both forms are extracted the same way: find the FIRST literal `{` after
 * the `export type|function <name>` marker (for a type alias this is the
 * object type's opening brace right after `=`; for a function this is the
 * body's opening brace — everything before it, generics `<T extends X>`,
 * the parameter list `(...)`, and a `: ReturnType` annotation, cannot
 * itself contain a bare `{`), then balance ONLY that brace (string-aware)
 * to find its matching close. A trailing `;` (present for type aliases,
 * absent for function declarations) is consumed if immediately adjacent.
 *
 * Throws if the named export or its opening brace cannot be found, so a
 * rename doesn't silently pass the sync check.
 */
function removeNamedExport(content, name) {
  const marker = new RegExp(`export (type|function)\\s+${name}\\b`);
  const match = content.match(marker);
  if (!match) {
    throw new Error(
      `Expected to find "export type|function ${name}" in the source file ` +
        `to remove it as a documented mirror omission, but it was not found. ` +
        `Either the export was renamed/removed (update check-handicap-sync.mjs) ` +
        `or it needs to be added to the Deno mirror instead.`
    );
  }

  const start = match.index;
  const braceStart = content.indexOf("{", start + match[0].length);
  if (braceStart === -1) {
    throw new Error(`Could not find the opening brace for export "${name}"`);
  }

  let depth = 0;
  let inString = false;
  let stringChar = "";
  let i = braceStart;

  for (; i < content.length; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : "";

    if ((ch === '"' || ch === "'" || ch === "`") && prev !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
      }
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) {
      let end = i + 1;
      if (content[end] === ";") end++;
      return content.slice(0, start) + content.slice(end);
    }
  }

  throw new Error(`Could not find the end of export "${name}" (unbalanced braces?)`);
}

function normalizeWhitespace(content) {
  return content.replace(/\s+/g, " ").trim();
}

function main() {
  console.log("Checking handicap engine synchronization...\n");

  let hasErrors = false;

  for (const pair of FILE_PAIRS) {
    let sourceContent;
    let mirrorContent;

    try {
      sourceContent = readFileSync(pair.source, "utf-8");
    } catch {
      console.error(`Failed to read package source: ${pair.source}`);
      hasErrors = true;
      continue;
    }

    try {
      mirrorContent = readFileSync(pair.mirror, "utf-8");
    } catch {
      console.error(`Failed to read Deno mirror: ${pair.mirror}`);
      hasErrors = true;
      continue;
    }

    let normalizedSource = stripImports(stripComments(sourceContent));
    const normalizedMirror = stripImports(stripComments(mirrorContent));

    try {
      for (const exportName of pair.allowedSourceOnlyExports) {
        normalizedSource = removeNamedExport(normalizedSource, exportName);
      }
    } catch (err) {
      console.error(`Handicap engine mismatch: ${pair.label}`);
      console.error(`  ${err.message}`);
      hasErrors = true;
      continue;
    }

    if (normalizeWhitespace(normalizedSource) !== normalizeWhitespace(normalizedMirror)) {
      console.error(`Handicap engine mismatch: ${pair.label}`);
      console.error(`  Package source:  ${pair.source}`);
      console.error(`  Deno mirror:     ${pair.mirror}`);
      hasErrors = true;
    } else {
      console.log(`${pair.label} is in sync`);
    }
  }

  console.log("");

  if (hasErrors) {
    console.error("Handicap engine sync check failed!");
    console.error(
      "\nAny change to calculations.ts / constants.ts / timeline.ts in " +
        "packages/handicap-core requires the mirrored edit in " +
        "supabase/functions/handicap-shared/ (utils.ts / constants.ts / " +
        "timeline.ts) — the Deno edge runtime that computes production " +
        "handicaps cannot import the workspace package directly."
    );
    console.error(
      "\nOnly import specifiers, comments, and the documented " +
        "RoundLike/getRelevantRounds omission (calculations.ts <-> utils.ts) " +
        "may differ between the package and the Deno mirror."
    );
    process.exit(1);
  }

  console.log(
    "Handicap engine (calculations/constants/timeline) is in sync with the Deno mirror!"
  );
}

main();
