#!/usr/bin/env node

/**
 * Schema Sync Checker
 *
 * Validates that the shared Zod schemas between the main app and Supabase Edge Functions
 * remain in sync. Only checks the core schemas (hole, tee, course, score, scorecard).
 *
 * The two files have expected differences:
 * - Different Zod imports (npm vs esm.sh for Deno)
 * - Edge functions have additional roundSchema (not needed in main app)
 * - Main app has additional types (ScorecardWithRound, CourseSearchResult)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const MAIN_APP_SCHEMA = join(rootDir, "types/scorecard.ts");
const EDGE_FUNCTION_SCHEMA = join(
  rootDir,
  "supabase/functions/handicap-shared/scorecard.ts"
);

// Schemas that must stay in sync
const SHARED_SCHEMAS = [
  "holeSchema",
  "teeSchema",
  "courseSchema",
  "scoreSchema",
  "scorecardSchema",
];

/**
 * Extract a schema definition from file content.
 * Handles both simple z.object({...}) and chained .superRefine(...) patterns.
 */
function extractSchema(content, schemaName) {
  // Find the start of the schema definition
  // Handle both "export const X = z.object(" and "export const X = z\n  .object("
  const startPattern = new RegExp(`export const ${schemaName}\\s*=\\s*z`);
  const match = content.match(startPattern);

  if (!match) {
    return null;
  }

  const startIndex = match.index;

  // Find where this schema ends by looking for the next "export" or end of file
  // We need to find where the schema definition ends (after all chained methods)
  let depth = 0;
  let foundFirstParen = false;
  let endIndex = startIndex;
  let inString = false;
  let stringChar = "";

  for (
    let schemaIndex = startIndex + match[0].length;
    schemaIndex < content.length;
    schemaIndex++
  ) {
    const char = content[schemaIndex];
    const prevChar = schemaIndex > 0 ? content[schemaIndex - 1] : "";

    // Track string state to ignore parens inside strings
    if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === "(" || char === "{" || char === "[") {
        depth++;
        foundFirstParen = true;
      } else if (char === ")" || char === "}" || char === "]") {
        depth--;
      }

      // Schema ends when we return to depth 0 after having been deeper
      // and we hit a semicolon
      if (foundFirstParen && depth === 0 && char === ";") {
        endIndex = schemaIndex + 1;
        break;
      }
    }
  }

  return content.slice(startIndex, endIndex);
}

/**
 * Normalize schema content for comparison.
 * Removes whitespace differences and the export declaration.
 */
function normalizeSchema(schema) {
  if (!schema) return null;

  return (
    schema
      // Remove the export const X = part for comparison
      .replace(/^export const \w+\s*=\s*/, "")
      // Normalize all whitespace to single spaces
      .replace(/\s+/g, " ")
      // Remove trailing semicolon
      .replace(/;\s*$/, "")
      .trim()
  );
}

function main() {
  console.log("Checking schema synchronization...\n");

  let mainContent, edgeContent;

  try {
    mainContent = readFileSync(MAIN_APP_SCHEMA, "utf-8");
  } catch {
    console.error(`Failed to read main app schema: ${MAIN_APP_SCHEMA}`);
    process.exit(1);
  }

  try {
    edgeContent = readFileSync(EDGE_FUNCTION_SCHEMA, "utf-8");
  } catch {
    console.error(
      `Failed to read edge function schema: ${EDGE_FUNCTION_SCHEMA}`
    );
    process.exit(1);
  }

  let hasErrors = false;

  for (const schemaName of SHARED_SCHEMAS) {
    const mainSchema = extractSchema(mainContent, schemaName);
    const edgeSchema = extractSchema(edgeContent, schemaName);

    if (!mainSchema) {
      console.error(`Missing ${schemaName} in main app (types/scorecard.ts)`);
      hasErrors = true;
      continue;
    }

    if (!edgeSchema) {
      console.error(
        `Missing ${schemaName} in edge functions (supabase/functions/handicap-shared/scorecard.ts)`
      );
      hasErrors = true;
      continue;
    }

    const normalizedMain = normalizeSchema(mainSchema);
    const normalizedEdge = normalizeSchema(edgeSchema);

    if (normalizedMain !== normalizedEdge) {
      console.error(`Schema mismatch: ${schemaName}`);
      console.error("  Main app and edge function versions differ.");
      console.error("  Please sync the schemas manually.\n");
      hasErrors = true;
    } else {
      console.log(`${schemaName} is in sync`);
    }
  }

  console.log("");

  if (hasErrors) {
    console.error("Schema sync check failed!");
    console.error("\nFiles to sync:");
    console.error("  - types/scorecard.ts (source of truth)");
    console.error("  - supabase/functions/handicap-shared/scorecard.ts");
    process.exit(1);
  }

  console.log("All shared schemas are in sync!");
}

main();
