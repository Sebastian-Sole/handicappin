# Red Hat review — external-auth-model

Perspective: gut feeling, founder/engineer instinct. Verdict: **mixed** (leaning agree, with two things that itch).

## What smells right

- **Rejecting Option C is instantly, viscerally correct.** A hand-rolled PAT layer that forces the service-role client into the request path of an RLS-centric codebase is exactly where the one-missed-check cross-user leak lives. The research didn't need three paragraphs; my gut said "no" at "opaque keys fail the Bearer path." Same for better-auth — a second auth system next to Supabase Auth is a wound that never heals.
- **The low-regret framing feels honest, not salesy.** B and A ride the *identical* Bearer path, so B failing in beta degrades to A with zero throwaway work. That's the shape of a good bet: capped downside. Most "do the strategic thing now" recommendations don't have this property; this one does.
- **Gating on a 1-day spike is the right instinct.** The whole recommendation hangs on `auth.getUser()` accepting OAuth-issued tokens. The researcher didn't assume it; good.

## What smells off

1. **OAuth ceremony for your own app talking to your own backend.** Consent screen, client registration, PKCE, a standard OAuth library in the fitness app — for v1 with exactly one consumer, written by the same person, at the same trust level as the native app that already just uses session tokens. My over-engineering alarm goes off. The native app is the existence proof that Option A is "the pattern we already ship." The counterweight — forced user re-auth on a later migration — is real pain I've felt before, so the alarm doesn't fully win. But it rings.
2. **"~2-4 days" and "~50 lines" are founder-optimism numbers.** Bespoke consent UI in apps/web (which may then trip the web-native parity gates — the open question list even admits this is unresolved), an unwrapped client-side flow, beta rough edges, a custom-domain `.well-known` bug open since January. Betas from platform vendors slip and get priced after you're committed. I'd mentally budget a week-plus and be pleasantly surprised.
3. **The buried product question is actually the fork in the road.** "Should a fitness-app user share handicappin identity or connect via consent?" is listed as an open question, but it's the *decision*. If the answer is "one account across my apps" (very plausible for a solo dev's mini-ecosystem), then A isn't a dead end — it's the design, and B's consent moment is theater. If the answer is "separate identities," A is disqualified outright. Picking B before answering this feels like choosing the plumbing before deciding where the bathroom goes. B "supports both" is technically true but that flexibility is what you're paying the 2-4+ days for — make it a conscious purchase.
4. **Energy allocation.** The scary parts of this project are the Cloudflare challenge (no token model matters if nothing reaches origin) and the 700-line inline submitScorecard. Auth is the *third* hardest problem here, and it's getting the most sophisticated answer. Fine — as long as the OAuth work doesn't become the fun displacement activity while the ugly extraction waits.
5. **The interim allowlist will ossify.** "Temporary until Supabase Phase 2 scopes" — I have never seen an interim authorization shim get removed on schedule. Accept that the allowlist IS the scoping story for a year and design it to be lived in, not apologized for.

## Gut verdict

B is defensible and the fallback makes it cheap to be wrong. But I'd only sign off after (a) the identity/product question is answered out loud, and (b) the spike comes in clean *and short* — if the spike day turns into three days of beta archaeology, that's the gut's cue to ship A now and revisit B when a real third party shows up.
