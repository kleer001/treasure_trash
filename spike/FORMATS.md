# FORMATS — Treasure Trash level & solution files

Two text formats and a four-module API. Everything a level file claims about itself is
checked against the rules engine by `verify.mjs`; nothing is asserted by hand.

Design rule: **one implementation of the rules.** `rules.mjs` is imported by the browser
spike, the solver, and the verifier. A second implementation in another language would
drift, and a drifted verifier certifies nothing.

---

## 1. Level file — `.tt`

Line-oriented. A line beginning `;` is a comment, a line beginning `:` is a directive,
and everything between `:grid` and `:end` is taken **verbatim** — so no map glyph can
ever collide with a key.

```
:pack   Treasure Trash — Act 1 (raccoon only)
:format 1

:level  L1
:name   Pounce
:teach  directional pounce, the fan, permanent mess
:par    4
:traps  2
:solves 1
:solve  uU!dr
:note   The down-strike is legal and fatal — its fan buries the exit.
:grid
---
-$-
--E
#@#
:end
```

| Key | Type | Meaning |
|---|---|---|
| `:pack` `:format` | text | file-level metadata, before the first `:level` |
| `:level` | text | starts a level; the value is its id |
| `:name` `:teach` `:note` | text | documentation; never affects play |
| `:arm` | `on`/`off` | **default off.** Board-changing actions ask twice in this room — a scaffold for the room that introduces a piece. Input-only: it can never change a par |
| `:par` | int | **the provably minimal solve length.** Verified, not declared |
| `:traps` | int | count of legal actions that lead to an unwinnable board |
| `:solves` | int | count of distinct shortest solutions (`>1` = unintended solves) |
| `:solve` | LURD | the par solution, replayed by the verifier |
| `:grid` … `:end` | glyphs | the board |

A duplicate key, an unknown glyph, a non-integer where an int is wanted, or an unclosed
`:grid` is an **error**, not a warning. Validate at the boundary, fail loudly.

### Glyphs

Deliberately XSB-compatible on the shared subset — `#`, `@`, `$` and `+` mean what they
mean in every Sokoban tool, so a Treasure Trash map pasted into a Sokoban viewer renders
roughly right instead of nonsense.

| Glyph | Cell |
|---|---|
| `#` | wall |
| `-` | floor **(canonical writer output)** |
| ` ` `.` | floor (accepted aliases — a space is lost to whitespace-stripping, and `.` reads better in a markdown doc) |
| `@` | raccoon |
| `$` | garbage bag |
| `C` / `c` | full can / empty can |
| `x` | spilled trash |
| `E` | the exit |
| `+` | raccoon standing on the exit |
| `b` | recycle bin — shove it and it drops a cell of trash ahead |
| `j` | water jug — shove it and it spills a cell of water ahead |
| `F` `G` `H` `K` `M` `N` | furniture — **one letter per piece**, see below |
| `~` | water — impassable, and no object may rest in it |
| `=` | water filled with trash: a permanent bridge, walkable like floor |
| `*` | raccoon standing on a bridge |

**Divergence to know about:** in XSB, `.` is a *goal square* and a space is floor. Treasure
Trash has no goal squares at all — the win is transformation plus egress — so `.` is free,
and we spend it on floor for doc readability. Rows shorter than the widest row pad with
floor. **There is no glyph for anything else on the exit**, because no such state exists:
the rules refuse any action that would put an object there, so the writer throws rather
than invent a glyph for the unreachable. **Water is the same story with one exception:** it
is terrain carrying at most one occupant, and that occupant can only ever be trash, so `~`
and `=` are the complete set and anything else in water makes the writer throw. Note that
water is a cell *flag*, not an occupant code, because it is terrain — but unlike the wall
it is **not static**: the water jug writes new water mid-room, which is why `stateKey`
encodes the (water, occupant) pair rather than the occupant alone.

### Multi-cell pieces

Furniture is one rigid piece spanning several cells, so **its glyph names a piece, not a kind
of thing.** The rule is one line:

> **A 4-connected blob of the same letter is one piece.**

Everything else follows. Two couches shoved flush together are told apart by writing them with
two letters — that is the entire reason there is a pool (`F G H K M N`) rather than a single
furniture glyph, because `FFFF` and `FFGG` are boards that push completely differently and a
format that cannot distinguish them is a format that loses one of them. The same letter used
twice in places that do not touch is simply two pieces; letters carry no meaning beyond
grouping, and none at all across rooms.

Two things the reader enforces, loudly:

- **A one-cell piece is an error.** A single-cell couch is an empty can with a different name,
  and the game does not need two names for one behaviour.
- **More pieces than the pool is an error**, not a wrap-around. Six couches is already far more
  than a room should hold.

**The writer is canonical:** it hands out pool letters in raster order of each piece's first
cell. A grid that letters its pieces in some other order still *parses* correctly — it just
fails the round-trip check, the same way writing floor as `.` instead of `-` does.

`stateKey` carries a **second lane** for the piece partition, because the occupant codes alone
do not determine the board: four furniture cells in a row are one long couch or two short ones,
and the two push differently. The lane is numbered by first appearance in raster order, so it
keys on the partition itself and not on whichever internal ids happen to be in play.

---

## 2. Solution file — `.sol`

Same grammar, `:solution` sections carrying `:moves` instead of a grid.

