// Face 2 of the in-round pager (plan 013 D5): hole-out capture. Detailed
// rounds get the 2×2 crown grid — Score ↖, Putts ↗, Penalties ↙,
// Fairway ↘ (fixed order). Numeric tiles focus on tap and dial with the
// Digital Crown (haptic tick per detent); Fairway is a tap toggle
// (✓ / ✗ / –; n/a on par 3s). Scores-only rounds collapse to one large
// Score face + crown. Next commits the hole, advances, and swipes the
// pager back to the Distance face for the new hole.
import SwiftUI

struct HoleView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession
    /// Pager selection — Next returns to the distance face (or the finish
    /// page once every hole is scored).
    @Binding var tab: Int

    var body: some View {
        if session.isDetailed {
            DetailGridFace(session: session, tab: $tab)
        } else {
            ScoreOnlyFace(session: session, tab: $tab)
        }
    }
}

/// Post-commit navigation shared by both faces: back to the distance face
/// for the new hole; to the finish page (controls, tag 3) when the round
/// is complete.
@MainActor
private func settleAfterCommit(model: RoundModel, tab: Binding<Int>) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
        guard let session = model.session, session.status == .active else { return }
        withAnimation {
            tab.wrappedValue = session.allHolesScored ? 3 : 0
        }
    }
}

// MARK: - Detailed: the 2×2 crown grid

