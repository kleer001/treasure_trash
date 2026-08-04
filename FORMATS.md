# FORMATS — Treasure Trash level & solution files

Two text formats and a four-module API. Everything a level file claims about itself is
checked against the rules engine by `tools/verify.mjs`; nothing is asserted by hand.
`src/rules.js` is the module the browser game, the solver and the verifier all import.

---

## 1. Level file — `.tt`

Line-oriented. A line beginning `;` is a comment, a line beginning `:` is a directive,
and everything inside a block — `:grid` or `:water`, each closed by `:end` — is taken
**verbatim**, so no map glyph can ever collide with a key.

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
| `:grid` … `:end` | glyphs | the occupants, walls and exit |
| `:water` … `:end` | `~`/`=`/`-` | optional terrain mask laid over the grid |

A duplicate key or block, an unknown glyph, a non-integer where an int is wanted, or an
unclosed block throws.

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

Water is **not** in this table. It is terrain that sits *under* an occupant, so it lives in
its own `:water` block — see below.

**Divergence to know about:** in XSB, `.` is a *goal square* and a space is floor. Treasure
Trash has no goal squares at all — the win is transformation plus egress — so `.` is free,
and we spend it on floor for doc readability. Rows shorter than the widest row pad with
floor. **There is no glyph for anything else on the exit**, because no such state exists:
the rules refuse any action that would put an object there, so the writer throws rather
than invent a glyph for the unreachable.

### The `:water` block

Water takes **anything** — a can, a bag, a bin, a couch — so a single character per cell
cannot spell it. `~` alone would have to mean "empty canal", "a can in the canal", and
"couch G in the canal" all at once. So terrain is a **second aligned block** over the same
grid, with three values, and a room that never had a canal simply omits it:

| Mask glyph | Terrain |
|---|---|
| `~` | open canal — objects rest in it, the raccoon will not |
| `=` | filled in — **floor**, and it stays floor |
| `-` (or a floor alias) | dry ground |

```
:grid                   :water
----                    ----
-E$-                    ----
----                    ----
----                    ~~~~
-@$-                    ----
----                    ----
:end                    :end
```
*(shown side by side; in the file the two blocks follow one another.)*

That costs one block, and the occupant grid gets to say what is standing in a cell and
nothing else — so `@` is the raccoon whether he is on dry ground or on a crossing he made,
and a can reads `c` wherever it has ended up. No combination of terrain and occupant needs
a glyph of its own.
The reader rejects a mask that marks a wall or the exit as water, or that starts the raccoon
in open water.

**A filled cell is terrain, not "water carrying trash".** That distinction is the whole reason
a can can be shoved across a crossing: a cell holds one occupant, so while the fill counted as
that occupant there was no room for anything else to be there. The garbage does not sit on the
hole — once it goes in, it *is* the ground, and the cell behaves like the floor it has become.

Terrain is **not static**: the jug writes new water and any fill converts it, which is why
`stateKey` encodes the (terrain, occupant) pair rather than the occupant alone.

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

- **A one-cell piece is an error.** A single-cell couch is an empty can with a different name.
- **More pieces than the pool is an error**, not a wrap-around.

**The writer is canonical:** it hands out pool letters in raster order of each piece's first
cell. A grid that letters its pieces in some other order still *parses* correctly — it just
fails the round-trip check, the same way writing floor as `.` instead of `-` does.

`stateKey` carries a **lane per multi-cell kind**, because the occupant codes alone do not
determine the board: four furniture cells in a row are one long couch or two short ones, and
the two push differently. Each lane is numbered by first appearance in raster order, so it
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
import { explain, step, applyAction, isWon, bagsLeft, fan } from '../src/rules.js';
import { parseLevelPack, toState, toGrid, parseLurd, formatLurd } from '../src/format.js';
import { analyze, replay } from '../src/solver.js';
```

**`src/rules.js`** — pure, deterministic, no DOM, no I/O.
`explain(state, dir)` is the one decision point: it returns `{ok:true, kind, next}` or
`{ok:false, reason, blame:[[x,y]…]}`. `blame` is exactly the cells that forbid the action —
the renderer paints those red, and the verifier can assert them. Nothing anywhere
re-derives legality.

**`src/format.js`** — text ⇄ data. `toState` validates at the boundary (exactly one raccoon,
exactly one exit). `toGrid` serialises any live state back to glyphs, so a mid-solve board
can be dropped into a bug report.

**`src/solver.js`** — `analyze(state)` enumerates the **entire** reachable state graph and
computes liveness exactly, returning `minMoves`, a canonical `shortestLurd`,
`shortestCount`, the `dead` set, and every `trap` (a legal action from a live state to a
dead one). This is the small-board version of what a Sokoban solver approximates with
deadlock tables — the rooms run 3 to 3,089 states, so there is no need to estimate
anything.

**`tools/verify.mjs`** — the CLI.
`node tools/verify.mjs [levels/act1.tt] [levels/act1.sol]`, exit code 0 or 1.

---

## 4. What the verifier enforces

Per pack: level and solution files round-trip through parse→format→parse unchanged, and
LURD round-trips exactly (including rejecting `u!`, `U!!`, and unknown letters).

Per level:

1. Exactly one raccoon, exactly one exit; the exit starts empty; the raccoon does not
   start on it.
2. The grid and the water mask both round-trip through the serialiser.
3. **Solvable** — a win is reachable.
4. **`:par` is provably minimal** — BFS depth to the nearest win equals the declared par.
5. **`:solve` replays to a win in exactly par actions**, with every declared kind matching.
6. The `.sol` entry agrees with the inline `:solve`.
7. `:traps` and `:solves` match the computed counts.
8. **No lethal plain move.** No plain *move* may take a live board to a dead one. Under
   the current ruleset this cannot fail, because walking writes nothing to the board and
   so cannot change a board's liveness. It is a regression guard: it fires only if some
   future verb makes a plain step alter the board — a conveyor, a trapdoor, terrain that
   carries you further than you asked.
9. **The exit is never occupied.** Across *every reachable state* of every room, the exit
   cell holds no object — checked over the whole state graph, not just the solve path.
10. **The exit refuses at least one action**, in any room containing a bag. Zero refusals
    means the exit's position forbids nothing.
11. **A room with `:arm on` declares what it teaches**, via `:teach`.
12. Every `:solve` string appears verbatim in `../levels.md`, so the prose cannot drift
    from the data.

### Refusals vs. traps

The two failure classes are counted separately:

| | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| **refusals caused by the exit** (said no at the keypress) | 0 | 2 | 12 | 12 |
| **stranding traps** (trash walls you off from a clear exit) | 0 | 0 | 1 | 2 |

A stranding trap leaves the exit clear and intact while your own trash cuts you off from
it. Those need connectivity reasoning rather than just reading the fan preview.

Current pack: 18 levels (L0–L17), 3–3,089 reachable states each, all green. The table above
is the L0–L3 snapshot it was written from and has not been re-measured since.
