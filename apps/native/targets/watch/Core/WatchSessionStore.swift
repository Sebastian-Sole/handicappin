// Watch-side session state: optimistic local reducer + phone-snapshot
// reconciliation (PROTOCOL.md §Ordering & conflicts). Transport-agnostic —
// the WatchConnectivity layer feeds `receiveContext` and consumes
// `outbox`-style sends through WatchTransport, so this logic runs under
// plain `swift test`.
import Foundation

public protocol WatchTransport {
    var isReachable: Bool { get }
    /// Fire-and-forget event relay (sendMessage with transferUserInfo
    /// fallback happens inside the transport).
    func sendEvent(_ event: SessionEvent)
    func requestCatalog(_ completion: @escaping (Result<CatalogReply, Error>) -> Void)
    func requestSearch(query: String, _ completion: @escaping (Result<SearchReply, Error>) -> Void)
    func requestTees(courseId: Int, _ completion: @escaping (Result<TeesReply, Error>) -> Void)
    func requestStart(
        course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?,
        _ completion: @escaping (Result<StartReply, Error>) -> Void
    )
    func requestSubmit(_ completion: @escaping (Result<SubmitReply, Error>) -> Void)
    func requestSync()
}

/// Single source of watch-side truth for the live round. Not thread-safe by
/// itself — the app wraps it in a @MainActor ObservableObject.
public final class WatchSessionStore {
    public private(set) var session: RoundSession?
    /// Home-screen stats — last value received from the phone. Kept when a
    /// frame arrives without the key (the phone omits stats until fetched;
    /// stale numbers beat an empty home).
    public private(set) var stats: WatchStats?
    /// Seq of the last snapshot adopted FROM THE PHONE (not local optimism).
    public private(set) var lastAdoptedSeq: Int = -1
    public var onChange: (() -> Void)?

    private let transport: WatchTransport

    public init(transport: WatchTransport) {
        self.transport = transport
    }

    // MARK: Phone → watch

    /// Adopt-or-keep rule: the phone is authoritative, but a stale context
    /// (produced before our in-flight events landed) must not rubber-band
    /// scores the golfer just entered. A snapshot for a DIFFERENT session
    /// (or none) always wins — start/discard/submit elsewhere is definitive.
    /// Stats have no ordering concerns (advisory, phone-computed): adopt
    /// whenever present.
    public func receiveContext(_ frame: ContextFrame) {
        var changed = false
        if let incomingStats = frame.stats, incomingStats != stats {
            stats = incomingStats
            changed = true
        }
        guard frame.session != nil else {
            if session != nil {
                session = nil
                lastAdoptedSeq = -1
                changed = true
            }
            if changed { onChange?() }
            return
        }
        guard let incoming = frame.decodedSession() else {
            if changed { onChange?() }
            return
        }
        let sameSession = incoming.id == session?.id
        if sameSession, let current = session, incoming.eventSeq < current.eventSeq {
            // Stale session echo; the phone will overtake after applying
            // our events. (Fresh stats were still adopted above.)
            if changed { onChange?() }
            return
        }
        session = incoming
        lastAdoptedSeq = incoming.eventSeq
        onChange?()
    }

    // MARK: Watch → phone

    /// Apply locally through the mirrored reducer, and relay to the phone
    /// only if the reducer accepted (no-ops aren't worth radio time — the
    /// phone reducer would reject them identically anyway).
    @discardableResult
    public func dispatch(_ event: SessionEvent) -> Bool {
        guard let current = session else { return false }
        guard let next = applyEvent(current, event) else { return false }
        session = next
        transport.sendEvent(event)
        onChange?()
        return true
    }

    // MARK: Convenience for the UI

    public func scoreCurrentHole(strokes: Int, at: String) {
        guard let s = session else { return }
        let index = s.currentHoleIndex
        // Phone UI policy (rounds/live/index.tsx): auto-advance only when
        // the hole was previously UNSCORED — editing a score never moves
        // the player off the hole they chose.
        let wasUnscored = s.currentEntry?.strokes == nil
        guard dispatch(.scoreSet(holeIndex: index, strokes: Double(strokes), at: at)) else { return }
        if wasUnscored, let scored = session {
            let target = nextHoleAfterScore(scored, justScoredIndex: index)
            if target != scored.currentHoleIndex {
                dispatch(.holeSelected(holeIndex: target, at: at))
            }
        }
    }

    public func selectHole(_ index: Int, at: String) {
        dispatch(.holeSelected(holeIndex: index, at: at))
    }

    public func clearScore(holeIndex: Int, at: String) {
        dispatch(.scoreCleared(holeIndex: holeIndex, at: at))
    }

    public func beginFinish(at: String) {
        dispatch(.finishStarted(at: at))
    }

    public func cancelFinish(at: String) {
        dispatch(.finishCancelled(at: at))
    }
}

// MARK: - Derived display values (selectors.ts counterparts)

extension RoundSession {
    public var scoredCount: Int {
        entries.filter { $0.strokes != nil }.count
    }

    public var totalStrokes: Int {
        entries.compactMap(\.strokes).reduce(0, +)
    }

    /// Par for the holes scored so far (running to-par denominator).
    public var parForScoredHoles: Int {
        zip(entries, displayedHoles)
            .filter { $0.0.strokes != nil }
            .map(\.1.par)
            .reduce(0, +)
    }

    /// Running score vs par over scored holes; nil until something is scored.
    public var toPar: Int? {
        scoredCount == 0 ? nil : totalStrokes - parForScoredHoles
    }

    public var currentHole: SessionHole? {
        displayedHoles.indices.contains(currentHoleIndex)
            ? displayedHoles[currentHoleIndex] : nil
    }

    public var currentEntry: HoleEntry? {
        entries.indices.contains(currentHoleIndex) ? entries[currentHoleIndex] : nil
    }

    public var allHolesScored: Bool {
        scoredCount == holeCount
    }

    /// The complete nine this session could be submitted as (USGA 9-or-18
    /// rule) — selectors.ts finishEligibility.asNine.
    public var completeNine: NineHoleSection? {
        if holeCount == 9 {
            return allHolesScored ? (nineHoleSection ?? .front) : nil
        }
        if entries.prefix(9).allSatisfy({ $0.strokes != nil }) { return .front }
        if entries.count >= 18, entries[9...].allSatisfy({ $0.strokes != nil }) { return .back }
        return nil
    }

    /// Submittable at all (full round or a complete nine)?
    public var canFinish: Bool {
        allHolesScored || completeNine != nil
    }
}

/// Format a to-par value the golf way: E, +3, -2.
public func formatToPar(_ toPar: Int?) -> String {
    guard let toPar else { return "—" }
    if toPar == 0 { return "E" }
    return toPar > 0 ? "+\(toPar)" : "\(toPar)"
}
