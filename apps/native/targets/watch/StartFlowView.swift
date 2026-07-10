// Round setup, entirely on the wrist: course → tee → holes → start.
// Course/tee data comes from the phone (catalog = last played, search =
// dictation/scribble → course.searchCourses). The phone owns fetching,
// auth, and validation — the watch only echoes chosen options back.
import SwiftUI

struct StartFlowView: View {
    @EnvironmentObject private var model: RoundModel
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List {
                if case let .failed(message) = model.catalogState {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Theme.destructive)
                }

                if !model.catalog.isEmpty {
                    Section("Recent") {
                        ForEach(model.catalog) { course in
                            courseLink(course)
                        }
                    }
                }

                Section("Find course") {
                    // Watch text input = dictation/scribble — no keyboard UX
                    // to worry about; a course name fragment is enough.
                    TextField("Course name…", text: $query)
                        .onSubmit { model.search(query) }
                    if model.searchState == .loading {
                        ProgressView()
                    }
                    if case let .failed(message) = model.searchState {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(Theme.destructive)
                    }
                    ForEach(model.searchResults) { course in
                        courseLink(course)
                    }
                }

                if model.catalog.isEmpty && model.catalogState == .loading {
                    ProgressView("Syncing with iPhone…")
                }
            }
            .listStyle(.carousel)
            .navigationTitle("Handicappin'")
        }
        .onAppear {
            if model.catalog.isEmpty {
                model.loadCatalog()
            }
        }
    }

    private func courseLink(_ course: WatchCourseOption) -> some View {
        NavigationLink {
            TeePickView(course: course)
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(course.name).lineLimit(2)
                Text(course.city)
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground)
            }
        }
        .accessibilityIdentifier("course-option")
    }
}

struct TeePickView: View {
    @EnvironmentObject private var model: RoundModel
    let course: WatchCourseOption

    /// Catalog courses carry their last-used tee inline; anything else is
    /// fetched from the phone on appear.
    private var tees: [WatchTeeOption] {
        if let inline = course.tees, !inline.isEmpty {
            // Merge: inline (offline-capable) first, fetched extras after.
            let fetched = model.tees.filter { t in !inline.contains(where: { $0.id == t.id }) }
            return inline + fetched
        }
        return model.tees
    }

    var body: some View {
        List {
            Section("Tee") {
                if tees.isEmpty && model.teesState == .loading {
                    ProgressView("Loading tees…")
                }
                if case let .failed(message) = model.teesState, tees.isEmpty {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Theme.destructive)
                }
                ForEach(tees) { tee in
                    NavigationLink {
                        HoleCountPickView(course: course, tee: tee)
                    } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(tee.name)
                            Text(teeDetail(tee))
                                .font(.footnote)
                                .foregroundStyle(Theme.mutedForeground)
                        }
                    }
                    .accessibilityIdentifier("tee-option")
                }
            }
        }
        .navigationTitle(course.name)
        .onAppear {
            model.loadTees(courseId: course.id)
        }
    }

    private func teeDetail(_ tee: WatchTeeOption) -> String {
        let unit = tee.distanceMeasurement == "yards" ? "yd" : "m"
        return "Par \(tee.totalPar) · \(Int(tee.totalDistance))\(unit) · \(tee.gender)"
    }
}

struct HoleCountPickView: View {
    @EnvironmentObject private var model: RoundModel
    let course: WatchCourseOption
    let tee: WatchTeeOption

    private var isStarting: Bool { model.startState == .loading }

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                startButton(label: "18 holes", holeCount: 18, section: nil)
                startButton(label: "Front 9", holeCount: 9, section: .front)
                startButton(label: "Back 9", holeCount: 9, section: .back)

                if case let .failed(message) = model.startState {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                }
                if isStarting {
                    ProgressView()
                }
            }
        }
        .navigationTitle(tee.name)
    }

    private func startButton(
        label: String, holeCount: Int, section: NineHoleSection?
    ) -> some View {
        Button {
            model.startRound(
                course: course.courseRef, teeId: tee.id,
                holeCount: holeCount, nineHoleSection: section
            )
        } label: {
            Text(label)
                .font(.headline)
                .frame(maxWidth: .infinity)
        }
        .tint(Theme.primary)
        .buttonStyle(.borderedProminent)
        .foregroundStyle(Theme.primaryForeground)
        .disabled(isStarting)
        .accessibilityIdentifier(
            section == nil ? "start-18" : section == .front ? "start-front9" : "start-back9"
        )
    }
}
