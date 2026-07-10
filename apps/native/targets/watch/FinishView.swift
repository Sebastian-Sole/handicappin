// Round controls (bottom page) + the finishing confirmation screen.
import SwiftUI

/// Bottom page while the round is active: totals + "Finish round".
struct RoundControlsView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession

    var body: some View {
        VStack(spacing: 8) {
            summary

            Button {
                model.beginFinish()
            } label: {
                Text("Finish round")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .tint(Theme.primary)
            .buttonStyle(.borderedProminent)
            .foregroundStyle(Theme.primaryForeground)
            .disabled(!session.canFinish)
            .accessibilityIdentifier("finish-round")

            if !session.allHolesScored {
                // USGA 9-or-18: a complete nine of an 18-hole round still counts.
                Text(
                    session.canFinish
                        ? "Submits as a 9-hole round"
                        : "\(session.holeCount - session.scoredCount) holes unscored"
                )
                .font(.footnote)
                .foregroundStyle(Theme.warning)
            }
        }
        .padding(.horizontal, 4)
    }

    private var summary: some View {
        VStack(spacing: 2) {
            Text(formatToPar(session.toPar))
                .font(.system(size: 40, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text("\(session.totalStrokes) strokes · \(session.scoredCount)/\(session.holeCount) holes")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
        }
    }
}

/// status == .finishing: confirm submission (relayed to the phone's
/// submit pipeline) or go back to scoring.
struct FinishView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession

    private var isSubmitting: Bool { model.submitState == .loading }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(formatToPar(session.toPar))
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text("\(session.totalStrokes) strokes on \(session.course.name)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
                    .multilineTextAlignment(.center)

                if case let .failed(message) = model.submitState {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                }

                if model.lastSubmitOutcome == .parked {
                    Text("Saved — will sync when your phone is online.")
                        .font(.footnote)
                        .foregroundStyle(Theme.warning)
                        .multilineTextAlignment(.center)
                }

                Button {
                    model.submit()
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text("Submit scorecard")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                }
                .tint(Theme.primary)
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Theme.primaryForeground)
                .disabled(isSubmitting)
                .accessibilityIdentifier("submit-scorecard")

                Button("Keep playing") {
                    model.cancelFinish()
                }
                .disabled(isSubmitting)
                .accessibilityIdentifier("keep-playing")
            }
        }
        .navigationTitle("Finish")
    }
}
