# Maestro flows

Behavioral tier of the verification harness (`apps/native/verification/`) —
ported from the ks-digital reference. A vision-only green is **insufficient**:
screenshots are blind to broken state, dead buttons, focus order, and SR
labels. A screen is equivalent only when its vision verdict **and** these
Maestro assertions **and** the a11y/glyph checks all pass.

## Install

```sh
curl -Ls https://get.maestro.mobile.dev | bash
# or: brew tap mobile-dev-inc/tap && brew install maestro
maestro --version
```

## Run

**PRE-REQUISITE (quality gate):** the Expo dev server + iOS simulator must
already be running and the app installed. These flows do **not** auto-start
them — an auto-started server masks a broken launch instead of catching it.

```sh
# Terminal 1: start the app yourself
pnpm --filter native ios        # or: expo start + install in the booted sim

# Terminal 2:
maestro test apps/native/.maestro/flows/smoke-token-gallery.yaml
# …or the whole tier:
maestro test apps/native/.maestro/flows/
```

## Conventions (keep these — they are the point)

- **Selectors are accessibility-label / text / testID based, never coordinate
  or index.** A selector that cannot find a node by its accessible name is
  itself a finding — the node is invisible to VoiceOver. This makes the
  behavioral tier a second a11y enforcement layer for free.
- The app renders nothing until fonts resolve, so the `fonts-ready` testID
  marker (root layout, `lib/fonts.ts` FONTS_READY_TEST_ID) is the programmatic
  font-ready gate; a visible `"Token gallery"` heading is the human-readable
  proxy.
- One flow per screen/behavior, named `<screen>-<behavior>.yaml` (the smoke
  flow is `smoke-token-gallery.yaml`). Add a flow alongside every ported
  screen and reference it from the a11y matrix
  (`verification/gates/a11y-checks.mjs`).
- `appId` is the `expo prebuild` convention `com.anonymous.handicappin` until
  `app.json` gains a real `ios.bundleIdentifier` — update flows **and**
  `verification/config.mjs` SIM.appId together when that happens.

## Touch-target (WCAG 2.5.5) — where it's checked

Maestro cannot measure a view's hittable bounds, so the **≥44×44 incl.
`hitSlop`** assertion belongs in component code (enforce `minWidth/minHeight:
44` + `hitSlop` on icon buttons as interactive components land). The harness's
a11y tier records it as a per-screen row (`touch_target_2_5_5`).

## One-time simulator setup: disable password AutoFill

iOS's "Use Strong Password?" / "Save Password?" sheets render OUT OF PROCESS —
Maestro can neither see nor dismiss them, and a covered control swallows taps
while every step still reports COMPLETED. Before running flows on a fresh
simulator: Settings → General → AutoFill & Passwords → turn OFF both
"AutoFill Passwords and Passkeys" and "Suggest Strong Passwords".
(State persists per simulator. The flows themselves stay selector-only.)
