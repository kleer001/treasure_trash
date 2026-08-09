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
| L8 | Bin Night | 15 | `LDldL!rurrdLLdR!l` |
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

## Act 2 — the H act

Sets of three rooms, each set drawn on one **H** — two chambers joined by a neck, the one
outline family whose state spaces stay deep rather than bushy. What ships is the part of that H
the rooms use: the exit and the raccoon are sited where they leave the player the least walking,
and then every cell no solution touches is walled and the frame cropped away, so a set whose
second chamber was only ever the walk to the door comes out smaller than the H it was drawn on.
Each set gets harder in a stated way — by filling a container that was already standing there,
by adding a piece, or by rearranging the same cast. Sets are ordered by how much of the solution
optimal play can still throw away.

Ten sets, and the price is on the label: the recycle bin is in 27 of the 30 rooms. It is the most
fertile piece in the roster by a distance, and on H outlines it is close to load-bearing — of 56
candidate sets exactly one contains no bin at all. The cap on how much of one act a single piece
may take is what runs out first, and reaching ten meant raising it. `tools/act2.mjs` prints the
piece counts every run, so the cost stays visible rather than becoming the house style.

The rooms themselves are [`levels/act2.tt`](./levels/act2.tt).

| Room | Name | Par | Solve |
|---|---|---|---|
| L31 | TODO name L31 | 12 | `LLLLLdllluU!d` |
| L32 | TODO name L32 | 28 | `LLLLLdllluluurrdDRRdLullU!dDu` |
| L33 | TODO name L33 | 30 | `ulDllLldllluluurrdDrrdLullU!dDu` |
| L34 | TODO name L34 | 11 | `UurrruurrDu` |
| L35 | TODO name L35 | 17 | `UurrrddrUluuurrDu` |
| L36 | TODO name L36 | 21 | `UllUrrrrrddrUluuurrDu` |
| L37 | TODO name L37 | 14 | `uulDldRD!uullLd` |
| L38 | TODO name L38 | 17 | `UuLLdR!lllllluRdrr` |
| L39 | TODO name L39 | 21 | `rUruRrrdLrrrrULLddrU!d` |
| L40 | TODO name L40 | 16 | `RrrrrrdrrUulD!uUl` |
| L41 | TODO name L41 | 18 | `RurrRdrrdrrUulD!uUl` |
| L42 | TODO name L42 | 30 | `RrruLullDurrdL!rrRdrrdrrUulD!uUl` |
| L43 | TODO name L43 | 12 | `RurrrdLddrUl` |
| L44 | TODO name L44 | 14 | `RuLrrrrdLddrUl` |
| L45 | TODO name L45 | 29 | `RuLdlUrrrrrdLullllDrdrrrddrUl` |
| L46 | TODO name L46 | 9 | `DrrrrruRu` |
| L47 | TODO name L47 | 20 | `DrrrrruRDDldRuuuurDl` |
| L48 | TODO name L48 | 22 | `DrRdrrruuRDDldRuuuurDl` |
| L49 | TODO name L49 | 10 | `UrDrrRulll` |
| L50 | TODO name L50 | 14 | `UrrdrRulllldRu` |
| L51 | TODO name L51 | 26 | `UrrdrRurrruurDldllllllldRu` |
| L52 | TODO name L52 | 14 | `DlllllllDlluR!l` |
| L53 | TODO name L53 | 18 | `DDlllllluRllDlluR!l` |
| L54 | TODO name L54 | 20 | `DDlU!dllllluRllDlluR!l` |
| L55 | TODO name L55 | 19 | `dDrdddLluRdrUuuluRl` |
| L56 | TODO name L56 | 21 | `dDrdddLluRdrRlUuuluRl` |
| L57 | TODO name L57 | 23 | `dDrdddLluRdrRlURluuluRl` |
| L58 | TODO name L58 | 8 | `luUluRul` |
| L59 | TODO name L59 | 12 | `luURruLulDul` |
| L60 | TODO name L60 | 22 | `luURrurrrrDullllLulDul` |

`tools/metrics.mjs` scores a room. Open questions about the pack live in `TODO.md`.
