// Mirror of apps/native/tests/unit/round-session-detail.test.ts (the parts
// that apply watch-side): HOLE_DETAIL_SET semantics, detail preservation
// across SCORE_SET, wire coding, and the commit-at-hole-out store flow.
import XCTest
@testable import WatchRoundCore

private let t0 = "2026-07-06T10:00:00.000Z"
private let at = "2026-07-06T10:05:00.000Z"

private func makeSession(detailed: Bool? = true, holeCount: Int = 18) -> RoundSession {
    let holes = (0..<holeCount).map { i in
        SessionHole(holeNumber: 1 + i, par: 4, hcp: (i % 18) + 1, distance: 350)
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
        nineHoleSection: nil,
        detailed: detailed,
        displayedHoles: holes,
        currentHoleIndex: 0,
        entries: (0..<holeCount).map { _ in HoleEntry(strokes: nil, updatedAt: t0) },
        notes: ""
    )
}

final class HoleDetailSetTests: XCTestCase {
    func testSetsAllFieldsAndBumpsSeq() {
        let s = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 2, fairwayHit: true, penaltyStrokes: 1, at: at)
        )
        XCTAssertEqual(s?.entries[0].putts, 2)
        XCTAssertEqual(s?.entries[0].fairwayHit, true)
        XCTAssertEqual(s?.entries[0].penaltyStrokes, 1)
        XCTAssertEqual(s?.eventSeq, 1)
    }

    func testNilClearsFields() {
        let s1 = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 3, fairwayHit: false, penaltyStrokes: 2, at: at)
        )!
        let s2 = applyEvent(
            s1,
            .holeDetailSet(holeIndex: 0, putts: nil, fairwayHit: nil, penaltyStrokes: nil, at: at)
        )
        XCTAssertNil(s2?.entries[0].putts)
        XCTAssertNil(s2?.entries[0].fairwayHit)
        XCTAssertNil(s2?.entries[0].penaltyStrokes)
    }

    func testIdenticalPatchIsNoOp() {
        let s1 = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 2, fairwayHit: nil, penaltyStrokes: 0, at: at)
        )!
        let s2 = applyEvent(
            s1,
            .holeDetailSet(holeIndex: 0, putts: 2, fairwayHit: nil, penaltyStrokes: 0, at: at)
        )
        XCTAssertNil(s2)
    }

    func testClampsNumericFields() {
        let s = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 99, fairwayHit: nil, penaltyStrokes: -4, at: at)
        )
        XCTAssertEqual(s?.entries[0].putts, MAX_PUTTS)
        XCTAssertEqual(s?.entries[0].penaltyStrokes, 0)
    }

    func testRejectsOutOfRangeAndNonActive() {
        XCTAssertNil(
            applyEvent(
                makeSession(),
                .holeDetailSet(holeIndex: 18, putts: 2, fairwayHit: nil, penaltyStrokes: nil, at: at)
            ))
        var finishing = makeSession()
        finishing.status = .finishing
        XCTAssertNil(
            applyEvent(
                finishing,
                .holeDetailSet(holeIndex: 0, putts: 2, fairwayHit: nil, penaltyStrokes: nil, at: at)
            ))
    }

    func testDetailOnScoredHoleIsBoundedByStrokes() {
        // putts + penalties ≤ strokes − 1; putts keep priority.
        var s = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 4, at: at))!
        s = applyEvent(
            s,
            .holeDetailSet(holeIndex: 0, putts: 4, fairwayHit: nil, penaltyStrokes: 2, at: at)
        )!
        XCTAssertEqual(s.entries[0].putts, 3)
        XCTAssertEqual(s.entries[0].penaltyStrokes, 0)
    }

    func testScoreEditReFitsExistingDetail() {
        // Score 5 with 4 putts edited to 4 → putts clamp to 3.
        var s = applyEvent(makeSession(), .scoreSet(holeIndex: 0, strokes: 5, at: at))!
        s = applyEvent(
            s,
            .holeDetailSet(holeIndex: 0, putts: 4, fairwayHit: nil, penaltyStrokes: nil, at: at)
        )!
        s = applyEvent(s, .scoreSet(holeIndex: 0, strokes: 4, at: at))!
        XCTAssertEqual(s.entries[0].putts, 3)
    }

    func testUnscoredHoleDetailIsUnbounded() {
        // Detail can land before the score in live play — no strokes, no cap.
        let s = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 6, fairwayHit: nil, penaltyStrokes: 3, at: at)
        )
        XCTAssertEqual(s?.entries[0].putts, 6)
        XCTAssertEqual(s?.entries[0].penaltyStrokes, 3)
    }

    func testScoreSetPreservesDetailAndScoreClearedWipesIt() {
        var s = applyEvent(
            makeSession(),
            .holeDetailSet(holeIndex: 0, putts: 2, fairwayHit: false, penaltyStrokes: 0, at: at)
        )!
        s = applyEvent(s, .scoreSet(holeIndex: 0, strokes: 5, at: at))!
        XCTAssertEqual(s.entries[0].strokes, 5)
        XCTAssertEqual(s.entries[0].putts, 2)
        XCTAssertEqual(s.entries[0].fairwayHit, false)

        s = applyEvent(s, .scoreCleared(holeIndex: 0, at: at))!
        XCTAssertNil(s.entries[0].strokes)
        XCTAssertNil(s.entries[0].putts)
        XCTAssertNil(s.entries[0].fairwayHit)
    }
}

