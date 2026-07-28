# Red Hat Review — hosting-stack-decision

**Perspective:** Gut feeling / founder intuition
**Verdict:** Agree — the recommendation smells like the boring, correct move. But three things smell wrong around its edges.

## What smells right

- **Staying on the stack is the seasoned call.** Standing up a Hono/Fastify service on day one, for one consumer, who is *yourself*, would be résumé-driven architecture. The research even found the repo's own scar tissue arguing for the recommendation: `supabase/functions/handicap-shared` — the hand-maintained Deno mirror — is what happens when you create a second runtime before the packages exist. Gut says: a codebase that already paid that tax once should not be eager to pay it again.
- **The two-step extraction sequence (services/ now, package only after packages/db) rings true.** Forcing `packages/scorecard-core` while the Drizzle schema lives in `apps/web/db` would be the over-engineered version — a "package" that imports from an app is theater. The research resisted that temptation. Good.
- **The timeout panic was correctly deflated.** The moment I saw that the heavy recalc goes through `handicap_calculation_queue` + pg_cron (verified: migrations 20251207150152/153 exist), the whole "does the transaction fit the serverless window" framing collapsed. The research caught its own premise being wrong. That's the mark of research I trust.

## What smells wrong

### 1. "Confidence: high" while the actual launch killer is an untested dashboard toggle
Every hard technical question got answered, but the thing that will actually burn launch day is the Cloudflare 429 challenge — an ops setting nobody has flipped or curl-tested yet. Twenty years of scar tissue says: the risk isn't the 700-line transaction, it's the config change that "someone will do before launch." That curl test should happen **this week**, not "before any consumer integrates." If the bypass can't be scoped cleanly, the hosting decision itself might change (a separate host trivially sidesteps it), and then this whole recommendation gets re-litigated.

### 2. The delete-on-race code is scarier than the research's tone suggests
I read round.ts:949-992. Hand-rolled compensating deletes across four tables, running *outside* the transaction, keyed off a REST count re-check. For a browser user with one submit button, fine. For an API client with retry logic? My stomach turns. The research says "Idempotency-Key mitigates" and files the DB-side limit constraint under *open questions*. Gut says that's backwards: **don't expose public writes over that compensation path at all.** Make the free-tier limit transactional/DB-enforced first. It's a small piece of work and it deletes a whole class of 2 a.m. incidents.

### 3. The trigger list smells like a list nobody will ever read again
"Sustained API-attributable Vercel cost > $50-100/mo" — who is going to measure API-attributable cost? Nobody. Triggers without an owner and an alert never fire; they get remembered six months after they tripped. Honest compression of that list: **split when a real third party shows up, or when Supavisor connection alarms go off.** Set the one Supavisor alert (the fluid-compute connection-growth report is the only genuinely unresolved smell in the whole analysis) and drop the pretense of the rest.

### One nagging itch, not a blocker
If the fitness app shares the same Supabase project, consumer #1 needs zero OAuth and could arguably just speak tRPC-with-bearer like the native app already does. So is a versioned public REST /v1 itself slightly premature? My gut lands on: the *extraction* is the real deliverable either way, and a thin /v1 adapter over the extracted service is cheap discipline. But be honest that "API platform" is currently a hypothesis with zero external demand — build the seam, keep the ceremony minimal.

## Must-address before locking

1. Run the cookie-less curl against prod and confirm a scoped Cloudflare/Vercel bypass is actually configurable — this week, before any other work is scheduled on this decision.
2. Decide the free-tier limit enforcement (DB-side constraint vs compensation) **before** public writes exist — not as a parallel open question.
3. Replace the seven-item trigger list with the two triggers that will actually be noticed: a real third-party consumer, and a configured Supavisor connection alert firing.
