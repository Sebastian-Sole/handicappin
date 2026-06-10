/**
 * Live web↔native parity watcher (dev signal).
 * Ported from the ks-digital reference implementation.
 *
 * Watches the web UI source dirs while you develop. When you save a web
 * component/screen/lib file, it computes — from the import graph — which
 * routes render it, and prints a loud reminder to mirror the change in the
 * same-slug native screen. This is the human-facing twin of the agent's
 * PostToolUse parity hook. It is a SIGNAL, not a gate: structure parity can't
 * be auto-synced (web JSX ≠ RN JSX). Token VALUES auto-propagate via
 * `pnpm generate:theme` — unrelated to this.
 *
 * Run: `pnpm parity:watch` (joins the dev stack in `pnpm dev:parity` once the
 * native app exists).
 */
import { watch } from "node:fs";
import { join, relative } from "node:path";
import { nativeAppPresent, REPO } from "./routes.mjs";
import { affectedRoutes, buildRouteClosures, isWebUiFile } from "./drift.mjs";

const WATCH_DIRS = [
  "apps/web/components",
  "apps/web/app",
  "apps/web/lib",
  "apps/web/hooks",
  "apps/web/contexts",
];
const DEBOUNCE_MS = 400;

let closures = buildRouteClosures();
const pending = new Set();
let timer = null;

function flush() {
  timer = null;
  const files = [...pending].filter(isWebUiFile);
  pending.clear();
  if (files.length === 0) return;

  closures = buildRouteClosures(); // refresh: imports may have changed
  const absFiles = files.map((f) => join(REPO, f));
  const affected = affectedRoutes(absFiles, closures);

  const tag = "\x1b[35m[parity]\x1b[0m"; // magenta so it stands out in the dev stream
  for (const f of files) console.log(`${tag} web UI changed: ${f}`);
  if (affected.length === 0) {
    console.log(
      `${tag} ↳ not reachable from any route page (shared util?) — re-verify broadly if visual.`,
    );
    return;
  }
  if (!nativeAppPresent()) {
    console.log(`${tag} ↳ routes affected (native app not present yet — informational):`);
    for (const slug of affected) console.log(`${tag}     → ${slug || "(root)"}`);
    return;
  }
  console.log(`${tag} ↳ mirror this in the SAME-SLUG native screen, then verify:`);
  for (const slug of affected) console.log(`${tag}     → ${slug || "(root)"}`);
}

function onChange(baseDir, _event, filename) {
  if (!filename) return;
  const rel = relative(REPO, join(REPO, baseDir, filename)).replace(/\\/g, "/");
  if (!isWebUiFile(rel)) return;
  pending.add(rel);
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

console.log(
  "\x1b[35m[parity]\x1b[0m watching web UI for changes. Token values auto-propagate via generate:theme; component structure must be mirrored.",
);
for (const dir of WATCH_DIRS) {
  try {
    watch(join(REPO, dir), { recursive: true }, (event, filename) =>
      onChange(dir, event, filename),
    );
  } catch (err) {
    console.error(`\x1b[35m[parity]\x1b[0m could not watch ${dir}: ${err.message}`);
  }
}
