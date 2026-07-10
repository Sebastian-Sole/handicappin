/**
 * JS surface of the WatchBridge native module (iOS only). Android and web
 * resolve to the no-op stub via requireOptionalNativeModule, so callers
 * never need Platform checks.
 */
import { requireOptionalNativeModule } from "expo";

/** Structural stand-in for expo-modules-core's EventSubscription (not
 *  re-exported from "expo", and expo-modules-core isn't a direct dep). */
interface EventSubscription {
  remove(): void;
}

interface WatchBridgeState {
  supported: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
  reachable: boolean;
}

interface WatchFrameEvent {
  json: string;
  replyId: string | null;
}

interface ReachabilityEvent {
  reachable: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
}

interface WatchBridgeNativeModule {
  isSupported(): boolean;
  getState(): WatchBridgeState;
  publishContext(json: string): void;
  reply(replyId: string, json: string): void;
  addListener(
    eventName: "onWatchFrame",
    listener: (event: WatchFrameEvent) => void,
  ): EventSubscription;
  addListener(
    eventName: "onReachability",
    listener: (event: ReachabilityEvent) => void,
  ): EventSubscription;
}

const native = requireOptionalNativeModule<WatchBridgeNativeModule>("WatchBridge");

const UNSUPPORTED_STATE: WatchBridgeState = {
  supported: false,
  paired: false,
  watchAppInstalled: false,
  reachable: false,
};

export const WatchBridge = {
  isAvailable(): boolean {
    return native?.isSupported() ?? false;
  },
  getState(): WatchBridgeState {
    return native?.getState() ?? UNSUPPORTED_STATE;
  },
  publishContext(json: string): void {
    native?.publishContext(json);
  },
  reply(replyId: string, json: string): void {
    native?.reply(replyId, json);
  },
  onWatchFrame(listener: (event: WatchFrameEvent) => void): EventSubscription | null {
    return native?.addListener("onWatchFrame", listener) ?? null;
  },
  onReachability(listener: (event: ReachabilityEvent) => void): EventSubscription | null {
    return native?.addListener("onReachability", listener) ?? null;
  },
};

export type { WatchBridgeState, WatchFrameEvent, ReachabilityEvent };
