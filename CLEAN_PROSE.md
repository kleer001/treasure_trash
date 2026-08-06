# CLEAN PROSE

Governs every `.md` here, every comment in `src/` and `tools/`, and every commit message.
A paragraph and a `//` line are the same thing at different sizes.

## The rule

1. **Prose does not state the rules of the game.** Not what a piece does, not what refuses
   what, not how far a thing travels, not a measured count. `rules.js` decides it, the tests
   pin it, `verify.mjs` proves it against the level data.
2. **Prose does not restate code.** Not the signature above it, not the statement below it,
   not the sentence the function name already carries.

## Keep

- **what a file is** — "`format.js` is the `.tt`/`.sol` parser"
- **where a thing lives** — "the rooms are `levels/act1.tt`"; a `// --- section ---` marker
- **how to run it** — `./run.sh`, `npm test`, `node tools/verify.mjs`
- **why a non-obvious choice went that way** — `= undefined` not `delete`, because deleting a
  property drops the cell into dictionary mode
- **syntax you cannot infer** — the `.tt` directives and glyph tables
- **an invariant no single body can show** — "the one place trash is laid down" is a claim
  about every other call site

## Delete

Ask both. **Yes to the first, or no to the second, and it goes.**

- Could this become false when someone edits the code it describes?
- Does it tell the reader anything the code does not already say?

**Delete, do not correct.** Absence is the goal. A true sentence about behavior is a sentence
that will be false later. Never sync prose to a code change — if there is something to sync,
that is the bug.

**The sentence is the unit.** A block of good rationale carrying one dead clause loses the
clause, not the block.

**The citation test.** A comment may cite behavior when that behavior is the reason the code is
shaped as it is. Cut the citation: if the rationale still stands, the citation was decoration
and goes; if nothing is left standing, put it back.

## Exceptions

- **`levels.md`'s `:solve` strings** — `verify.mjs` asserts each one appears there verbatim.
  Checked data, not prose; it cannot rot without turning CI red.
- **`GAME-SHEET.md`** — the player-facing pitch, governed by `RELEASE-CHECKLIST.md`.

Prose is safe when something checks it, or when its reader is not holding the pencil.
