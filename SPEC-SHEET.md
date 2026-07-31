# SPEC-SHEET — Treasure Trash

The buildable spec — precise enough to implement from. Written **after** the panel
gate clears, from what survived the review.

Authoritative ruleset: `levels.md`. Where this file and `DESIGN-BIBLE.md` disagree,
this file wins — the bible documents a superseded real-time design and is retained
as history only.

## Panel gate 🔒

**No game code until this block is filled and every concern is resolved or
consciously accepted.** See `CLAUDE.md` → "The design gate." An accepted objection
is fine; an ignored one is not.

- [x] `GAME-SHEET.md` written — rewritten 2026-07-29 to the untimed one-raccoon
      design, replacing a pitch for the superseded real-time two-animal game.
- [x] Panel convened on the pitch — 2026-07-29. Full notes: `REVIEW-LOG.md` Session 1.

- **The Shipper** — core-loop / scope concern: the item table lists **nine** object
  types; only **three** (bag, metal can, spilled trash) are verified in `spike/`.
  Wheelie-bin roll-until-wall and rigid furniture polyominoes are each a separate
  system with their own push-resolution edge cases. → **resolution: accepted, cut.**
  The slice ships on the three verified objects only. The other six are each gated
  behind their own spike and are explicitly out of the slice (see *Vertical slice*).

- **The Shipper** — second concern: L1 "Pounce" is a two-move win that, by
  `levels.md`'s own admission, "doesn't yet exercise direction/mess." The first room
  teaches nothing about the only mechanic. → **resolution: accepted.** L1 is demoted
  to an optional interaction primer; the **Act 1 spine opens on L3 "Fire Away From
  the Path"**, the smallest verified room where direction is load-bearing. Recorded
  as an open question for playtest, not a locked ordering.

- **The Critic** — meaning / cohesion concern: the game is titled *Treasure Trash*
  and the item set explicitly cuts "shiny/treasure & any collecting." Winning means
  every bag is torn open; nothing is collected or carried off. The title sells a loot
  fantasy the mechanics refuse. → **resolution: logged as an open decision, not
  resolved.** The theme the mechanics actually argue is *irreversibility* — the board
  only ever gets worse. Either a shiny returns as a real object with real rules, or
  the game is renamed. Deliberately not settled here; it does **not** block code,
  because no system depends on the title. It **does** block the release gate.

- **The Critic** — second concern: bright flat Memphis-style geometry contradicts a
  game about grime, accumulation, and permanent decay. The aesthetic says "playful
  and clean"; the mechanic says "you are ruining this alley forever."
  → **resolution: consciously accepted, 2026-07-29.** Memphis is the chosen game
  surface for now, on the owner's call, and buys legibility — the mess must read at a
  glance for the puzzle to be fair, and flat hard-edged color does that better than
  grime. Revisit at the MVP gate once a full board of trash is on screen.

- **The Archivist** — lineage / accuracy concern: the game's own documentation
  misdescribed the game. `GAME-SHEET.md` and `DESIGN-BIBLE.md` specified a real-time,
  timed, two-animal click-to-command game; `levels.md` and `spike/` implement an
  untimed one-raccoon turn-based puzzle. A panel convened on the stale pitch would
  have reviewed a game that does not exist. → **resolution: fixed, 2026-07-29.**
  `GAME-SHEET.md` rewritten to the live design; `DESIGN-BIBLE.md` marked superseded
  at its head; this file declared authoritative over the bible.

- **The Archivist** — second concern: the novelty claim. `levels.md` records
  "[searched 2026-07, no direct match]" for the additive-scatter mechanic and
  correctly caveats that the PuzzleScript and itch.io long tail is unindexed, so
  absence cannot be proven. → **resolution: accepted as written.** The caveat stays
  attached to the claim. **"Novel" and "first" are barred from all marketing copy**;
  permitted phrasing is "uncommon" or a description of the mechanic without a
  priority claim. Enforced at the release gate by the `honest-copy` skill.

