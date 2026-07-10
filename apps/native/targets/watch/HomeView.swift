// Watch home — "Clubhouse Cards" (docs/apple-watch.md; concepts artifact).
// The idle-state companion: index hero on top, last round and season one
// crown-scroll below — the same vertical pager the live round uses. Rounds
// normally start on the iPhone; the watch start flow survives as a fallback
// sheet behind the season page.
import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var model: RoundModel
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            IndexPage().tag(0)
            LastRoundPage().tag(1)
            SeasonPage().tag(2)
        }
        .tabViewStyle(.verticalPage)
    }
}

// MARK: - Shared bits

/// Uppercase micro-label that tops every home page.
private func pageLabel(_ text: String, color: Color = Theme.primary) -> some View {
    Text(text)
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .kerning(1.1)
        .foregroundStyle(color)
}

/// Round to-par presented the golf way, colored by sign.
private func toParColor(_ toPar: Int?) -> Color {
    guard let toPar else { return Theme.foreground }
    if toPar < 0 { return Theme.scoreBirdie }
    if toPar == 0 { return Theme.scorePar }
    return Theme.scoreBogey
}

/// "18 holes" / "Front 9" / "Back 9" from the round shape.
private func holesLabel(holesPlayed: Int, section: NineHoleSection?) -> String {
    if holesPlayed >= 18 { return "18 holes" }
    return section == .back ? "Back 9" : "Front 9"
}

/// ISO teeTime → "Jul 6" (or "" when unparsable — the row just omits it).
/// PostgREST timestamps come without a timezone suffix ("2026-07-07T19:33:00"),
/// which ISO8601DateFormatter rejects — hence the plain-format fallback.
private func shortDate(_ iso: String) -> String {
    var parsed = ISO8601DateFormatter.shared.date(from: iso)
        ?? ISO8601DateFormatter().date(from: iso)
    if parsed == nil {
        let plain = DateFormatter()
        plain.locale = Locale(identifier: "en_US_POSIX")
        plain.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        parsed = plain.date(from: String(iso.prefix(19)))
    }
    guard let parsed else { return "" }
    let f = DateFormatter()
    f.setLocalizedDateFormatFromTemplate("MMM d")
    return f.string(from: parsed)
}

// MARK: - Page 1 · Index hero

private struct IndexPage: View {
    @EnvironmentObject private var model: RoundModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            pageLabel("HANDICAP INDEX")

            if let stats = model.stats {
                Text(String(format: "%.1f", stats.handicapIndex))
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .padding(.top, 6)
                    .accessibilityIdentifier("home-index")

                chip(stats)
                    .padding(.top, 4)

                Spacer(minLength: 0)

                footer(stats)
            } else {
                Spacer(minLength: 0)
                ProgressView("Syncing with iPhone…")
                    .font(.footnote)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
    }

    /// Recalculating > delta > nothing. The delta mirrors the phone home's
    /// "from first round" semantics; a worsening index goes neutral grey,
    /// never red — the app stays on the golfer's side.
    @ViewBuilder
    private func chip(_ stats: WatchStats) -> some View {
        if stats.recalculating {
            chipBody("Updating…", color: Theme.mutedForeground)
        } else {
            let delta = stats.handicapIndex - stats.initialHandicapIndex
            if delta <= -0.05 {
                chipBody("▼ \(String(format: "%.1f", abs(delta))) from first round",
                         color: Theme.primary)
            } else if delta >= 0.05 {
                chipBody("▲ \(String(format: "%.1f", delta)) from first round",
                         color: Theme.mutedForeground)
            }
        }
    }

    private func chipBody(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(Theme.card))
    }

    @ViewBuilder
    private func footer(_ stats: WatchStats) -> some View {
        if let last = stats.lastRound {
            VStack(alignment: .leading, spacing: 1) {
                (Text("Last · ").foregroundStyle(Theme.mutedForeground)
                    + Text(last.courseName).foregroundStyle(Theme.foreground))
                    .lineLimit(1)
                Text("\(last.totalStrokes) · \(holesLabel(holesPlayed: last.holesPlayed, section: last.nineHoleSection))")
                    .foregroundStyle(Theme.mutedForeground)
            }
            .font(.system(.footnote, design: .rounded))
        } else {
            Text("Tee off from your iPhone —\nthe watch takes over out here.")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
        }
    }
}

