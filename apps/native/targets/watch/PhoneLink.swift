// WatchConnectivity transport (watch side) — the WatchTransport
// implementation behind WatchSessionStore. Wire shapes live in
// WatchRoundCore/Protocol.swift ↔ lib/round-session/watch-protocol.ts.
import Foundation
import WatchConnectivity

final class PhoneLink: NSObject, ObservableObject, WatchTransport {
    static let shared = PhoneLink()

    @Published private(set) var activated = false
    @Published private(set) var reachable = false

    /// Set by the app once; PhoneLink pushes decoded frames into it.
    var onContext: ((ContextFrame) -> Void)?

    private let encoder = JSONEncoder()

    override private init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    var isReachable: Bool { WCSession.default.isReachable }

    // MARK: WatchTransport

    func sendEvent(_ event: SessionEvent) {
        guard let dict = encodeFrame(.event(event)) else { return }
        let session = WCSession.default
        if session.isReachable {
            // Errors fall back to the queued channel — events are idempotent
            // and the phone reducer no-ops duplicates, so double-send is safe.
            session.sendMessage(dict, replyHandler: nil) { _ in
                session.transferUserInfo(dict)
            }
        } else {
            session.transferUserInfo(dict)
        }
    }

    func requestCatalog(_ completion: @escaping (Result<CatalogReply, Error>) -> Void) {
        request(.catalogRequest, completion)
    }

    func requestSearch(query: String, _ completion: @escaping (Result<SearchReply, Error>) -> Void) {
        request(.searchRequest(query: query), completion)
    }

    func requestTees(courseId: Int, _ completion: @escaping (Result<TeesReply, Error>) -> Void) {
        request(.teesRequest(courseId: courseId), completion)
    }

    func requestStart(
        course: WatchCourseRef, teeId: Int, holeCount: Int, nineHoleSection: NineHoleSection?,
        _ completion: @escaping (Result<StartReply, Error>) -> Void
    ) {
        request(
            .startRequest(
                course: course, teeId: teeId,
                holeCount: holeCount, nineHoleSection: nineHoleSection
            ),
            completion
        )
    }

    func requestSubmit(_ completion: @escaping (Result<SubmitReply, Error>) -> Void) {
        request(.submitRequest, completion)
    }

    func requestSync() {
        guard let dict = encodeFrame(.syncRequest) else { return }
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(dict, replyHandler: nil, errorHandler: nil)
        }
    }

    // MARK: Plumbing

    private func encodeFrame(_ frame: WatchToPhoneFrame) -> [String: Any]? {
        guard let data = try? encoder.encode(frame),
              let json = try? JSONSerialization.jsonObject(with: data),
              let dict = json as? [String: Any]
        else { return nil }
        return dict
    }

    private func request<Reply: Decodable>(
        _ frame: WatchToPhoneFrame,
        _ completion: @escaping (Result<Reply, Error>) -> Void
    ) {
        guard let dict = encodeFrame(frame) else {
            completion(.failure(PhoneLinkError.encodingFailed))
            return
        }
        guard WCSession.default.isReachable else {
            completion(.failure(PhoneLinkError.phoneUnreachable))
            return
        }
        WCSession.default.sendMessage(dict) { reply in
            do {
                let data = try JSONSerialization.data(withJSONObject: reply)
                let decoded = try JSONDecoder().decode(Reply.self, from: data)
                DispatchQueue.main.async { completion(.success(decoded)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(error)) }
            }
        } errorHandler: { error in
            DispatchQueue.main.async { completion(.failure(error)) }
        }
    }

    private func handleIncomingContext(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let frame = try? JSONDecoder().decode(ContextFrame.self, from: data)
        else { return }
        DispatchQueue.main.async { [weak self] in
            self?.onContext?(frame)
        }
    }
}

enum PhoneLinkError: LocalizedError {
    case phoneUnreachable
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .phoneUnreachable:
            return "iPhone not reachable. Open Handicappin' on your phone."
        case .encodingFailed:
            return "Internal encoding error."
        }
    }
}

extension PhoneLink: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith state: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async { [weak self] in
            self?.activated = state == .activated
            self?.reachable = session.isReachable
        }
        // Pick up whatever context the phone last published, then ask for a
        // fresh one (covers first-launch-before-any-publish).
        if state == .activated {
            let context = session.receivedApplicationContext
            if !context.isEmpty {
                handleIncomingContext(context)
            }
            requestSync()
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            self?.reachable = session.isReachable
        }
    }

    func session(
        _ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        handleIncomingContext(applicationContext)
    }

    /// The phone may also push context frames as live messages (faster than
    /// applicationContext coalescing) — same payload, same handler.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncomingContext(message)
    }
}
