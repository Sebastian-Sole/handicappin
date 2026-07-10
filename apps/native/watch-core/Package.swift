// swift-tools-version: 5.9
// Pure Swift mirror of apps/native/lib/round-session (engine + types).
// Platform-agnostic on purpose: `swift test` runs on macOS with no simulator,
// and the watch target compiles the same sources (see targets/watch).
import PackageDescription

let package = Package(
    name: "WatchRoundCore",
    platforms: [.watchOS(.v10), .iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "WatchRoundCore", targets: ["WatchRoundCore"])
    ],
    targets: [
        .target(name: "WatchRoundCore", path: "Sources/WatchRoundCore"),
        .testTarget(
            name: "WatchRoundCoreTests",
            dependencies: ["WatchRoundCore"],
            path: "Tests/WatchRoundCoreTests"
        ),
    ]
)
