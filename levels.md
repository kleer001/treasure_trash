# LEVELS — Treasure Trash

Index of the shipped pack. **The rooms themselves live in
[`levels/act1.tt`](./levels/act1.tt)** — grids, masks and every declared field. This file is
not a second copy of them; it is the list, and the solve strings `tools/verify.mjs`
cross-checks against the data.

Nothing here describes what the pieces do. That is `src/rules.js`, and it moves.

Solves are extended LURD: lowercase = move, UPPERCASE = push, UPPERCASE + `!` = pounce-tear.
The token count is the par.

| Room | Name | Par | Solve |
|---|---|---|---|
| L0 | Out | 2 | `uu` |
| L1 | Pounce | 4 | `uU!dr` |
| L2 | Heavy Can | 7 | `UluRU!dl` |
| L3 | Fire Away From the Path | 5 | `U!dD!ur` |
| L4 | Right Beside the Door | 5 | `D!uuR!l` |
| L5 | Recycling Day | 6 | `luRU!dl` |
| L6 | Runaway Bin | 12 | `UluuRldR!lddd` |
| L7 | Three Bags Full | 13 | `lldR!ldD!ulluR!l` |
| L8 | Bin Night | 15 | `lDldL!rurrdLLdR!l` |
| L9 | Tight Corner | 17 | `uruullDurrddD!ulU!d` |
| L10 | Long Way Round | 19 | `uuulDddlU!drrddLruL!r` |
| L11 | Crosstown | 21 | `rrUurD!ulluuRldR!lulD!ul` |
| L12 | The Far Side | 23 | `uuuurrDdlU!ddddRruL!ruuuu` |
| L13 | Closing Time | 23 | `uuuulDdlU!ddddRU!dlllluR!l` |
| L14 | Wet Paws | 7 | `R!uuluR!l` |
| L15 | Two Crossings | 8 | `L!rR!uulL!r` |
| L16 | Wet the Landing | 6 | `UruU!ll` |
| L17 | Both Ends | 7 | `uurDR!lu` |
| L18 | Out of the Way | 6 | `ddRU!dl` |
| L19 | Nothing Else Moves It | 9 | `LdllluRR!l` |
| L20 | Out the Back | 6 | `DldRR!l` |
| L21 | Still in the Basket | 10 | `LdlUrrruL!r` |
| L22 | Load It Yourself | 5 | `uRD!ul` |
| L23 | Bin in the Basket | 6 | `uRRD!ul` |
| L24 | Jug in the Basket | 6 | `uRRD!ul` |
| L25 | No Room to Follow | 4 | `rRU!d` |
| L26 | Two Carts | 12 | `ddlUruuLD!uru` |
| L27 | Can in the Basket | 8 | `LullDR!lu` |
| L28 | Carried, Not Rolled | 10 | `ULlullDR!lu` |
| L29 | The Couch Stops It | 19 | `dlUruulLrrddlUddlU!d` |
| L30 | He Stops the Pour | 10 | `UdlluuRD!ul` |

Trap and solve counts are declared per level in `act1.tt` and verified there. Run
`node tools/verify.mjs` for the current numbers rather than reading them here.

## Provenance

L0–L6, L14–L17 were composed. L7–L13 were found: a seeded generator threw random layouts at
the rules engine, and these seven were selected on a rising par. The generator is not in the
repo; the bank of candidates it produced is, in `levels/bank.jsonl`.

`tools/metrics.mjs` scores a room. Open questions about the pack live in `TODO.md`.
