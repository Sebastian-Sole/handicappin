import SwiftUI

@main
struct HandicappinWatchApp: App {
    @StateObject private var model = RoundModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: RoundModel

    var body: some View {
        Group {
            // The post-round summary outranks everything for its ~6s hold
            // (tap to skip) — the session usually clears underneath it, so
            // dismissal lands on Home with the stats already refreshing.
            if let summary = model.summary {
                RoundSummaryView(summary: summary)
            } else if let session = model.session {
                switch session.status {
                case .active:
                    RoundPagerView(session: session)
                case .finishing:
                    FinishView(session: session)
                case .submitted:
                    // Rarely visible — reconcileSummary presents the
                    // summary on this transition; kept as a fallback.
                    SubmittedView()
                }
            } else {
                HomeView()
            }
        }
    }
}

/// Vertical pager for the in-round experience: hole scoring on top, round
/// controls one swipe below (finishing happens from the last hole — don't
/// make the golfer traverse the scorecard list), full scorecard at the end.
struct RoundPagerView: View {
    let session: RoundSession
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            HoleView(session: session, tab: $tab).tag(0)
            RoundControlsView(session: session).tag(1)
            ScorecardView(session: session, tab: $tab).tag(2)
        }
        .tabViewStyle(.verticalPage)
    }
}

struct SubmittedView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(Theme.primary)
            Text("Round submitted")
                .font(.headline)
            Text("Nice work out there.")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
        }
        .accessibilityIdentifier("round-submitted")
    }
}
