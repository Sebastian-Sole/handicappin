// Watch theme — values mirror packages/tokens/generated/tokens.ts (dark
// mode: watch UIs are dark-background per HIG). The token pipeline emits
// TS/CSS only today; emitting a Swift file from `pnpm generate:theme` is
// the follow-up that deletes this file (docs/apple-watch.md).
// allow-hardcoded mirrored from generated tokens.ts dark palette, single source pending Swift emitter
import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

enum Theme {
    // colors.dark from tokens.ts
    static let primary = Color(hex: 0x229944)
    static let primaryForeground = Color(hex: 0x030F05)
    static let foreground = Color(hex: 0xECF4EF)
    static let mutedForeground = Color(hex: 0x96A298)
    static let card = Color(hex: 0x041608)
    static let destructive = Color(hex: 0xDE3B3D)
    static let warning = Color(hex: 0xDE9C31)

    static let scoreEagle = Color(hex: 0xF7C900)
    static let scoreBirdie = Color(hex: 0x05DF72)
    static let scorePar = Color(hex: 0x56A2FF)
    static let scoreBogey = Color(hex: 0xFF8B1E)
    static let scoreDouble = Color(hex: 0xFF6568)
    static let scoreTriple = Color(hex: 0xE40015)

    /// Web's score-color ramp (relative to par), used for score accents.
    static func scoreColor(strokes: Int, par: Int) -> Color {
        switch strokes - par {
        case ..<(-1): return scoreEagle
        case -1: return scoreBirdie
        case 0: return scorePar
        case 1: return scoreBogey
        case 2: return scoreDouble
        default: return scoreTriple
        }
    }
}
