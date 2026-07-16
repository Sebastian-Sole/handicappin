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
public let MAX_PUTTS = 20
public let MAX_PENALTIES = 10

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
        // Preserve hole-out detail on a score edit (mirror of engine.ts),
        // re-fit to the new score: putts + penalties ≤ strokes − 1 (putts
        // keep priority).
        var entry = s.entries[holeIndex]
        entry.strokes = clamped
        entry.updatedAt = at
        entry.location = location
        let budget = max(0, clamped - 1)
        if let putts = entry.putts { entry.putts = min(putts, budget) }
        if let pen = entry.penaltyStrokes {
            entry.penaltyStrokes = min(pen, budget - (entry.putts ?? 0))
        }
        next.entries[holeIndex] = entry
        return next

    case let .scoreCleared(holeIndex, at):
        guard s.status == .active, inRange(s, holeIndex) else { return nil }
        guard s.entries.indices.contains(holeIndex) else { return nil }
        if s.entries[holeIndex].strokes == nil { return nil }
        var next = accept(s, at)
        // Clearing a score clears the whole hole, detail included.
        next.entries[holeIndex] = HoleEntry(strokes: nil, updatedAt: at)
        return next

    case let .holeDetailSet(holeIndex, putts, fairwayHit, penaltyStrokes, at):
        guard s.status == .active, inRange(s, holeIndex) else { return nil }
        guard s.entries.indices.contains(holeIndex) else { return nil }
        // The watch always sends the FULL patch (see Models.swift): every
        // field is applied, nil = clear. Numeric fields are clamped exactly
        // like the phone reducer (0–20 putts, 0–10 penalties).
        let current = s.entries[holeIndex]
        var entry = current
        entry.putts = putts.map { min(MAX_PUTTS, max(0, $0)) }
        entry.fairwayHit = fairwayHit
        entry.penaltyStrokes = penaltyStrokes.map { min(MAX_PENALTIES, max(0, $0)) }
        // A scored hole also bounds detail: putts + penalties ≤ strokes − 1
        // (putts keep priority) — mirror of engine.ts.
        if let strokes = current.strokes {
            let budget = max(0, strokes - 1)
            if let p = entry.putts { entry.putts = min(p, budget) }
            if let pen = entry.penaltyStrokes {
                entry.penaltyStrokes = min(pen, budget - (entry.putts ?? 0))
            }
        }
        if entry.putts == current.putts,
           entry.fairwayHit == current.fairwayHit,
           entry.penaltyStrokes == current.penaltyStrokes {
            return nil
        }
        entry.updatedAt = at
        var next = accept(s, at)
        next.entries[holeIndex] = entry
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
