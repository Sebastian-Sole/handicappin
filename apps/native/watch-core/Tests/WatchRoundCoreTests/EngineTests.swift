// Mirror of apps/native/tests/unit/round-session-engine.test.ts — the TS
// suite defines the reducer semantics; every behavioral test there has a
// counterpart here. startSession is intentionally NOT ported (rounds start
// on the phone; the watch only applies events optimistically), so fixtures
// build sessions directly.
import XCTest
@testable import WatchRoundCore

private let t0 = "2026-07-06T10:00:00.000Z"
private let at = "2026-07-06T10:05:00.000Z"

private func makeSession(holeCount: Int = 18, section: NineHoleSection? = nil) -> RoundSession {
    let holes = (0..<holeCount).map { i in
        SessionHole(
            holeNumber: (section == .back ? 10 : 1) + i,
            par: 4,
            hcp: (i % (holeCount == 9 ? 9 : 18)) + 1,
            distance: 350
        )
    }
    return RoundSession(
        schemaVersion: 1,
        id: "session-1",
        userId: "user-1",
        status: .active,
        startedAt: t0,
        lastEventAt: t0,
        eventSeq: 0,
        course: SessionCourse(id: 1, name: "Test Course", city: "Oslo", country: "Norway"),
        tee: SessionTee(name: "Yellow", distanceMeasurement: "meters"),
        holeCount: holeCount,
        nineHoleSection: holeCount == 9 ? (section ?? .front) : nil,
        displayedHoles: holes,
        currentHoleIndex: 0,
        entries: (0..<holeCount).map { _ in HoleEntry(strokes: nil, updatedAt: t0) },
        notes: ""
    )
}

final class ScoreSetTests: XCTestCase {
    func testRecordsScoreAndBumpsEventSeq() {
        let s = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 5, at: at))
        XCTAssertEqual(s?.entries[0].strokes, 5)
        XCTAssertEqual(s?.eventSeq, 1)
        XCTAssertEqual(s?.lastEventAt, at)
    }

    func testIdempotentIdenticalScoreIsNoOp() {
        let s1 = applyEvent(makeSession(), .scoreSet(holeIndex: 3, strokes: 4, at: at))!
        let s2 = applyEvent(s1, .scoreSet(holeIndex: 3, strokes: 4, at: "2026-07-06T10:06:00.000Z"))
        XCTAssertNil(s2)
        XCTAssertEqual(s1.eventSeq, 1)
    }

    func testRejectsNonFiniteStrokes() {
        let s = makeSession()
        XCTAssertNil(applyEvent(s, .scoreSet(holeIndex: 0, strokes: .nan, at: at)))
        XCTAssertNil(applyEvent(s, .scoreSet(holeIndex: 0, strokes: .infinity, at: at)))
    }

    func testClampsStrokesTo1Through30() {
        let low = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 0, at: at))
        XCTAssertEqual(low?.entries[0].strokes, 1)
        let high = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 99, at: at))
        XCTAssertEqual(high?.entries[0].strokes, 30)
    }

    func testRoundsFractionalStrokesLikeJsMathRound() {
        let s = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 4.5, at: at))
        XCTAssertEqual(s?.entries[0].strokes, 5)
    }

    func testIgnoresOutOfRangeHolesAndNonActiveSessions() {
        let s = makeSession()
        XCTAssertNil(applyEvent(s, .scoreSet(holeIndex: 18, strokes: 4, at: at)))
        XCTAssertNil(applyEvent(s, .scoreSet(holeIndex: -1, strokes: 4, at: at)))
        let finishing = applyEvent(s, .finishStarted(at: at))!
        XCTAssertNil(applyEvent(finishing, .scoreSet(holeIndex: 0, strokes: 4, at: at)))
    }
}

final class LifecycleTests: XCTestCase {
    func testWalksActiveFinishingSubmittedAndRejectsInvalidJumps() {
        let s = makeSession()
        XCTAssertNil(applyEvent(s, .submitted(at: at)))
        let finishing = applyEvent(s, .finishStarted(at: at))!
        XCTAssertEqual(finishing.status, .finishing)
        XCTAssertNil(applyEvent(finishing, .finishStarted(at: at)))
        let back = applyEvent(finishing, .finishCancelled(at: at))!
        XCTAssertEqual(back.status, .active)
        let submitted = applyEvent(applyEvent(back, .finishStarted(at: at))!, .submitted(at: at))!
        XCTAssertEqual(submitted.status, .submitted)
        XCTAssertNil(applyEvent(submitted, .finishCancelled(at: at)))
        XCTAssertNil(applyEvent(submitted, .notesSet(notes: "late", at: at)))
    }

