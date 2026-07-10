// Reconciliation + optimistic-dispatch semantics for the watch-side store
// (PROTOCOL.md §Ordering & conflicts).
import XCTest
@testable import WatchRoundCore

private let t0 = "2026-07-06T10:00:00.000Z"
private let at = "2026-07-06T10:05:00.000Z"

private final class FakeTransport: WatchTransport {
    var isReachable = true
    var sentEvents: [SessionEvent] = []
    var syncRequests = 0

    func sendEvent(_ event: SessionEvent) { sentEvents.append(event) }
    func requestCatalog(_ completion: @escaping (Result<CatalogReply, Error>) -> Void) {}
    func requestSearch(query: String, _ completion: @escaping (Result<SearchReply, Error>) -> Void) {}
    func requestTees(courseId: Int, _ completion: @escaping (Result<TeesReply, Error>) -> Void) {}
    func requestStart(
        course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?,
        _ completion: @escaping (Result<StartReply, Error>) -> Void
    ) {}
    func requestSubmit(_ completion: @escaping (Result<SubmitReply, Error>) -> Void) {}
    func requestSync() { syncRequests += 1 }
}

private func makeSession(id: String = "session-1", eventSeq: Int = 0) -> RoundSession {
    RoundSession(
        schemaVersion: 1,
        id: id,
        userId: "user-1",
        status: .active,
        startedAt: t0,
        lastEventAt: t0,
        eventSeq: eventSeq,
        course: SessionCourse(id: 1, name: "Test Course", city: "Oslo", country: "Norway"),
        tee: SessionTee(name: "Yellow", distanceMeasurement: "meters"),
        holeCount: 9,
        nineHoleSection: .front,
        displayedHoles: (1...9).map {
            SessionHole(holeNumber: $0, par: $0 == 3 ? 3 : 4, hcp: $0, distance: 350)
        },
        currentHoleIndex: 0,
        entries: (0..<9).map { _ in HoleEntry(strokes: nil, updatedAt: t0) },
        notes: ""
    )
}

private func contextFrame(_ session: RoundSession?) -> ContextFrame {
    var payload: [String: Any] = [
        "v": 1, "kind": "context", "seq": session?.eventSeq ?? -1, "publishedAt": at,
    ]
    if let session {
        let data = try! JSONEncoder().encode(session)
        payload["session"] = String(data: data, encoding: .utf8)!
    }
    let data = try! JSONSerialization.data(withJSONObject: payload)
    return try! JSONDecoder().decode(ContextFrame.self, from: data)
}

final class ReceiveContextTests: XCTestCase {
    func testAdoptsFirstSnapshot() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(contextFrame(makeSession(eventSeq: 2)))
        XCTAssertEqual(store.session?.id, "session-1")
        XCTAssertEqual(store.lastAdoptedSeq, 2)
    }

    func testNilSessionClearsState() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(contextFrame(makeSession()))
        store.receiveContext(contextFrame(nil))
        XCTAssertNil(store.session)
        XCTAssertEqual(store.lastAdoptedSeq, -1)
    }

    func testStaleEchoOfSameSessionIsIgnored() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        store.receiveContext(contextFrame(makeSession(eventSeq: 0)))
        // Golfer scores two holes locally → local seq 4 (2 scores + 2 advances).
        store.scoreCurrentHole(strokes: 5, at: at)
        store.scoreCurrentHole(strokes: 4, at: at)
        let localSeq = store.session!.eventSeq
        XCTAssertGreaterThan(localSeq, 0)
        // A snapshot from BEFORE those events (seq 1) must not rubber-band.
        store.receiveContext(contextFrame(makeSession(eventSeq: 1)))
        XCTAssertEqual(store.session?.eventSeq, localSeq)
        XCTAssertEqual(store.session?.entries[0].strokes, 5)
    }

    func testNewerPhoneSnapshotOvertakesLocalOptimism() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(contextFrame(makeSession(eventSeq: 0)))
        store.scoreCurrentHole(strokes: 5, at: at)
        var phoneSession = makeSession(eventSeq: 10)
        phoneSession.entries[0] = HoleEntry(strokes: 6, updatedAt: at)
        store.receiveContext(contextFrame(phoneSession))
        XCTAssertEqual(store.session?.eventSeq, 10)
        XCTAssertEqual(store.session?.entries[0].strokes, 6)
    }

    func testDifferentSessionIdAlwaysWins() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(contextFrame(makeSession(id: "old", eventSeq: 50)))
        store.receiveContext(contextFrame(makeSession(id: "new", eventSeq: 0)))
        XCTAssertEqual(store.session?.id, "new")
    }
}

