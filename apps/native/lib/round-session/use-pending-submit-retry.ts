/**
 * Opportunistic retry of a round that finished offline: runs once on mount
 * (Home) and again every time the app returns to the foreground — the two
 * moments connectivity is most likely to be back (leaving the course,
 * unlocking the phone in the clubhouse).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  invalidateRoundQueries,
  retryPendingSubmit,
} from "@/lib/round-session/pending-submit";

export function usePendingSubmitRetry(): void {
  const queryClient = useQueryClient();
  const busyRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const outcome = await retryPendingSubmit();
        if (outcome === "submitted" || outcome === "deduped") {
          invalidateRoundQueries(queryClient);
        }
      } finally {
        busyRef.current = false;
      }
    };

    void run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    return () => subscription.remove();
  }, [queryClient]);
}
