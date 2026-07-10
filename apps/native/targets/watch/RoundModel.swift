// @MainActor glue between WatchSessionStore (pure logic, WatchRoundCore)
// and SwiftUI. Also hosts the GPS seam: DistanceProvider mirrors geo.ts —
// swap NullDistanceProvider for a CoreLocation-backed one when hole
// geometry exists; nothing else moves.
import Foundation
import SwiftUI

// MARK: GPS seam (mirror of lib/round-session/geo.ts)

struct DistanceInfo: Equatable {
    var meters: Double
    var target: String // "front" | "center" | "back"
}

protocol DistanceProvider {
    func distanceToHole(_ holeNumber: Int) async -> DistanceInfo?
}

/// The only provider that exists today: no course geo data, no distance.
struct NullDistanceProvider: DistanceProvider {
    func distanceToHole(_ holeNumber: Int) async -> DistanceInfo? { nil }
}

// MARK: Post-round summary

/// What the golfer sees for ~6s after submitting, before landing on Home.
/// Built from the final session snapshot; the differential arrives with the
/// phone's SubmitReply (it's server-computed but synchronous — unlike the
/// index, which the handicap queue reworks ~1 min later, so the index is
/// deliberately absent here).
struct RoundSummary: Equatable {
    var courseName: String
    var totalStrokes: Int
    var toPar: Int?
    var holesPlayed: Int
    var nineHoleSection: NineHoleSection?
    var differential: Double?
}

// MARK: Round model

@MainActor
final class RoundModel: ObservableObject {
    @Published private(set) var session: RoundSession?
    @Published private(set) var stats: WatchStats?
    @Published private(set) var summary: RoundSummary?
    @Published var catalog: [WatchCourseOption] = []
    @Published var catalogState: LoadState = .idle
    @Published var searchResults: [WatchCourseOption] = []
    @Published var searchState: LoadState = .idle
    @Published var tees: [WatchTeeOption] = []
    @Published var teesState: LoadState = .idle
    @Published var startState: LoadState = .idle
    @Published var submitState: LoadState = .idle
    @Published var lastSubmitOutcome: SubmitOutcome?
    /// GPS seam output — always nil with NullDistanceProvider.
    @Published private(set) var distance: DistanceInfo?

    enum LoadState: Equatable {
        case idle
        case loading
        case failed(String)
    }

    private let store: WatchSessionStore
    private let link: PhoneLink
    private let distanceProvider: DistanceProvider = NullDistanceProvider()
    private var summaryTask: Task<Void, Never>?

    /// How long the post-round summary holds before settling on Home.
    private static let summaryHoldSeconds: UInt64 = 6

    init(link: PhoneLink = .shared) {
        self.link = link
        self.store = WatchSessionStore(transport: link)
        store.onChange = { [weak self] in
            guard let self else { return }
            let previous = self.session
            let next = self.store.session
            self.session = next
            self.stats = self.store.stats
            self.reconcileSummary(previous: previous, next: next)
            self.refreshDistance()
        }
        link.onContext = { [weak self] frame in
            self?.store.receiveContext(frame)
        }
        link.activate()
    }

    // MARK: Post-round summary

    /// Present the summary when a session reaches .submitted (works for
    /// phone- and watch-initiated submits alike — both arrive here as a
    /// snapshot transition), and drop it the moment a NEW round starts.
    private func reconcileSummary(previous: RoundSession?, next: RoundSession?) {
        if let next, next.status == .submitted, previous?.status != .submitted {
            presentSummary(for: next)
        } else if let next, next.id != previous?.id, next.status == .active {
            dismissSummary()
        }
    }

