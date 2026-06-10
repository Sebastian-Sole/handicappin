/**
 * Parity drift trigger — automatic, no mapping/config.
 * Ported from the ks-digital reference implementation.
 *
 * Given a git diff, find which WEB UI files changed, walk the web import graph
 * to see which ROUTES transitively render them, and report those routes as
 * needing a web↔native parity re-check. "Changed file → affected routes" is
 * COMPUTED from the module graph — never declared. Route slugs are the join
 * key to native, so no web↔native file map is needed.
 *
 * DORMANT until apps/native exists: with no native app the affected routes are
 * reported informationally (exit 0). Once apps/native lands, any affected
 * SHARED route exits 1 so a gate can require parity verification.
 *
 * Usage: node scripts/parity/drift.mjs [baseRef]   (default: origin/main, else HEAD~1)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { computeParity, nativeAppPresent, REPO, webRouteFiles } from "./routes.mjs";

const WEB_ROOT = join(REPO, "apps/web"); // `@/` → apps/web (tsconfig paths: "@/*": ["./*"])
const EXTS = [".tsx", ".ts", ".jsx", ".js"];

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(WEB_ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null; // external package (incl. @handicappin/* workspace pkgs)
  const cands = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, "index" + e))];
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const IMPORT_RE =
  /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Is this path a web UI source file (a parity-relevant change)? */
export function isWebUiFile(relPath) {
  const p = relPath.replace(/\\/g, "/");
  if (!/^apps\/web\/(app|components|lib|hooks|contexts)\//.test(p)) return false;
  if (/^apps\/web\/app\/api\//.test(p)) return false; // route handlers: no visual surface
  if (!/\.(tsx?|jsx?)$/.test(p)) return false;
  if (/(\.test\.tsx?|\.test\.jsx?|\.stories\.tsx?|\.d\.ts)$/.test(p)) return false;
  return true;
}

/** All web files transitively reachable from `entry`. */
function closure(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      if (!spec) continue;
      const resolved = resolveImport(spec, file);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return seen;
}

function changedWebFiles(baseRef) {
  let base = baseRef;
  if (!base) {
    try {
      execSync("git rev-parse --verify origin/main", { cwd: REPO, stdio: "ignore" });
      base = "origin/main";
    } catch {
      base = "HEAD~1";
    }
  }
  const out = execSync(
    `git diff --name-only ${base}...HEAD; git diff --name-only; git diff --cached --name-only`,
    { cwd: REPO, encoding: "utf8" },
  );
  return [...new Set(out.split("\n").map((s) => s.trim()).filter(Boolean))]
    .filter(isWebUiFile)
    .map((p) => join(REPO, p));
}

/**
 * Import-graph closure per route page. With a native app present, only SHARED
 * routes (the ones with a native twin) are tracked; while dormant, all web
 * routes are tracked so the signal is still informative.
 */
export function buildRouteClosures() {
  const trackAll = !nativeAppPresent();
  const shared = trackAll ? null : new Set(computeParity().shared);
  const closures = new Map();
  for (const [slug, file] of webRouteFiles()) {
    if (trackAll || shared.has(slug)) closures.set(slug, closure(file));
  }
  return closures;
}

/** Given changed absolute web files, which tracked routes transitively render them. */
export function affectedRoutes(changedAbsFiles, closures = buildRouteClosures()) {
  const affected = new Set();
  for (const file of changedAbsFiles) {
    for (const [slug, files] of closures) {
      if (files.has(file)) affected.add(slug);
    }
  }
  return [...affected].sort();
}

function main() {
  const baseRef = process.argv[2];
  const changed = changedWebFiles(baseRef);
  if (changed.length === 0) {
    console.log("parity:drift — no web UI files changed. Nothing to re-verify.");
    return;
  }
  const affected = affectedRoutes(changed);

  console.log(`parity:drift — ${changed.length} web UI file(s) changed:`);
  for (const f of changed) console.log(`  · ${relative(REPO, f)}`);

  if (affected.length === 0) {
    console.log(
      "\n⚠️  Changed web files are not reachable from any route page (shared/lib util?). Re-verify broadly.",
    );
    return;
  }

  if (!nativeAppPresent()) {
    console.log(
      `\nparity:drift — DORMANT (apps/native not present). ${affected.length} route(s) would need a native re-check once the app exists:`,
    );
    for (const slug of affected) console.log(`  → ${slug || "(root)"}`);
    return;
  }

  console.log(
    `\n${affected.length} route(s) need a web↔native parity re-check (the same-slug native screen must match):`,
  );
  for (const slug of affected) console.log(`  → ${slug || "(root)"}`);
  console.log(
    "\n  Update the same-slug native screen(s) and run the visual parity check before merging.",
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
