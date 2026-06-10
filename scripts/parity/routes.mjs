/**
 * Web↔Native route auto-discovery — the zero-config shared key for parity.
 * Ported from the ks-digital reference implementation.
 *
 * Both apps are file-based routers, so routes are DERIVED from the filesystem
 * on each side and intersected. No hand-maintained screen list, no mapping
 * config — rename a route and it changes its URL on that side, falls out of
 * the intersection, and `parity:routes` fails loudly.
 *
 *   Web (Next.js):  apps/web/app/(group)/<route>/page.tsx
 *   Native (Expo):  apps/native/app/(group)/<route>.tsx | <route>/index.tsx
 *
 * DORMANT until apps/native exists: with no native app the gate prints the
 * discovered web routes and exits 0. The day apps/native lands, every web
 * route without a native twin fails the gate — seed INTENTIONAL.webOnly with
 * the not-yet-ported routes during bring-up and burn the list down to the
 * truly-deliberate divergences.
 *
 * The ONE irreducible bit of human intent is which divergences are DELIBERATE.
 * That's product intent, not a mapping — kept tiny and explicit below.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
export const WEB_APP = join(REPO, "apps/web/app");
export const NATIVE_APP = join(REPO, "apps/native/app");

/** Deliberate, documented divergences (intent — NOT a mapping). */
export const INTENTIONAL = {
  // NATIVE BRING-UP BACKLOG (seeded 2026-06-10): every web route not yet
  // ported to a native screen. Porting a screen = create the same-slug file
  // in apps/native/app AND delete the entry here. The set must burn down to
  // only the genuinely web-only routes (legal/SEO pages, web-only auth
  // flows) — revisit each entry deliberately, don't let it fossilize.
  webOnly: new Set([
    "about",
    "auth/verify-session",
    "billing",
    "billing/success",
    "calculators",
    "contact",
    "dashboard/[id]",
    "forgot-password",
    "onboarding",
    "privacy-policy",
    "profile/[id]",
    "rounds/[id]/calculation",
    "rounds/add",
    "statistics",
    "statistics/courses/[courseId]",
    "terms-of-service",
    "update-password",
    "upgrade",
    "verify-email",
    "verify-signup",
  ]),
  // Native-only routes by design.
  nativeOnly: new Set([]),
};

export function nativeAppPresent() {
  return existsSync(NATIVE_APP);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Strip Expo/Next route GROUPS `(group)` from a slug path. */
const stripGroups = (segments) => segments.filter((s) => !/^\(.*\)$/.test(s));

/** Web: app/(group)/x/y/page.tsx → "x/y"; app/page.tsx → "". api/ has no pages. */
export function discoverWebRoutes() {
  return new Set(
    walk(WEB_APP)
      .filter((f) => f.replace(/\\/g, "/").endsWith("/page.tsx"))
      .map((f) => relative(WEB_APP, f).replace(/\\/g, "/"))
      .map((rel) =>
        stripGroups(rel.replace(/(^|\/)page\.tsx$/, "").split("/").filter(Boolean)).join("/"),
      ),
  );
}

/** Native: app/(group)/x.tsx | x/index.tsx → "x"; app/index.tsx → "". */
export function discoverNativeRoutes() {
  if (!nativeAppPresent()) return new Set();
  return new Set(
    walk(NATIVE_APP)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => relative(NATIVE_APP, f).replace(/\\/g, "/"))
      .filter((rel) => {
        const base = rel.split("/").pop();
        return base !== "_layout.tsx" && !base.startsWith("+"); // layouts, +html, +not-found
      })
      .map((rel) =>
        stripGroups(
          rel
            .replace(/(^|\/)index\.tsx$/, "")
            .replace(/\.tsx$/, "")
            .split("/")
            .filter(Boolean),
        ).join("/"),
      ),
  );
}

/** Web route slug → absolute page.tsx file (for the import-graph drift trigger). */
export function webRouteFiles() {
  const map = new Map();
  for (const f of walk(WEB_APP)) {
    if (!f.replace(/\\/g, "/").endsWith("/page.tsx")) continue;
    const rel = relative(WEB_APP, f).replace(/\\/g, "/");
    const slug = stripGroups(
      rel.replace(/(^|\/)page\.tsx$/, "").split("/").filter(Boolean),
    ).join("/");
    map.set(slug, f);
  }
  return map;
}

export function computeParity() {
  const web = discoverWebRoutes();
  const native = discoverNativeRoutes();
  const shared = [...web].filter((r) => native.has(r)).sort();
  const webOnly = [...web].filter((r) => !native.has(r) && !INTENTIONAL.webOnly.has(r)).sort();
  const nativeOnly = [...native]
    .filter((r) => !web.has(r) && !INTENTIONAL.nativeOnly.has(r))
    .sort();
  // Intentional entries that no longer exist → stale intent, also a failure.
  const staleWebOnly = [...INTENTIONAL.webOnly].filter((r) => !web.has(r)).sort();
  const staleNativeOnly = [...INTENTIONAL.nativeOnly].filter((r) => !native.has(r)).sort();
  return { web, native, shared, webOnly, nativeOnly, staleWebOnly, staleNativeOnly };
}

function main() {
  if (!nativeAppPresent()) {
    const web = discoverWebRoutes();
    console.log(
      `parity:routes — DORMANT (apps/native not present). ${web.size} web routes discovered:`,
    );
    for (const route of [...web].sort()) console.log(`  · ${route || "(root)"}`);
    console.log(
      "\nGate activates automatically when apps/native/app exists. During bring-up, seed INTENTIONAL.webOnly with unported routes.",
    );
    return;
  }

  const r = computeParity();
  console.log(`parity:routes — ${r.shared.length} shared routes (the parity test set):`);
  for (const route of r.shared) console.log(`  ✓ ${route || "(root)"}`);

  const problems = [];
  if (r.webOnly.length)
    problems.push(
      `UNEXPECTED web-only routes (no native twin, not declared intentional):\n` +
        r.webOnly.map((x) => `    - ${x}`).join("\n"),
    );
  if (r.nativeOnly.length)
    problems.push(
      `UNEXPECTED native-only routes (no web twin, not declared intentional):\n` +
        r.nativeOnly.map((x) => `    - ${x}`).join("\n"),
    );
  if (r.staleWebOnly.length)
    problems.push(
      `STALE INTENTIONAL.webOnly (route no longer exists): ${r.staleWebOnly.join(", ")}`,
    );
  if (r.staleNativeOnly.length)
    problems.push(
      `STALE INTENTIONAL.nativeOnly (route no longer exists): ${r.staleNativeOnly.join(", ")}`,
    );

  if (problems.length) {
    console.error("\n❌ parity:routes FAILED — route sets diverged (likely a rename on one side):\n");
    for (const p of problems) console.error("  " + p);
    console.error(
      "\n  Fix: rename so the route matches on both apps, or (if deliberate) add it to INTENTIONAL in scripts/parity/routes.mjs.",
    );
    process.exit(1);
  }
  console.log(
    "\n✅ parity:routes PASS — every route matches across web and native (or is declared intentional).",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
