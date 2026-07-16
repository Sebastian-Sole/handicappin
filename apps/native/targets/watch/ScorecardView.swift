// Scrollable scorecard: every hole with its committed score; tapping a row
// jumps the round cursor there (HOLE_SELECTED). Long-press clears a score.
import SwiftUI

struct ScorecardView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession
    /// Pager selection — picking a hole jumps back to the scoring page.
    @Binding var tab: Int

    var body: some View {
        List {
            Section {
                ForEach(Array(session.displayedHoles.enumerated()), id: \.offset) { index, hole in
                    row(index: index, hole: hole)
                }
            } header: {
                HStack {
                    Text(session.course.name)
                        .lineLimit(1)
                    Spacer()
                    Text("\(session.scoredCount)/\(session.holeCount)")
                        .monospacedDigit()
                }
                .font(.footnote)
            }
        }
        .listStyle(.carousel)
    }

    private func row(index: Int, hole: SessionHole) -> some View {
        let entry = session.entries.indices.contains(index) ? session.entries[index] : nil
        let isCurrent = index == session.currentHoleIndex
        return Button {
            model.selectHole(index)
            // Jump to the SCORE face (tag 1) — tag 0 is the distance face.
            withAnimation { tab = 1 }
        } label: {
            HStack {
                Text("\(hole.holeNumber)")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .frame(width: 26, alignment: .leading)
                    .foregroundStyle(isCurrent ? Theme.primary : Theme.foreground)
                Text("Par \(hole.par)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
                Spacer()
                if let strokes = entry?.strokes {
                    Text("\(strokes)")
                        .font(.system(.body, design: .rounded).weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.scoreColor(strokes: strokes, par: hole.par))
                } else {
                    Text("–")
                        .foregroundStyle(Theme.mutedForeground)
                }
            }
        }
        .accessibilityIdentifier("scorecard-hole-\(hole.holeNumber)")
        .listRowBackground(
            isCurrent
                ? RoundedRectangle(cornerRadius: 8).fill(Theme.card)
                : nil
        )
        .contextMenu {
            if entry?.strokes != nil {
                Button(role: .destructive) {
                    model.clearScore(at: index)
                } label: {
                    Label("Clear score", systemImage: "xmark.circle")
                }
            }
        }
    }
}