    func testEventSeqIncreasesMonotonically() {
        var s = makeSession()
        var seqs = [s.eventSeq]
        s = applyEvent(s, .scoreSet(holeIndex: 0, strokes: 4, at: at))!
        seqs.append(s.eventSeq)
        s = applyEvent(s, .holeSelected(holeIndex: 5, at: at))!
        seqs.append(s.eventSeq)
        s = applyEvent(s, .notesSet(notes: "windy", at: at))!
        seqs.append(s.eventSeq)
        XCTAssertEqual(seqs, [0, 1, 2, 3])
    }

    func testNotesSetAllowedWhileFinishing() {
        let finishing = applyEvent(makeSession(), .finishStarted(at: at))!
        let noted = applyEvent(finishing, .notesSet(notes: "great day", at: at))
        XCTAssertEqual(noted?.notes, "great day")
    }
}

final class ClearAndSelectTests: XCTestCase {
    func testClearsScoreAndClearingEmptyHoleIsNoOp() {
        let scored = applyEvent(makeSession(), .scoreSet(holeIndex: 2, strokes: 6, at: at))!
        let cleared = applyEvent(scored, .scoreCleared(holeIndex: 2, at: at))!
        XCTAssertNil(cleared.entries[2].strokes)
        XCTAssertNil(applyEvent(cleared, .scoreCleared(holeIndex: 2, at: at)))
    }

    func testMovesCursorAndSameIndexIsNoOp() {
        let moved = applyEvent(makeSession(), .holeSelected(holeIndex: 7, at: at))!
        XCTAssertEqual(moved.currentHoleIndex, 7)
        XCTAssertNil(applyEvent(moved, .holeSelected(holeIndex: 7, at: at)))
    }
}

final class NextHoleAfterScoreTests: XCTestCase {
    func testAdvancesToNextUnscoredHole() {
        let s = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 4, at: at))!
        XCTAssertEqual(nextHoleAfterScore(s, justScoredIndex: 0), 1)
    }

    func testSkipsScoredHolesAndWrapsAround() {
        var s = makeSession(holeCount: 9, section: .front)
        for i in 1..<9 {
            s = applyEvent(s, .scoreSet(holeIndex: i, strokes: 4, at: at))!
        }
        XCTAssertEqual(nextHoleAfterScore(s, justScoredIndex: 8), 0)
    }

    func testStaysPutWhenEveryHoleIsScored() {
        var s = makeSession(holeCount: 9, section: .front)
        for i in 0..<9 {
            s = applyEvent(s, .scoreSet(holeIndex: i, strokes: 4, at: at))!
        }
        XCTAssertEqual(nextHoleAfterScore(s, justScoredIndex: 4), 4)
    }
}

