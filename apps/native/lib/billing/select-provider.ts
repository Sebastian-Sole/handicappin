/**
 * D-seam selection rule, isolated pure so it's unit-testable without the
 * Expo runtime: the REAL RevenueCat SDK is used iff a non-empty iOS API key
 * is configured; otherwise the mock. The SDK must never be configured
 * without a key.
 */
export type BillingProviderKind = "revenuecat" | "mock";

export function selectBillingProviderKind(
  revenueCatIosApiKey: string | null | undefined,
): BillingProviderKind {
  return revenueCatIosApiKey && revenueCatIosApiKey.length > 0
    ? "revenuecat"
    : "mock";
}
