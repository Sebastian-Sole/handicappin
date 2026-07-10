// Swift mirror of lib/round-session/watch-protocol.ts — frame shapes for
// the WatchConnectivity transport. Keep in sync field-for-field; the TS
// side zod-validates everything the watch sends.
import Foundation

// MARK: - Watch → phone

/// Course identity echoed back on start — every field originated from a
/// phone reply (catalog/search); the watch adds nothing of its own.
public struct WatchCourseRef: Codable, Equatable, Sendable {
    public var id: Int
    public var name: String
    public var city: String
    public var country: String
    public var website: String
    public var approvalStatus: String

    public init(
        id: Int, name: String, city: String, country: String,
        website: String, approvalStatus: String
    ) {
        self.id = id
        self.name = name
        self.city = city
        self.country = country
        self.website = website
        self.approvalStatus = approvalStatus
    }
}

public enum WatchToPhoneFrame {
    case event(SessionEvent)
    case catalogRequest
    case searchRequest(query: String)
    case teesRequest(courseId: Int)
    case startRequest(course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?)
    case submitRequest
    case syncRequest
}

extension WatchToPhoneFrame: Codable {
    enum CodingKeys: String, CodingKey {
        case v, kind, event, query, course, courseId, teeId, holeCount, nineHoleSection
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try c.decode(String.self, forKey: .kind)
        switch kind {
        case "event":
            self = .event(try c.decode(SessionEvent.self, forKey: .event))
        case "catalogRequest":
            self = .catalogRequest
        case "searchRequest":
            self = .searchRequest(query: try c.decode(String.self, forKey: .query))
        case "teesRequest":
            self = .teesRequest(courseId: try c.decode(Int.self, forKey: .courseId))
        case "startRequest":
            self = .startRequest(
                course: try c.decode(WatchCourseRef.self, forKey: .course),
                teeId: try c.decode(Int.self, forKey: .teeId),
                holeCount: try c.decode(Int.self, forKey: .holeCount),
                nineHoleSection: try c.decodeIfPresent(NineHoleSection.self, forKey: .nineHoleSection)
            )
        case "submitRequest":
            self = .submitRequest
        case "syncRequest":
            self = .syncRequest
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .kind, in: c, debugDescription: "Unknown frame kind: \(kind)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(1, forKey: .v)
        switch self {
        case let .event(event):
            try c.encode("event", forKey: .kind)
            try c.encode(event, forKey: .event)
        case .catalogRequest:
            try c.encode("catalogRequest", forKey: .kind)
        case let .searchRequest(query):
            try c.encode("searchRequest", forKey: .kind)
            try c.encode(query, forKey: .query)
        case let .teesRequest(courseId):
            try c.encode("teesRequest", forKey: .kind)
            try c.encode(courseId, forKey: .courseId)
        case let .startRequest(course, teeId, holeCount, nineHoleSection):
            try c.encode("startRequest", forKey: .kind)
            try c.encode(course, forKey: .course)
            try c.encode(teeId, forKey: .teeId)
            try c.encode(holeCount, forKey: .holeCount)
            try c.encodeIfPresent(nineHoleSection, forKey: .nineHoleSection)
        case .submitRequest:
            try c.encode("submitRequest", forKey: .kind)
        case .syncRequest:
            try c.encode("syncRequest", forKey: .kind)
        }
    }
}

// MARK: - Phone → watch

public struct WatchTeeOption: Codable, Equatable, Identifiable, Sendable {
    public var id: Int
    public var name: String
    public var gender: String
    public var totalPar: Int
    public var totalDistance: Double
    public var distanceMeasurement: String

    public init(
        id: Int, name: String, gender: String, totalPar: Int,
        totalDistance: Double, distanceMeasurement: String
    ) {
        self.id = id
        self.name = name
        self.gender = gender
        self.totalPar = totalPar
        self.totalDistance = totalDistance
        self.distanceMeasurement = distanceMeasurement
    }
}

public struct WatchCourseOption: Codable, Equatable, Identifiable, Sendable {
    public var id: Int
    public var name: String
    public var city: String
    public var country: String
    public var website: String
    public var approvalStatus: String
    /// Present when the phone already holds tee snapshots (lastSetup);
    /// otherwise the watch follows up with a teesRequest.
    public var tees: [WatchTeeOption]?