/// Wire-format tests — the JSON here is copied from what the phone actually
/// produces (codec.ts encodeSession / the events the phone UI dispatches).
final class WireFormatTests: XCTestCase {
    func testDecodesPhoneSnapshotJson() throws {
        let json = """
        {
          "schemaVersion": 1,
          "id": "0d7f2c9e-1111-4222-8333-abcdefabcdef",
          "userId": "user-abc",
          "status": "active",
          "startedAt": "2026-07-06T10:00:00.000Z",
          "lastEventAt": "2026-07-06T10:05:00.000Z",
          "eventSeq": 3,
          "course": {
            "id": 42, "name": "Oslo GK", "city": "Oslo", "country": "Norway",
            "website": "https://oslogk.no", "approvalStatus": "approved"
          },
          "tee": {
            "id": 7, "name": "Yellow", "gender": "mens",
            "courseRating18": 71.2, "slopeRating18": 128,
            "courseRatingFront9": 35.6, "slopeRatingFront9": 128,
            "courseRatingBack9": 35.6, "slopeRatingBack9": 128,
            "outPar": 36, "inPar": 36, "totalPar": 72,
            "outDistance": 2900, "inDistance": 2950, "totalDistance": 5850,
            "distanceMeasurement": "meters", "approvalStatus": "approved",
            "holes": []
          },
          "holeCount": 9,
          "nineHoleSection": "back",
          "displayedHoles": [
            {"id": 10, "teeId": 7, "holeNumber": 10, "par": 4, "hcp": 1, "distance": 351},
            {"holeNumber": 11, "par": 3, "hcp": 2, "distance": 150},
            {"holeNumber": 12, "par": 5, "hcp": 3, "distance": 480},
            {"holeNumber": 13, "par": 4, "hcp": 4, "distance": 360},
            {"holeNumber": 14, "par": 4, "hcp": 5, "distance": 340},
            {"holeNumber": 15, "par": 3, "hcp": 6, "distance": 165},
            {"holeNumber": 16, "par": 5, "hcp": 7, "distance": 500},
            {"holeNumber": 17, "par": 4, "hcp": 8, "distance": 385},
            {"holeNumber": 18, "par": 4, "hcp": 9, "distance": 400}
          ],
          "currentHoleIndex": 2,
          "entries": [
            {"strokes": 5, "updatedAt": "2026-07-06T10:02:00.000Z", "location": null},
            {"strokes": 3, "updatedAt": "2026-07-06T10:05:00.000Z", "location": null},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"},
            {"strokes": null, "updatedAt": "2026-07-06T10:00:00.000Z"}
          ],
          "notes": "windy"
        }
        """
        let s = try JSONDecoder().decode(RoundSession.self, from: Data(json.utf8))
        XCTAssertEqual(s.eventSeq, 3)
        XCTAssertEqual(s.holeCount, 9)
        XCTAssertEqual(s.nineHoleSection, .back)
        XCTAssertEqual(s.tee.name, "Yellow")
        XCTAssertEqual(s.displayedHoles[0].holeNumber, 10)
        XCTAssertEqual(s.entries[0].strokes, 5)
        XCTAssertNil(s.entries[2].strokes)
        XCTAssertEqual(s.notes, "windy")

        // The decoded session must still run the reducer correctly.
        let next = applyEvent(s, .scoreSet(holeIndex: 2, strokes: 6, at: at))
        XCTAssertEqual(next?.eventSeq, 4)
        XCTAssertEqual(next?.entries[2].strokes, 6)
    }

    func testEncodesEventsInPhoneReducerShape() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

        let scoreSet = SessionEvent.scoreSet(holeIndex: 4, strokes: 5, at: at)
        let scoreJson = String(data: try encoder.encode(scoreSet), encoding: .utf8)!
        XCTAssertEqual(
            scoreJson,
            #"{"at":"2026-07-06T10:05:00.000Z","holeIndex":4,"strokes":5,"type":"SCORE_SET"}"#
        )

        let finish = SessionEvent.finishStarted(at: at)
        let finishJson = String(data: try encoder.encode(finish), encoding: .utf8)!
        XCTAssertEqual(finishJson, #"{"at":"2026-07-06T10:05:00.000Z","type":"FINISH_STARTED"}"#)
    }

    func testEventJsonRoundTrips() throws {
        let events: [SessionEvent] = [
            .scoreSet(holeIndex: 0, strokes: 4, at: at),
            .scoreCleared(holeIndex: 1, at: at),
            .holeSelected(holeIndex: 2, at: at),
            .notesSet(notes: "n", at: at),
            .finishStarted(at: at),
            .finishCancelled(at: at),
            .submitted(at: at),
        ]
        for e in events {
            let data = try JSONEncoder().encode(e)
            let decoded = try JSONDecoder().decode(SessionEvent.self, from: data)
            XCTAssertEqual(decoded, e)
        }
    }

    func testHoleEntryEncodesExplicitNullStrokes() throws {
        let entry = HoleEntry(strokes: nil, updatedAt: t0)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let json = String(data: try encoder.encode(entry), encoding: .utf8)!
        XCTAssertEqual(json, #"{"strokes":null,"updatedAt":"2026-07-06T10:00:00.000Z"}"#)
    }
}
