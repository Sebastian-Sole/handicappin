/**
 * Client-stored preferences (plan 013 D3) — native mirror of
 * apps/web/hooks/useDetailedScoringDefault.ts. Backed by
 * expo-sqlite/kv-store (same durable KV the round session uses); no DB
 * column by design.
 */
import { useCallback, useState } from "react";
import Storage from "expo-sqlite/kv-store";

const DETAILED_DEFAULT_KEY = "hcp.pref.detailedScoringDefault.v1";

export function readDetailedScoringDefault(): boolean {
  try {
    return Storage.getItemSync(DETAILED_DEFAULT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDetailedScoringDefault(value: boolean): void {
  try {
    Storage.setItemSync(DETAILED_DEFAULT_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable — the toggle simply won't persist.
  }
}

/** Reactive view of the "Detailed logging" default. */
export function useDetailedScoringDefault(): {
  detailedDefault: boolean;
  setDetailedDefault: (value: boolean) => void;
} {
  const [detailedDefault, setState] = useState(readDetailedScoringDefault);

  const setDetailedDefault = useCallback((value: boolean) => {
    setState(value);
    writeDetailedScoringDefault(value);
  }, []);

  return { detailedDefault, setDetailedDefault };
}
