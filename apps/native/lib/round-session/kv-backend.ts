/**
 * The one expo-sqlite import in the round-session module. Kept separate so
 * the engine/persistence layers stay importable from the node:test rig
 * (tests inject a Map-backed KvBackend instead).
 *
 * expo-sqlite/kv-store: each setItemSync is an atomic SQLite transaction —
 * durable across app kill/background, which is the whole point (a session
 * must survive 5+ hours in a pocket).
 */
import Storage from "expo-sqlite/kv-store";

import type { KvBackend } from "@/lib/round-session/persistence";

export const sqliteKvBackend: KvBackend = {
  getItemSync: (key) => Storage.getItemSync(key),
  setItemSync: (key, value) => Storage.setItemSync(key, value),
  removeItemSync: (key) => Storage.removeItemSync(key),
};