```
:solution L1
:label  par
:moves  uU!dr
```

### LURD, extended

Sokoban's convention is lowercase = move, uppercase = push. Treasure Trash has a **third**
action class, so it gets a third case:

| Token | Action |
|---|---|
| `l u r d` | **move** — step onto empty floor |
| `L U R D` | **push** — shove a can (full can also ejects its bag) |
| `L! U! R! D!` | **pounce-tear** — burst a bag. The `!` is the burst, not a danger marker: with no pull, a push is every bit as permanent |

`uU!dr` = step up, tear upward, step down, step right. **Par is the token count**, so the
solution string *is* the par claim.

**Arming does not appear here.** In a room with `:arm on`, a board-changing action is
armed with one press and committed with a second — but arming changes no state and spends
no move, so it is an input-layer affordance, not an action. One `U!` token is one tear,
one `U` is one push, in an arming room and a plain one alike. The rules engine, the solver
and every par are unaffected by the flag, which is why the same solution file replays
against either.

The kind is part of the token, and the verifier replays each action against the board and
**rejects a solution whose declared kind disagrees with what actually happens**. A solution
that still reaches the exit for the wrong reason fails loudly instead of quietly passing —
that is the whole reason for encoding the kind rather than just the direction.

---

## 3. The API

```js
import { explain, step, applyAction, isWon, bagsLeft, fan } from './rules.mjs';
import { parseLevelPack, toState, toGrid, parseLurd, formatLurd } from './format.mjs';
import { analyze, replay } from './solver.mjs';
```

**`rules.mjs`** — pure, deterministic, no DOM, no I/O.
`explain(state, dir)` is the one decision point: it returns `{ok:true, kind, next}` or
`{ok:false, reason, blame:[[x,y]…]}`. `blame` is exactly the cells that forbid the action —
the renderer paints those red, and the verifier can assert them. Nothing anywhere
re-derives legality.

**`format.mjs`** — text ⇄ data. `toState` validates at the boundary (exactly one raccoon,
exactly one exit). `toGrid` serialises any live state back to glyphs, so a mid-solve board
can be dropped into a bug report.

**`solver.mjs`** — `analyze(state)` enumerates the **entire** reachable state graph and
computes liveness exactly, returning `minMoves`, a canonical `shortestLurd`,
`shortestCount`, the `dead` set, and every `trap` (a legal action from a live state to a
dead one). This is the small-board version of what a Sokoban solver approximates with
deadlock tables — the rooms run 3 to 137 states, so there is no need to estimate anything.

**`verify.mjs`** — the CLI. `node verify.mjs [levels/act1.tt] [levels/act1.sol]`, exit code
0 or 1.

---

## 4. What the verifier enforces

Per pack: level and solution files round-trip through parse→format→parse unchanged, and
LURD round-trips exactly (including rejecting `u!`, `U!!`, and unknown letters).

Per level:

1. Exactly one raccoon, exactly one exit; the exit starts empty; the raccoon does not
   start on it.
2. The grid round-trips through the serialiser.
3. **Solvable** — a win is reachable.
4. **`:par` is provably minimal** — BFS depth to the nearest win equals the declared par.
5. **`:solve` replays to a win in exactly par actions**, with every declared kind matching.
6. The `.sol` entry agrees with the inline `:solve`.
7. `:traps` and `:solves` match the computed counts.
8. **GUARD — no lethal plain move.** No plain *move* may take a live board to a dead one.
   Be honest about this one: under the current ruleset it **cannot fail**, because walking
   writes nothing to the board and so cannot change a board's liveness. It is a regression
   guard, not enforcement, and it fires only if some future verb makes a plain step alter the
   board — a conveyor, a trapdoor, terrain that carries you further than you asked. It is
   **not** an argument against irreversible mechanics: undo reverses anything, and what a
   lost board actually costs the player is how long it stays playable before saying so
   (`pm`, in `metrics.mjs`).
9. **INVARIANT — the exit is never occupied.** Across *every reachable state* of every
   room, the exit cell holds no object. Not "our levels avoid it" — the engine makes it
   impossible, and this proves it over the whole state graph.
10. **LAW — the exit earns its slot.** In any room containing a bag, the exit must itself
    refuse at least one action. Zero refusals means the exit's position forbids nothing:
    a walk-back tax, so move it.
11. **A room with `:arm on` declares what it teaches.** Arming is a scaffold for
    introducing a piece; a room that arms but teaches nothing is charging the player an
    extra press for no reason.
12. Every `:solve` string appears verbatim in `../levels.md`, so the prose cannot drift
    from the data.

### Refusals vs. traps

Protecting the exit converted a whole class of soft-lock into a refusal, which is visible
in the numbers:

| | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| **refusals caused by the exit** (said no at the keypress) | 0 | 2 | 12 | 12 |
| **stranding traps** (trash walls you off from a clear exit) | 0 | 0 | 1 | 2 |

What remains are *stranding* traps — the exit is clear and intact, but your own trash has
cut you off from it. Those need connectivity reasoning rather than just reading the fan
preview, and they are what L4 "Corner Yourself" is built around.

Current pack: 17 levels (L0–L16), 3–3,089 reachable states each, all green. The table above
is the L0–L3 snapshot it was written from and has not been re-measured since.
