# DECISIONS

**Every rule the engine plays was decided by the owner. This is where that is written down.**

One entry per change to what a piece does. `tools/gate.mjs` reads the newest entry and refuses
the build when the engine's fingerprint does not match it — so a rule cannot change without
somebody adding a line here, and the line lands in a diff.

The fingerprint is `node tools/fingerprint.mjs`: what the engine ANSWERS over every staged
meeting, not a hash of the source. A refactor keeps it; a rule change moves it.

**This file records decisions. It does not state rules** — `src/rules.js` does that, and
[`CLEAN_PROSE.md`](./CLEAN_PROSE.md) says why nothing else may. An entry says what was decided
and who decided it, in one or two lines. If you find yourself writing a specification here, it
belongs in the code.

## How to add one

1. Make the rules change and re-prove the packs (`node tools/verify.mjs`).
2. `node tools/fingerprint.mjs`
3. Add an entry at the TOP of the log below, newest first.

`decided-by:` is the person who chose it. Not the session that implemented it. A session that
cannot name the person has not been given a decision, and the honest move is to stop and ask.

---

## 2026-09-06 — a6564140aa1dac1f

**decided-by:** kleer001

A load does not shorten a roll. Weight no longer decides how far a wheeled thing travels: a
laden cart rolls its whole run, takes a knock, and is not held in place by what it carries.
Rolled back on the owner's instruction — the rule had entered through a build plan and was never
asked for. Restores nineteen rooms.

A grate takes a cart that comes to rest wholly inside it, load and all, on the same
whole-footprint rule a multi-cell piece already had.

**Before this entry the project kept no ledger.** The rules in force on this date are whatever
`src/rules.js` played, and this fingerprint is the baseline they are measured from — not a claim
that every one of them was decided deliberately.
