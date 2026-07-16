"use client";

/**
 * "Detailed logging" default (plan 013 D3): the Settings-level preference
 * that pre-selects Track detailed stats / Scores only at round start.
 * Client-stored by design (localStorage — no DB column; supersedes plan
 * 010's no-persistence stance). Mirrored on native by
 * apps/native/lib/preferences.ts.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "hcp.detailedScoringDefault.v1";

export function readDetailedScoringDefault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDetailedScoringDefault(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode) — the toggle simply won't persist.
  }
}

/**
 * Reactive view of the preference. Reads after mount (never during SSR),
 * so the first client render matches the server-rendered default.
 */
export function useDetailedScoringDefault(): {
  detailedDefault: boolean;
  setDetailedDefault: (value: boolean) => void;
  hydrated: boolean;
} {
  const [detailedDefault, setState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration after mount (SSR-safe)
    setState(readDetailedScoringDefault());
    setHydrated(true);
  }, []);

  const setDetailedDefault = useCallback((value: boolean) => {
    setState(value);
    writeDetailedScoringDefault(value);
  }, []);

  return { detailedDefault, setDetailedDefault, hydrated };
}
