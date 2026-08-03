# SPEC-SHEET — Treasure Trash

The buildable spec — precise enough to implement from. Written from what survived
the review.

Authoritative ruleset: `levels.md`, and — where prose and code disagree — the engine
itself, `src/rules.js`, which is the single implementation every consumer imports.
File formats and the verifier's contract: `FORMATS.md`. Where this file and
`DESIGN-BIBLE.md` disagree, this file wins — the bible documents a superseded
real-time design and is retained as history only.

## Design decisions

- [x] `GAME-SHEET.md` written — rewritten 2026-07-29 to the untimed one-raccoon
      design, replacing a pitch for the superseded real-time two-animal game.
- [x] Reviewed against all four lenses — 2026-07-29.

**Scope & core loop.** The item table lists **nine** object types; only **three**
(bag, metal can, spilled trash) are verified. Wheelie-bin roll-until-wall and rigid
furniture polyominoes are each a separate system with their own push-resolution edge
cases, so the slice ships on the three verified objects and the other six are each
gated behind their own prototype (see *Vertical slice*).

L1 "Pounce" is a two-move win that, by `levels.md`'s own admission, "doesn't yet
exercise direction/mess" — the first room teaches nothing about the only mechanic.
It is demoted to an optional interaction primer, and the **Act 1 spine opens on L3
"Fire Away From the Path"**, the smallest verified room where direction is
load-bearing. An open question for playtest, not a locked ordering. — 2026-07-29

**What it's about, and where that lives in the mechanics.** The game is titled
*Treasure Trash* and the item set explicitly cuts "shiny/treasure & any collecting."
Winning means every bag is torn open; nothing is collected or carried off. The title
sells a loot fantasy the mechanics refuse, and what the mechanics actually argue is
*irreversibility* — the board only ever gets worse. Either a shiny returns as a real
object with real rules, or the game is renamed. **Deliberately unsettled.** It does
not block code, because no system depends on the title. It **does** block release.

Bright flat Memphis-style geometry contradicts a game about grime, accumulation and
permanent decay: the aesthetic says "playful and clean," the mechanic says "you are
ruining this alley forever." **Accepted anyway** — Memphis buys legibility, and the
mess must read at a glance for the puzzle to be fair, which flat hard-edged color
does better than grime. Worth revisiting once a full board of trash is on screen.
— 2026-07-29

**Lineage, and what's actually new.** The game's own documentation had misdescribed
the game: `GAME-SHEET.md` and `DESIGN-BIBLE.md` specified a real-time, timed,
two-animal click-to-command game while `levels.md` and the prototype implement an
untimed one-raccoon turn-based puzzle. Fixed 2026-07-29 — `GAME-SHEET.md` rewritten
to the live design, `DESIGN-BIBLE.md` marked superseded at its head, and this file
declared authoritative over the bible.

On novelty: `levels.md` records "[searched 2026-07, no direct match]" for the
additive-scatter mechanic and correctly caveats that the PuzzleScript and itch.io
long tail is unindexed, so absence cannot be proven. The caveat stays attached to
the claim. **"Novel" and "first" are barred from all marketing copy**; permitted
phrasing is "uncommon," or a description of the mechanic with no priority claim.
Enforced at the release gate by the `honest-copy` skill. — 2026-07-29

**The genre's players, and what they get.** Genre: turn-based "thinky" puzzle,
Sokoban-family block-pusher. **Soft-lock is the only failure state, and nothing
detects it.** A blocked fan refuses the strike immediately, so the strike itself is
safe — but the real soft-lock is *positional* (L3: seal the corridor and the far bag
is stranded) and the game stays silent about it, so the player can walk many moves
past a dead board. This genre's audience treats that as a defect even with free
undo. **In slice:** a **solvability check** (see *Systems* → `solver`) runs after
every state change and surfaces a non-blocking "this board can no longer be won"
indicator. The existing `tools/verify.mjs` search is the basis; it already detects L3's
dead state offline.

No mastery tail: deterministic hand-authored rooms with par counts give the hardcore
nothing past the last room, and a level editor with community sharing was asked for.
**Out of the slice**, on scope. Levels are data (see *Data*), so an editor stays
cheap to add later, and par-move counts ship as the mastery hook. — 2026-07-29

- [x] **Decisions recorded — 2026-07-29.**

## Post-gate ruleset changes

The ruleset moved after the decisions above — the exit became a first-class element,
arming was added, and refusal became a performed animation — which lands on two of
them. What changed, and what it does to each:

