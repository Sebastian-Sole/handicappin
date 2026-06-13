/**
 * Backing route for the tab bar's center (+) slot (D17). The custom
 * tabBarButton intercepts every press and opens the /rounds/add modal, so
 * this screen only renders if something deep-links to /add directly —
 * forward those to the real flow.
 */
import { Redirect } from "expo-router";

export default function AddTabRedirect() {
  return <Redirect href="/rounds/add" />;
}
