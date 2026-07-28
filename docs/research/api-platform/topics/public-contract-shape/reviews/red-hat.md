# Red Hat review — public-contract-shape

**Perspective:** gut feeling / experienced-founder intuition
**Verdict:** agree — the core call smells right; parts of the packaging smell like platform cosplay.

## What feels right

**Option A is the boring, correct choice, and my gut trusts it immediately.** Hand-written REST for a
handful of endpoints is the kind of decision you never regret at 2am. Every time I've seen someone
bolt a "derive the public API from the internal framework" bridge onto a product, the coupling bill
arrived within a year. The research's own con list for Option B ("you've rebuilt Option A inside
tRPC metadata") is exactly the smell — if the expensive work (output schemas, path design, service
extraction) is manual anyway, the generator is only saving you the *easy* part while taking a
dependency hostage.

**The bus-factor instinct on trpc-to-openapi is worth trusting even though it looks fine today.**
239k weekly downloads, fresh release — sure. But "single-maintainer fork of a package that was
abandoned exactly at the last major version boundary" is a pattern I've been burned by before. You
don't need to prove it will die; the prior is enough. When your entire public contract sits on top
of one stranger's weekend availability, that's a founder-level risk, not a library choice.

**Option C dies on the repo's own evidence, and the gut agrees.** The native app — same monorepo,
same developer, easiest possible case — already couldn't import the typed router and fell back to an
untyped client with zod revalidation (`apps/native/lib/api/client.ts`). Anyone whose instinct says
"we're the same dev, just share the types" hasn't sat through the build-breakage-at-a-distance
experience that superjson + unversioned contracts guarantee. The research is right to kill this.

**Burying the lede check passes — barely.** The real work here is not the REST handlers; it's
extracting the ~700-line `submitScorecard` pipeline out of `round.ts:303`. The recommendation does
say "must be extracted regardless," which is honest. But my gut says that extraction is 80% of the
effort and 95% of the risk (billing gating, pending-course auto-creation, transactional recalc), and
the REST shell is a weekend. Sequence accordingly: extraction PR first, REST second.

## What smells off

**The "minimum operational package" is not minimum — it's a costume.** RFC 9457 problem+json with a
closed append-only code set, a *written 12-month deprecation policy*, RFC 9745 Deprecation + RFC 8594
Sunset headers, hosted spec + changelog… for an API whose only consumer is *the same person's other
app*. This is dressing for a party where no guests have RSVP'd. The parts that are cheap and
structural — problem+json error shape, `/v1` prefix, plain JSON — yes, do them day one, because
retrofitting an error envelope is genuinely painful. But a deprecation-policy document and Sunset
headers with zero third parties is process theater. Write those the week the first stranger asks for
an API key. Naivety smell in the other direction would be worse (shipping superjson to partners),
but over-ceremony has a real cost too: it makes the first PR bigger, slower, and more precious.

**The OpenAPI spec at launch is borderline.** "Small build-your-own step" is how spec drift is born —
hand-assembled OpenAPI that nobody's client actually generates from goes stale in three months. For
one internal consumer, a markdown page + the shared zod schemas in a package might honestly be more
truthful. If the spec ships, wire a CI check that the handlers' zod schemas *are* the spec's source,
or don't ship it yet.

**The Cloudflare 429 is being treated as a footnote and it's the actual day-0 boss fight.** Gut says:
before writing a single handler, curl a hello-world route through prod with a bearer token and no
cookies. "Fix is dashboard-side" is the kind of sentence that eats a week — challenge-mode bypass
rules interact with the orange-cloud setup in ways nobody remembers configuring. Prove the path is
reachable first; everything else is deterministic engineering.

**One quiet worry, no hard evidence:** 4–6 endpoints has a way of becoming 15 once the fitness app
wants course search, tee lists, and round history with pagination. That's fine — but it means the
service-extraction pattern set in the first PR is the real contract. Get *that* review right; the
HTTP layer will follow it whatever it looks like.

## Must address before locking

1. Prove the Cloudflare/Vercel challenge bypass end-to-end on prod (cookie-less bearer request to a
   stub `/api/v1/ping`) before any contract code is written.
2. Cut the ops package to what's structural (problem+json shape, `/v1`, stable error codes);
   explicitly defer the deprecation policy/Sunset-header machinery until a non-owned consumer exists.
3. Sequence the `submitScorecard` extraction as its own PR ahead of any REST handler — that's where
   the risk lives.