- **The exit is terrain, and it cannot be buried.** Any strike or push that would put an
  object on the exit is refused at the keypress; `src/rules.js` splits *where the
  raccoon may stand* (`isClearFloor` — the exit qualifies) from *where an object may come
  to rest* (`isOccupiable` — it does not). Win is now transformation **plus egress**.
- **The dead-board concern narrows.** Protecting the exit converted a whole
  class of soft-lock into a refusal (L1 2 traps → 0, L2 13 → 1, L3 10 → 2). What the
  solvability check must still catch is **stranding** — the exit is clear and intact but
  your own trash has cut you off from it. The resolution stands; its scope shrank, and
  the remaining case needs connectivity reasoning, not fan-reading.
- **The L1 objection is partly answered, and the room order is *not* settled.**
  L1 now teaches a real lesson — the down-strike's fan would land on the exit, so the
  room refuses it — and a new **L0 "Out"** teaches egress alone. `levels.md` records the
  Act 1 spine as **L0 → L1 → L3 → L4 → L5**; the recorded decision demoted L1 and opened
  on L3. Both are on the table; the call is open (see *Open questions*).
- **Arming (`:arm on`)** is a per-room teaching scaffold, default off, on in L1 and L2.
  It is input-layer only — it spends no move and the solver never sees it, so no flag can
  change a par. It came after the review and adds no system to the slice beyond input.

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
- Fan preview on the four candidate directions from the raccoon's current cell — on in
  every room, since a full-information puzzle owes the player that answer. Arming only
  *focuses* it to the aimed direction.
- Unlimited undo, restart, per-level par-move display.
- Stranding indicator (dead-board warning) — see *Systems* → `solver`.
- Rooms: **L0, L1, L2, L3** verified from `levels.md` and shipped as data in
  `levels/act1.tt`, plus **L4** and **L5** once cell-exact and proven solvable.
  Spine order is an open question.
- **Win condition: every bag torn open *and* the raccoon standing on the exit.** A full
  can counts as an unopened bag. The exit sign renders unlit while bags remain and lights
  when the last one tears.

**Explicitly out** (each needs its own prototype before it enters):
- The crow, and any second unit.
- Bag-on-can stack (bag launch — the only bag *repositioning* verb).
- Recycle bin, wheelie bin, shopping cart, furniture polyominoes.
- Water / gaps. Any collecting, shiny, or score. Any timer. Any RNG in logic.
- Level editor, community levels, verb/skill tree, bosses, story, hazards.

## Systems

One responsibility each. Core logic is pure — no DOM, canvas, or audio reached for
from inside it.

**`rules`** — the sim. Pure functions over a board state; the whole testable half. The
API below is the shipped engine (`src/rules.js`), which the browser,
the solver and the verifier all import; port it, don't re-derive it. **One implementation
of the rules** — a second one drifts, and a drifted verifier certifies nothing.

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

**`format`** — text ⇄ data, `src/format.js`. Parses level and solution
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
3 / 18 / 137 / 62 / 106 / 125 / 695 / 297 / 3089 / 258 / 1260 / 2626 / 1537 / 2492 reachable states (L0–L13), so this is exact where a full-size Sokoban
solver would need deadlock tables. It answers the stranding concern at runtime and backs the test
assertion that every shipped room is solvable in its stated par. `replay(state, actions)`
walks a declared solution through `explain` and throws on the first disagreement.

**`undo`** — a stack of prior states. `explain` returning fresh states makes this a
push/pop, not a diff.

**`render`** — ordered layers via `src/compositor.js`, each `{ name, draw(ctx, frame) }`:
`grid` (floor/walls) → `exit` (the sign — unlit while bags remain, lit when the last one
tears) → `objects` (bags, cans, trash) → `preview` (candidate fan tint, focused to the
aimed direction while armed) → `raccoon` → `refusal` (the lunge/burst/rewind sequence and
the red blame cells) → `hud` (room name, moves, par, refusal reason, stranding indicator).
The preview draws **above** the floor, not under it.

