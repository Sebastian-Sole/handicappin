/**
 * The round session is DEVICE-global (one SQLite slot), while accounts are
 * not — a second account logging in on the same phone must never see or
 * resume the first account's round. Every resume surface (tab button, Home
 * card, auto-resume, live screens) goes through this hook so a foreign
 * session reads as "no session". The foreign session stays on disk; it is
 * only overwritten if the new user starts their own round (single-slot
 * tradeoff, by design).
 */
import { useUserId } from "@/lib/auth/session-provider";
import { useRoundSession } from "@/lib/round-session/store";
import type { RoundSession } from "@/lib/round-session/types";

export function useOwnedRoundSession(): RoundSession | null {
  const userId = useUserId();
  const session = useRoundSession();
  if (!session || userId == null || session.userId !== userId) return null;
  return session;
}
