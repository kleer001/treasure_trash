# SPEC-SHEET — Treasure Trash

The buildable spec — precise enough to implement from.

Authoritative ruleset: `levels.md`, and — where prose and code disagree — the engine
itself, `src/rules.mjs`, which is the single implementation every consumer imports.
File formats and the verifier's contract: `FORMATS.md`.

## Vertical slice

The smallest playable thing that proves the loop is fun.

**In:**
- Grid board, one raccoon, orthogonal step movement, no pull.
- Three object types: **garbage bag**, **metal can** (full → empty), **spilled trash**.
- Walls and floor, plus **the exit** — terrain, not an object, exactly one per room. Free
  against the object budget (still 3 of ~8).
- Pounce-tear with the 2×3 directional fan; permanent trash; the side-cell corollary.
- Full-can push (slide 1, eject bag 1 further, can becomes empty).
- **Exit protection:** any strike or push that would land trash, a can or a bag on the
  exit is refused. Enforced in `rules`, not by level design.
- **Performed refusal.** An illegal action animates and rewinds — lunge, burst, debris
  reaching the cell that won't take it, red flash on the blame cells, buzz, then the whole
  sequence reverses. No state changes and no move is spent, so the invalid overlap is a
  frame in an animation and never a board position. Scaled to the action (full sequence
  for a tear, short lunge for a shove, quick knock for a step), degrades to the short
  version on a repeat of the same mistake in the same room, and any keypress skips it.
- **Arming**, per-room, default off: in a room that introduces a piece, board-changing
  actions ask twice — first press aims and focuses the preview, second commits. Aiming is
  free, and any other direction or undo cancels. Input layer only.
- **Fan preview**, per-room, default off (`:preview on`): the four candidate directions
  from the raccoon's cell tint where their trash would land. On in L1-L3, the rooms that
  teach the fan, and off from L4. Arming focuses it to the aimed direction. Render layer
  only.
- Unlimited undo, restart, per-level par-move display.
- Stranding indicator (dead-board warning) — see *Systems* → `solver`.
- Rooms: **L0, L1, L2, L3** verified from `levels.md` and shipped as data in
  `levels/act1.tt`, plus **L4** and **L5** once cell-exact and proven solvable.
  Spine order is an open question.
- **Win condition: every bag torn open *and* the raccoon standing on the exit.** A full
  can counts as an unopened bag. The exit sign renders unlit while bags remain and lights
  when the last one tears.

**Explicitly out** (each needs its own spike before it enters):
- The crow, and any second unit.
- Bag-on-can stack (bag launch — the only bag *repositioning* verb).
- Recycle bin, wheelie bin, shopping cart, furniture polyominoes.
- Water / gaps. Any collecting, shiny, or score. Any timer. Any RNG in logic.
- Level editor, community levels, verb/skill tree, bosses, story, hazards.

## Systems

One responsibility each. Core logic is pure — no DOM, canvas, or audio reached for
from inside it.

**`rules`** — the sim. Pure functions over a board state; the whole testable half. The
API below is `src/rules.mjs`, which the game, the solver and the verifier all import.
**One implementation of the rules** — a second one drifts, and a drifted verifier
certifies nothing.

- **`explain(state, dir)` is the one decision point.** Returns `{ok: true, kind, next}`
  or `{ok: false, reason, blame}`, where `kind` ∈ `move` | `push` | `tear`, `next` is a
  fresh state, `reason` ∈ `edge` | `wall` | `trash` | `fan` | `canRoom` | `exit`, and
  `blame` is exactly the cells that forbid the action — the list the renderer paints red
  and the tests assert on. Every caller goes through it; nothing re-derives legality.
- `step(state, dir)` → the next state, or `null` if illegal. `explain` with the reason
  discarded.
- `applyAction(state, {dir, kind})` → throws unless the board produces *exactly* that
  kind. This is what makes a solution file self-checking rather than a hint: a solve that
  reaches the exit for the wrong reason fails loudly instead of quietly passing.
- `fan(bx, by, dx, dy)` → the **5** cells a tear fills: the bag's two cells perpendicular
  to the strike direction, plus the three cells one step ahead spanning perpendicular
  offsets −1, 0, +1. Nothing sprays backward; the came-from cell stays clear.
- **Two different clearance questions, two predicates** — the exit is the only cell where
  they disagree, and keeping them separate is what makes exit protection an engine
  property instead of a level-design habit:
  - `isClearFloor(s, x, y)` — *may the raccoon stand here?* In-grid, not a wall, no
    occupant. **The exit qualifies.**
  - `isOccupiable(s, x, y)` — *may an object come to rest here?* `isClearFloor` **and not
    the exit.** Trash, a shoved can and an ejected bag all test against this.