final class DispatchTests: XCTestCase {
    func testAcceptedEventIsAppliedLocallyAndRelayed() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        store.receiveContext(contextFrame(makeSession()))
        let accepted = store.dispatch(.scoreSet(holeIndex: 0, strokes: 5, at: at))
        XCTAssertTrue(accepted)
        XCTAssertEqual(store.session?.entries[0].strokes, 5)
        XCTAssertEqual(transport.sentEvents.count, 1)
    }

    func testRejectedEventIsNotRelayed() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        store.receiveContext(contextFrame(makeSession()))
        let accepted = store.dispatch(.scoreSet(holeIndex: 99, strokes: 5, at: at))
        XCTAssertFalse(accepted)
        XCTAssertTrue(transport.sentEvents.isEmpty)
    }

    func testScoreCurrentHoleAutoAdvances() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        store.receiveContext(contextFrame(makeSession()))
        store.scoreCurrentHole(strokes: 5, at: at)
        XCTAssertEqual(store.session?.currentHoleIndex, 1)
        // Two events on the wire: SCORE_SET + HOLE_SELECTED.
        XCTAssertEqual(transport.sentEvents.count, 2)
    }

    func testEditingAScoredHoleDoesNotAdvance() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        store.receiveContext(contextFrame(makeSession()))
        store.scoreCurrentHole(strokes: 5, at: at) // hole 1 scored, advance to 2
        store.selectHole(0, at: at)                // player goes back to edit
        store.scoreCurrentHole(strokes: 6, at: at) // edit must NOT move them
        XCTAssertEqual(store.session?.currentHoleIndex, 0)
        XCTAssertEqual(store.session?.entries[0].strokes, 6)
    }

    func testNoDispatchWithoutSession() {
        let transport = FakeTransport()
        let store = WatchSessionStore(transport: transport)
        XCTAssertFalse(store.dispatch(.finishStarted(at: at)))
        XCTAssertTrue(transport.sentEvents.isEmpty)
    }
}

final class SelectorTests: XCTestCase {
    func testToParAndTotals() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(contextFrame(makeSession()))
        XCTAssertNil(store.session?.toPar)
        XCTAssertEqual(formatToPar(store.session?.toPar), "—")
        store.scoreCurrentHole(strokes: 5, at: at) // hole 1, par 4 → +1
        XCTAssertEqual(store.session?.toPar, 1)
        XCTAssertEqual(formatToPar(store.session?.toPar), "+1")
        store.selectHole(2, at: at)
        store.scoreCurrentHole(strokes: 2, at: at) // hole 3, par 3 → -1
        XCTAssertEqual(store.session?.toPar, 0)
        XCTAssertEqual(formatToPar(store.session?.toPar), "E")
        XCTAssertEqual(store.session?.totalStrokes, 7)
        XCTAssertEqual(store.session?.scoredCount, 2)
    }
}

// MARK: - Home-screen stats (ContextFrame.stats, watch-protocol.ts WatchStats)

/// Exactly what the TS bridge emits (byte-compat spec — optional keys are
/// OMITTED, never null; see the NSNull note in watch-protocol.ts).
private let bridgeStatsJson = """
{"handicapIndex":22.9,"initialHandicapIndex":24,"recalculating":false,\
"lastRound":{"courseName":"Ballerud Golfklubb","totalStrokes":35,"toPar":8,\
"differential":26.3,"playedAt":"2026-07-06T18:00:00.000Z","holesPlayed":9,\
"nineHoleSection":"front"},"seasonRounds":12,"seasonBestDifferential":26.3,\
"totalRounds":13,"generatedAt":"2026-07-07T10:00:00.000Z"}
"""

private func rawContextFrame(session: RoundSession?, statsJson: String?) -> ContextFrame {
    var json = "{\"v\":1,\"kind\":\"context\",\"seq\":\(session?.eventSeq ?? -1),\"publishedAt\":\"\(at)\""
    if let session {
        let data = try! JSONEncoder().encode(session)
        let encoded = try! JSONEncoder().encode(String(data: data, encoding: .utf8)!)
        json += ",\"session\":\(String(data: encoded, encoding: .utf8)!)"
    }
    if let statsJson { json += ",\"stats\":\(statsJson)" }
    json += "}"
    return try! JSONDecoder().decode(ContextFrame.self, from: Data(json.utf8))
}

