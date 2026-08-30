# FORMATS — Treasure Trash level & solution files

The syntax of the `.tt` and `.sol` files. **What the pieces do is not documented here — read
`src/rules.js`.** It is the module the game, the solver and the verifier all import, and it
changes faster than prose can track.

`node tools/verify.mjs` checks every claim a level file makes against that module.

---

## 1. Level file — `.tt`

Line-oriented. `;` starts a comment, `:` starts a directive, and everything inside a block —
`:grid`, `:water`, `:cart` or `:hold`, each closed by `:end` — is taken verbatim.

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
| `:gate` | `none`, `kind push\|tear\|move`, or `erase`/`wall` then `x,y` cells | what covers the room's lesson, for `verify.mjs` to take away |
| `:par` | int | solve length. Verified, not declared |
| `:traps` | int | verified, not declared |
| `:solves` | int | verified, not declared |
| `:lead` `:tail` | int | optional. Dead travel at each end of the solve — see below |
| `:solve` | LURD | the par solution, replayed by the verifier |
| `:grid` … `:end` | glyphs | the occupant grid |
| `:water` … `:end` | `~`/`=`/`-` | optional terrain mask over the grid |
| `:cart` … `:end` | see below | optional cart mask over the grid |
| `:hold` … `:end` | `x,y glyphs` | optional. What a carried barrow has inside it |

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

The `:water` block carries every terrain lane, not only water — it keeps the name because the
shipped rooms spell it that way.

| `:water` | |
|---|---|
| `~` | open canal |
| `=` | filled in |
| `%` | grease |
| `T` | tar |
| `*` | broken glass |
| `_` | covered — a hazard something was laid over |
| `O` | sewer grate |
| `^` `v` `<` `>` | one-way, passable only in the direction shown |
| `-` (or a floor alias) | dry ground |

One value per cell: the block is a mask, so a cell carries exactly the lane its character names.

| `:cart` | |
|---|---|
| `P` `Q` `R` | a skateboard cell — one letter per board, two cells each |
| `u` `v` `w` | a barrow facing up — one cell each, one letter per barrow |
| `d` `e` `f` | facing down |
| `l` `m` `n` | facing left |
| `r` `s` `t` | facing right |
| `-` (or a floor alias) | not a cart |

The letters within a facing are a POOL, the way the furniture letters are: a 4-connected run of
one letter is one piece, so two barrows of the same facing standing flush need two letters
between them. The seconds are the next letters along rather than capitals, because `R` is
already a two-cell skateboard and the reader would match that first.

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

The reader rejects a terrain mask that marks a wall or the exit, or that starts the raccoon in
open water or on broken glass; and a cart cell that is a wall, the exit, the raccoon's start or
furniture, or a cart blob whose size is not the one its glyph names.

### The `:hold` list

A LIST, not a mask, and the only block that is one: what it says is not one character per cell.

A cart cell holds its cargo in the grid, and that cargo may be a barrow — `^` `v` `<` `>`, a
barrow riding in something rather than standing on its own wheel. What THAT barrow is carrying
has nowhere in the grid to go, so it is written here: one line per loaded cell, `x,y` in grid
indices (zero-based, from the top left) and then the chain from the outside in.

```
:hold
4,2 >C
:end
```

Reads as: whatever stands at (4,2) is carrying a barrow facing right, and that barrow has a
full can in it. The line is a statement ABOUT a cell the grid and the cart mask have already
settled, so it is read last.

The reader rejects a `:hold` line naming a cell off the grid, naming one twice, naming a cell
that is not a carried barrow, putting something inside a glyph that is not a barrow, or holding
a piece bigger than one cell. It also rejects a carried barrow in the grid with no cart under
it: that is cargo with nothing to be cargo in, and neither the rules nor the writer can read it
back.

### What a piece is for

Every piece on a board has to hinder: the verifier refuses a pack carrying one that neither any
shortest solve touches nor changes the room by being removed. There is no directive for an
exception, because nothing about a room makes decoration worth its cell.

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