- **The Superfan** (genre: turn-based "thinky" puzzle / Sokoban-family block-pusher)
  — audience / genre concern: **soft-lock is the only failure state, and nothing
  detects it.** A blocked fan refuses the strike immediately, so the strike itself is
  safe — but the real soft-lock is *positional* (L3: seal the corridor and the far bag
  is stranded) and the game stays silent about it. The player can walk many moves past
  a dead board. This genre's current audience treats that as a defect even with free
  undo. → **resolution: accepted; in slice.** The slice ships a **solvability check**
  (see *Systems* → `solver`) that runs after every state change and surfaces a
  non-blocking "this board can no longer be won" indicator. The existing
  `spike/verify.mjs` search is the basis; it already detects L3's dead state offline.

- **The Superfan** — second concern: no mastery tail. Deterministic hand-authored
  rooms with par counts give the hardcore nothing past the last room; she asked for a
  level editor and community sharing. → **resolution: overruled for the slice**, on
  the Shipper's scope objection. Levels are data (see *Data*), so an editor stays
  cheap to add later, and par-move counts ship as the mastery hook. Recorded so the
  MVP gate can revisit.

- [x] **Gate cleared — 2026-07-29. Build may begin.**

## Vertical slice

The smallest playable thing that proves the loop is fun.

**In:**
- Grid board, one raccoon, orthogonal step movement, no pull.
- Three object types: **garbage bag**, **metal can** (full → empty), **spilled trash**.
- Walls and floor. The entry stub renders distinctly but behaves as floor.
- Pounce-tear with the 2×3 directional fan; permanent trash; the side-cell corollary.
- Full-can push (slide 1, eject bag 1 further, can becomes empty).
- Fan preview on the four candidate directions from the raccoon's current cell.
- Unlimited undo, restart, per-level par-move display.
- Solvability indicator (dead-board warning).
- Rooms: **L3, L1, L2** verified from `levels.md`, plus **L4** and **L5** once
  cell-exact and proven solvable. Act 1 spine opens on L3.
- Win condition: every bag torn open.

**Explicitly out** (each needs its own spike before it enters):
- The crow, and any second unit.
- Bag-on-can stack (bag launch — the only bag *repositioning* verb).
- Recycle bin, wheelie bin, shopping cart, furniture polyominoes.
- Water / gaps. Any collecting, shiny, or score. Any timer. Any RNG in logic.
- Level editor, community levels, verb/skill tree, bosses, story, hazards.

## Systems

One responsibility each. Core logic is pure — no DOM, canvas, or audio reached for
from inside it.

**`rules`** — the sim. Pure functions over a board state; the whole testable half.
The transitions below are transcribed from the verified prototype
(`spike/verify.mjs:19–32`, all assertions passing), not restated from prose.
- `fanCells(bagPos, dir)` → the **5** cells a tear fills: the bag's two cells
  perpendicular to `dir`, plus the three cells one step ahead in `dir` spanning
  perpendicular offsets −1, 0, +1.
- `legalMoves(state)` → which of the four directions are permitted, and each one's
  kind (`step` | `tear` | `pushFull` | `pushEmpty`).
- `applyMove(state, dir)` → a **new** state. Never mutates.
- `isWon(state)` → no bags remain **and no full cans remain**. A full can still holds
  an unopened bag, so it counts toward the goal; `spike/verify.mjs` counts `BAG` and
  `CANF` together, and the shipped rule must match.
- Rejects an illegal move loudly; it does not silently no-op internally. The input
  boundary is responsible for not asking.

Transitions, where the raccoon at `R` steps in direction `D` into target cell `T`
(`T = R + D`), and `clear` means in-grid, floor, and unoccupied:

| Contents of `T` | Precondition | Effect |
|---|---|---|
| empty | — | raccoon → `T` |
| wall / off-grid | — | **illegal** |
| spilled trash | — | **illegal** (inert, permanent) |
| bag | all 5 `fanCells(T, D)` clear | those 5 cells become trash; `T` clears; raccoon → `T` |
| full can | `T+D` and `T+2D` both clear | bag → `T+2D`; empty can → `T+D`; raccoon → `T` |
| empty can | `T+D` clear | can → `T+D`; raccoon → `T` |

A blocked fan makes the tear **illegal** — the move is refused and no state changes.
It is not a loss. The genuine soft-lock is positional and is `solver`'s job.

**`board`** — state representation and queries. Parses a level's `grid` strings into
cells, exposes `at(x, y)`, bounds checks, and the bag/can inventories. Owns no rules.

**`solver`** — breadth-first search over `applyMove` for "is this board still
winnable." Answers the Superfan's dead-board concern at runtime and backs the test
assertion that every shipped room is solvable in par. Bounded by an explicit node
cap; on hitting the cap it reports `unknown`, never a guess.

