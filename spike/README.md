# Spike — Treasure Trash L0–L12

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
| `../src/format.mjs` | `.tt` parse + serialise, LURD, glyphs |
| `solver.mjs` | exhaustive state-graph analysis: minimal par, liveness, traps |
| `verify.mjs` | the CLI that checks every claim the level files make |
| `levels/act1.tt` | the levels, as **data** |
| `index.html` | presentation + input only. Owns no rules |
| `FORMATS.md` | the spec for all of the above |
| `build-artifact.mjs` | bundles the whole spike into one self-contained HTML for publishing |

## Run
```
./run.sh 8000          # then open http://localhost:8000
```
ES modules need `http://` — opening `index.html` off the filesystem will fail loudly
rather than silently run a stale copy of the rules.

Arrows / WASD to move-strike-push · **U** undo · **R** restart · level tabs.
- **Arming (`:arm on`, default off).** A room that *introduces a piece* asks twice before
  a board-changing action: press once to *aim* (the fan previews, or the can's and its
  bag's landing cells) — nothing has happened — press again to commit. On in **L1** (the
  bag) and **L2** (the can); off in L0 and L3, where one press acts, block-pusher style.
  When a room does arm it arms tears *and* pushes, because with no pull a push is exactly
  as permanent; walking is always single-press.
- **Fan preview** (while aimed): pale yellow on every cell that would become trash. It
  answers *where would this land*, which has the same answer whether or not the strike is
  legal — so it is always yellow.
- **The exit refuses everything.** Trash, cans, ejected bags — none may land on it. A
  strike or push that would put something there is refused outright, so you can never
  bury your own way out.
- **Blocked** (you pressed a direction the rules refuse): the refusal is *performed* —
  the raccoon lunges, the bag bursts, the debris reaches the cell that won't take it, that
  cell flashes red with a ✕ and buzzes, and the sequence rewinds itself. **No state
  changes and no move is spent**, so the invalid overlap is a frame in a rejection, not a
  position you have to undo out of. Afterwards the ✕ and the reason stay on screen. A
  refused shove gets a shorter version, a refused step a quick knock, and a repeat of the
  same mistake in the same room degrades to the short form. Any keypress skips it.

## Verify
```
node verify.mjs                          # defaults to levels/act1.tt
node verify.mjs levels/sketches.tt        # the retired ladder
```
Exit code 0 or 1. It checks, per level: solvable; **`:par` is provably minimal** (BFS
over the whole reachable graph, not an assertion); `:solve` replays to a win in exactly
par with every action's declared *kind* matching the board; the
trap and distinct-solution counts match; **the exit is never occupied in any reachable
state** (the engine makes it impossible, and this proves it over the whole state graph);
and in any room with a bag, **the exit must refuse at least one action** (or it's a
walk-back tax). Plus: both formats round-trip, LURD round-trips and rejects
malformed input, and every `:solve` appears verbatim in `../levels.md` so the prose
can't drift from the data.

## Publish
```
node build-artifact.mjs [out.html]      # default: ./artifact.html (gitignored)
```
Inlines the modules and the level pack into a single file, because an Artifact is one
file behind a CSP that blocks every external request. It is a **publishing** step, not a
build step — `spike/` stays the source of truth and still runs unbundled via `./run.sh`,
and the script only concatenates. It throws if a `fetch` or any module syntax survives,
since the CSP would kill either one silently.

## Scope / omissions (deliberate)
- Raccoon only (crow pinned). No cans-as-bridges, no multi-fan interference yet.
- No compositor / RNG / audio — a spike, not the house-stack game.
- `verify.mjs` is a bespoke CLI. When this graduates to `src/`, port the checks to
  `node --test` per the house rule; the analysis in `solver.mjs` moves across as-is.
