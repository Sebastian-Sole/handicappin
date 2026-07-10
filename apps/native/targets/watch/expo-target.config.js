/**
 * Apple Watch companion app target (@bacons/apple-targets). Regenerated
 * into the Xcode project on every `expo prebuild` — the Swift sources in
 * this directory ARE the app; Core/ additionally backs the SwiftPM test
 * package at ../../watch-core (symlinked, `swift test`).
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "watch",
  name: "HandicappinWatch",
  displayName: "Handicappin'",
  // Appended to the main app id → com.handicappin.app.watchkitapp
  bundleIdentifier: ".watchkitapp",
  // watchOS 10: .verticalPage TabView style + single-closure onChange.
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WatchConnectivity"],
  colors: {
    // tokens.ts primary (light/dark) — the watch accent color.
    $accent: { color: "#006b27", darkColor: "#229944" },
  },
};
