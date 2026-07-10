// Swift mirror of apps/native/lib/round-session/engine.ts. The TS source +
// tests/unit/round-session-engine.test.ts are the spec; keep transitions
// byte-for-byte equivalent (accept/reject rules, clamping, seq bumping).
//
// One representational difference: TS signals a rejected/no-op event by
// returning the SAME object reference. Swift structs are value types, so
// applyEvent returns nil instead — callers keep their current session and
// skip persistence/publishing, which is the same contract.
import Foundation

public let MIN_STROKES = 1
public let MAX_STROKES = 30

private func clampStrokes(_ strokes: Double) -> Int {
    // JS Math.round rounds half toward +infinity; inputs are clamped to
    // [1, 30] afterwards so away-from-zero rounding is equivalent here.
    let rounded = Int((strokes).rounded(.toNearestOrAwayFromZero))
    return min(MAX_STROKES, max(MIN_STROKES, rounded))
}

private func inRange(_ s: RoundSession, _ holeIndex: Int) -> Bool {
    holeIndex >= 0 && holeIndex < s.holeCount
}

/// Accepted-event bookkeeping: bump eventSeq, stamp lastEventAt.
private func accept(_ s: RoundSession, _ at: String) -> RoundSession {
    var next = s
    next.eventSeq += 1
    next.lastEventAt = at
    return next
}

/// (session, event) → new session, or nil when the event is rejected or a
/// no-op (mirror of engine.ts returning the same reference).
public func applyEvent(_ s: RoundSession, _ e: SessionEvent) -> RoundSession? {
    switch e {
    case let .scoreSet(holeIndex, strokes, at, location):
        guard s.status == .active, inRange(s, holeIndex) else { return nil }
        guard strokes.isFinite else { return nil }
        let clamped = clampStrokes(strokes)
        guard s.entries.indices.contains(holeIndex) else { return nil }
        if s.entries[holeIndex].strokes == clamped { return nil }
        var next = accept(s, at)
        next.entries[holeIndex] = HoleEntry(strokes: clamped, updatedAt: at, location: location)
        return next

    case let .scoreCleared(holeIndex, at):
        guard s.status == .active, inRange(s, holeIndex) else { return nil }
        guard s.entries.indices.contains(holeIndex) else { return nil }
        if s.entries[holeIndex].strokes == nil { return nil }
        var next = accept(s, at)
        next.entries[holeIndex] = HoleEntry(strokes: nil, updatedAt: at)
        return next

    case let .holeSelected(holeIndex, at):
        guard s.status == .active, inRange(s, holeIndex) else { return nil }
        if s.currentHoleIndex == holeIndex { return nil }
        var next = accept(s, at)
        next.currentHoleIndex = holeIndex
        return next

    case let .notesSet(notes, at):
        if s.status == .submitted || s.notes == notes { return nil }
        var next = accept(s, at)
        next.notes = notes
        return next

    case let .finishStarted(at):
        guard s.status == .active else { return nil }
        var next = accept(s, at)
        next.status = .finishing
        return next

    case let .finishCancelled(at):
        guard s.status == .finishing else { return nil }
        var next = accept(s, at)
        next.status = .active
        return next

    case let .submitted(at):
        guard s.status == .finishing else { return nil }
        var next = accept(s, at)
        next.status = .submitted
        return next
    }
}

/// Convenience for optimistic local application: no-ops fall through.
public func applied(_ s: RoundSession, _ e: SessionEvent) -> RoundSession {
    applyEvent(s, e) ?? s
}

/// Auto-advance target after scoring hole `justScoredIndex`: first unscored
/// hole strictly after it (wrapping once); if all scored, stay put.
public func nextHoleAfterScore(_ s: RoundSession, justScoredIndex: Int) -> Int {
    guard s.holeCount > 0 else { return justScoredIndex }
    for step in 1...s.holeCount {
        let i = (justScoredIndex + step) % s.holeCount
        if s.entries.indices.contains(i), s.entries[i].strokes == nil {
            return i
        }
    }
    return justScoredIndex
}
