// Phone-side WatchConnectivity bridge (Expo local module).
//
// Responsibilities are deliberately dumb-pipe:
// - publishContext(json): push the latest ContextFrame to the watch
//   (applicationContext for last-value persistence + a live message when
//   reachable, because applicationContext delivery coalesces/lags).
// - Incoming watch frames surface to JS as "onWatchFrame" events; frames
//   that arrived via sendMessage carry a replyId, and JS answers through
//   reply(replyId, json). All policy (zod validation, reducer dispatch,
//   catalog building, submitting) lives in TS — see
//   lib/round-session/watch-bridge.ts.
import ExpoModulesCore
import WatchConnectivity

public class WatchBridgeModule: Module {
    private let delegate = WatchBridgeSessionDelegate()

    public func definition() -> ModuleDefinition {
        Name("WatchBridge")

        Events("onWatchFrame", "onReachability")

        OnCreate {
            self.delegate.onFrame = { [weak self] json, replyId in
                self?.sendEvent("onWatchFrame", [
                    "json": json,
                    "replyId": replyId as Any,
                ])
            }
            self.delegate.onReachability = { [weak self] reachable, paired, installed in
                self?.sendEvent("onReachability", [
                    "reachable": reachable,
                    "paired": paired,
                    "watchAppInstalled": installed,
                ])
            }
            self.delegate.activate()
        }

        Function("isSupported") {
            WCSession.isSupported()
        }

        Function("getState") { () -> [String: Any] in
            guard WCSession.isSupported() else {
                return ["supported": false, "paired": false, "watchAppInstalled": false, "reachable": false]
            }
            let s = WCSession.default
            return [
                "supported": true,
                "paired": s.isPaired,
                "watchAppInstalled": s.isWatchAppInstalled,
                "reachable": s.isReachable,
            ]
        }

        /// Publish the context frame (JSON string). Never throws to JS —
        /// connectivity hiccups must not break phone-side dispatch.
        Function("publishContext") { (json: String) in
            self.delegate.publishContext(json)
        }

        /// Answer a sendMessage-delivered frame. Late/duplicate replies are
        /// dropped (the handler is one-shot).
        Function("reply") { (replyId: String, json: String) in
            self.delegate.reply(replyId: replyId, json: json)
        }
    }
}

final class WatchBridgeSessionDelegate: NSObject, WCSessionDelegate {
    var onFrame: ((String, String?) -> Void)?
    var onReachability: ((Bool, Bool, Bool) -> Void)?

    private var pendingReplies: [String: ([String: Any]) -> Void] = [:]
    private let lock = NSLock()
    /// Last published context, re-pushed on (re)activation so a watch that
    /// pairs later still converges.
    private var lastContextJson: String?

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func publishContext(_ json: String) {
        guard WCSession.isSupported() else { return }
        lastContextJson = json
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        guard let dict = Self.jsonToDict(json) else { return }
        // Last-value channel (survives watch app relaunch)…
        try? session.updateApplicationContext(dict)
        // …plus a live push for sub-second UI updates while both are up.
        if session.isReachable {
            session.sendMessage(dict, replyHandler: nil, errorHandler: nil)
        }
    }

    func reply(replyId: String, json: String) {
        lock.lock()
        let handler = pendingReplies.removeValue(forKey: replyId)
        lock.unlock()
        guard let handler, let dict = Self.jsonToDict(json) else { return }
        handler(dict)
    }

    private static func jsonToDict(_ json: String) -> [String: Any]? {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let dict = obj as? [String: Any]
        else { return nil }
        return dict
    }

    private static func dictToJson(_ dict: [String: Any]) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func emitFrame(_ dict: [String: Any], replyId: String?) {
        guard let json = Self.dictToJson(dict) else { return }
        onFrame?(json, replyId)
    }

    private func emitReachability(_ session: WCSession) {
        onReachability?(session.isReachable, session.isPaired, session.isWatchAppInstalled)
    }

    // MARK: WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        emitReachability(session)
        if let json = lastContextJson {
            publishContext(json)
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        emitReachability(session)
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        emitReachability(session)
    }

    /// Fire-and-forget frames (events via the fallback queue).
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        emitFrame(message, replyId: nil)
    }

    /// RPC frames — hold the reply handler until JS answers (or the watch
    /// times the request out and WCSession discards it).
    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        let replyId = UUID().uuidString
        lock.lock()
        pendingReplies[replyId] = replyHandler
        lock.unlock()
        emitFrame(message, replyId: replyId)
    }

    /// Queued events delivered while unreachable (transferUserInfo).
    func session(
        _ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]
    ) {
        emitFrame(userInfo, replyId: nil)
    }
}
