/**
 * Legal/consent constants for native. LEGAL_VERSION mirrors
 * apps/web/lib/legal-config.ts — keep in lockstep when web bumps it.
 *
 * Legal documents are PERMANENTLY web-only routes (decision ledger §1);
 * native links out to the canonical site via expo-web-browser.
 */
import * as WebBrowser from "expo-web-browser";

export const LEGAL_VERSION = "2026-07-12";

export const SITE_URL = "https://handicappin.com";

export type LegalDocument = "terms" | "privacy";

const LEGAL_PATHS: Record<LegalDocument, string> = {
  terms: "/terms-of-service",
  privacy: "/privacy-policy",
};

export function openLegalDocument(doc: LegalDocument): Promise<unknown> {
  return WebBrowser.openBrowserAsync(`${SITE_URL}${LEGAL_PATHS[doc]}`);
}
