---
name: keyboard-test
description: "Fires when asked to generate keyboard testing checklist, verify keyboard accessibility, or prepare for manual a11y testing."
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Keyboard Testing Checklist Generator

Generate a page-specific keyboard testing checklist for manual verification. Keyboard testing is the **single highest-ROI manual accessibility test** according to every a11y expert.

## Usage

```
/keyboard-test                  # Generate for all user test flows
/keyboard-test /search          # Generate for search page
/keyboard-test L-3 L-4          # Generate for specific user test tasks
```

## Process

### 1. Determine Scope

Parse `$ARGUMENTS`:
- If a route path: generate checklist for that page
- If user test IDs (A-1, L-3, etc.): read `docs/synthesis/01-user-test-spec.md` and generate for those tasks
- If empty: generate for all 17 user test tasks

### 2. Read Page Structure

For each page in scope, read the source files to understand:
- What interactive elements exist (buttons, links, inputs, dialogs, menus)
- What dynamic content changes (search results, form validation, toasts)
- What Base UI components are used (cross-ref with 005 findings)

### 3. Generate Checklist

For each page/flow, output a structured checklist:

```markdown
## Keyboard Test: <Page/Flow Name>
**Route**: <url>
**User Test**: <A-X or L-X if applicable>
**Tester**: _______________
**Date**: _______________
**Browser**: _______________

### Tab Order
- [ ] First Tab reaches skip-to-content link
- [ ] Second Tab reaches <first interactive element>
- [ ] Tab order follows visual layout (left-to-right, top-to-bottom)
- [ ] No elements are skipped
- [ ] No elements receive focus that shouldn't (decorative, hidden)
- [ ] Shift+Tab reverses the order exactly

### Focus Indicators
- [ ] Every focused element has a visible indicator
- [ ] Focus indicator has >= 3:1 contrast against background
- [ ] Focus indicator is not just a color change (also outline/border)

### Interactive Elements
<For each interactive element found in the page source:>
- [ ] <Element description>: reachable via Tab
- [ ] <Element description>: activates with Enter or Space
- [ ] <Button/link>: shows focus state

### Dialogs/Modals
<If page has dialogs:>
- [ ] Focus moves into dialog on open
- [ ] Tab cycles within dialog (focus trap)
- [ ] Escape closes dialog
- [ ] Focus returns to trigger button on close
- [ ] Background content is inert (not reachable via Tab)

### Forms
<If page has forms:>
- [ ] All inputs reachable via Tab
- [ ] Labels announced (associated with inputs)
- [ ] Required fields indicated (not by color alone)
- [ ] Error messages appear and are associated with fields
- [ ] Form submits with Enter key
- [ ] Validation errors don't trap focus

### Dynamic Content
<If page has dynamic updates:>
- [ ] Search results: announced after loading
- [ ] Filter changes: results update announced
- [ ] Status messages: reservation confirmed, etc.
- [ ] Loading states: communicated (aria-busy)

### Keyboard Shortcuts
- [ ] No custom shortcuts conflict with browser/AT shortcuts
- [ ] All functionality available without shortcuts (shortcuts are enhancement only)

### Result
- [ ] PASS -- all items checked
- [ ] FAIL -- issues found (list below)

**Issues Found:**
1.
2.
3.
```

### 4. Map to User Tests

When generating for user test tasks, include the specific steps from `docs/synthesis/01-user-test-spec.md`:

**Example for L-3 (Search & Filter):**
```
1. Tab to search input
2. Type "Dei sju dorene" -- verify autocomplete is navigable with arrow keys
3. Press Enter to search -- verify focus moves to results
4. Tab to filter controls -- verify dropdowns open with Enter/Space
5. Tab to result cards -- verify "Reserve" button reachable
6. Activate reserve -- verify dialog opens and traps focus
```

## Gotchas

- Keyboard testing catches issues that **no automated tool can detect**: focus traps, illogical tab order, missing keyboard activation, broken focus return.
- The evaluators in May 2026 WILL test with keyboard. This is not optional.
- Common failure: SPA route changes that don't move focus to new content.
- Common failure: Custom components (date pickers, rich editors) that trap focus.
- Base UI's Combobox has known keyboard issues -- test search thoroughly.
- Test in Chrome AND Firefox -- keyboard behavior differs slightly.

## What This Skill Does NOT Do

- Does NOT run automated tests (use `/a11y-check` for that)
- Does NOT test screen reader announcements (that requires VoiceOver/NVDA)
- Does NOT replace testing -- it generates the checklist FOR testing
