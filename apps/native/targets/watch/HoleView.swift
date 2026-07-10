// The screen a golfer sees 90% of the round: current hole, par/distance,
// and one-gesture score entry. Digital Crown or +/- buttons pick the
// strokes; the big button commits (SCORE_SET) and auto-advances.
import SwiftUI

struct HoleView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession
    /// Pager selection — saving the final score flips to the finish page.
    @Binding var tab: Int

    /// Pending (uncommitted) strokes for the current hole.
    @State private var pending: Double = 4
    @State private var editingHoleIndex: Int = -1

    private var hole: SessionHole? { session.currentHole }
    private var committed: Int? { session.currentEntry?.strokes }

    var body: some View {
        VStack(spacing: 2) {
            header

            Spacer(minLength: 0)

            HStack(spacing: 10) {
                adjustButton("minus", id: "score-minus") { adjust(-1) }

                Text("\(Int(pending))")
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(pendingColor)
                    .frame(minWidth: 60)
                    .focusable(true)
                    .digitalCrownRotation(
                        $pending,
                        from: 1, through: 30, by: 1,
                        sensitivity: .low,
                        isContinuous: false,
                        isHapticFeedbackEnabled: true
                    )

                adjustButton("plus", id: "score-plus") { adjust(+1) }
            }

            Spacer(minLength: 0)

            Button(action: commit) {
                Text(commitLabel)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .tint(Theme.primary)
            .buttonStyle(.borderedProminent)
            .foregroundStyle(Theme.primaryForeground)
            .accessibilityIdentifier("save-score")
        }
        .padding(.horizontal, 4)
        .onAppear(perform: syncPending)
        .onChange(of: session.currentHoleIndex) { syncPending() }
        .navigationTitle("")
    }

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                Text("HOLE \(hole?.holeNumber ?? 0)")
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(Theme.primary)
                    .accessibilityIdentifier("hole-title")
                Spacer()
                Text(formatToPar(session.toPar))
                    .font(.system(.headline, design: .rounded))
                    .monospacedDigit()
            }
            HStack {
                Text("Par \(hole?.par ?? 0) · Hcp \(hole?.hcp ?? 0)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
                Spacer()
                distanceLabel
            }
        }
    }

    /// Tee distance today; live GPS distance replaces it when the
    /// DistanceProvider seam is filled (model.distance non-nil).
    private var distanceLabel: some View {
        Group {
            if let gps = model.distance {
                Text("\(Int(gps.meters))m ⛳️")
                    .foregroundStyle(Theme.foreground)
            } else if let hole {
                Text("\(Int(hole.distance))\(unitSuffix)")
                    .foregroundStyle(Theme.mutedForeground)
            }
        }
        .font(.footnote)
    }

    private var unitSuffix: String {
        session.tee.distanceMeasurement == "yards" ? "yd" : "m"
    }

    private var pendingColor: Color {
        guard let hole else { return Theme.foreground }
        return Theme.scoreColor(strokes: Int(pending), par: hole.par)
    }

    private var commitLabel: String {
        if let committed {
            return committed == Int(pending) ? "Saved ✓" : "Update"
        }
        return "Save score"
    }

    private func adjustButton(
        _ symbol: String, id: String, _ action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .frame(width: 38, height: 38)
        }
        .buttonStyle(.bordered)
        .clipShape(Circle())
        .accessibilityIdentifier(id)
    }

    private func adjust(_ delta: Double) {
        pending = min(30, max(1, pending + delta))
    }

    private func commit() {
        model.score(Int(pending))
        // Round complete → take the golfer to the finish page after a beat
        // of "Saved ✓" feedback (mirrors the phone spotlighting Finish).
        if model.session?.allHolesScored == true {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                if model.session?.allHolesScored == true,
                   model.session?.status == .active {
                    withAnimation { tab = 1 }
                }
            }
        }
    }

    /// Default the picker to the committed score, else par (fast common case).
    private func syncPending() {
        guard editingHoleIndex != session.currentHoleIndex else { return }
        editingHoleIndex = session.currentHoleIndex
        pending = Double(committed ?? session.currentHole?.par ?? 4)
    }
}