final class StatsContextTests: XCTestCase {
    func testDecodesStatsAsTheBridgeEmitsThem() {
        let frame = rawContextFrame(session: nil, statsJson: bridgeStatsJson)
        let stats = frame.stats
        XCTAssertEqual(stats?.handicapIndex, 22.9)
        XCTAssertEqual(stats?.initialHandicapIndex, 24)
        XCTAssertEqual(stats?.recalculating, false)
        XCTAssertEqual(stats?.lastRound?.courseName, "Ballerud Golfklubb")
        XCTAssertEqual(stats?.lastRound?.totalStrokes, 35)
        XCTAssertEqual(stats?.lastRound?.toPar, 8)
        XCTAssertEqual(stats?.lastRound?.differential, 26.3)
        XCTAssertEqual(stats?.lastRound?.holesPlayed, 9)
        XCTAssertEqual(stats?.lastRound?.nineHoleSection, .front)
        XCTAssertEqual(stats?.seasonRounds, 12)
        XCTAssertEqual(stats?.seasonBestDifferential, 26.3)
        XCTAssertEqual(stats?.totalRounds, 13)
    }

    func testOptionalStatsKeysMayBeAbsent() {
        // A fresh account: no rounds → no lastRound, no seasonBest.
        let minimal = """
        {"handicapIndex":54,"initialHandicapIndex":54,"recalculating":true,\
        "seasonRounds":0,"totalRounds":0,"generatedAt":"2026-07-07T10:00:00.000Z"}
        """
        let frame = rawContextFrame(session: nil, statsJson: minimal)
        XCTAssertEqual(frame.stats?.recalculating, true)
        XCTAssertNil(frame.stats?.lastRound)
        XCTAssertNil(frame.stats?.seasonBestDifferential)
    }

    func testStatsAdoptedAndKeptWhenNextFrameOmitsThem() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(rawContextFrame(session: nil, statsJson: bridgeStatsJson))
        XCTAssertEqual(store.stats?.handicapIndex, 22.9)
        // Next frame without the key (e.g. published before the fetch
        // finished) must NOT wipe the home screen.
        store.receiveContext(rawContextFrame(session: makeSession(), statsJson: nil))
        XCTAssertEqual(store.stats?.handicapIndex, 22.9)
        XCTAssertEqual(store.session?.id, "session-1")
    }

    func testStaleSessionEchoStillAdoptsFreshStats() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(rawContextFrame(session: makeSession(eventSeq: 5), statsJson: nil))
        // Same session at a LOWER seq (stale echo) but carrying stats: the
        // session must be kept, the stats adopted.
        store.receiveContext(rawContextFrame(session: makeSession(eventSeq: 2), statsJson: bridgeStatsJson))
        XCTAssertEqual(store.session?.eventSeq, 5)
        XCTAssertEqual(store.stats?.handicapIndex, 22.9)
    }

    func testSessionClearKeepsStats() {
        let store = WatchSessionStore(transport: FakeTransport())
        store.receiveContext(rawContextFrame(session: makeSession(), statsJson: bridgeStatsJson))
        store.receiveContext(rawContextFrame(session: nil, statsJson: bridgeStatsJson))
        XCTAssertNil(store.session)
        XCTAssertEqual(store.stats?.handicapIndex, 22.9)
    }
}

final class SubmitReplyDecodeTests: XCTestCase {
    func testCarriesSynchronousDifferential() {
        let json = "{\"v\":1,\"kind\":\"submitResult\",\"outcome\":\"submitted\",\"differential\":26.3}"
        let reply = try! JSONDecoder().decode(SubmitReply.self, from: Data(json.utf8))
        XCTAssertEqual(reply.outcome, .submitted)
        XCTAssertEqual(reply.differential, 26.3)
    }

    func testDifferentialAbsentOnOlderPhones() {
        let json = "{\"v\":1,\"kind\":\"submitResult\",\"outcome\":\"parked\"}"
        let reply = try! JSONDecoder().decode(SubmitReply.self, from: Data(json.utf8))
        XCTAssertEqual(reply.outcome, .parked)
        XCTAssertNil(reply.differential)
    }
}