**`undo`** — a stack of prior states. `applyMove` returning fresh states makes this a
push/pop, not a diff.

**`render`** — ordered layers via `src/compositor.js`, each `{ name, draw(ctx, frame) }`:
`grid` (floor/walls) → `objects` (bags, cans, trash) → `preview` (candidate fan
tint) → `raccoon` → `hud` (room name, moves, par, dead-board indicator).

**`input`** — keyboard (arrows / WASD, `U` undo, `R` restart) and the on-screen d-pad,
translated to a direction intent. Knows nothing about rules beyond asking `legalMoves`.

**`audio`** — procedural WebAudio: step, tear burst, blocked-push clunk, win.

## Data

Levels are data, never hard-coded in logic. The grid notation is **the same legend
`levels.md` documents**, so the design doc and the shipped data are one source of
truth.

```
.  floor      #  wall       _  entry stub (renders distinctly, behaves as floor)
B  bag        C  full can   c  empty can        x  spilled trash
```

```json
{
  "id": "L3",
  "name": "Fire Away From the Path",
  "par": 3,
  "start": { "x": 2, "y": 3 },
  "grid": [
    "...",
    ".B.",
    "...",
    ".B.",
    "..."
  ]
}
```

Coordinates are 1-based, `(1,1)` top-left, `x` → right, `y` ↓ down — matching
`levels.md`. The raccoon start is a separate `start` field rather than a grid glyph,
so no cell carries two meanings.

Runtime state:

```js
{
  width, height,
  cells,            // flat array of terrain + object enum per cell
  raccoon: {x, y},
  moves,            // count, for par
  levelId
}
```

## RNG & determinism

**The game logic contains no randomness at all.** No procedural generation, no
shuffles, no hidden rolls — every room is hand-authored and every outcome follows
from the player's input. `src/rng.js` (`mulberry32`) ships per the house stack and is
available for *cosmetic* use only (e.g. picking a trash sprite variant), seeded from
the level id so a room looks identical on every visit. **Never `Math.random()`.**

A "seed" therefore reproduces nothing but appearance; a *replay* is the level id plus
the move sequence, which is enough to reproduce a solve exactly.

## Tests

`tests/*.test.js`, `node --test`. Ported from `spike/verify.mjs`, which already
proves the core assertions headlessly.

- `fanCells` geometry for all four directions, including the 5-cell count and that
  the came-from cell stays clear.
- Clearance: a bag with any fan cell blocked (wall, off-grid, trash, can) is not
  tearable.
- The side-cell corollary: a can adjacent to a bag blocks **every** strike direction.
- Full-can push ejects the bag one cell beyond the can and empties it.
- Permanence: no operation ever removes a trash cell.
- **Every shipped room is solvable, and solvable in its stated par** (`solver`).
- L3's wrong strike produces a board the solver reports unwinnable.

## Open questions

Needs a spike or a playtest to answer:

1. **`levels.md` rule 3 is ambiguous and should be corrected.** It reads "Fan blocked
   → **soft-lock** (undo)", conflating two different things: a *blocked fan refuses
   the strike* (the spike's red preview — no state change, cannot lose), versus a
   *positional soft-lock* (a legal board from which some bag can never be opened).
   This spec treats them as separate; `levels.md` should be reworded to match.
2. **Room order.** Does opening on L3 rather than L1 lose players who need to learn
   the tear before they learn to aim it? Playtest.
3. **Is the dead-board indicator a spoiler?** Telling a player the board is dead also
   tells them a move was wrong, which shortcuts the deduction some thinky players
   want. Consider an opt-out.
4. **The title.** Unresolved by the panel. Blocks the release gate, not the build.
5. **Memphis at full board.** Whether flat bright color still reads as accumulating
   garbage once thirty trash cells are on screen — the Critic's objection, deferred to
   the MVP gate.
6. **Does one verb carry a full game?** The fan is the only real mechanic in the
   slice. If L5-style fan interference isn't deep enough, the bag-launch stack is the
   first candidate to promote out of the cut list.
7. **The crow.** Un-pinned only after the raccoon-alone game proves fun. Its powers
   are undesigned; the earlier "separation of powers" framing was unsatisfying and
   the superseded scrap-on-adjacency twist is not carried forward.
