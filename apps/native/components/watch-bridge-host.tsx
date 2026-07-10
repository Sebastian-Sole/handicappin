/**
 * Mounts the phone↔watch bridge for the app's lifetime (iOS only — the
 * bridge is a no-op wherever WatchConnectivity doesn't exist). Restarts on
 * account switch so the ownership scoping inside the bridge always reads
 * the current user.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSession } from "@/lib/auth/session-provider";
import { startWatchBridge } from "@/lib/round-session/watch-bridge";

export function WatchBridgeHost() {
  const { session, initializing } = useSession();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    // Hold the first publish until auth resolves: during the initializing
    // window userId reads null, and publishing "no session" then would
    // wrongly clear the watch on every phone cold start (it self-heals a
    // beat later, but the watch visibly rubber-bands mid-round).
    if (initializing) return;
    return startWatchBridge({
      getUserId: () => userId,
      queryClient,
    });
  }, [initializing, userId, queryClient]);

  return null;
}
