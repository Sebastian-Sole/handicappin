// Swift mirror of apps/native/lib/round-session/types.ts (+ geo.ts).
// The JSON wire shapes are the contract (PROTOCOL.md): a RoundSession
// snapshot decoded here came from the phone's codec.ts encodeSession, and
// SessionEvents encoded here are fed into the phone's applyEvent reducer.
// Keep field names and null-vs-absent semantics byte-compatible with TS.
import Foundation

public enum SessionStatus: String, Codable, Sendable {
    case active
    case finishing
    case submitted
}

public enum NineHoleSection: String, Codable, Sendable {
    case front
    case back
}

// geo.ts GeoStamp — never populated today; carried for forward-compat.
public struct GeoStamp: Codable, Equatable, Sendable {
    public var lat: Double
    public var lon: Double
    public var accuracyM: Double?
    public var at: String

    public init(lat: Double, lon: Double, accuracyM: Double? = nil, at: String) {
        self.lat = lat
        self.lon = lon
        self.accuracyM = accuracyM
        self.at = at
    }
}

public struct SessionCourse: Codable, Equatable, Sendable {
    public var id: Int
    public var name: String
    public var city: String
    public var country: String

    public init(id: Int, name: String, city: String, country: String) {
        self.id = id
        self.name = name
        self.city = city
        self.country = country
    }
}

// Loose mirror of handicap-core holeSchema — only what the watch renders.
public struct SessionHole: Codable, Equatable, Sendable {
    public var holeNumber: Int
    public var par: Int
    public var hcp: Int
    public var distance: Double

    public init(holeNumber: Int, par: Int, hcp: Int, distance: Double) {
        self.holeNumber = holeNumber
        self.par = par
        self.hcp = hcp
        self.distance = distance
    }
}

// Loose mirror of the frozen tee snapshot — display fields only. The watch
// never re-encodes the session, so dropping the rating fields is safe.
public struct SessionTee: Codable, Equatable, Sendable {
    public var name: String
    public var distanceMeasurement: String?

    public init(name: String, distanceMeasurement: String? = nil) {
        self.name = name
        self.distanceMeasurement = distanceMeasurement
    }
}

public struct HoleEntry: Codable, Equatable, Sendable {
    /// nil = not yet scored (wire: explicit JSON null, never absent).
    public var strokes: Int?
    public var updatedAt: String
    public var location: GeoStamp?
    /// Shot-level detail captured at hole-out (plan 013). nil = not
    /// recorded — the wire may carry the key as null or omit it; both
    /// decode to nil.
    public var putts: Int?
    public var fairwayHit: Bool?
    public var penaltyStrokes: Int?

    public init(
        strokes: Int?,
        updatedAt: String,
        location: GeoStamp? = nil,
        putts: Int? = nil,
        fairwayHit: Bool? = nil,
        penaltyStrokes: Int? = nil
    ) {
        self.strokes = strokes
        self.updatedAt = updatedAt
        self.location = location
        self.putts = putts
        self.fairwayHit = fairwayHit
        self.penaltyStrokes = penaltyStrokes
    }

    enum CodingKeys: String, CodingKey {
        case strokes, updatedAt, location, putts, fairwayHit, penaltyStrokes
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        strokes = try c.decodeIfPresent(Int.self, forKey: .strokes)
        updatedAt = try c.decode(String.self, forKey: .updatedAt)
        location = try c.decodeIfPresent(GeoStamp.self, forKey: .location)
        putts = try c.decodeIfPresent(Int.self, forKey: .putts)
        fairwayHit = try c.decodeIfPresent(Bool.self, forKey: .fairwayHit)
        penaltyStrokes = try c.decodeIfPresent(Int.self, forKey: .penaltyStrokes)
    }

    // codec.ts requires `strokes` PRESENT (null when unscored); Swift's
    // synthesized encoder would drop the key, so encode the null explicitly.
    // Detail keys are nullish in codec.ts — omit when nil.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let strokes {
            try c.encode(strokes, forKey: .strokes)
        } else {
            try c.encodeNil(forKey: .strokes)
        }
        try c.encode(updatedAt, forKey: .updatedAt)
        try c.encodeIfPresent(location, forKey: .location)
        try c.encodeIfPresent(putts, forKey: .putts)
        try c.encodeIfPresent(fairwayHit, forKey: .fairwayHit)
        try c.encodeIfPresent(penaltyStrokes, forKey: .penaltyStrokes)
    }
}

public struct RoundSession: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var id: String
    public var userId: String
    public var status: SessionStatus
    public var startedAt: String
    public var lastEventAt: String
    /// Monotonic counter bumped per accepted event — the ordering authority.
    public var eventSeq: Int
    public var course: SessionCourse
    public var tee: SessionTee
    public var holeCount: Int
    public var nineHoleSection: NineHoleSection?
    /// Detail tracking for this round (plan 013 D3). Absent = false —
    /// optional so pre-013 snapshots decode unchanged.
    public var detailed: Bool?
    public var displayedHoles: [SessionHole]
    public var currentHoleIndex: Int
    public var entries: [HoleEntry]
    public var notes: String

    public init(
        schemaVersion: Int,
        id: String,
        userId: String,
        status: SessionStatus,
        startedAt: String,
        lastEventAt: String,
        eventSeq: Int,
        course: SessionCourse,
        tee: SessionTee,
        holeCount: Int,
        nineHoleSection: NineHoleSection? = nil,
        detailed: Bool? = nil,
        displayedHoles: [SessionHole],
        currentHoleIndex: Int,
        entries: [HoleEntry],
        notes: String
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.userId = userId
        self.status = status
        self.startedAt = startedAt
        self.lastEventAt = lastEventAt
        self.eventSeq = eventSeq
        self.course = course
        self.tee = tee
        self.holeCount = holeCount
        self.nineHoleSection = nineHoleSection
        self.detailed = detailed
        self.displayedHoles = displayedHoles
        self.currentHoleIndex = currentHoleIndex
        self.entries = entries
        self.notes = notes
    }

    /// Convenience: whether this round tracks hole-out detail.
    public var isDetailed: Bool { detailed ?? false }
}