// MARK: - Page 2 · Last round

private struct LastRoundPage: View {
    @EnvironmentObject private var model: RoundModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            pageLabel("LAST ROUND", color: Theme.mutedForeground)

            if let last = model.stats?.lastRound {
                Text(last.courseName.isEmpty ? "Round" : last.courseName)
                    .font(.system(.headline, design: .rounded))
                    .lineLimit(2)
                    .padding(.top, 6)
                let date = shortDate(last.playedAt)
                Text(date.isEmpty
                     ? holesLabel(holesPlayed: last.holesPlayed, section: last.nineHoleSection)
                     : "\(holesLabel(holesPlayed: last.holesPlayed, section: last.nineHoleSection)) · \(date)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)

                VStack(spacing: 2) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(last.totalStrokes)")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .monospacedDigit()
                        Spacer()
                        Text(formatToPar(last.toPar))
                            .font(.system(.headline, design: .rounded))
                            .foregroundStyle(toParColor(last.toPar))
                    }
                    HStack {
                        Text("Differential")
                            .font(.footnote)
                            .foregroundStyle(Theme.mutedForeground)
                        Spacer()
                        Text(String(format: "%.1f", last.differential))
                            .font(.system(.footnote, design: .rounded).weight(.semibold))
                            .monospacedDigit()
                    }
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.card))
                .padding(.top, 8)

                Spacer(minLength: 0)
            } else {
                Spacer(minLength: 0)
                Text("No rounds yet.")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
        .accessibilityIdentifier("home-last-round")
    }
}

// MARK: - Page 3 · Season + fallback start

private struct SeasonPage: View {
    @EnvironmentObject private var model: RoundModel
    @State private var showStartFlow = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            pageLabel("THIS SEASON", color: Theme.mutedForeground)

            if let stats = model.stats {
                statRow("Rounds", value: "\(stats.seasonRounds)")
                if let best = stats.seasonBestDifferential {
                    statRow("Best diff", value: String(format: "%.1f", best),
                            valueColor: Theme.primary)
                }
                statRow("All time", value: "\(stats.totalRounds)")
            } else {
                Text("Waiting for your iPhone…")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
            }

            Spacer(minLength: 0)

            // Fallback only — the primary path is starting on the iPhone.
            Button {
                showStartFlow = true
            } label: {
                Text("New round")
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("start-from-watch")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
        // No container identifier here: it would override every child's,
        // hiding "start-from-watch" from the UI tests.
        .sheet(isPresented: $showStartFlow) {
            StartFlowView()
        }
    }

    private func statRow(
        _ label: String, value: String, valueColor: Color = Theme.foreground
    ) -> some View {
        HStack {
            Text(label)
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
            Spacer()
            Text(value)
                .font(.system(.body, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(valueColor)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.card))
    }
}

// MARK: - Post-round summary (all concepts share this beat)

/// Holds ~6s after a submit (tap to skip), then RootView settles on Home.
/// Shows only what is already true — score, to-par, differential — and
/// says plainly that the index is being reworked server-side.
struct RoundSummaryView: View {
    @EnvironmentObject private var model: RoundModel
    let summary: RoundSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            pageLabel("ROUND SUBMITTED")

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(summary.totalStrokes)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text(formatToPar(summary.toPar))
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(toParColor(summary.toPar))
            }
            .padding(.top, 6)

            Text("\(summary.courseName) · \(holesLabel(holesPlayed: summary.holesPlayed, section: summary.nineHoleSection))")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
                .lineLimit(1)

            if let differential = summary.differential {
                HStack {
                    Text("Differential")
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer()
                    Text(String(format: "%.1f", differential))
                        .font(.system(.footnote, design: .rounded).weight(.semibold))
                        .monospacedDigit()
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.card))
                .padding(.top, 8)
            }

            Spacer(minLength: 0)

            Text("Index recalculating…")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
        .contentShape(Rectangle())
        .onTapGesture { model.dismissSummary() }
        .accessibilityIdentifier("round-summary")
    }
}
