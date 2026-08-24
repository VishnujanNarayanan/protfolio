# Blog writing playbook

Derived from reading ~20 danluu.com posts (pl-tokens, slow-device, cgroup-throttling,
cache-incidents, latency-pitfalls, metrics-analytics, tracing-analytics, deconstruct-files,
file-consistency, simple-architectures, essential-complexity, everything-is-broken, wat,
writing-non-advice, why-benchmark, corp-eng-blogs, postmortem-lessons, sounds-easy, in-house).

Not "write like Dan Luu." The point is to steal the *mechanics* that make those posts read as
a person who did the work, and apply them to ingestion reliability / market data.

---

## 1. What makes a post worth writing

Dan's own filter, from `why-benchmark`: measurement is undervalued, therefore high-ROI
measurement projects are easy to find. Restated as a test:

> After reading, does the reader have a **number**, a **failure mode**, or a **technique**
> they did not have before?

If the answer is "they have my opinion," don't publish it.

Every good post in the sample is one of five shapes:

| # | Shape | Examples | Why it works |
|---|-------|----------|--------------|
| 1 | **Measure what everyone argues about but nobody measured** | keyboard-latency, slow-device, pl-tokens | The number did not exist before you |
| 2 | **Incident / bug archaeology** | cache-incidents, everything-is-broken, postmortem-lessons | Knowledge decays fast; you're preserving it |
| 3 | **Widely-held belief + disconfirming data** | essential-complexity, keyboard-v-mouse, pl-tokens | Requires quoting the claim verbatim, then refuting |
| 4 | **Cheap tool, outsized payoff** | metrics-analytics, tracing-analytics | Reader thinks "I could build that Monday" |
| 5 | **Defense of the boring choice, with receipts** | simple-architectures, boring-languages, in-house | Contrarian *and* evidenced |

What is never in the sample: tutorials for things already documented, "10 tips", framework
comparisons without data, "my journey learning X", opinion without a measurement behind it.

**On problems nobody cares about:** the tell is whether a real person said the wrong thing out
loud. `pl-tokens` opens by quoting Google's AI summary. `deconstruct-files` opens by quoting the
top two r/programming comments. `essential-complexity` quotes Brooks. `in-house` opens with
"Twitter has a kernel team!?" — a thing people actually said to him. If you can't point at
someone believing the wrong thing, or at a number nobody has, the post has no reason to exist.

---

## 2. Openings

Zero throat-clearing in 20 posts. No "in today's fast-paced world", no "in this post we will
explore". Four opening moves, all usable:

1. **Result first.** — "We spent one day building a system that immediately found a mid 7 figure
   optimization (which ended up shipping)."
2. **Absurd concrete framing.** — "Wave is a $1.7B company with 70 engineers whose product is a
   CRUD app that adds and subtracts numbers."
3. **Quote the wrong claim, announce you're checking it.** — pl-tokens.
4. **Provenance note in italics.** — "*This is an excerpt from an internal document David Mackey
   and I co-authored in April 2019.*" Tells the reader what they're getting and buys forgiveness
   for rough edges.

The first sentence always contains a number, a name, or a quote. Never a definition.

---

## 3. Structure

- Body stays readable; **the mess goes in appendices.** pl-tokens has six. `metrics-analytics`
  has "Appendix: stuff I screwed up". This is the single most copyable structural trick — it lets
  you be rigorous without making the main line unreadable.
- Headings are plain descriptions of content ("Sampling", "Time", "Hardware", "Humans"), never
  clever.
- **No summary conclusion.** Posts end on the last real point, an open question, a caveat, or the
  acknowledgements. `pl-tokens`'s conclusion section is literally: "What does it all mean? / Who
  knows?"
- Heavy cross-linking to his own earlier posts, so the blog reads as one continuous argument
  rather than 100 standalone essays. Worth doing from post #2 onward.
- Ends with: "Thanks to [names] for comments/corrections/discussion."

---

## 4. Voice — the specific things that read as human