The exit reads as an **emergency exit sign**: white legend and arrow on green, the arrow
pointing at the nearest board edge. Green is borrowed, not invented — ISO 3864 codes green
as *"safe condition,"* which is why ISO 7010 emergency-exit signs are white-on-green
(the US is the exception; NFPA's Life Safety Code has long permitted red too). It is the
one non-Memphis color on the board and a signal color on purpose: nothing else in the
palette is that green.

**`input`** — keyboard (arrows / WASD, `U` undo, `R` restart) and the on-screen d-pad,
translated to a direction intent. Owns **arming**: in a room flagged `arm on`, the first
press on a board-changing direction aims (focuses the preview, spends nothing) and the
second commits; any other direction or undo cancels. It also owns skipping a refusal
animation. Knows nothing about rules beyond asking `explain`. Because arming lives here,
it can never change a par — the rules engine and the solver never see the flag, and the
same solution file replays against an arming room and a plain one alike.

**`audio`** — procedural WebAudio: step, tear burst, blocked-push clunk, refusal buzz,
win.

## Data

Levels are data, never hard-coded in logic — and the data is **canonical, the prose is
commentary**. Two line-oriented text formats, both specified in `FORMATS.md` and
already carrying the shipped pack (`levels/act1.tt` + `act1.sol`). One format, never a
second one: `tools/verify.mjs` checks that every solve string quoted in
`levels.md` appears verbatim in the data, which is what keeps the design doc from
drifting from the game.

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

Solutions are **extended LURD**, in `.tt` inline as `:solve` and in `.sol` as `:moves`:
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

`tests/*.test.js`, `node --test`, alongside `tools/verify.mjs`, which proves
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
  the `.sol` entry agrees with the inline `:solve`.
- `:traps` and `:solves` match the computed counts.
- **INVARIANT — the exit is never occupied**, across *every reachable state*. Not "our
  levels avoid it": the engine makes it impossible and this proves it over the whole graph.
- **LAW — the exit earns its slot.** In any room containing a bag, the exit must itself
  cause at least one refusal. Zero means its position forbids nothing — a walk-back tax,
  so move it.
- **GUARD — no lethal plain move.** No plain move may take a live board to a dead one.
  Keep it and label it honestly: under the current ruleset it **cannot fail**, because
  walking writes nothing to the board and so cannot change liveness. It is a regression
  guard that fires only if some future verb makes a plain step alter the board — a conveyor,
  a trapdoor. It is **not** an argument against irreversible mechanics: undo reverses
  anything, and what a lost board costs the player is `pm`, not this check.
- A room with `arm on` declares what it teaches — arming a room that introduces nothing
  charges the player an extra press for no reason.
- Every `:solve` string appears verbatim in `levels.md`, so the prose cannot drift from
  the data.

## Open questions

Needs a prototype or a playtest to answer:

1. **Room order — an owner call, not just a playtest.** `levels.md` runs the Act 1 spine
   **L0 → L1 → L3 → L4 → L5**; the panel demoted L1 and opened on **L3**. The panel's
   objection was that L1 taught nothing about direction, which the exit partly fixed — L1
   now refuses the down-strike because its fan would bury the exit. What's still true is
   that L1 never makes you *choose* a direction that matters, and that L0 and L1 are both
   single-idea teaching rooms in front of the first real puzzle. Decide before the room
   list is wired.
2. **Is the stranding indicator a spoiler?** Telling a player the board is dead also tells
   them a move was wrong, which shortcuts the deduction some thinky players want. Consider
   an opt-out. Narrower than it was — exit protection removed the burying case, so the
   indicator now only ever fires on stranding.
3. **The title.** Unresolved by the panel. Blocks the release gate, not the build.
4. **Memphis at full board.** Whether flat bright color still reads as accumulating
   garbage once thirty trash cells are on screen — the legibility-versus-grime
   objection, deferred until a full board is playable.
5. **Does one verb carry a full game?** The fan is the only real mechanic in the
   slice. If L5-style fan interference isn't deep enough, the bag-launch stack is the
   first candidate to promote out of the cut list.
6. **The crow.** Un-pinned only after the raccoon-alone game proves fun. Its powers
   are undesigned; the earlier "separation of powers" framing was unsatisfying and
   the superseded scrap-on-adjacency twist is not carried forward.
7. **The passive fan preview can be ambiguous.** With arming off and the raccoon between
   two bags (L3), both fans light and there's no telling which cell belongs to which
   strike. In L3 that happens to *be* the lesson — the corridor is the only unlit row —
   but it's luck, not design. If a later room misleads, the options are to preview only
   the last-moved direction or to tint the two fans differently. Bears on `render`.
8. **Does the walk to the exit read as tension or as filler?** Mechanically verified, not
   felt. Cheapest test: play the pack and see whether the last move is ever a decision.
   If it is filler, the authoring law (the exit must forbid at least one direction) is the
   lever — tighten it rather than drop the exit.