    public init(
        id: Int, name: String, city: String, country: String,
        website: String, approvalStatus: String, tees: [WatchTeeOption]? = nil
    ) {
        self.id = id
        self.name = name
        self.city = city
        self.country = country
        self.website = website
        self.approvalStatus = approvalStatus
        self.tees = tees
    }

    public var courseRef: WatchCourseRef {
        WatchCourseRef(
            id: id, name: name, city: city, country: country,
            website: website, approvalStatus: approvalStatus
        )
    }
}

/// The golfer's most recent submitted round (watch-protocol.ts
/// WatchLastRound). Every number was computed synchronously at submit time
/// — nothing here waits on the server's handicap queue.
public struct WatchLastRound: Codable, Equatable, Sendable {
    public var courseName: String
    public var totalStrokes: Int
    /// totalStrokes - parPlayed (signed; 0 = level).
    public var toPar: Int
    public var differential: Double
    /// Round teeTime, ISO.
    public var playedAt: String
    public var holesPlayed: Int
    public var nineHoleSection: NineHoleSection?

    public init(
        courseName: String, totalStrokes: Int, toPar: Int,
        differential: Double, playedAt: String, holesPlayed: Int,
        nineHoleSection: NineHoleSection? = nil
    ) {
        self.courseName = courseName
        self.totalStrokes = totalStrokes
        self.toPar = toPar
        self.differential = differential
        self.playedAt = playedAt
        self.holesPlayed = holesPlayed
        self.nineHoleSection = nineHoleSection
    }
}

/// Home-screen stats (watch-protocol.ts WatchStats), phone-computed.
/// `recalculating` is true from a submit until the server's handicap queue
/// has reworked the index (~1 min) — the home screen wears the "Updating…"
/// chip while it's set, keeping the old index visible.
public struct WatchStats: Codable, Equatable, Sendable {
    public var handicapIndex: Double
    public var initialHandicapIndex: Double
    public var recalculating: Bool
    public var lastRound: WatchLastRound?
    /// Rounds with a teeTime in the current calendar year.
    public var seasonRounds: Int
    public var seasonBestDifferential: Double?
    public var totalRounds: Int
    public var generatedAt: String

    public init(
        handicapIndex: Double, initialHandicapIndex: Double,
        recalculating: Bool, lastRound: WatchLastRound? = nil,
        seasonRounds: Int, seasonBestDifferential: Double? = nil,
        totalRounds: Int, generatedAt: String
    ) {
        self.handicapIndex = handicapIndex
        self.initialHandicapIndex = initialHandicapIndex
        self.recalculating = recalculating
        self.lastRound = lastRound
        self.seasonRounds = seasonRounds
        self.seasonBestDifferential = seasonBestDifferential
        self.totalRounds = totalRounds
        self.generatedAt = generatedAt
    }
}

/// applicationContext payload: `session` is the codec.ts JSON string.
public struct ContextFrame: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var session: String?
    public var stats: WatchStats?
    public var seq: Int
    public var publishedAt: String

    enum CodingKeys: String, CodingKey { case v, kind, session, stats, seq, publishedAt }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        v = try c.decode(Int.self, forKey: .v)
        kind = try c.decode(String.self, forKey: .kind)
        session = try c.decodeIfPresent(String.self, forKey: .session)
        stats = try c.decodeIfPresent(WatchStats.self, forKey: .stats)
        seq = try c.decode(Int.self, forKey: .seq)
        publishedAt = try c.decode(String.self, forKey: .publishedAt)
    }

    /// Decode the embedded session snapshot (nil when no session or corrupt).
    public func decodedSession() -> RoundSession? {
        guard let session, let data = session.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(RoundSession.self, from: data)
    }
}

public struct CatalogReply: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var courses: [WatchCourseOption]
}

public struct SearchReply: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var courses: [WatchCourseOption]
    public var error: String?
}

public struct TeesReply: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var tees: [WatchTeeOption]
    public var error: String?
}

public struct StartReply: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var ok: Bool
    public var error: String?
}

public enum SubmitOutcome: String, Codable, Sendable {
    case submitted
    case parked
    case error
}

public struct SubmitReply: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var outcome: SubmitOutcome
    /// Server-computed score differential for the just-submitted round —
    /// known synchronously (the index is NOT; the handicap queue reworks it
    /// ~1 min later). Present only on outcome .submitted.
    public var differential: Double?
    public var error: String?
}

public struct EventAck: Codable, Equatable, Sendable {
    public var v: Int
    public var kind: String
    public var seq: Int
}