- `bagsLeft(s)` counts `BAG` and `CAN_FULL` together — a full can still holds an unopened
  bag. `atExit(s)` is the raccoon's cell being the exit. **`isWon(s) = bagsLeft(s) === 0
  && atExit(s)`.**
- `stateKey(s)` — canonical key over occupants plus the raccoon; walls and the exit are
  static. The solver's identity function, so it belongs here.
- **Where it fails loudly, and where it doesn't.** `explain` never throws on an illegal
  action — reporting *why* is its job, and the renderer needs the reason to perform the
  refusal. `step` returns `null`. The loud failures are `applyAction` (a declared kind the
  board won't produce) and `format`'s boundary validation, both of which mean a *bug in the
  data or the caller*, not a player mistake. An illegal player input is a refusal; an
  illegal declared action is a defect. Never silently no-op either.

Transitions, where the raccoon at `R` steps in direction `D` into target cell `T`
(`T = R + D`):

| Contents of `T` | Precondition | Effect | Refusal `reason` |
|---|---|---|---|
| empty floor (**incl. the exit**) | — | raccoon → `T` | — |
| off-grid | — | **refused** | `edge` |
| wall | — | **refused** | `wall` |
| spilled trash | — | **refused** (inert, permanent) | `trash` |
| bag | all 5 `fan(T, D)` cells `isOccupiable` | those 5 become trash; `T` clears; raccoon → `T` | `fan`, or `exit` if any blocker is the exit |
| full can | `T+D` and `T+2D` both `isOccupiable` | bag → `T+2D`; empty can → `T+D`; raccoon → `T` | `canRoom`, or `exit` |
| empty can | `T+D` is `isOccupiable` | can → `T+D`; raccoon → `T` | `canRoom`, or `exit` |

Because the object predicate excludes the exit, a fan or a push destination that includes
the exit is refused by the same code path that refuses a wall. An exit-caused refusal
reports `reason: 'exit'` specifically — *"you can't dump on your way out"* is a different
lesson from *"there's no room"*, and the HUD says the right one.

A refusal is not a loss: no state changes and no move is spent. The genuine soft-lock
that remains is **stranding** — positional, and `solver`'s job.

**`board`** — the state shape and the queries the engine doesn't need: dimensions, the
bag/can inventories, and HUD-facing counts. Cell access and bounds checking (`cell`,
`inGrid`, `cloneState`) live in `rules`, because the engine depends on them and one
definition beats two. Owns no rules.

**`format`** — text ⇄ data, in `src/format.mjs`. Parses level
packs, `toState` **validates at the boundary** — exactly one raccoon, exactly one exit,
every glyph known, short rows padded with floor — and `toGrid` serialises any live
state back to glyphs so a mid-solve board can be pasted into a bug report. It throws
rather than emit a glyph for an object on the exit, because no such state exists. Format
spec: `FORMATS.md`.

**`solver`** — `analyze(state)` enumerates the **entire** reachable state graph and
computes liveness exactly: forward BFS from the start, then reverse-reachability from
every winning state. Returns `minMoves`, a canonical `shortestLurd` (ties broken by
direction order), `shortestCount` (`>1` means unintended solves), the `dead` key set,
every `trap` (a legal action from a live state to a dead one) and `silentTraps` (traps
whose action is a plain move). No estimation and no node cap — the shipped rooms measure
3 / 18 / 137 / 62 / 106 / 125 / 695 / 297 / 15 / 30 / 96 / 114 / 263 reachable states (L0–L12), so this is exact where a full-size Sokoban
solver would need deadlock tables. It detects stranding at runtime and backs the test
assertion that every shipped room is solvable in its stated par. `replay(state, actions)`
walks a declared solution through `explain` and throws on the first disagreement.

**`undo`** — a stack of prior states. `explain` returning fresh states makes this a
push/pop, not a diff.

**`render`** — ordered layers via `src/compositor.js`, each `{ name, draw(ctx, frame) }`,
built in `src/layers.js`: `terrain` (floor, canal, and the exit sign — unlit while bags
remain, lit when the last one tears) → `pieces` (every occupant, the pieces in flight, the
debris of a refused burst, and the raccoon) → `guides` (fan preview, aim ring and landing
markers, the red blame cells) → `confetti`.

The split is by **what moves**, not by what it is: terrain never changes within a room,
pieces change every action, guides answer a question about the next one, and the confetti
is over a room already finished. That is what keeps a layer's `draw` a straight read of
the frame it was handed. Guides draw **above** everything, including the exit sign — Law
1.7 says a dead end must be foreseeable, and an exit trap only is if you can see where the
trash would land. The room name, move count, par and the two badges are DOM, not a canvas
pass (`src/hud.js`); text belongs in text.

The exit reads as an **emergency exit sign**: white legend and arrow on green, the arrow
pointing at the nearest board edge. Green is borrowed, not invented — ISO 3864 codes green
as *"safe condition,"* which is why ISO 7010 emergency-exit signs are white-on-green
(the US is the exception; NFPA's Life Safety Code has long permitted red too). It is the
one non-Memphis color on the board and a signal color on purpose: nothing else in the
palette is that green.

**`input`** — keyboard (arrows / WASD, `U` undo, `R` restart) and the on-screen d-pad,
translated to a direction intent (`src/input.js`). It knows nothing else: the pad is one
delegated listener over `[data-act]`, so rearranging the buttons is a markup change.

**`session`** — the play state around a board: which room, the undo stack, the move count,
and **arming**. In a room flagged `arm on`, the first press on a board-changing direction
aims (focuses the preview, spends nothing) and the second commits; any other direction or
undo cancels. Because arming lives above the rules, it can never change a par — the engine
and the solver never see the flag, and the same solution replays against an arming room and
a plain one alike. `act(dir)` returns an *event*, never a drawing: the view decides what a
refusal looks like, the session decides only what happened. Pure, so the whole thing is
driven from `tests/session.test.js` without a browser.

**`audio`** — WebAudio at the boundary (`src/audio.js`), four verbs: `unlock`, `confirm`,
`refuse`, `win`. The first three are procedural tones; the win is a sample, fired and
forgotten so it rings over the hand-over into the next room. The one place the house
"fail loudly" rule is suspended on purpose — a browser that will not make a sound must
never be a browser that will not take an input.

## Data

Levels are data, never hard-coded in logic — and the data is **canonical, the prose is
commentary**. One line-oriented text format, specified in `FORMATS.md` and carrying the
shipped pack (`levels/act1.tt`). One format, never a second: `tools/verify.mjs` checks
that every solve string and every room diagram quoted in `levels.md` appears verbatim in
the data, which is what keeps the design doc from drifting from the game.

A line beginning `;` is a comment, a line beginning `:` a directive, and everything
between `:grid` and `:end` is verbatim — so no map glyph can collide with a key.

```
:level  L3
:name   Fire Away From the Path
:teach  fire your mess away from where you still need to walk
:par    5
:traps  2
:solves 2
:solve  U!dD!ur
:grid
---
-$-
-@E
-$-
---
:end
```

`:par` is the **provably minimal** solve length, not a declaration — the verifier computes
it. `:arm on`/`off` (default off) is the per-room arming flag. A duplicate key, an unknown
glyph, a non-integer where an int is wanted, or an unclosed `:grid` is an **error**, not a
warning.

Glyphs are deliberately XSB-compatible on the shared subset, so a room pasted into a
Sokoban viewer renders roughly right:

```
#  wall    -  floor (canonical writer output; ` ` and `.` accepted as aliases)
@  raccoon    $  bag    C  full can    c  empty can    x  spilled trash
E  the exit   +  raccoon standing on the exit
```

There is **no glyph for anything else on the exit**, because no such state exists. Nor is
there entry-stub terrain: the raccoon's start cell is plain floor, and a room that wants
the entrance to read as one walls it in on either side (L1 does).

Solutions are **extended LURD**, inline in the `.tt` as `:solve`:
lowercase = move, UPPERCASE = push, UPPERCASE + `!` = pounce-tear. Sokoban's convention
has two cases because it has two action classes; Treasure Trash has three. **Par is the
token count**, so the solution string *is* the par claim, and the walk to the exit is part
of it. The kind is encoded, not just the direction, so a solve that reaches the exit for
the wrong reason is rejected on replay. Arming never appears in a solution — it spends no
move.

Coordinates: **`levels.md` and this file talk in 1-based `(1,1)` top-left**, matching the
design prose; the engine indexes cells 0-based internally. Convert at the boundary, in
`format`, and nowhere else.

Runtime state:

```js
{
  cols, rows,
  cells,            // rows of { wall, exit, o }  — o is the occupant enum
  rac: {x, y},
  moves,            // count, for par
  levelId
}
```

`wall` and `exit` are static terrain; only `o` and `rac` vary, which is why `stateKey`
hashes just those two.

## RNG & determinism

**The game logic contains no randomness at all.** No procedural generation, no
shuffles, no hidden rolls — every room is hand-authored and every outcome follows
from the player's input. `src/rng.js` (`mulberry32`) ships per the house stack and is
available for *cosmetic* use only (e.g. picking a trash sprite variant), seeded from
the level id so a room looks identical on every visit. **Never `Math.random()`.**

A "seed" therefore reproduces nothing but appearance; a *replay* is the level id plus
the move sequence, which is enough to reproduce a solve exactly.

## Tests

`tests/*.test.js`, `node --test`. Ported from `tools/verify.mjs`, which already proves
these headlessly across the whole shipped pack; `FORMATS.md` §4 is the full list. The
verifier's discipline carries over: **every claim a level file makes about itself is
checked against the engine, never asserted by hand.**

Engine unit tests:
- `fan` geometry for all four directions, including the 5-cell count and that the
  came-from cell stays clear.
- Clearance: a bag with any fan cell blocked (wall, off-grid, trash, can) is not tearable,
  and `blame` names exactly the blocking cells — never the whole fan.
- The side-cell corollary: a can adjacent to a bag blocks **every** strike direction.
- Full-can push ejects the bag one cell beyond the can and empties it.
- Permanence: no operation ever removes a trash cell.
- `isClearFloor` vs `isOccupiable` disagree on the exit and nowhere else.
- An exit-caused refusal reports `reason: 'exit'`, not the generic `fan`/`canRoom`.

Per shipped room:
- Exactly one raccoon and one exit; the exit starts empty; the raccoon does not start on
  it; the grid round-trips through the serialiser (and LURD round-trips exactly, including
  rejecting `u!`, `U!!`, and unknown letters).
- **Solvable**, and **`:par` is provably minimal** — BFS depth to the nearest win equals
  the declared par.
- `:solve` replays to a win in exactly par actions with every declared kind matching, and
  every board levels.md draws matches the level file it documents.
- `:traps` and `:solves` match the computed counts.
- **INVARIANT — the exit is never occupied**, across *every reachable state*. Not "our
  levels avoid it": the engine makes it impossible and this proves it over the whole graph.
- **LAW — the exit earns its slot.** In any room containing a bag, the exit must itself
  cause at least one refusal. Zero means its position forbids nothing — a walk-back tax,
  so move it.
- **GUARD — no lethal plain move.** No plain move may take a live board to a dead one.
  Keep it and label it honestly: under the current ruleset it **cannot fail**, because
  stepping back into the cell you just vacated is always legal, so a move never changes
  liveness. It is a regression guard that starts doing real work the day a mechanic breaks
  move-reversibility.
- A room with `arm on` declares what it teaches — arming a room that introduces nothing
  charges the player an extra press for no reason.
- Every `:solve` string appears verbatim in `levels.md`, so the prose cannot drift from
  the data.

## Open questions

Needs a spike or a playtest to answer:

1. **Room order — an owner call, not just a playtest.** The pack opens L0 → L1 → L2 → L3,
   three single-idea teaching rooms before the first real puzzle. L1 never makes you
   *choose* a direction that matters: it refuses the down-strike (the fan would bury the
   exit), but refusing is not choosing. Opening on L3 instead is the live alternative.
   Decide before the room list is wired.
2. **Is the stranding indicator a spoiler?** Telling a player the board is dead also tells
   them a move was wrong, which shortcuts the deduction some thinky players want. Consider
   an opt-out. Narrower than it was — exit protection removed the burying case, so the
   indicator now only ever fires on stranding.
3. **The title.** *Treasure* promises loot the game refuses to give. Blocks the release
   gate, not the build.
4. **Memphis at full board.** Whether flat bright color still reads as accumulating
   garbage once thirty trash cells are on screen. Answer it at the MVP gate, on a real
   board.
5. **Does one verb carry a full game?** The fan is the only real mechanic in the
   slice. If L5-style fan interference isn't deep enough, the bag-launch stack is the
   first candidate to promote out of the cut list.
6. **The crow.** Un-pinned only after the raccoon-alone game proves fun. Its powers
   are undesigned; the earlier "separation of powers" framing was unsatisfying and
   the superseded scrap-on-adjacency twist is not carried forward.
7. **Does the fan preview come off at the right room?** It runs L1-L3 and stops. L3 is
   the room where two bags light at once and the unlit corridor is the answer, so it also
   has to carry "read two fans together" in the same room it is the last time you get any
   help. If L4 lands as a cliff, the fix is to run the preview one room further, not to
   bring it back. Bears on `render`.
8. **Does the walk to the exit read as tension or as filler?** Mechanically verified, not
   felt. Cheapest test: play the pack and see whether the last move is ever a decision.
   If it is filler, the authoring law (the exit must forbid at least one direction) is the
   lever — tighten it rather than drop the exit.
