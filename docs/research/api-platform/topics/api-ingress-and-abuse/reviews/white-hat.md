# White Hat Review — api-ingress-and-abuse

Perspective: facts and information only. Each load-bearing claim was re-checked against the live system, the repo, or primary sources on 2026-07-20.

## Claims independently VERIFIED during this review

1. **The blocker is live right now.** `curl -I https://handicappin.com/` and `/api/trpc/*` both return HTTP/2 429 with `x-vercel-mitigated: challenge`, `x-vercel-challenge-token`, and `server: cloudflare` + `cf-ray` (Oslo edge). The mitigation is Vercel's, served through Cloudflare's proxy — exactly as the research states.
2. **The native app's prod target is the challenged host.** `apps/native/eas.json` lines 20 and 30 set `EXPO_PUBLIC_API_BASE_URL: "https://handicappin.com"` for both preview and production profiles.
3. **Bearer-token auth exists in the app layer.** `apps/web/server/api/trpc.ts` implements `extractBearerToken` / `getUserFromBearerToken` (cookie-first, Bearer fallback), so the only thing making the Bearer path unreachable in prod is the edge challenge — the app code is ready.
4. **`getIdentifier` IP-bucketing claim.** `apps/web/lib/rate-limit.ts:188-207` prefers `x-real-ip` (Vercel-set = connecting client). Behind orange-cloud the connecting client is a Cloudflare edge node, so anonymous per-IP buckets are indeed shared across all real users behind the same CF edge IP. (This last step is a correct inference from the code + topology, not directly observed.)
5. **Vercel doc facts (fetched 2026-07-20):**
   - Attack Mode doc (last_updated 2026-05-08): "we recommend using it primarily when facing highly targeted attacks rather than as a permanent setting"; known bots incl. webhook providers auto-allowed; "Standalone APIs, other backend frameworks... may not be able to pass challenges and could be blocked... consider using Custom Rules."
   - Firewall concepts doc (last_updated 2026-06-16): challenge sessions valid **1 hour** (confirms the mid-round-expiry failure mode for browser users); "Direct API calls (e.g., from scripts, cURL, or Postman) will fail"; "For custom rule bypasses, the request is allowed through any custom or managed rules."

## Claims SOURCED but not independently re-verified

6. **"Attack Mode takes precedence over ALL custom rules including bypass."** The source is a Vercel staff answer in community discussion #7221 (June 2024). The current 2026 docs are *consistent* with it (they steer users to custom rules for granular control) but do **not** explicitly restate the precedence. Notably, the firewall-concepts doc distinguishes **custom-rule bypasses** from **system bypasses** ("allowed through any system-level mitigations"); whether a *system bypass* can exempt a path from Attack Mode is not established anywhere in the research. This does not change the recommendation — toggle-off + custom challenge rule works regardless — but the flat statement "bypass under Attack Mode does not exist as an option" is a 2024-vintage claim carried forward, not a 2026-verified one. A 15-minute test on a throwaway Vercel project would settle it.
7. **Proxy-stacking officially unsupported / Enterprise Trusted Proxy only.** Cited to Vercel docs in the research file; not re-fetched in this review. Plausible and consistent with observed behavior, but treat as sourced-not-reverified.
8. **Cloudflare free-plan limits (1 rate rule, IP-key, 10s window; Bot Fight Mode not path-bypassable).** Not re-verified; Cloudflare has changed free-tier rate-limiting entitlements before. Only matters if Option C is revisited.

## Claims that are ASSUMPTIONS/INFERENCES (flagged as such in the research — correctly)

- **Which mechanism is enabled** (Attack Mode toggle vs project-wide challenge rule vs automatic mitigation): the observed headers cannot distinguish these. The research says so; step 1's exact action is contingent on a dashboard check that has not happened.
- **Native app users are being hurt today**: verified-unreachable endpoint + verified prod URL, but no evidence was gathered on whether prod native builds are actually in users' hands or whether Sentry shows native 429s. The *severity/urgency* framing rests on this.
- **The challenge was motivated by Cloudflare-IP concentration aggravating DDoS heuristics**: explicitly speculative in the research; no incident data examined.

## Data still obtainable that would firm up the decision (all cheap)

- Vercel dashboard → Firewall: which mitigation is on; project plan tier (rule quotas). (~5 min; determines step 1's exact form.)
- Sentry: native-app 429/HTML-parse errors, and web-user tRPC "Unexpected token '<'" frequency — quantifies current harm (memory note `vercel-challenge-mode-breaks-trpc` says this was already observed for web).
- Stripe/RevenueCat dashboards: webhook delivery success during the challenge window — tests the "known webhook providers auto-allowed" claim against reality.
- Cloudflare dashboard: any page rules/redirects/features actually depending on orange-cloud (answers "why proxied at all" and whether grey-clouding everything is safe).
- Empirical Attack-Mode-vs-bypass test on a scratch project (settles claim 6 and the system-bypass question).

## Factual assessment of the recommendation

The recommendation's mechanism chain — toggle off, ordered host-scoped custom rules, per-record grey-cloud CNAME, host guard, layered rate limits — uses only primitives that are documented as of June 2026 and, where checkable from this machine, checked out. Nothing in the evidence contradicts Option B. The two facts the research itself marks as unverified (dashboard state, plan tier) affect sequencing detail, not direction. The one verification gap introduced above (claim 6's 2024 provenance and the unexplored system-bypass path) could only make the situation *easier* than assumed, not harder — it cannot invalidate Option B.

Verdict: **agree** — the evidence base is unusually solid; remaining gaps are enumerable and each has a concrete, cheap collection path.
