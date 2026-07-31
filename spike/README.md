# Spike — Treasure Trash L0–L3

**Throwaway feasibility spike. NOT the game.** Per the studio design gate, this is the
one allowed pre-gate artifact: a spike to answer a specific risk before any real
`src/` code exists. It lives here, outside `src/`, and can be deleted once it's served
its purpose.

## The question it answers
Does the raccoon's core loop — **directional 2×3 burst + persistent trash + the
side-cell corollary** — actually feel like a good puzzle, i.e. does *"fire your mess
away from the path you still need"* read and play cleanly?

**Second question (added with the exit):** does requiring the raccoon to *leave*
sharpen that lesson or just tax it with walk-back moves? Every room's exit is placed
to forbid at least one strike or push direction — L1's forbids the down-strike, L2's
forbids shoving the can left, L3's sits in the corridor the room already taught you
to protect. If it still reads as a tax in play, that's the finding.

## Layout

| File | What it is |
|---|---|
| `rules.mjs` | **the rules.** Pure, deterministic, no DOM. One implementation, imported by everything else |
| `format.mjs` | `.tt` / `.sol` parse + serialise, LURD, glyphs |
| `solver.mjs` | exhaustive state-graph analysis: minimal par, liveness, traps |
| `verify.mjs` | the CLI that checks every claim the level files make |
| `levels/act1.tt` | the levels, as **data** |
| `levels/act1.sol` | the par solutions, as **data** |
| `index.html` | presentation + input only. Owns no rules |
| `FORMATS.md` | the spec for all of the above |

## Run
```
./run.sh 8000          # then open http://localhost:8000
```
ES modules need `http://` — opening `index.html` off the filesystem will fail loudly
rather than silently run a stale copy of the rules.

Arrows / WASD to move-strike-push · **U** undo · **R** restart · level tabs.
- **Tearing takes two presses.** Press a direction at a bag to *aim* — the fan previews
  and nothing has happened. Press the same direction again to commit. Aiming is free and
  spends no move, so you can inspect all four directions before bursting anything. Only
  the aimed direction previews, so standing between two bags no longer lights both fans
  at once. Moves and pushes remain single-press: the tear is the only irreversible verb,
  so it's the only one that asks twice.
- **Fan preview** (while aimed): pale yellow on every cell that would become trash. It
  answers *where would this land*, which has the same answer whether or not the strike is
  legal — so it is always yellow.
- **The exit refuses everything.** Trash, cans, ejected bags — none may land on it. A
  strike or push that would put something there is refused outright, so you can never
  bury your own way out.
- **Blocked** (you pressed a direction the rules refuse): the one cell *doing* the
  blocking gets a red ✕, a buzz sounds, and the HUD names what's in the way. Red is never a second opinion about the
  fan — it marks a single cell, and only once you've actually tried. A refused input
  costs no moves.

## Verify
```
node verify.mjs                          # defaults to levels/act1.tt + levels/act1.sol
node verify.mjs levels/act1.tt levels/act1.sol
```
Exit code 0 or 1. It checks, per level: solvable; **`:par` is provably minimal** (BFS
over the whole reachable graph, not an assertion); `:solve` replays to a win in exactly
par with every action's declared *kind* matching the board; the `.sol` file agrees; the
trap and distinct-solution counts match; **the exit is never occupied in any reachable
state** (the engine makes it impossible, and this proves it over the whole state graph);
and in any room with a bag, **the exit must refuse at least one action** (or it's a
walk-back tax). Plus: both formats round-trip, LURD round-trips and rejects
malformed input, and every `:solve` appears verbatim in `../levels.md` so the prose
can't drift from the data.

## Scope / omissions (deliberate)
- Raccoon only (crow pinned). No cans-as-bridges, no multi-fan interference yet.
- No compositor / RNG / audio — a spike, not the house-stack game.
- `verify.mjs` is a bespoke CLI. When this graduates to `src/`, port the checks to
  `node --test` per the house rule; the analysis in `solver.mjs` moves across as-is.
