# Red Hat Review — golf-api-landscape

- **Perspective:** Red Hat (gut feeling, founder/engineer intuition)
- **Verdict:** AGREE with the recommendation (Option B now, Option D as declared phase-2 shape)
- **Date:** 2026-07-20

## Gut read

This one passes the smell test, and that is rare for API-platform research. The usual
failure mode of "should we build a platform?" research is that it talks itself into the
platform because platforms are exciting. This report does the opposite and the evidence
trail — verbatim USGA email, NGF board PDFs, actual developer-portal fetches — smells
like real legwork, not confirmation-shopping.

## What feels right

1. **"Zero self-serve API surfaces exist anywhere in consumer golf" is the loudest smell
   in the whole report — and the report reads it correctly.** When an entire category of
   well-funded incumbents (Garmin, Arccos, TheGrint, Golfshot) all independently land on
   vetted-partner deals and never open a portal, that is not laziness, that is the market
   telling you the shape of demand. My gut hates "we'd be first!" arguments in categories
   where being first is trivially possible and nobody did it. Option C smelled of founder
   vanity from the first sentence; the report kills it for the right reasons.

2. **"A developer portal with no users behind it is inventory without a market"** — this
   is the sentence an experienced founder would tattoo somewhere. API value in this
   category scales with the user graph. handicappin does not have the graph. Building
   distribution infrastructure before the graph exists is the classic order-of-operations
   mistake, and the recommendation refuses to make it.

3. **Not poking the bear mid-negotiation.** With USGA (#151) already having said, in
   writing, "remove the estimator from the US," publicly productizing an unofficial-index
   API while #147/#151 are live is the kind of thing that feels bold on Monday and
   catastrophic in the reply email on Thursday. Gut says: quiet hands until NGF answers.

4. **Option D is the emotionally honest part.** "The platform ambition becomes a partner
   program — smaller than the original vision" — naming that grief up front is exactly
   how you stop the vision from sneaking back in as scope creep later. Good instinct.

## Where my nose twitches (not blockers, but watch them)

1. **"Days not weeks" for the Option B extraction smells optimistic.** Extracting a
   ~700-line transactional pipeline (billing gates, pending-course auto-create, handicap
   recalc) out of a tRPC router into a workspace package is the kind of job that is
   always "mostly mechanical" until the transaction boundaries and context assumptions
   surface. I still agree with doing it — it's hygiene the codebase needs regardless —
   but budget it as a real refactor, not a formality, or it will get half-done.

2. **Platform-shaped seams are a known trap.** "We're not building the platform, just
   the seams" is how platforms get built by installments. Idempotency keys, versioning,
   per-consumer attribution for exactly ONE consumer you also own — fine. The moment
   someone proposes a scopes model, consent screens, or a `developers/` docs folder
   "while we're in there," that is Option C wearing Option B's jacket. The report itself
   flags "resisting the temptation to publish docs" — trust that flag.

3. **Two of the three phase-2 triggers are passive.** "A named partner with users asks"
   — partners do not ask products they have never heard of; that trigger will never fire
   on its own. The open-questions list already has the fix (interest form + PostHog
   event); my gut says promote that from open question to part of the Option B ticket,
   or the triggers are unfalsifiable.

4. **The Cloudflare 429 challenge will eat v1 alive if forgotten.** Prod serves a
   Security Checkpoint to cookie-less clients. The fitness app is a cookie-less client.
   This is a dashboard fix, not code, which is precisely why it will be remembered at
   integration time instead of design time. It belongs on the v1 checklist in bold.

5. **Confidence is under-sold.** The summary says "medium," the file says "medium-high."
   For a conclusion grounded in first-party USGA correspondence and federation board
   documents, medium is falsely modest — and false modesty invites re-litigating a
   settled question next quarter. Call the landscape facts high, the demand inference
   medium, and move on.

## Verdict

**Agree.** B + D is the boring, correct answer, and the research earned it rather than
defaulting to it. The residual risks are all execution-discipline risks (scope creep
toward C, forgetting the Cloudflare bypass, passive triggers), not direction risks.
