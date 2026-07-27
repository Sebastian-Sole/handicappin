# Red Hat review — api-ingress-and-abuse

**Perspective:** gut feeling, founder/engineer intuition. No pretense of balance.
**Verdict:** AGREE — this recommendation smells right, and one part of it smells urgent.

## What my gut says

### 1. This isn't a research topic, it's an open incident. Treat it that way.

The thing that jumps off the page: the shipped native app points production builds at
`https://handicappin.com` (verified in `apps/native/eas.json`) and every cookie-less request
gets a 429 challenge. That means **the native app's entire prod API path is dead right now**,
and browser users mid-round get HTML-parse errors after an hour. My stomach dropped reading
that framed as "step 1 of a plan." Step 1 is a five-minute dashboard toggle. Do it today,
before any more deliberation. The fact that this has been broken since at least 07-16 and
was discovered as a side quest of API-platform research is the real red flag here.

### 2. The recommendation feels like *removing* an accident, not adding architecture. That's why I trust it.

Cloudflare-orange-cloud-in-front-of-Vercel never smelled right — proxy-stacking two edge
vendors so neither sees real client IPs is the kind of setup you inherit, not design. The
"aggravated DDoS heuristics probably caused the challenge in the first place" theory has the
ring of truth: the system was defending itself against its own topology. Option B mostly
*deletes* complexity (grey-cloud the API host, real IPs come back, per-IP limits start
meaning something). Recommendations that work by subtraction are the ones that age well.
Options C and D, by contrast, smell like adding vendors/deployments to solve a problem the
current stack caused itself. Correctly rejected.

### 3. The footgun analysis is honest, and my gut says the footgun WILL fire.

"Never press the Attack Mode toggle, use the host-scoped challenge rule instead" is a runbook
rule fighting human nature. During a real attack at 2am, someone (probably future Sebastian)
will press the big obvious button, and every bypass rule silently dies. You cannot
runbook your way out of a UI that puts a landmine next to the light switch. This is exactly
why Option B beats Option A for me on pure gut: B makes the API host *structurally* less
coupled to the site's panic responses. But note it doesn't fully escape — the toggle is
project-wide, and the api host is on the same project. The honest framing would be "B narrows
the blast radius; only D eliminates it." The research says this quietly; I'd say it loudly.

### 4. Where it smells faintly of over-engineering: the abuse layer.

IP+JA4 WAF rate-limit rules, per-region counter caveats, layered defense-in-depth… for an
API whose first and only consumer is *the same developer's fitness app*. Gut check: Bearer
auth that 401s junk + the Upstash limiters that already exist in `lib/rate-limit.ts` is
enough abuse protection for the next 12+ months. The Vercel WAF rate-limit rule is cheap to
add, fine — but nobody should spend a day tuning JA4 fingerprint rules before a single
third-party developer exists. Ship the hole, ship auth, ship Upstash, move on. The elaborate
edge posture is a "third-party platform" problem, and that platform is aspirational.

### 5. The unasked question that itches: why is Cloudflare there at all?

The open-questions list buries this. If orange-cloud is a zone-add default rather than a
deliberate choice (my gut says default — nothing in the repo depends on Cloudflare features),
then the *simplest* end state is grey-cloud everything and let Vercel be the only edge.
That dissolves the proxy-stacking problem for the whole site, fixes anonymous per-IP
bucketing for the contact form, and removes a dashboard from the "two dashboards to keep
coherent" problem. Option B is right either way, but answer this question first — it might
make half the plan unnecessary.

### 6. Dashboard-state config: annoying, but don't let perfect block done.

Yes, it's ugly that `bypass` can't live in `vercel.json`. The proposed mitigation (document
the ruleset in `docs/` + runbook) is the correct pragmatic move. A screenshot and a markdown
table beat waiting for Vercel to ship firewall-as-code.

## Must-address before locking

1. **Do step 1 (toggle off / unblock native) immediately as an incident fix — do not batch
   it with the fitness-app work or wait for this review cycle to close.**
2. **Answer "why orange-cloud at all?" before doing DNS work** — if nothing depends on
   Cloudflare proxying, grey-cloud broadly and simplify the whole picture.
3. **Verify the Vercel plan tier before designing rules** — Hobby's 3-custom-rules/1-rate-rule
   cap makes the proposed ordered ruleset barely fit or not fit.

## Verdict

Agree, with emphasis: the core move (toggle off + grey-clouded api host) is subtractive,
uses boring supported primitives, and decouples the right things. Cut the abuse-layer
gold-plating to match the actual threat model (one friendly consumer), and treat the broken
native app as the emergency it is.
