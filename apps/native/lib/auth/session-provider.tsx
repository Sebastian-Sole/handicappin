/**
 * App-wide Supabase session state.
 *
 * One subscription to `onAuthStateChange` at the root; screens consume
 * `useSession()` instead of talking to supabase-js directly. Auth gating
 * lives in the route layouts (logged-out users are redirected to /login by
 * the protected groups), not here — this provider only OWNS the state.
 *
 * Token auto-refresh follows the Supabase RN guidance: refresh while the
 * app is foregrounded, stop in the background.
 */
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";

interface SessionContextValue {
  /** The current Supabase session, or null when logged out. */
  session: Session | null;
  /** True until the persisted session has been read from secure storage. */
  initializing: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  initializing: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setInitializing(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setInitializing(false);
      });

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (mounted) setSession(nextSession);
      },
    );

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          void supabase.auth.startAutoRefresh();
        } else {
          void supabase.auth.stopAutoRefresh();
        }
      },
    );
    void supabase.auth.startAutoRefresh();

    return () => {
      mounted = false;
      authSubscription.subscription.unsubscribe();
      appStateSubscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, initializing }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/** Convenience: the logged-in user's id, or null. */
export function useUserId(): string | null {
  const { session } = useSession();
  return session?.user.id ?? null;
}
