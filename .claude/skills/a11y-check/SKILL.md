---
name: a11y-check
description: "Fires when asked to check accessibility, run a11y audit, verify WCAG compliance, or scan a page for accessibility issues."
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Task
---

# Accessibility Check

On-demand WCAG 2.1 AA verification for the running dev server or specific component files.

## Usage

```
/a11y-check                    # Scan all key pages
/a11y-check /search            # Scan specific route
/a11y-check components/ui/     # Lint component files only
```

## Process

### 1. Determine Scope

Parse `$ARGUMENTS`:
- If a URL path (starts with `/`): scan that route on localhost:3000
- If a file/directory path: run Biome a11y lint on those files
- If empty: scan all key pages listed below

### 2. Static Check (Biome a11y rules)

Run on all `.tsx`/`.jsx` files in scope:

```bash
pnpm --filter web exec biome lint --only="a11y" <path>
```

This catches ~33 rules: missing alt text, missing form labels, invalid ARIA, div-as-button, empty links, positive tabindex, etc. Takes ~20ms per file.

### 3. Report

Format results as:

```
A11Y AUDIT REPORT
=================
Scope: <what was checked>

STATIC ANALYSIS (Biome)
  Files checked: X
  Violations: Y
  [list each: file:line rule -- description]

COMPONENT RISK CHECK
  [cross-reference any components used against docs/findings/005-base-ui-accessibility-audit.md]
  HIGH RISK: <any high-risk Base UI components found in code>
  CAUTION: <any moderate-risk components>

MANUAL TESTING NEEDED
  [ ] Keyboard: Tab through all interactive elements
  [ ] Screen reader: Test with VoiceOver (Cmd+F5)
  [ ] Zoom: Check at 200% and 400%
  [ ] Focus: Verify visible focus indicators
  [ ] Language: Confirm lang="nb" on <html>

Overall: [X violations found / clean]
```

### 4. Component Risk Cross-Reference

Read `docs/findings/005-base-ui-accessibility-audit.md` and check which Base UI components are imported in the scanned files. Flag any HIGH RISK or DO NOT USE components.

## Key Pages for Full Scan

When no arguments given, check these routes (if they exist):

| Route | User Test | What to verify |
|-------|-----------|----------------|
| `/` | L-1 | Navigation, landmarks, heading hierarchy |
| `/search` | L-3, L-4 | Combobox a11y, result list, inline reserve |
| `/events` | L-7 | Event cards, "show interest" button |
| `/my-page` | L-5 | Reservation status, notification prefs |
| `/cms` | A-1 | CMS dashboard, content creation |

## Gotchas

- Biome catches ~30% of WCAG criteria. A clean Biome report does NOT mean the page is accessible.
- axe-core (via MCP or Playwright) catches ~57% by volume. Still not enough alone.
- The remaining 43-70% requires manual keyboard + screen reader testing.
- Base UI's Combobox has known screen reader issues -- always test search manually.
- Context Menu component is completely inaccessible -- flag if found in code.
- Norwegian Bokmal: all user-facing text must be in `nb`, verify `<html lang="nb">`.

## What This Skill Does NOT Do

- Does NOT replace manual screen reader testing
- Does NOT verify color contrast with actual CSS values (needs runtime check)
- Does NOT test keyboard navigation flows (use `/keyboard-test` for that)
- Does NOT guarantee WCAG compliance -- it catches the low-hanging fruit