1. **Calibrated hedges, not vague ones.** "AFAIK", "at least partially attributed to", "seems
   plausible to me", "I'd guess", "maybe at best vaguely directionally true". He hedges the
   *strength* of a claim while the claim itself stays specific. Vague writing hedges the claim.
2. **Pre-register, then grade yourself in public.** pl-tokens states three predictions with
   confidence percentages *before* the results, then marks one of his own "incorrect".
3. **Publish your own screwups.** metrics-analytics: "I think I've probably signed up for roughly
   double the amount of direct work on this system... for essentially no benefit." He maintains a
   whole `/corrections` page.
4. **State where you stopped and why.** "I wanted this to be more of a 'quick toy project' level
   of correctness than a 'Gary Bernhardt' level of correctness, so I stopped after fixing a
   handful of issues." Admitting the ceiling is more credible than pretending there isn't one.
5. **Ambivalence survives editing.** He does not resolve into a clean takeaway when the data
   doesn't support one.
6. **Rhythm.** Long, run-on sentences with nested parentheticals sitting next to three-word
   sentences. "Who knows?" LLM-flat prose has uniform sentence length — that's the tell.
7. **Name real people**, both collaborators and people he disagrees with.
8. **Anticipate the objection inline, in parens, then keep moving** — rather than a "But some
   might say..." section.
9. **Quantify everything available.** Not "much slower" but "16ms at the server and ~240ms at the
   client, a factor of 15". Not "a lot of bugs" but "6 SEV-0s and 6 SEV-1s... along with 38 less
   severe incidents".
10. **Anecdotes are evidence, not decoration.** Each one isolates a specific mechanism and is
    followed by the generalization it supports.

### The AI tell — cut these on sight

Flagged 2026-08-10. The single strongest signal that prose was generated is the **rhetorical
flourish at the end of a paragraph**. Dan almost never does this; he ends paragraphs on a fact.

| Cut | Why | Replace with |
|-----|-----|--------------|
| Aphoristic metaphor as a closer — "the date of the cure and nothing about the date of the disease" | Written to be quoted, carries no information | The plain fact: "nothing records when a bug started, only when I fixed it" |
| Balanced antithesis — "safe in the narrow sense and useless in the broad one" | The symmetry is doing the work, not the content | "The lock stopped two threads writing at the same instant, which is not the same as making this correct" |
| Neat reversals — "the gap-repair mechanism was what made the gap permanent" | Too tidy to be observed | State the mechanism, drop the irony |
| Recycled metaphors — "wearing different clothes", "sharp edge" | Reads as filler once repeated | "are really the same bug" |

Test: read the last sentence of each paragraph on its own. If it sounds like a pull quote,
rewrite it as a statement of fact. The plain version is almost always shorter and says more,
because the space goes to a detail (a number, a flag name, a cap) instead of the rhythm.

### External links

