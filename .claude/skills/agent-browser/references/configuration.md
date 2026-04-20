# Configuration

Configuration file, browser engine selection, and observability dashboard.

**Related**: [commands.md](commands.md) for full command reference, [SKILL.md](../SKILL.md) for quick start.

## Contents

- [Configuration File](#configuration-file)
- [Browser Engine Selection](#browser-engine-selection)
- [Observability Dashboard](#observability-dashboard)

## Configuration File

Create `agent-browser.json` in the project root for persistent settings:

```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "./browser-data"
}
```

Priority (lowest to highest): `~/.agent-browser/config.json` < `./agent-browser.json` < env vars < CLI flags. Use `--config <path>` or `AGENT_BROWSER_CONFIG` env var for a custom config file (exits with error if missing/invalid). All CLI options map to camelCase keys (e.g., `--executable-path` -> `"executablePath"`). Boolean flags accept `true`/`false` values (e.g., `--headed false` overrides config). Extensions from user and project configs are merged, not replaced.

## Browser Engine Selection

Use `--engine` to choose a local browser engine. The default is `chrome`.

```bash
# Use Lightpanda (fast headless browser, requires separate install)
agent-browser --engine lightpanda open example.com

# Via environment variable
export AGENT_BROWSER_ENGINE=lightpanda
agent-browser open example.com

# With custom binary path
agent-browser --engine lightpanda --executable-path /path/to/lightpanda open example.com
```

Supported engines:
- `chrome` (default) -- Chrome/Chromium via CDP
- `lightpanda` -- Lightpanda headless browser via CDP (10x faster, 10x less memory than Chrome)

Lightpanda does not support `--extension`, `--profile`, `--state`, or `--allow-file-access`. Install Lightpanda from https://lightpanda.io/docs/open-source/installation.

## Observability Dashboard

The dashboard is a standalone background server that shows live browser viewports, command activity, and console output for all sessions.

```bash
# Install the dashboard once
agent-browser dashboard install

# Start the dashboard server (background, port 4848)
agent-browser dashboard start

# All sessions are automatically visible in the dashboard
agent-browser open example.com

# Stop the dashboard
agent-browser dashboard stop
```

The dashboard runs independently of browser sessions on port 4848 (configurable with `--port`). All sessions automatically stream to the dashboard.