/// types.ts SessionEvent union. `strokes` stays Double through the wire so
/// the reducer owns rounding/clamping exactly like the TS engine.
public enum SessionEvent: Equatable, Sendable {
    case scoreSet(holeIndex: Int, strokes: Double, at: String, location: GeoStamp? = nil)
    case scoreCleared(holeIndex: Int, at: String)
    /// Hole-out detail patch (plan 013). The watch always sends the FULL
    /// patch (all three keys present; nil encodes as explicit JSON null =
    /// clear) — the TS contract's absent-key/"leave unchanged" form is
    /// never produced on this side.
    case holeDetailSet(
        holeIndex: Int, putts: Int?, fairwayHit: Bool?, penaltyStrokes: Int?, at: String
    )
    case holeSelected(holeIndex: Int, at: String)
    case notesSet(notes: String, at: String)
    case finishStarted(at: String)
    case finishCancelled(at: String)
    case submitted(at: String)
}

extension SessionEvent: Codable {
    enum CodingKeys: String, CodingKey {
        case type, holeIndex, strokes, at, location, notes
        case putts, fairwayHit, penaltyStrokes
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        let at = try c.decode(String.self, forKey: .at)
        switch type {
        case "SCORE_SET":
            self = .scoreSet(
                holeIndex: try c.decode(Int.self, forKey: .holeIndex),
                strokes: try c.decode(Double.self, forKey: .strokes),
                at: at,
                location: try c.decodeIfPresent(GeoStamp.self, forKey: .location)
            )
        case "SCORE_CLEARED":
            self = .scoreCleared(holeIndex: try c.decode(Int.self, forKey: .holeIndex), at: at)
        case "HOLE_DETAIL_SET":
            self = .holeDetailSet(
                holeIndex: try c.decode(Int.self, forKey: .holeIndex),
                putts: try c.decodeIfPresent(Int.self, forKey: .putts),
                fairwayHit: try c.decodeIfPresent(Bool.self, forKey: .fairwayHit),
                penaltyStrokes: try c.decodeIfPresent(Int.self, forKey: .penaltyStrokes),
                at: at
            )
        case "HOLE_SELECTED":
            self = .holeSelected(holeIndex: try c.decode(Int.self, forKey: .holeIndex), at: at)
        case "NOTES_SET":
            self = .notesSet(notes: try c.decode(String.self, forKey: .notes), at: at)
        case "FINISH_STARTED":
            self = .finishStarted(at: at)
        case "FINISH_CANCELLED":
            self = .finishCancelled(at: at)
        case "SUBMITTED":
            self = .submitted(at: at)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: c, debugDescription: "Unknown SessionEvent type: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .scoreSet(holeIndex, strokes, at, location):
            try c.encode("SCORE_SET", forKey: .type)
            try c.encode(holeIndex, forKey: .holeIndex)
            // Whole scores encode as JSON integers (5, not 5.0) to match the
            // numbers the phone reducer receives from its own UI.
            if strokes.truncatingRemainder(dividingBy: 1) == 0,
               let whole = Int(exactly: strokes) {
                try c.encode(whole, forKey: .strokes)
            } else {
                try c.encode(strokes, forKey: .strokes)
            }
            try c.encode(at, forKey: .at)
            try c.encodeIfPresent(location, forKey: .location)
        case let .scoreCleared(holeIndex, at):
            try c.encode("SCORE_CLEARED", forKey: .type)
            try c.encode(holeIndex, forKey: .holeIndex)
            try c.encode(at, forKey: .at)
        case let .holeDetailSet(holeIndex, putts, fairwayHit, penaltyStrokes, at):
            try c.encode("HOLE_DETAIL_SET", forKey: .type)
            try c.encode(holeIndex, forKey: .holeIndex)
            // Full patch: every key present; nil = explicit null (clear).
            if let putts { try c.encode(putts, forKey: .putts) } else { try c.encodeNil(forKey: .putts) }
            if let fairwayHit { try c.encode(fairwayHit, forKey: .fairwayHit) } else { try c.encodeNil(forKey: .fairwayHit) }
            if let penaltyStrokes { try c.encode(penaltyStrokes, forKey: .penaltyStrokes) } else { try c.encodeNil(forKey: .penaltyStrokes) }
            try c.encode(at, forKey: .at)
        case let .holeSelected(holeIndex, at):
            try c.encode("HOLE_SELECTED", forKey: .type)
            try c.encode(holeIndex, forKey: .holeIndex)
            try c.encode(at, forKey: .at)
        case let .notesSet(notes, at):
            try c.encode("NOTES_SET", forKey: .type)
            try c.encode(notes, forKey: .notes)
            try c.encode(at, forKey: .at)
        case let .finishStarted(at):
            try c.encode("FINISH_STARTED", forKey: .type)
            try c.encode(at, forKey: .at)
        case let .finishCancelled(at):
            try c.encode("FINISH_CANCELLED", forKey: .type)
            try c.encode(at, forKey: .at)
        case let .submitted(at):
            try c.encode("SUBMITTED", forKey: .type)
            try c.encode(at, forKey: .at)
        }
    }
}
