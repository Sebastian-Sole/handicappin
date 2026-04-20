---
name: agent-browser
description: "Fires when the user needs browser automation — navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to open a website, fill out a form, click a button, take a screenshot, scrape data from a page, test this web app, login to a site, automate browser actions, or any task requiring programmatic web interaction."
allowed-tools: Bash(npx agent-browser:*), Bash(agent-browser:*)
---

# Browser Automation with agent-browser

The CLI uses Chrome/Chromium via CDP directly. Install via `pnpm add -g agent-browser`, `brew install agent-browser`, or `cargo install agent-browser`. Run `agent-browser install` to download Chrome. Run `agent-browser upgrade` to update to the latest version.

## Core Workflow

Every browser automation follows this pattern:

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get element refs like `@e1`, `@e2`)
3. **Interact**: Use refs to click, fill, select
4. **Re-snapshot**: After navigation or DOM changes, get fresh refs

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Command Chaining

Commands can be chained with `&&` in a single shell invocation. The browser persists between commands via a background daemon.

```bash
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser snapshot -i
agent-browser fill @e1 "user@example.com" && agent-browser fill @e2 "password123" && agent-browser click @e3
```

**When to chain:** Use `&&` when you don't need to read intermediate output. Run commands separately when you need to parse output first (e.g., snapshot to discover refs, then interact).

## Handling Authentication

**Option 1: Import auth from user's browser (fastest for one-off tasks)**

```bash
agent-browser --auto-connect state save ./auth.json
agent-browser --state ./auth.json open https://app.example.com/dashboard
```

**Option 2: Persistent profile (simplest for recurring tasks)**

```bash
agent-browser --profile ~/.myapp open https://app.example.com/login
# ... login once, then all future runs are already authenticated
agent-browser --profile ~/.myapp open https://app.example.com/dashboard
```

**Option 3: Session name (auto-save/restore cookies + localStorage)**

```bash
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close  # State auto-saved
# Next time: state auto-restored
agent-browser --session-name myapp open https://app.example.com/dashboard
```

**Option 4: Auth vault (credentials stored encrypted, login by name)**

```bash
echo "$PASSWORD" | agent-browser auth save myapp --url https://app.example.com/login --username user --password-stdin
agent-browser auth login myapp
```

**Option 5: State file (manual save/load)**

```bash
agent-browser state save ./auth.json
agent-browser state load ./auth.json
```

State files contain session tokens in plaintext -- add to `.gitignore` and delete when no longer needed. Set `AGENT_BROWSER_ENCRYPTION_KEY` for encryption at rest. See [references/authentication.md](references/authentication.md) for OAuth, 2FA, cookie-based auth, and token refresh patterns.

## Essential Commands

```bash
# Navigation
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser close                   # Close browser
agent-browser close --all             # Close all active sessions

# Snapshot
agent-browser snapshot -i             # Interactive elements with refs (recommended)
agent-browser snapshot -s "#selector" # Scope to CSS selector

# Interaction (use @refs from snapshot)
agent-browser click @e1               # Click element
agent-browser click @e1 --new-tab     # Click and open in new tab
agent-browser fill @e2 "text"         # Clear and type text
agent-browser type @e2 "text"         # Type without clearing
agent-browser select @e1 "option"     # Select dropdown option
agent-browser check @e1               # Check checkbox
agent-browser press Enter             # Press key
agent-browser keyboard type "text"    # Type at current focus (no selector)
agent-browser scroll down 500         # Scroll page
agent-browser scroll down 500 --selector "div.content"  # Scroll within container

# Get information
agent-browser get text @e1            # Get element text
agent-browser get url                 # Get current URL
agent-browser get title               # Get page title

# Wait
agent-browser wait @e1                # Wait for element
agent-browser wait --load networkidle # Wait for network idle
agent-browser wait --url "**/page"    # Wait for URL pattern
agent-browser wait 2000               # Wait milliseconds
agent-browser wait --text "Welcome"   # Wait for text to appear
agent-browser wait "#spinner" --state hidden  # Wait for element to disappear

# Downloads
agent-browser download @e1 ./file.pdf          # Click to trigger download
agent-browser wait --download ./output.zip     # Wait for download to complete

# Network
agent-browser network requests                 # Inspect tracked requests
agent-browser network route "**/api/*" --abort  # Block matching requests
agent-browser network har start                # Start HAR recording
agent-browser network har stop ./capture.har   # Stop and save HAR file

# Viewport & Device Emulation
agent-browser set viewport 1920 1080          # Set viewport size (default: 1280x720)
agent-browser set device "iPhone 14"          # Emulate device (viewport + user agent)

# Capture
agent-browser screenshot              # Screenshot to temp dir
agent-browser screenshot --full       # Full page screenshot
agent-browser screenshot --annotate   # Annotated screenshot with numbered element labels
agent-browser pdf output.pdf          # Save as PDF

# Clipboard
agent-browser clipboard read          # Read text from clipboard
agent-browser clipboard write "text"  # Write text to clipboard

# Dialogs (alert, confirm, prompt)
agent-browser dialog accept           # Accept dialog
agent-browser dialog dismiss          # Dismiss/cancel dialog
agent-browser dialog status           # Check if a dialog is currently open

# Diff (compare page states)
agent-browser diff snapshot           # Compare current vs last snapshot
agent-browser diff screenshot --baseline before.png  # Visual pixel diff

# Streaming
agent-browser stream enable           # Start WebSocket streaming
agent-browser stream status           # Check streaming state
agent-browser stream disable          # Stop streaming
```

