# Blue Hat review — api-ingress-and-abuse

**Perspective:** process control. Was the right question asked, was the method sound, and what should the decision process be?
**Verdict:** agree — with process corrections that must land before the recommendation is locked.

## 1. Was this the right question?

Mostly, and the research did the single most valuable thing a researcher can do: it **falsified the question's own framing**. The topic asked to choose between "challenge-mode bypass rules scoped to /api/v1/*" and alternatives; the research showed (primary-sourced) that the first option does not exist because Attack Mode overrides all bypass rules. Reframing the question instead of answering it as posed is exactly right.

But the reframing surfaced a scope problem the process has not acted on: **step 1 is not an API-platform decision, it is a live production incident.** The shipped native app's entire Bearer path is unreachable and browser users get HTML-parse errors after 1-hour challenge expiry. That belongs in an incident/fix lane executed *today*, not held inside a research-review-decide cycle for a future fitness-app integration. Process action: split step 1 out of this workstream and do it now; let this topic's decision govern steps 2–4 only.

## 2. Method soundness

Strong by the standards of this research program:

- **Recency:** all load-bearing Vercel/Cloudflare claims cite docs dated 2026-05/06/07 or were retrieved 2026-07-20; the blocker was re-confirmed live the same day. No stale-knowledge risk on the mechanism claims.
- **Codebase grounding:** real files checked (`rate-limit.ts`, `proxy.ts`, `vercel.json`, `trpc.ts`, `eas.json`); the `getIdentifier` shared-bucket consequence of orange-cloud is a genuine repo-level finding, not doc paraphrase.
- **Options space:** A–D is complete for this topic (single-host, dedicated host grey, dedicated host orange, separate deployment); C and D are dismissed with reasons rather than strawmanned, and D correctly defers to the stack topic.

Two method gaps, both minor but worth flagging:

- **The precedence claim rests on a June 2024 community post.** The research asserts it is "still the documented behavior in 2026" but cites only the 2024 discussion plus the Attack Mode doc generally. Since this claim is the keystone of the whole reframing, the implementer should spend 2 minutes confirming the precedence statement appears in the current Attack Mode doc text (or reproduce it empirically: enable rule, test, disable) before relying on it in the runbook.
- **Vercel-plan and dashboard-state facts were left as open questions when they are 5-minute checks the owner can do.** Research that ends with "the exact dashboard state is unverified... could shift step 1's details" has stopped one step short. Cheap, decision-relevant, owner-accessible facts should be gathered *before* declaring high confidence, not listed after it.

## 3. Sequencing errors in the recommended process

These are the must-address items:

1. **Diagnose before toggling.** Open question 1 admits the mitigation could be (a) the Attack Mode toggle, (b) a custom challenge rule, or (c) automatic mitigation aggravated by Cloudflare-IP concentration. The recommendation's step 1 assumes (a)/(b). If it is (c), toggling off fixes nothing and **grey-clouding becomes step 1, not step 2** — inverting the recommended order. The dashboard check is not an open question to resolve "later"; it is the first step of the decision procedure and gates which option-sequence applies.
2. **Answer "was there an attack?" before removing the defense.** Turning off a standing challenge without knowing why it was enabled (deliberate response to abuse vs. panic-toggle vs. never-deliberate) is dropping a shield blind. The process should be: check Vercel firewall analytics / traffic history first (minutes of work), then remove the challenge with a rollback plan (the documented replacement: host-scoped challenge rule) ready to apply if abusive traffic reappears.
3. **The footgun mitigation is under-engineered.** A runbook note in `docs/` is the weakest possible control for "any future panic-enable of the toggle silently kills the API and native app." The decision should include a **continuous synthetic probe**: a cron (the project already has one in `vercel.json`, or external uptime monitor) that curls `/api/trpc/*` cookie-less and alerts on `x-vercel-mitigated` — turning a silent multi-day outage into a minutes-long alert. This also compensates for the config being dashboard-state/unversioned, which no option on Vercel can fix.
4. **Webhook delivery audit (OQ4) should be promoted from open question to step-1 checklist item.** If Stripe/RevenueCat deliveries were dropped during the challenge period, there may be billing-state repair to do — that changes urgency and scope now, not later.

## 4. What would change the answer

- Dashboard shows automatic mitigation (not toggle/rule) → grey-cloud first; Option B's ordering flips but B still wins.
- Owner has a deliberate reason for orange-cloud (origin-hiding, cached marketing pages) → B unchanged (per-record grey cloud); only "grey-cloud everything" simplification dies.
- Project on Hobby plan → B still feasible (3 rules is exactly enough) but with zero headroom; strengthens the case for the plan check before rule design.
- Evidence of an actual ongoing attack → keep a challenge posture (as the host-scoped rule) while carving the API host; still B, but step 1 becomes rule-replacement rather than removal.

Note that none of these flip B to another option — which is why I agree at high confidence with the *destination* while insisting the *procedure* be reordered: verify dashboard state → check attack history + webhook logs → replace toggle with scoped rules → grey-clouded api host → probe + runbook.

## 5. Decision-process recommendation

- Treat step 1 as an incident fix executed immediately after the two 5-minute dashboard checks; do not gate it on the rest of the api-platform decision cycle.
- Lock Option B for the fitness-app timeline, conditional on the dashboard check not revealing case (c) above (which only reorders, not replaces, B).
- Record the firewall ruleset in `docs/` **and** add the synthetic cookie-less probe; the runbook line alone is insufficient.
- Feed forward to `hosting-stack-decision` exactly as the research does: edge ingress does not justify a separate deployment; the residual argument for D must come from other grounds.
