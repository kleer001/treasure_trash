---
name: honest-copy
description: >-
  Audit public-facing copy for false, unverifiable, or fabricated claims —
  store pages, READMEs, release notes, announcement posts, trailer narration.
  TRIGGER when the user asks to check, audit, or honest-check any copy, when
  writing or reviewing an announcement, and at the release gate before a store
  page goes live.
argument-hint: "[path/to/copy.md or inline copy]"
allowed-tools: Read, Glob, Grep, Bash
---

Audit the copy at **$ARGUMENTS** for honesty.

Read the file. Then go line by line through every claim and flag anything that
fails one of these tests.

---

## The Five Tests

**1. First-person experience claims**
Any sentence starting with "I", "I've", "Every time I", "I got tired of", etc.
Ask: is this verifiably true from the git history, the issue tracker, or
something the user has explicitly stated? If not, flag it.

> Bad: "The tool I got tired of rebuilding from scratch"
> Bad: "Every time I needed to fit an image, I'd rebuild the same node chain"
> OK: "Houdini's Resample COP only does Stretch" ← verifiable fact about the software

**2. Ordinal and superlative claims**
"First release", "the first of its kind", "most complete", "the only". Run
`gh release list` to verify any ordinal claim. Flag unsupported superlatives.

**3. Implied repeated personal experience**
Narrative framing like "every time", "I kept having to", "I always ended up"
implies something happened repeatedly. This is fabricated unless the user has
said so. Rephrase as a description of the problem in second or third person.

**4. Emotional/rhetorical filler**
"which feels right", "that's the way it should be", "finally", "at last" — these
add sentiment without adding information. Flag and suggest cutting.

Also reduce extra metaphors. Stock figures like "papercut", "tedious dance",
"shuffle" hide the actual mechanism — describe the literal behavior instead.
("Friction" and "pain point" are fine; they're plain industry terms.)

**5. Claims the build does not keep**
The other four tests catch invented experience. This one catches claims that
were true of the code once, or are true of part of it, and are now doing more
work than the build supports. For every claim about what the software *does*,
open the code that implements it and check the claim across its whole range —
not just the first case.

Two shapes to watch for:

- **True early, false later.** A progression described from its opening steps
  ("each level wears its own surface, brick then stone then steel") when the
  implementation only holds for the authored head and generalizes past it.
  Check the last case, not the first.
- **True when written, outgrown since.** A dial described as always climbing
  ("more choices the deeper you go") when the code caps it early and holds flat
  for the rest of the range. Find the constant; find where it stops moving.

Numbers, counts, dates, real-world references, and named external facts get
verified against a primary source, not against memory. If the copy borrows
credibility from something real — a hardware spec, a historical broadcast, an
instruction set, a call sign — the audience for that copy contains people who
know the real thing better than you do. An invented detail there costs more
than the sentence was worth.

> Bad: "32 levels, each harder than the last" when levels 13+ share one spec
> OK: "32 levels" when `MAX_LEVEL` is 32
> Fix shape: narrow the claim to what the build keeps, or change the build

---

## Output Format

List each flagged item as:

```
LINE: [quote the sentence]
PROBLEM: [which test it fails and why]
EVIDENCE: [the source, file:line, or command output that settles it]
FIX: [a replacement that says the same thing honestly, or "cut it"]
```

`EVIDENCE` is required for test-5 flags and for any factual dispute — a flag
without it is an opinion, and opinions do not survive an argument with the
person who wrote the copy.

If nothing is flagged, say so explicitly: "No issues found."

After the audit, ask the user which fixes to apply, then edit the file.

---

## When to Run This

Run it on any copy before it reaches an audience: store-page descriptions,
release notes, announcement posts, README feature lists, trailer narration.

At the release gate this audit is mandatory and covers the store page as well
as the repo — the no-fabrication rule runs all the way to the marketing copy.
A claim that survives this audit should be one you would be comfortable having
checked by someone who already knows the subject.
