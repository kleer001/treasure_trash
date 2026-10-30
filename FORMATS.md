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
| `:name` `:teach` `:note` | text | documentation |
| `:arm` | `on`/`off` | default off |
| `:gate` | `none`, `kind push\|tear\|move`, or `erase`/`wall`/`dry` then `x,y` cells | what covers the room's lesson |
| `:par` | int | solve length. Checked by `verify.mjs` |
| `:traps` | int | Checked by `verify.mjs` |
| `:solves` | int | Checked by `verify.mjs` |
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
follow the last one.

Writing the key turns the number into a claim, checked exactly like `:par`: a room whose
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

Rows shorter than the widest row pad with floor. There is no glyph for an occupied exit.

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
| `_` | covered |
| `O` | sewer grate |
| `^` `v` `<` `>` | one-way |
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

Arming does not appear here.

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
