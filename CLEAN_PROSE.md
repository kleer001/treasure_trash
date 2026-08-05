# CLEAN PROSE — why the docs don't describe the game

Decided 2026-08-05. Applies to every `.md` in this repo, every comment in `src/` and
`tools/`, and every commit message.

## The rule

**Prose does not state the rules of the game.**

No doc, comment or commit message says what a piece does, what refuses what, what the fan
covers, or how many cells a thing travels. `src/rules.js` says it. The tests pin it.
`tools/verify.mjs` proves it against the level data.

What prose is still for:

- **what a file is** — "`format.js` is the `.tt`/`.sol` parser"
- **where a thing lives** — "the rooms are `levels/act1.tt`"
- **how to run it** — `./run.sh`, `npm test`, `node tools/verify.mjs`
- **why a non-obvious decision went the way it did** — `= undefined` instead of `delete`,
  because deleting a property drops the cell into dictionary mode
- **syntax you cannot infer** — the `.tt` directives and glyph tables, since you need them
  to hand-author a level file

Not behavior. Not measured counts. Not a narrated solve.

## Why

The game is a prototype and the rules change weekly. Every sentence describing them was a **second
copy of the code** — and the copy has no tests, so it rots silently and for free.

That rot is not neutral. It costs three ways:

1. **It argues with the code.** A line like "all mess is permanent" or "nothing sprays
   backward" reads as a constraint on the next change when it was only ever a description
   of the last one. Two hands on one pencil.
2. **It puts a tax on every rules change.** Change the engine, then go find the four
   paragraphs that described the old behavior. The tax is paid on the thing we most want
   to be cheap: changing the game.
3. **It generates fake work.** Auditing prose against code, finding a stale claim, fixing
   the claim — that loop feels productive and ships nothing. The fixed sentence is more
   specific than the one it replaced, so it breaks sooner, and the audit runs again.

The trigger for writing this down: a docs pass that "corrected" a stale claim about how
many motion steps a traced action reports. The correction was accurate and was still the
wrong move — the sentence should not have existed. It was deleted instead.

## What to do when you find mechanical prose

**Delete it. Do not correct it.** Accuracy is not the goal; absence is. A true sentence
about behavior is a sentence that will be false later.

Do not "sync the docs" after a rules change either. If there is something to sync, that is
the bug — remove it so the next change is free.

## The two exceptions, and why they are not exceptions

- **`levels.md` keeps every `:solve` string.** `verify.mjs` asserts each one appears there
  verbatim, so these are checked data, not prose. Anything the verifier proves is welcome;
  it cannot go stale without turning CI red. Everything it does not prove is a liability.
- **`GAME-SHEET.md` still describes the game.** It is the player-facing pitch, and a pitch
  with no mechanics is not a pitch. It is aimed at players, not at the next person editing
  `rules.js`, and `RELEASE-CHECKLIST.md` governs it. Keep it short and keep it honest.

The distinction underneath both: prose is fine when something checks it, or when its reader
is not holding the pencil.

## The test

Before writing a sentence, ask: **could this become false when someone edits `rules.js`?**

If yes, delete it and point at the code instead.
