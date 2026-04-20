---
name: a11y-component
description: "Fires when adding a new shadcn/ui component, installing a Base UI component, or asking about component accessibility."
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Accessibility Component Check

Verify Base UI / shadcn component accessibility before integrating. Checks the component against known issues from our audit.

## Usage

```
/a11y-component dialog          # Check Dialog component
/a11y-component combobox select  # Check multiple components
```

## Process

### 1. Read the Audit

Read `docs/findings/005-base-ui-accessibility-audit.md` for the per-component risk assessment.

### 2. Look Up Component

Match `$ARGUMENTS` against the component names in the audit. For each component:

#### If LOW RISK
```
COMPONENT: <name>
Risk: LOW
Status: Safe to use
Notes: <any notes from audit>
Action: Standard testing sufficient
```

#### If MODERATE RISK
```
COMPONENT: <name>
Risk: MODERATE
Status: Use with caution
Known issues:
  - <issue description> (<GitHub issue #>)
Workaround: <suggested workaround>
Action: Test with VoiceOver before shipping
```

#### If HIGH RISK
```
COMPONENT: <name>
Risk: HIGH
Status: Extra testing required
Known issues:
  - <issue description> (<GitHub issue #>)
  - <issue description> (<GitHub issue #>)
Impact on our project: <why this matters for library platform>
Action: Manual screen reader testing REQUIRED (NVDA + VoiceOver). Budget X hours.
```

#### If DO NOT USE
```
COMPONENT: <name>
Risk: DO NOT USE
Reason: <why>
Alternative: <what to use instead>
```

### 3. Check Current Usage

Search the codebase for existing imports of the component:

```bash
# Check if already installed
ls apps/web/components/ui/ | grep -i <name>

# Check imports
grep -r "from.*base-ui.*<name>\|from.*@/components/ui/<name>" apps/web/
```

### 4. Installation Guidance

If the component is safe to add:

```bash
pnpm dlx shadcn@latest add <component-name>
```

Remind: After installing, run `/a11y-check` on the file to verify Biome rules pass.

## Component Quick Reference

| Component | Risk | Key Concern |
|-----------|------|-------------|
| Button | LOW | NVDA loading state |
| Dialog / AlertDialog | LOW | Programmatic trigger focus edge case |
| Select | LOW | None |
| Tabs | LOW | None |
| Accordion | LOW | None |
| Popover | LOW | None |
| Checkbox / Radio / Switch | LOW | Pin @base-ui/react >= 1.3.0 |
| Navigation Menu | MODERATE | Shift-tab skips submenu items |
| Tooltip | MODERATE | NOT accessible to touch/SR -- use aria-label |
| Menubar | MODERATE-HIGH | Invalid ARIA children structure |
| Combobox / Autocomplete | HIGH | Screen reader announcements broken |
| Toast (with actions) | HIGH | Undo unreachable by keyboard/SR |
| Context Menu | DO NOT USE | Completely inaccessible |

## Gotchas

- shadcn/ui v4 uses **Base UI** (`@base-ui/react`), NOT Radix. Don't reference Radix docs.
- Base UI has **no independent accessibility audit**. Our findings doc is based on community reports.
- Pin `@base-ui/react` to `^1.3.0` minimum -- the label association fix is essential.
- "Accessible" in Base UI docs means "follows WAI-ARIA patterns" -- it does NOT mean "tested with real screen readers and verified."
- Every component from the MODERATE or HIGH list needs manual VoiceOver testing before the May user tests.
