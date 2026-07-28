# Red Hat Review — two-way-sync

Perspective: intuition and gut feeling. No citations, just pattern-matching from years of watching sync
infrastructure get built too early.

## Verdict: agree

## Gut reactions

### 1. The recommendation smells right, and for the right reason
The single strongest fact in the whole summary is the one that settles it instantly: **the recalc is
already async on a 60-second cron, and the first-party apps don't even poll for it.** When your own
product ships fetch-on-navigation and nobody has complained, building push transport for consumer #2 is
pure vanity engineering. Any experienced founder feels this in their bones: you don't give an external
surface stronger guarantees than your own UI has ever needed. The research got the confidence
calibration right — this is a "high", not a hedge.

### 2. The cursor endpoint rejection is the sneaky-best call
"Changes since cursor" *sounds* like the humble option and is actually the trap — no `updated_at`,
hard-deleted rounds, so it silently drags in schema migrations and a tombstone strategy. I've watched
teams walk into exactly this because "a sync endpoint" sounds smaller than "webhooks". The research
caught it. Good nose.

### 3. But the Realtime "accelerator" makes my eye twitch — mildly
It's sold as free, and the billing-sync precedent is real. But two smells:

- **"Free" features have a way of becoming load-bearing.** The moment the fitness app's post-submit
  screen feels snappy via Realtime, that snappiness becomes the de facto contract, and the day topic 2
  moves to PAT/OAuth auth (which the longer-term "genuine third-party platform" goal practically
  guarantees), you're not removing an accelerator — you're shipping a perceived regression. Fine to
  build; do NOT document it, do not let the fitness app UX depend on it existing.
- **A second app opening a raw websocket into handicappin's Postgres publication is intimacy, not
  API.** It's acceptable precisely because both apps are the same developer sharing a Supabase project
  — but it's the kind of shortcut that feels great at v1 and embarrassing when you write the public
  docs. The research knows this (it's gated on topic 2), but the framing "recommended" gives it more
  weight than my gut would. I'd call it "permitted, optional, undocumented".

### 4. The biggest smell isn't in the answer — it's in the open questions
"Does the fitness app have its own backend?" is listed as the *top open question*. **It's the same
developer.** That's not a research unknown, that's a Slack message to yourself. Leaving the single
fact that flips webhooks from "moot" to "cheap hardcoded pg_net call" unanswered — while writing
paragraphs about QStash pricing and Standard Webhooks HMAC — is research theater. Answer it in five
minutes, then half the deferred-webhook analysis either collapses or activates.

### 5. The pre-built future webhook architecture: fine as notes, watch the anchoring
Speccing QStash + outbox + Standard Webhooks *now* for a system explicitly deferred is a classic way to
pre-commit emotionally. In 12 months the right answer might be different (Supabase may ship native
queues/webhooks; the outbox might want to live elsewhere). Keep it as a sketch with a date on it, not a
decision.

### 6. One small naivety: the "poll every 15s for 2min" contract
Over-specified. Documenting a cadence that precise invites the consumer to hardcode it and invites you
to feel bound by it. The honest contract is "the index is eventually consistent, typically <2 minutes;
refetch on focus and after submit". Fewer numbers in the contract, fewer future apologies.

## Must address before locking

1. Answer the fitness-app-backend question by asking the developer (yourself) — before the decision is
   recorded, not as a lingering open question.
2. Decide explicitly whether Realtime is part of the documented contract or an undocumented internal
   optimization. My gut: undocumented, and the fitness app must be fully functional with it turned off.

## Bottom line

Option B, but with Option A energy: polling IS the product, Realtime is a private garnish, and the
webhook section is a sketch, not a blueprint. The research resisted the siren song of eventing
infrastructure at n=1 consumers — that's the mark of someone who's been burned before, and I trust it.
