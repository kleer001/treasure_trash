# CLEAN PROSE — what words in this repo are for

Decided 2026-08-05 for the docs. Widened 2026-08-06 to cover comments as deliberately as it
covered docs, after the first reading of it went wrong in exactly the way an unstated rule
invites. Applies to every `.md` here, every comment in `src/` and `tools/`, and every commit
message. One rule, one reason, both media — a paragraph and a `//` line are the same thing at
different sizes.

## The rule

**1. Prose does not state the rules of the game.**

No doc, comment or commit message says what a piece does, what refuses what, what the fan covers,
or how many cells a thing travels. `src/rules.js` says it. The tests pin it. `tools/verify.mjs`
proves it against the level data.

**2. Prose does not restate code.**

A sentence that says what the line below it says is a second copy with no test. That covers the
docblock spelling out a signature you can read, the comment narrating the statement it sits on,
and the one people miss — the function whose name already carries the whole sentence.

What prose is still for:

- **what a file is** — "`format.js` is the `.tt`/`.sol` parser"
- **where a thing lives** — "the rooms are `levels/act1.tt`"; a `// --- section ---` marker
- **how to run it** — `./run.sh`, `npm test`, `node tools/verify.mjs`
- **why a non-obvious decision went the way it did** — `= undefined` instead of `delete`, because
  deleting a property drops the cell into dictionary mode
- **syntax you cannot infer** — the `.tt` directives and glyph tables, since you need them to
  hand-author a level file
- **an invariant no single function can show you** — "the one place trash is laid down" is a claim
  about every other call site, and the body it sits on cannot prove it

Not behavior. Not measured counts. Not a narrated solve. Not the signature you just read.

## Why

The game is a prototype and the rules change weekly. Every sentence describing them was a **second
copy of the code** — and the copy has no tests, so it rots silently and for free.

That rot is not neutral. It costs four ways:

1. **It argues with the code.** A line like "all mess is permanent" or "nothing sprays backward"
   reads as a constraint on the next change when it was only ever a description of the last one.
   Two hands on one pencil.
2. **It puts a tax on every rules change.** Change the engine, then go find the four paragraphs
   that described the old behavior. The tax is paid on the thing we most want to be cheap:
   changing the game.
3. **It generates fake work.** Auditing prose against code, finding a stale claim, fixing the
   claim — that loop feels productive and ships nothing. The fixed sentence is more specific than
   the one it replaced, so it breaks sooner, and the audit runs again.
4. **It lies to the agent.** Most of the reading here is done by a model, and a model does not
   discount a comment against the code the way you do — it takes the sentence as ground truth and
   reasons from it. Misleading text inside code costs roughly a quarter of code-reasoning accuracy
   ([CodeCrash](https://openreview.net/forum?id=CAB0EjD9EK)), and thinking it through first wins
   back under half of that. Absent comments cost far less. An agent lives in the code; it
   only needs telling what the code cannot say.

The trigger for writing this down: a docs pass that "corrected" a stale claim about how many motion
steps a traced action reports. The correction was accurate and was still the wrong move — the
sentence should not have existed. It was deleted instead.

## What to do when you find it

**Delete it. Do not correct it.** Accuracy is not the goal; absence is. A true sentence about
behavior is a sentence that will be false later.

**The sentence is the unit, not the comment.** A block of good rationale carrying one stale clause
loses the clause and keeps the block. Do not delete a paragraph to kill a phrase.

Do not "sync the docs" after a rules change either. If there is something to sync, that is the bug
— remove it so the next change is free.

## The hard case

Some comments cite behavior *because that behavior is the reason the code is shaped as it is*. The
citation is the rationale, and deleting it leaves a claim with no support.

The test: take the citation out. If the rationale still stands, the citation was decoration and it
goes. If what is left explains nothing, put it back.

## The two exceptions, and why they are not exceptions

- **`levels.md` keeps every `:solve` string.** `verify.mjs` asserts each one appears there
  verbatim, so these are checked data, not prose. Anything the verifier proves is welcome; it
  cannot go stale without turning CI red. Everything it does not prove is a liability.
- **`GAME-SHEET.md` still describes the game.** It is the player-facing pitch, and a pitch with no
  mechanics is not a pitch. It is aimed at players, not at the next person editing `rules.js`, and
  `RELEASE-CHECKLIST.md` governs it. Keep it short and keep it honest.

The distinction underneath both: prose is fine when something checks it, or when its reader is not
holding the pencil.

## The test

Before writing a sentence, ask two things:

- **Could this become false when someone edits the code it describes?**
- **Does this tell the reader anything the code does not already say?**

Yes to the first, or no to the second, and it goes. Point at the code instead.

## Where this comes from, and when to reopen it

This is Robert Martin's line from *Clean Code* — a comment is a failure to express yourself in code
— resting on the Pragmatic Programmer's DRY, which is the part that actually bites: one fact, one
authoritative home.

John Ousterhout [disagrees, at length and in public](https://github.com/johnousterhout/aposd-vs-clean-code),
and for most codebases he is right. Comments carry what the code cannot, and a missing one costs
more than a stale one.

Two things make this repo the other case, and neither is permanent. The rules churn weekly, so the
second copy is expensive and always in season. And `rules.js` is genuinely the spec — the tests pin
it, `verify.mjs` proves it against the level data, and no contract here lives anywhere but the
code. When those stop being true, reopen this.
