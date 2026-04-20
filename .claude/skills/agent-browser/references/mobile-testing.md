# Mobile Testing (iOS Simulator)

Native mobile browser automation via iOS Simulator and Appium.

**Related**: [SKILL.md](../SKILL.md) for core workflow, [commands.md](commands.md) for full command reference.

## Contents

- [iOS Simulator (Mobile Safari)](#ios-simulator-mobile-safari)
- [Requirements](#requirements)
- [Real Devices](#real-devices)

## iOS Simulator (Mobile Safari)

```bash
# List available iOS simulators
agent-browser device list

# Launch Safari on a specific device
agent-browser -p ios --device "iPhone 16 Pro" open https://example.com

# Same workflow as desktop - snapshot, interact, re-snapshot
agent-browser -p ios snapshot -i
agent-browser -p ios tap @e1          # Tap (alias for click)
agent-browser -p ios fill @e2 "text"
agent-browser -p ios swipe up         # Mobile-specific gesture

# Take screenshot
agent-browser -p ios screenshot mobile.png

# Close session (shuts down simulator)
agent-browser -p ios close
```

## Requirements

- macOS with Xcode
- Appium: `pnpm add -g appium && appium driver install xcuitest`

## Real Devices

Works with physical iOS devices if pre-configured. Use `--device "<UDID>"` where UDID is from `xcrun xctrace list devices`.
