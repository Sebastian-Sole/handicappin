// Face 1 of the in-round pager (plan 013 D5): the heads-down distance
// face. Shows the hole's TOTAL distance today; reserved to become
// distance-to-pin when GPS / course-map data exists (the DistanceProvider
// seam in RoundModel). Default view for each new hole — Next on the score
// grid swipes back here.
import SwiftUI

struct DistanceFaceView: View {
    @EnvironmentObject private var model: RoundModel
    let session: RoundSession

    private var hole: SessionHole? { session.currentHole }

    private var unitSuffix: String {
        session.tee.distanceMeasurement == "yards" ? "yd" : "m"
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text("HOLE \(hole?.holeNumber ?? 0)")
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(Theme.primary)
                    .accessibilityIdentifier("distance-hole-title")
                Spacer()
                Text(formatToPar(session.toPar))
                    .font(.system(.headline, design: .rounded))
                    .monospacedDigit()
            }
            Text("Par \(hole?.par ?? 0) · SI \(hole?.hcp ?? 0)")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)

            Spacer(minLength: 0)

            if let gps = model.distance {
                // GPS seam filled: live distance-to-pin.
                Text("\(Int(gps.meters))")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text("m to \(gps.target)")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
            } else {
                Text("\(Int(hole?.distance ?? 0))")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .accessibilityIdentifier("distance-total")
                Text("\(unitSuffix) · full hole")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
                Text("DISTANCE TO PIN NEEDS GPS")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Theme.warning)
                    .padding(.top, 2)
            }

            Spacer(minLength: 0)

            Text("Swipe for score")
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground)
        }
        .padding(.horizontal, 6)
        .navigationTitle("")
    }
}