private struct DetailGridFace: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession
    @Binding var tab: Int

    private enum Field { case score, putts, pen }

    @State private var focused: Field = .score
    @State private var score: Double = 4
    @State private var putts: Double = 2
    @State private var pen: Double = 0
    @State private var fairway: Bool?
    @State private var seededHoleIndex: Int = -1

    private var hole: SessionHole? { session.currentHole }
    private var isPar3: Bool { hole?.par == 3 }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text("HOLE \(hole?.holeNumber ?? 0)")
                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                    .foregroundStyle(Theme.primary)
                    .accessibilityIdentifier("grid-hole-title")
                Spacer()
                Text("Par \(hole?.par ?? 0) · SI \(hole?.hcp ?? 0)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
            }

            Grid(horizontalSpacing: 4, verticalSpacing: 4) {
                GridRow {
                    numericCell(.score, label: "SCORE", value: Int(score), id: "grid-score")
                    numericCell(.putts, label: "PUTTS", value: Int(putts), id: "grid-putts")
                }
                GridRow {
                    numericCell(.pen, label: "PEN", value: Int(pen), id: "grid-pen")
                    fairwayCell
                }
            }
            .frame(maxHeight: .infinity)

            Button(action: commit) {
                Text("Next hole →")
                    .font(.system(.footnote, design: .rounded).weight(.bold))
                    .frame(maxWidth: .infinity)
            }
            .tint(Theme.primary)
            .buttonStyle(.borderedProminent)
            .foregroundStyle(Theme.primaryForeground)
            .accessibilityIdentifier("grid-next-hole")
        }
        .padding(.horizontal, 2)
        .focusable(true)
        .digitalCrownRotation(
            crownBinding,
            from: crownRange.lowerBound,
            through: crownRange.upperBound,
            by: 1,
            sensitivity: .low,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .onAppear(perform: seed)
        .onChange(of: session.currentHoleIndex) { seed() }
        .onChange(of: score) { clampDetailToScore() }
        .navigationTitle("")
    }

    // MARK: crown plumbing — the focused tile owns the crown

    private var crownBinding: Binding<Double> {
        switch focused {
        case .score: return $score
        case .putts: return $putts
        case .pen: return $pen
        }
    }

    /// Detail is bounded by the score: putts + penalties ≤ score − 1
    /// (mirror of the phone's detail rule; the reducer enforces it too).
    private var detailBudget: Int { max(0, Int(score) - 1) }

    private var crownRange: ClosedRange<Double> {
        switch focused {
        case .score: return Double(MIN_STROKES)...Double(MAX_STROKES)
        case .putts:
            return 0...Double(min(MAX_PUTTS, max(0, detailBudget - Int(pen))))
        case .pen:
            return 0...Double(min(MAX_PENALTIES, max(0, detailBudget - Int(putts))))
        }
    }

    /// Dialing the score down re-fits recorded detail (putts keep priority):
    /// score 5 with 4 putts dialed to 4 → 3 putts.
    private func clampDetailToScore() {
        if Int(putts) > detailBudget { putts = Double(detailBudget) }
        let penCap = max(0, detailBudget - Int(putts))
        if Int(pen) > penCap { pen = Double(penCap) }
    }

    // MARK: cells

    private func numericCell(
        _ field: Field, label: String, value: Int, id: String
    ) -> some View {
        let isFocused = focused == field
        let valueColor: Color =
            field == .score
            ? Theme.scoreColor(strokes: value, par: hole?.par ?? 4)
            : Theme.foreground
        return Button {
            focused = field
        } label: {
            VStack(spacing: 1) {
                Text(label)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.mutedForeground)
                Text("\(value)")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(valueColor)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isFocused ? Theme.primary.opacity(0.18) : Theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isFocused ? Theme.primary : Theme.mutedForeground.opacity(0.3), lineWidth: 1)
        )
        .accessibilityIdentifier(id)
        .accessibilityLabel("\(label) \(value)\(isFocused ? ", crown adjusts" : "")")
    }

    private var fairwayGlyph: String {
        if isPar3 { return "n/a" }
        switch fairway {
        case .some(true): return "✓"
        case .some(false): return "✗"
        case .none: return "–"
        }
    }

    private var fairwayColor: Color {
        if isPar3 { return Theme.mutedForeground }
        switch fairway {
        case .some(true): return Theme.scoreBirdie
        case .some(false): return Theme.destructive
        case .none: return Theme.mutedForeground
        }
    }

    private var fairwayCell: some View {
        Button {
            guard !isPar3 else { return }
            // Tap cycle: – → ✓ → ✗ → – (hit / miss / not recorded).
            switch fairway {
            case .none: fairway = true
            case .some(true): fairway = false
            case .some(false): fairway = nil
            }
        } label: {
            VStack(spacing: 1) {
                Text("FAIRWAY")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.mutedForeground)
                Text(fairwayGlyph)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(fairwayColor)
                Text(isPar3 ? "par 3" : "tap")
                    .font(.system(size: 8))
                    .foregroundStyle(Theme.mutedForeground)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.card))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.mutedForeground.opacity(0.3), lineWidth: 1)
        )
        .accessibilityIdentifier("grid-fairway")
        .accessibilityLabel(
            isPar3 ? "Fairway not applicable, par 3" : "Fairway \(fairwayGlyph), tap to change")
    }

    // MARK: intents

    private func commit() {
        model.commitHole(
            score: Int(score),
            putts: Int(putts),
            fairway: isPar3 ? nil : fairway,
            penalties: Int(pen)
        )
        settleAfterCommit(model: model, tab: $tab)
    }

    /// Seed the grid from the entry (or sensible defaults) per hole.
    private func seed() {
        guard seededHoleIndex != session.currentHoleIndex else { return }
        seededHoleIndex = session.currentHoleIndex
        let entry = session.currentEntry
        score = Double(entry?.strokes ?? session.currentHole?.par ?? 4)
        putts = Double(entry?.putts ?? 2)
        pen = Double(entry?.penaltyStrokes ?? 0)
        fairway = entry?.fairwayHit
        focused = .score
        clampDetailToScore()
    }
}

// MARK: - Scores-only: one large score + crown (the collapse)

private struct ScoreOnlyFace: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession
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
            return committed == Int(pending) ? "Next hole →" : "Update"
        }
        return "Next hole →"
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
        model.commitScoreOnly(Int(pending))
        settleAfterCommit(model: model, tab: $tab)
    }

    /// Default the picker to the committed score, else par (fast common case).
    private func syncPending() {
        guard editingHoleIndex != session.currentHoleIndex else { return }
        editingHoleIndex = session.currentHoleIndex
        pending = Double(committed ?? session.currentHole?.par ?? 4)
    }
}
