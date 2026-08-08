# FORMATS — Treasure Trash level & solution files

The syntax of the `.tt` and `.sol` files. **What the pieces do is not documented here — read
`src/rules.js`.** It is the module the game, the solver and the verifier all import, and it
changes faster than prose can track.

`node tools/verify.mjs` checks every claim a level file makes against that module.

---

## 1. Level file — `.tt`

Line-oriented. `;` starts a comment, `:` starts a directive, and everything inside a block —
`:grid`, `:water` or `:cart`, each closed by `:end` — is taken verbatim.

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
| `:arm` | `on`/`off` | default off. Input-layer only |
| `:par` | int | solve length. Verified, not declared |
| `:traps` | int | verified, not declared |
| `:solves` | int | verified, not declared |
| `:lead` `:tail` | int | optional. Dead travel at each end of the solve — see below |
| `:solve` | LURD | the par solution, replayed by the verifier |
| `:grid` … `:end` | glyphs | the occupant grid |
| `:water` … `:end` | `~`/`=`/`-` | optional terrain mask over the grid |
| `:cart` … `:end` | `P`/`Q`/`R`/`-` | optional cart mask over the grid |

A duplicate key or block, an unknown glyph, a non-integer where an int is wanted, or an
unclosed block throws.

### `:lead` and `:tail`

`lead` is how many actions pass before the first one that touches a piece; `tail` is how many
follow the last one. Both are measured over every shortest solve, so they are the best the
player can do, and both are walking — nothing on the board changes during either.

The verifier holds an undeclared room to a small bound at both ends. Writing the key raises the
bound for that room and turns the number into a claim, checked exactly like `:par`: a room whose
distance is the point says so, and cannot then drift.

### Glyphs

XSB-compatible on the shared subset — `#`, `@`, `$` and `+` — so a map pasted into a Sokoban
viewer renders roughly right. `.` is floor here, not a goal square.

| Glyph | Cell |
|---|---|
| `#` | wall |
| `-` | floor (canonical writer output) |
| ` ` `.` | floor (accepted aliases) |
| `@` | raccoon |
| `+` | raccoon on the exit |
| `E` | the exit |
| `$` | garbage bag |
| `C` / `c` | full can / empty can |
| `S` | bag-on-can stack |
| `W` / `w` | wheelie bin, full / empty |
| `B` / `b` | recycle bin, full / empty |
| `j` | water jug |
| `x` | spilled trash |
| `F` `G` `H` `K` `M` `N` | furniture — one letter per piece |

Rows shorter than the widest row pad with floor. There is no glyph for an occupied exit; the
writer throws rather than emit one.

### The `:water` and `:cart` masks

Terrain and cart membership are **aligned blocks laid over the same grid**, not glyphs in it,
because a cell can carry both an occupant and one of these at once.

| `:water` | |
|---|---|
| `~` | open canal |
| `=` | filled in |
| `-` (or a floor alias) | dry ground |

| `:cart` | |
|---|---|
| `P` `Q` `R` | a cart cell — one letter per cart |
| `-` (or a floor alias) | not a cart |

```
:grid                   :water                  :grid                   :cart
----                    ----                    #######                 -------
-E$-                    ----                    #--c--#                 --PP---
----                    ----                    #--$--#                 -------
----                    ~~~~                    #--@--#                 -------
-@$-                    ----                    #####E#                 -------
:end                    :end                    :end                    :end
```
*(shown side by side; in the file the blocks follow one another.)*

The reader rejects a water mask that marks a wall or the exit, or that starts the raccoon in
open water; and a cart cell that is a wall, the exit, the raccoon's start or furniture, or a
cart blob that is not exactly two cells.

### Multi-cell pieces

**A 4-connected blob of the same letter is one piece.** Two pieces shoved flush together are
told apart by writing them with two letters — hence a pool (`F G H K M N`) rather than one
glyph. The same letter in two places that do not touch is two pieces; letters carry no
meaning beyond grouping, and none across rooms.

A one-cell piece is an error. More pieces than the pool is an error, not a wrap-around.

**The writer is canonical:** it hands out pool letters in raster order of each piece's first
cell. Other orderings parse, but fail the round-trip check.

---

## 2. Solution file — `.sol`

Same grammar, `:solution` sections carrying `:moves` instead of a grid.

```
:solution L1
:label  par
:moves  uU!dr
```

### LURD, extended

| Token | Action |
|---|---|
| `l u r d` | move |
| `L U R D` | push |
| `L! U! R! D!` | pounce-tear |

`uU!dr` is four tokens. **Par is the token count**, so the solution string is the par claim.
The verifier replays each action and rejects a solution whose declared kind disagrees with
what the board actually does.

Arming does not appear here — it spends no move, so it is not an action.

---

## 3. The modules

```js
import { … } from '../src/rules.js';    // decides what is legal
import { … } from '../src/format.js';   // text ⇄ data
import { … } from '../src/stage.js';    // objects with positions
import { … } from '../src/solver.js';   // exhaustive search
```

Read the source for what each exports and what it does. `tools/verify.mjs` is the CLI:
`node tools/verify.mjs [levels/act1.tt] [levels/act1.sol]`, exit code 0 or 1.