## Deep-Dive Documentation

| Reference | When to Use |
| --- | --- |
| [references/commands.md](references/commands.md) | Full command reference with all options |
| [references/snapshot-refs.md](references/snapshot-refs.md) | Ref lifecycle, invalidation rules, troubleshooting |
| [references/session-management.md](references/session-management.md) | Parallel sessions, state persistence, concurrent scraping |
| [references/authentication.md](references/authentication.md) | Login flows, OAuth, 2FA handling, state reuse |
| [references/advanced-patterns.md](references/advanced-patterns.md) | Batch execution, iframes, data extraction, dark mode, local files |
| [references/dom-interaction.md](references/dom-interaction.md) | Annotated screenshots, semantic locators, JS evaluation |
| [references/security.md](references/security.md) | Content boundaries, domain allowlist, action policy, output limits |
| [references/troubleshooting.md](references/troubleshooting.md) | Diffing, timeouts, JS dialogs, session cleanup |
| [references/configuration.md](references/configuration.md) | Config files, browser engines (Lightpanda), observability dashboard |
| [references/mobile-testing.md](references/mobile-testing.md) | iOS Simulator, Mobile Safari, real device testing |
| [references/video-recording.md](references/video-recording.md) | Recording workflows for debugging and documentation |
| [references/profiling.md](references/profiling.md) | Chrome DevTools profiling for performance analysis |
| [references/proxy-support.md](references/proxy-support.md) | Proxy configuration, geo-testing, rotating proxies |

## Templates

Ready-to-use automation scripts in the `templates/` directory:

| Template | Description |
| --- | --- |
| [templates/form-automation.sh](templates/form-automation.sh) | Form filling with validation |
| [templates/authenticated-session.sh](templates/authenticated-session.sh) | Login once, reuse state |
| [templates/capture-workflow.sh](templates/capture-workflow.sh) | Content extraction with screenshots |

## Gotchas

- **Refs invalidate after navigation or DOM changes.** Always re-snapshot after clicking links, submitting forms, or triggering JS that modifies the DOM. Stale refs produce cryptic errors.
- **`agent-browser` must be installed separately.** It's not bundled with Claude Code. Run `agent-browser install` to download Chrome before first use.
- **State files contain plaintext tokens.** Add `*.json` auth state files to `.gitignore`. Set `AGENT_BROWSER_ENCRYPTION_KEY` for encryption at rest.
- **`networkidle` can hang on pages with persistent connections** (WebSockets, SSE, long-polling). Use `wait --load domcontentloaded` or `wait --text "..."` instead.
- **Screenshots are viewport-sized by default.** Use `--full` for full-page captures. Annotated screenshots (`--annotate`) add visual labels but change the image dimensions.
