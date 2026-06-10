/**
 * Auth stack — lives OUTSIDE the (tabs) shell (handoff ledger §1).
 *
 * No blanket redirect-if-authed here: on web only /login bounces signed-in
 * users, while update-password/verify-session NEED a (recovery) session to
 * work. Each screen mirrors its web twin's own redirect semantics.
 */
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