Dan links constantly, mid-sentence, to primary sources — papers, docs, repos, and his own
earlier posts. Links do real work here: they let you make a claim ("`validate="one_to_one"`
would have caught this") without explaining the whole API, and they're the main way a post
signals it was written by someone who reads. Prefer primary sources (the actual OSDI paper,
the actual pandas doc page) over listicles about them.

---

## 5. Application to this blog (ingestion reliability / market data)

Constraint: CiteSert is private. Dan's workaround is standard and legitimate — publish from
internal work with names anonymized ("with the actual service names anonymized per a comms
request"), or describe the mechanism and the numbers without the source's identity. Aggregate
numbers, failure taxonomies, and techniques are publishable; scraped data and source identities
may not be.

### Candidate posts by shape

**Shape 1 — measure what nobody measured** (highest value, flagship material)
- How often does a market data source silently rewrite history? Re-pull the same date range on a
  schedule for N weeks, diff every rerun, report the rate and the shape of the changes.
- How much do two sources disagree on corporate-action-adjusted price series, and which one is
  wrong?
- How stale is "real-time"? Measured end-to-end, source timestamp → row committed.

**Shape 2 — incident archaeology**
- A year of ingestion failures across 28 pipelines, categorized by root cause. Directly the
  `cache-incidents` shape. Probably the single best fit for the existing body of work.
- Every way a 20-year insider-filings backfill broke: format drift, encoding, renamed entities,
  restated filings.

**Shape 3 — belief + disconfirming data**
- "Idempotent" pipelines still produce non-reproducible datasets, and here's the measured rate.
- What "just add a retry" actually costs when the source is rate-limiting you.

**Shape 4 — cheap tool, outsized payoff**
- A rerun-diff harness built in a day, and the bugs it found in week one. Needs the bug list with
  real specifics.

**Shape 5 — boring choice defense**
- Whatever the actual stack is (Postgres + cron + a queue?) running 28 pipelines, with the cost
  and reliability numbers to back it.

### Rules for this blog specifically
- Never use the ~1,665 ticker figure (see memory `no-1665-ticker-count`). Prefer 28 pipelines,
  20 years of filings, 9.4M ticks, 6.4M transactions.
- Every post must carry at least one number that came from a measurement, not from a README.
- The recruiter reading this should conclude "this person has operated data pipelines and knows
  where they break" — which happens automatically if the posts are shapes 1, 2, or 4, and not at
  all if they're tutorials.

---

## 6. Post mechanics — rules set while writing the ingestion-bugs post

### Never explain how the post was made

Cut anything describing the *process* of assembling the piece: "I grepped my commit log
for fix-shaped messages," "I went back through a year of history," "the format is lifted
from X." Two reasons:

1. It reads as machine-assembled even when it isn't, which is the exact signal we're
   trying to avoid.
2. The reader does not need it. State the finding. "Over the last year I fixed about 30
   bugs across 32 scripts" stands on its own; how the 30 was counted belongs in a caveats
   section as *limitations of the number*, never as *the procedure I ran*.

The distinction that keeps this honest: **caveats about the number are good, provenance of
the method is not.** "This counts bugs I found, and the whole argument is that a class of
bug produces no signal" is a real limitation and stays. "I grepped for commits matching
fix|bug|broke" is method disclosure and goes.

### No style attribution

Do not credit or link the blog whose structure was studied, and do not describe the post as
following anyone's format. Absorbing a structure is normal writing practice; announcing it
makes the piece read as an exercise rather than a report. Links to a source's *content*
(a paper, an analysis, a doc page) are fine and encouraged — links that say "I copied this
person's format" are not.

### One heading per category, and explain all of them

An early draft listed five failure categories, then wrote up one of them in depth and
lumped the rest into "the loud twenty-two." That is a broken promise: the reader was given
a taxonomy and then handed one branch of it.

- Every category named in the classification gets its own `<h2>`, with the count in the
  heading: `2. The source fighting back — 9 bugs`.
- Individual incidents inside a category get an `<h3>`.
- It is fine for a category to be three sentences ending in "these are the bugs you fix once
  and stop thinking about." Short is not the same as skipped. Say plainly which category is
  the interesting one so the reader knows where to spend attention.

### Code examples

Include one wherever the bug *is* the code and prose has to work hard to describe it. The
format that carries the most information per line is **before/after in one block**, with the
comment doing the explaining:

```python
# Before: any row can become the resume point, including one
# that carries a date and no prices at all.
start = pd.read_csv(path)["Date"].max()

# After: only rows that actually carry a price count.
df = pd.read_csv(path)
start = df[df["Close"].notna()]["Date"].max()
```

Keep them under ~12 lines, real (paste from the actual fix, don't invent a cleaner version),
and never include a block that only restates the sentence above it. Three per post is plenty.

### Images and charts

Add one only when it shows something the prose can't. A distribution across categories
qualifies; a decorative header image does not. Rules:

- **Inline SVG**, not a raster file — it stays sharp, needs no build step, costs no request,
  and can use the site's own colour tokens.
- Load the `dataviz` skill before writing chart markup.
- Single series → **one hue** (`--color-highlight` #3932DC, validated against the #fcfcfc
  surface), direct value labels at the bar ends, no legend, recessive 1px axis.
- Always `role="img"` with a full `aria-label` naming every value, plus a `<figcaption>`
  that says what the reader should take from it.
- The numbers must also appear in the body text — the chart is a second view of the data,
  never the only one.

### How to add a post (the generator)

Since 2026-08-14 a post is **two files, and nothing else is edited by hand**:

1. `partials/posts/<slug>.html` — the article body only, starting at the first `<p>`.
   No `<article>`, no head, no header/footer, no share buttons.
2. An entry in `partials/posts.json` — slug, `title` (the SEO/card headline, Title Case),
   `h1` (the same thing in sentence case), `dek`, `description` (meta description, aim
   150–170 chars), `shareDescription`, `tags`, `published` (ISO date), `image`, `share`.

Then:

```
python3 scripts/gen-post-covers.py <image-basename>   # only if it needs a cover
node scripts/gen-post.mjs && node scripts/gen-partials.mjs
./scripts/gen-sitemap.sh                              # after committing
```

`gen-post.mjs` writes `blog/<slug>/index.html` in full, plus the card list on `/blog/`, the
four homepage `.wpanel` panels, and the "Keep reading" cards at the foot of every post.
**Do not edit any of those by hand** — the next run overwrites them. A title change is a
one-line edit in the manifest and propagates to about thirty places, including the
percent-encoded share URLs and both JSON-LD blocks.

Covers are generated (`scripts/gen-post-covers.py`) rather than sourced: seeded contour
plates in the site palette, so nothing licensed is introduced. Overwrite the JPEG with a
real image whenever there is one worth using.

### Every post ends with References

Set 2026-08-14. The last section of a post is `<h2>References and further reading</h2>`, and it
is not decoration — it is a large part of what the reader is being given.

Shape:

1. Two or three **discursive paragraphs** first, in the voice of the post: the one or two sources
   that are genuinely worth someone's next hour, each with a sentence on what it gives them.
2. Then grouped `<h3>` lists. The groups that keep earning their place:
   - **Tools / documentation** — the thing that fixes the problem the post describes, so a reader
     can act on it today.
   - **Background / the specifications** — primary sources: the RFC, the paper, the vendor doc.
     Never a listicle summarising them.
   - **Related work of mine** — other posts on this site, the project page, and the repo if it is
     public. This is what turns nine posts into one body of work rather than nine pages.
3. Every list item is `<a>link</a> — one line on why to open it`. A bare link is not a reference.

Rules learned writing them:

- **Link where the claim is, not only at the end.** If a paragraph says a flag would have caught a
  bug, that flag's doc page belongs in that paragraph.
- **Verify every URL before publishing.** `curl -s -o /dev/null -w "%{http_code}" -L <url>`, and
  fix or drop anything that is not 200. Doc sites reorganise constantly: two links written from
  memory in the first draft of these posts were already 404.
- **Only link repos that are public.** `market_data` is private, so posts describe it and link the
  project page instead. Public ones: `product-explorer`, `Job_Application_Bot`,
  `binance-futures-trading-bot`, `Fraud_Transaction_Detection`, `ticket-classifier-nlp`,
  `Trader_sentiment_analysis`.
- Prefer a stable primary URL over a prettier one: `usenix.org` PDFs and `rfc-editor.org` outlive
  vendor blog posts, and some publishers (SSRN, AMS) 403 automated checks even when the page works.

### Page furniture

Handled by CSS, but worth knowing when drafting:

- Article column is ~860px. Long `<pre>` blocks scroll inside the article rather than
  widening the page. `h2`, `h3`, `ul`, `pre` and inline `code` are styled; **tables are
  not** — use a list or prose instead.
- Sub-pages hide the centred VJ mark and sit on `--color-bg`.

---

## 7. The overriding rule: clear, simple narration

Set 2026-08-10, and it outranks everything above it. If any earlier guidance conflicts with
this, this wins.

**A post is one continuous explanation that a competent developer who has never touched
market data can read top to bottom and follow.** Not a list of incidents. Not notes.

Three failure modes to check every draft against:

### Don't swallow the context

The reader was not there. Every incident needs all four parts, in order, before it means
anything:

1. **What I was trying to do** — the goal, in a sentence
2. **What actually happened** — the symptom, concretely
3. **Why it mattered** — the consequence, in real terms
4. **What changed** — the fix

Dropping (1) is the most common mistake and the most damaging: a symptom with no goal
attached is just a fragment. "The dedup key was wrong" means nothing. "I was trying to stop
the same filing being stored twice when windows overlap, and the key I used didn't match any
real column, so every filing for a symbol on a day collapsed into one row" means something.

### Don't jump between things

Each section must follow from the one before it. If a section could be moved anywhere in
the post without anything reading oddly, the post has no spine and the reader is being asked
to assemble it themselves.

Write the transition explicitly. One sentence at the top of a section saying how it connects
to the last one is almost always worth its space:

> *"So the obvious traps are handled. The two that actually bit me are subtler."*

Bullet lists are where this rule dies most often. A list of five things is five fragments
unless the prose around it says what they have in common and why they are grouped.

### Define the term the first time you use it

In one clause, inline, no digression. Not a glossary, not a footnote:

- "the PIT endpoint" → "NSE's insider-trading disclosure endpoint"
- "an anti-join" → "keeping only the rows whose key isn't already stored"
- "TLS fingerprinting" → "blocking based on how the connection is opened, not what the
  request says"
- "the base rate" → "how often the thing you're predicting happens anyway"

This costs a clause and buys the entire audience outside your specialty — which, for a
portfolio, is most of the people who matter.

### The test

Read the draft as someone who knows how to program but has never seen this domain. If you
stop anywhere and think *"wait, what is that"* or *"why are we suddenly here"*, that is a
defect in the post, not in the reader. Fix it by adding a sentence, not by removing the
detail — the numbers and the specifics are the whole value. Length is not the enemy;
compression is.


## 8. Never reference your own work cold

Set 2026-08-14. The reader has not seen your repositories and never will. Anything that only
means something to someone who has — a scenario, a count, a file name, a numbered category
from another post — is noise to everyone else, and the reader's reaction is *what is he even
talking about*.

Two ways to handle a project-specific detail, and there is no third:

1. **Use it as a worked example, fully set up.** Say what the thing is, in general terms,
   before you lean on it: *"a small program that collects job adverts, scores them, and
   messages me the good ones"* — then the 92 tests, the four failures, the retired model all
   land. If you quote code, explain what it does; the code is evidence, not the argument.
2. **Cut it.** If setting it up would cost more than the point is worth, the point is not
   worth making here.

**Opening lines are where this goes wrong first.** `The bot had 92 unit tests` assumes a bot
the reader has never heard of. `I run a small program on a schedule: it collects job adverts,
scores them, and messages me the good ones. It had 92 unit tests` costs one clause and loses
nobody.

**Linking your own posts and projects.** Describe what the reader will *find* there, in their
terms — "check this out, it covers X and Y". Never describe it in terms of this post's
internals.

| Don't | Do |
| --- | --- |
| — the error classification behind the "budget exhausted mid-run" scenario. | — how to tell apart a rate limit that clears on its own, one that never will, and a quota that is simply spent: the distinction a retry loop needs. |
| — the full census these four rules came out of. | — a year of real pipeline failures sorted by cause, which is where these rules came from. |
| — what these 32 scripts feed. | — the project page for the system these collectors run in: what it gathers and how the pieces fit together. |
| — where this pipeline's bugs sit in the wider census; it is one of the two files that account for half of them. | — a year of real pipeline failures sorted by cause, including the ones a job like this produces. |

Back-references *within a single post* are fine — "category 1 above", "failure 2", "layer 2" —
because the reader has just read the thing being referenced. The rule is about references that
reach outside the page.

**Also never name internal or tooling files in a post** — repo scaffolding, agent instruction
files, private notes. Elide them (`CHANGELOG.md  PRD.md  job_automation_architecture.md`) or
leave the list generic. Same for `http://localhost:...` URLs in pasted output: cut the host
(`'.../resume/....pdf'`), since the point is never the address.

---

---

## 9. Read the shipped posts before writing a new one

Set 2026-08-24. **Before drafting anything, read two or three of the posts in
`partials/posts/`.** They are the pattern, and they are more specific than any rule below.
`how-to-test-a-data-pipeline`, `why-scrapers-get-blocked` and `http-429-retry-logic` are the
three to read — they were rewritten last and are closest to right.

This section replaces the old section 8 ("never reference your own work cold"), which was too
weak. It said don't mention a project *cold*. The actual rule is stronger.

## 10. The post is about the problem, not the project

Every post used to be *built around* a project, with a setup clause bolted on the front. A
reader arriving from a search for "why does my scraper get blocked" was handed a tour of
somebody else's codebase with the answer distributed through it. Two rewrites failed because
the framing was kept and only the wording changed.

**Delete every sentence that names a project, a repo, a product, a script count, or a file.
If what remains is still a complete answer to the title, the framing is right. If it collapses
into fragments, the post is a project write-up with SEO on top — start over.**

What survives the cut is the incident, told as something that happened to you. "A site I had
been collecting from started answering with 405" needs no project. "The bot had 92 unit tests"
does. The difference is whether the reader has to know anything to follow the sentence.

**Drop material that does not fit.** Rewriting is not translating — if a section only made
sense as project narration, cut it rather than rephrasing it. The last rewrite dropped a
section per post on average and every post got better.

**Where a detail is genuinely needed for a worked example**, one clause of generic setup does
it: "a collector that pulls news headlines for a set of crypto assets". Never a paragraph, and
never a name. The project belongs in one line of provenance before References, and in the
"My own projects" list, and nowhere else.

## 11. Show the research, not just the incident

The reader should finish believing you went and found out. Hitting a problem, reading around
it, and coming back with the name of the thing and the tool that solves it is the most valuable
shape a post has — more than the war story on its own.

So when a concept was learned after the fact, put it in as a concept: *metamorphic testing is
the name for asserting a relationship between two runs when you cannot state the correct
output for either*; *partition overwrite is the cleanest idempotency pattern available*;
*a slowly changing dimension is what to use when the source revises history*. Link the primary
source at that point.

**Do not annotate what you did or did not use in production.** No "I don't use this yet", no
"this isn't in my project". State the technique and what it is for. If it needs a hedge, hedge
the claim ("I have not hit that in practice, but it is the next thing I would look at"), not
your credentials.

Every post should carry at least one thing the reader can act on within the hour: run your
suite in a fresh clone, fetch `tls.browserleaks.com/json` from both your script and your
browser and compare, one unchanged rerun to measure the noise floor, `validate="one_to_one"`.

## 12. SEO: cover the canonical subtopics, then beat them

Search the target phrase before drafting and skim the top five results. Two things come out
of it, and both matter.

**What they all cover is the shape the searcher expects**, and the post has to cover it or it
reads as incomplete. For "how to test a data pipeline" that was unit, contract, data quality
and end-to-end tests. Cover them properly and briefly, with the standard tool names, because
those names are also the search surface.

**What none of them covers is the post.** That is where the real material goes and it is
usually most of the length. On the same query, nothing in the top results touched
non-deterministic sources, measuring variance, kill-and-resume, or third-party drift.

Other rules that hold:

- Title is the search phrase; the first paragraph answers it. Someone reading only the title
  and the opening should already have the short answer.
- The dek promises value, not autobiography. "A green suite is evidence about your code, not
  your data" beats "92 tests passed while three features were broken".
- Slugs and canonicals never change once published. Retitle freely in `posts.json`.
- **Mention the other guides at most once per post.** "Most write-ups cover X" is a useful
  framing device exactly one time. Used in three paragraphs it becomes a tic, and it reads as
  picking fights rather than explaining.

## 13. What reading Dan's posts actually changed

Re-read `danluu.com/postmortem-lessons` in August 2026 after two drafts came back as
AI-sounding. Four things were wrong that the earlier notes had not caught:

**No bullet lists.** Not "few" — the post has none. Organisation comes from plain `<h2>`
headings with prose underneath. Every list I had written turned out to be either three
sentences wearing a costume, or a real enumeration that read better as a sentence with commas.
The current nine posts contain zero `<ul>` in the body. Lists are fine in the References
section, which is a reference list.

**Paragraphs end on a fact or a hedge, never on a rule.** My drafts ended each section with a
bolded takeaway — "**The guard:** …", "**The tell:** …". One per section is a template, and a
template is the thing that reads as generated. State the rule inside the paragraph where it
arises, in ordinary type, then keep going. Bold is for a term being defined, a few times a post.

**Setup bridges from the general to the specific**, not the reverse. "This AWS failure tells a
typical story" comes *before* the anecdote. Opening a section on the incident and generalising
afterwards leaves the reader holding a fragment while they wait to find out why it matters.

**Hedges attach to the strength of a claim, never to its content.** "I'd guess that is the
general distribution, though I have not counted carefully enough to defend a number." The claim
stays specific; the confidence is what moves. Vague writing hedges the claim instead.

Also still true and easy to lose: numbers are evidence anchors, so every claim that can carry
one should; sentence length has to vary, because uniform length is the clearest tell in
generated prose; and the last sentence of a paragraph should never sound like a pull quote.

### The AI tells found in my own drafts

Checked by grep before publishing now:

| Construction | Example caught | Fix |
|---|---|---|
| Balanced antithesis | "this is normal rather than unlucky" | Say the fact: "the tests pass the whole time" |
| "X is not Y, it is Z" | "is not compression, it is an assertion" | "asserts that …" |
| Bolded rule per section | "**The guard:** assert your key columns exist" | Fold into the prose |
| Every paragraph the same length | — | Break one into three words |

```
grep -nE "is not [a-z ]+, (it is|it's)|rather than (unlucky|luck)|not about [a-z]+ but about" partials/posts/*.html
```

## 14. Headings are noun phrases, not sentences

Set 2026-08-24. A draft went out with headings like "The four kinds of test everyone lists,
and what each one misses" and "Testing against a source that won't repeat itself". Those are
statements. They read as amateur, they do not scan, and they waste the strongest on-page SEO
signal after the title.

A heading names the thing the section is about. The reliable form is a **noun phrase**,
optionally `Topic: qualifier`:

| Instead of | Write |
|---|---|
| The four kinds of test everyone lists, and what each one misses | Standard test types: unit, contract, data quality, end-to-end |
| Testing against a source that won't repeat itself | Non-deterministic sources: measuring the noise floor |
| Going too fast, and writing the wreckage | Adaptive backoff as a data-quality control |
| Where the choice makes no difference at all | Blocking: where neither tool helps |
| How soft the number is | Caveats on the count |

Rules that fall out of it:

- **Lead with the keyword.** "VRAM sizing: what fits in 6GB", not "What fits in the GPU you have".
  The first two or three words are what a reader scanning the page and a search engine both read.
- **No questions**, unless the whole post is structured around them. "Check 3: survival after
  costs" beats "Check 3: does it survive costs?".
- **No first person, no verbs in the imperative.** "A diagnostic order", not "The order I work
  through it now".
- **Keep a set consistent.** If one heading in the post is `Layer 2: TLS fingerprinting`, every
  sibling is `Layer N: <noun phrase>`. Mixed forms inside one post are what make it look
  unedited.
- A count or a label in the heading is good when it carries information —
  `Silently wrong data — 8 bugs` tells the reader the size of the section before they enter it.