final class DetailWireCodingTests: XCTestCase {
    func testHoleDetailSetEncodesFullPatchWithExplicitNulls() throws {
        let event = SessionEvent.holeDetailSet(
            holeIndex: 3, putts: 2, fairwayHit: nil, penaltyStrokes: 0, at: at)
        let data = try JSONEncoder().encode(event)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["type"] as? String, "HOLE_DETAIL_SET")
        XCTAssertEqual(json["putts"] as? Int, 2)
        XCTAssertEqual(json["penaltyStrokes"] as? Int, 0)
        // fairwayHit must be PRESENT as null (clear), never absent.
        XCTAssertTrue(json.keys.contains("fairwayHit"))
        XCTAssertTrue(json["fairwayHit"] is NSNull)

        let decoded = try JSONDecoder().decode(SessionEvent.self, from: data)
        XCTAssertEqual(decoded, event)
    }

    func testSnapshotWithDetailAndDetailedFlagDecodes() throws {
        var s = makeSession(detailed: true)
        s.entries[0] = HoleEntry(
            strokes: 5, updatedAt: at, putts: 2, fairwayHit: true, penaltyStrokes: 1)
        let data = try JSONEncoder().encode(s)
        let decoded = try JSONDecoder().decode(RoundSession.self, from: data)
        XCTAssertEqual(decoded.isDetailed, true)
        XCTAssertEqual(decoded.entries[0].putts, 2)
        XCTAssertEqual(decoded.entries[0].fairwayHit, true)
        XCTAssertEqual(decoded.entries[0].penaltyStrokes, 1)
    }

    func testPre013SnapshotDecodesAsNotDetailed() throws {
        let s = makeSession(detailed: nil)
        let data = try JSONEncoder().encode(s)
        // The key must be absent on the wire (omit-optional-keys rule).
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertFalse(json.keys.contains("detailed"))
        let decoded = try JSONDecoder().decode(RoundSession.self, from: data)
        XCTAssertEqual(decoded.isDetailed, false)
        XCTAssertNil(decoded.entries[0].putts)
    }
}

private final class RecordingTransport: WatchTransport {
    var isReachable = true
    var sent: [SessionEvent] = []
    func sendEvent(_ event: SessionEvent) { sent.append(event) }
    func requestCatalog(_ completion: @escaping (Result<CatalogReply, Error>) -> Void) {}
    func requestSearch(query: String, _ completion: @escaping (Result<SearchReply, Error>) -> Void) {}
    func requestTees(courseId: Int, _ completion: @escaping (Result<TeesReply, Error>) -> Void) {}
    func requestStart(
        course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?,
        _ completion: @escaping (Result<StartReply, Error>) -> Void
    ) {}
    func requestSubmit(_ completion: @escaping (Result<SubmitReply, Error>) -> Void) {}
    func requestSync() {}
}

final class CommitCurrentHoleTests: XCTestCase {
    private func store(with session: RoundSession) -> (WatchSessionStore, RecordingTransport) {
        let transport = RecordingTransport()
        let store = WatchSessionStore(transport: transport)
        // ContextFrame has no memberwise init (custom Decodable) — build it
        // the way the bridge does: from the wire dict.
        let sessionJSON = String(
            data: try! JSONEncoder().encode(session), encoding: .utf8)!
        let frameData = try! JSONSerialization.data(withJSONObject: [
            "v": 1,
            "kind": "context",
            "session": sessionJSON,
            "seq": session.eventSeq,
            "publishedAt": t0,
        ])
        let frame = try! JSONDecoder().decode(ContextFrame.self, from: frameData)
        store.receiveContext(frame)
        return (store, transport)
    }

    func testCommitSendsScoreThenDetailAndAdvances() {
        let (store, transport) = store(with: makeSession())
        store.commitCurrentHole(
            strokes: 5, putts: 2, fairwayHit: true, penaltyStrokes: 0, at: at)
        XCTAssertEqual(store.session?.entries[0].strokes, 5)
        XCTAssertEqual(store.session?.entries[0].putts, 2)
        XCTAssertEqual(store.session?.currentHoleIndex, 1)
        // Score must land before detail — the reducer bounds detail against
        // the hole's score (putts + penalties ≤ strokes − 1).
        guard case .scoreSet = transport.sent.first else {
            return XCTFail("score event must be sent first")
        }
        guard case .holeDetailSet = transport.sent.last else {
            return XCTFail("detail event must follow the score event")
        }
    }

    func testCommitClampsDetailAgainstTheNewScore() {
        let (store, _) = store(with: makeSession())
        // 4 putts on a 4-stroke hole: only 3 fit (one swing got it there).
        store.commitCurrentHole(
            strokes: 4, putts: 4, fairwayHit: nil, penaltyStrokes: 2, at: at)
        XCTAssertEqual(store.session?.entries[0].strokes, 4)
        XCTAssertEqual(store.session?.entries[0].putts, 3)
        XCTAssertEqual(store.session?.entries[0].penaltyStrokes, 0)
    }

    func testCommitOnEditedHoleStillAdvances() {
        var session = makeSession()
        session = applyEvent(session, .scoreSet(holeIndex: 0, strokes: 5, at: t0))!
        let (store, _) = store(with: session)
        // Same score, same detail-free patch: pure "Next" on a scored hole.
        store.commitCurrentHole(
            strokes: 5, putts: nil, fairwayHit: nil, penaltyStrokes: nil, at: at)
        XCTAssertEqual(store.session?.currentHoleIndex, 1)
    }
}