    private func presentSummary(for session: RoundSession) {
        var built = RoundSummary(
            courseName: session.course.name,
            totalStrokes: session.totalStrokes,
            toPar: session.toPar,
            holesPlayed: session.holeCount,
            nineHoleSection: session.nineHoleSection,
            differential: summary?.differential
        )
        // Consume a differential that arrived first via the submit reply —
        // consuming (not just reading) keeps it from leaking into a later
        // round's summary.
        if built.differential == nil, let known = pendingDifferential {
            built.differential = known
        }
        pendingDifferential = nil
        summary = built
        summaryTask?.cancel()
        summaryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.summaryHoldSeconds * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.summary = nil
                self?.pendingDifferential = nil
            }
        }
    }

    func dismissSummary() {
        summaryTask?.cancel()
        summaryTask = nil
        summary = nil
        pendingDifferential = nil
    }

    /// Differential from the submit reply; it can land before OR after the
    /// submitted snapshot, so it's merged from whichever side is second.
    private var pendingDifferential: Double?

    private static func now() -> String {
        ISO8601DateFormatter.shared.string(from: Date())
    }

    // MARK: Intents (session)

    func score(_ strokes: Int) {
        store.scoreCurrentHole(strokes: strokes, at: Self.now())
    }

    func selectHole(_ index: Int) {
        store.selectHole(index, at: Self.now())
    }

    func clearScore(at index: Int) {
        store.clearScore(holeIndex: index, at: Self.now())
    }

    func beginFinish() {
        store.beginFinish(at: Self.now())
    }

    func cancelFinish() {
        store.cancelFinish(at: Self.now())
    }

    func submit() {
        guard session?.status == .finishing else { return }
        submitState = .loading
        link.requestSubmit { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success(reply):
                self.lastSubmitOutcome = reply.outcome
                if reply.outcome == .error {
                    self.submitState = .failed(reply.error ?? "Submit failed")
                } else {
                    self.submitState = .idle
                    // The differential and the submitted snapshot race —
                    // merge into the summary if it's already on screen,
                    // park it for presentSummary otherwise.
                    if let differential = reply.differential {
                        if self.summary != nil {
                            self.summary?.differential = differential
                        } else {
                            self.pendingDifferential = differential
                        }
                    }
                }
            case let .failure(error):
                self.submitState = .failed(error.localizedDescription)
            }
        }
    }

    // MARK: Intents (start flow)

    func loadCatalog() {
        catalogState = .loading
        link.requestCatalog { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success(reply):
                self.catalog = reply.courses
                self.catalogState = .idle
            case let .failure(error):
                self.catalogState = .failed(error.localizedDescription)
            }
        }
    }

    func search(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        searchState = .loading
        searchResults = []
        link.requestSearch(query: trimmed) { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success(reply):
                self.searchResults = reply.courses
                self.searchState = reply.error.map { .failed($0) } ?? .idle
            case let .failure(error):
                self.searchState = .failed(error.localizedDescription)
            }
        }
    }

    func loadTees(courseId: Int) {
        teesState = .loading
        tees = []
        link.requestTees(courseId: courseId) { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success(reply):
                self.tees = reply.tees
                self.teesState = reply.error.map { .failed($0) } ?? .idle
            case let .failure(error):
                self.teesState = .failed(error.localizedDescription)
            }
        }
    }

    func startRound(
        course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?
    ) {
        startState = .loading
        link.requestStart(
            course: course, teeId: teeId,
            holeCount: holeCount, nineHoleSection: nineHoleSection
        ) { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success(reply):
                // Success surfaces as the phone's context push flipping
                // `session` — the reply only carries failures.
                self.startState = reply.ok ? .idle : .failed(reply.error ?? "Could not start round")
            case let .failure(error):
                self.startState = .failed(error.localizedDescription)
            }
        }
    }

    // MARK: GPS seam

    private func refreshDistance() {
        guard let hole = session?.currentHole else {
            distance = nil
            return
        }
        Task { [weak self] in
            let info = await self?.distanceProvider.distanceToHole(hole.holeNumber)
            await MainActor.run { self?.distance = info }
        }
    }
}

extension ISO8601DateFormatter {
    /// Matches the phone's `new Date().toISOString()` (millisecond precision).
    static let shared: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
