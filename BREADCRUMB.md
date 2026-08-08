fresh

## Summary

Two acts ship: Act 1 closed at 31 rooms (L0–L30), Act 2 built at 30 (L31–L60, ten sets of
three, every room an H) and shrink-wrapped. The room pipeline that produced Act 2 is in
`tools/` end to end, the game tracks progress and stars, and a dead board announces itself.

The open work is **writing**: all thirty Act 2 rooms carry `TODO name L31`-style placeholders,
and the HUD shows them to the player.

## Todos

### Parallel
- [ ] #11 **Name Act 2.** Thirty rooms need a `:name` and a `:note` in `levels/act2.tt`, and the
      matching name in the `levels.md` Act 2 table. Each room's `:note` already records which
      set it belongs to and which ramp that set uses, which is the context to write from.
      `tools/verify.mjs` does not require a name, so nothing fails today — it just reads wrong.
- [ ] #5 **A cart rolls into open water and comes to rest there.** Nothing stops it, the water
      is unchanged, and the raccoon can neither follow it nor stand on it — so a cart can be
      lost permanently, by accident, with no warning. Undesigned rather than broken. Costs
      nothing until a room holds both a canal and a cart.
- [ ] #10 **Decide the stack's fate.** `S` is last in the roster by an order of magnitude — 5.1
      solvable rooms per 1000 placements against 62.5 for every group without it, at the same
      enumeration-cap rate. It appears in no shipped Act 2 room. Cut it, or keep it as an
      expert-act piece; it will not carry an introduction.
- [ ] #12 **`tools/build-artifact.mjs` does not build**, and did not before any of this
      session's work: the win-chime `fetch` in `main.js` survives bundling and trips the tool's
      own CSP guard. The served game is unaffected; only the single-file publish path is.
- [ ] #14 **Act 2 rooms are tight now but the journeys are still long.** Shrinking removed the
      dead space; it cannot shorten the route, because walls never lower par. Walking is 80% of
      the average Act 2 solve against Act 1's 71%. Measured: the ten chosen sets average 0.19
      lines-of-work per action, the median candidate is 0.15 and the densest available is 0.24
      — but those densest sets score 1–4% `onPath`, so compactness is bought with the bite.
      `chooseSets` in `tools/pick.mjs` is where that trade would be made.
- [ ] #15 **Workers in `survey`, `harvest` and `sets` still push results in completion order**,
      so their output files reorder themselves run to run. Harmless downstream today only
      because `chooseSets` now breaks its last tie on the shape label; `tools/shrink.mjs` shows
      the fix — carry the input index through and reassemble by it.
- [ ] #13 **Render through the compositor.** `main.js` draws straight to the canvas; the house
      pattern is ordered layers via `src/compositor.js`, which the game still does not import.
      Worth doing before the art pass.

## Context

### What was built, and the one number behind each

- **The recycle bin got a terminal state.** It was the only container that never emptied, so it
  could never be an objective. It now does full→empty like the can and the wheelie (`B`/`b`),
  which puts it in `BAGS_IN`.
- **`tools/survey.mjs`** mapped which mixed piece groups make rooms at all. 586 groups, 117,200
  placements. **Homogeneous bag sets are barren** — every group whose only carrier is the loose
  bag scored at or near zero. Marginal fertility, solvable per 1000: `B` 86.6, `P` 62.0, `x`
  50.4, `j` 45.7, `$` 42.6, `F` 41.9, `w` 40.4, `c` 32.6, `W` 30.8, `C` 14.0, `S` 5.1.
- **`tools/harvest.mjs`** grew 6,651 rooms on outlines. Building rooms with walls rather than as
  open rectangles took the too-big-to-enumerate rate from 20% to 7% and roughly tripled the keep
  rate. Taylor & Parberry (GAMEON-NA 2011) reject any level holding a 3×4 clear block for making
  state spaces "very bushy, but not very deep"; that is exactly what the open 8×4 was doing.
- **`tools/score.mjs`** ranks on solution SHAPE, from the same paper: box **lines** (a run of
  shoves on one piece in one direction counts once) and box **changes** (how often the solution
  puts one piece down and picks another up). Push and move counts measure tedium, not
  difficulty. `pathBite` adds the axis Sokoban lacks — see below.
- **`tools/pick.mjs`** tightens before scoring, because `tighten` moves traps, solves and the
  graph, all scored terms. On one candidate it cut 31,012 states to 290 at the same par.
- **`tools/shapes.mjs`** enumerates outline families. Of L, U and H, **only H passes the
  open-floor rule** — an L is a rectangle minus a corner and a U minus a bite, so both leave a
  big open hall, at every size tried. 48 H variants pass; every one has a two-cell neck, which
  restricts tearing.
- **`tools/sets.mjs`** builds three-room sets sharing an outline: UPGRADE fills a container
  already standing there (`c`→`C`, `w`→`W`, `b`→`B`) so a rung adds a bag without adding a body;
  ADDITION puts a piece down; PAR rearranges one cast.
- **The solvability indicator** (`deadScan` in `src/solver.js`) walks the room's graph once when
  it opens, a slice per frame, then every move is a Set lookup. Not a worker: the artifact
  bundle inlines `src/` behind a CSP that would refuse to load one.
- **Progress** (`src/progress.js`) keeps the best run per room in `localStorage`. Three stars is
  a claim about OPTIMALITY, because par here is provably minimal; the second band is
  proportional (`≤ ceil(par × 1.25)`) so short rooms are not brutal.

- **`tools/shrink.mjs`** walls off the floor a set's solutions never touch — PER SET, since the
  three rooms share an outline and that sharing is the set. Guards are stricter than
  `tighten`'s default: par fixed, solves not up, and `onPath` must not fall. Act 2's unused
  floor went 40% to 22%, tighter than Act 1's 27%, at identical pars. Run it on
  `levels/sets.jsonl` before `tools/act2.mjs`; the sets path does NOT tighten on its own, which
  is why the first Act 2 shipped fluffy.

### The finding that shaped the design

**Losable and self-announcing pull against each other.** Of 5,578 eligible harvested rooms,
exactly ONE both lets optimal play go wrong at 15% of its steps and ends within 12 moves of the
mistake; median `onPath` is 0. This is causal: the mess is permanent, so a losable room has many
live-to-dead edges, and every dead state is still playable. It worsens with length — median
`blind` runs 27 at par 12–17 and 47 at par 30–45. Selection cannot buy its way out, which is why
the indicator is the enabling feature rather than a nicety.

### Act 2's real cost, recorded openly

The piece cap in `tools/act2.mjs` is 0.8, not a half, so the bin appears in 24 of 30 rooms. The
bin is the most fertile piece in the roster and on H outlines it is close to load-bearing: of 56
candidate sets exactly one contains no bin, and a deliberate bin-free search over 47 bin-free
fertile mixtures found that single set. Half a cap buys a 24-room act. `--maxpiece` changes it.

### Still worth trusting

- **Trap position beats trap count.** L29 shipped 17 traps all off the solution line. Score on
  `onPath` and `firstOnPath`, never on `:traps`.
- **`tighten` strips teeth if allowed to.** Its default refuses to remove a room's last trap.
- **Comparator, measured from source.** Sokoban's genre unit is ~50 rooms per set (Sasquatch I–XII);
  Microban's 155 are small one-concept rooms for beginners. Ordering is plain ascending
  difficulty. Sasquatch III is built on design symmetry — a set organised around a formal device
  has good precedent.
- **Minicosmos pairs a layout with itself plus a stone** "as a nice way of providing hints". The
  UPGRADE ramp is that device translated for a game where an extra body chokes the board.

### Data on disk

`levels/fertility.jsonl` (group map), `levels/harvest.jsonl` (6,651 rooms, every metric),
`levels/sets.jsonl` (56 candidate sets, shrunk). Re-ranking is a query over these; only a change
to what is MEASURED needs another run.

Rebuilding the act: `sets.mjs` → `shrink.mjs` → `act2.mjs`, then paste the emitted
`levels/act2.md` rows over the Act 2 table in `levels.md` (that file is scratch and gitignored —
`verify.mjs` checks `levels.md`, not it), then `node tools/verify.mjs`.

### Run it

`./run.sh`, `npm test` (222 specs), `node tools/verify.mjs` (both acts, 1,243 checks). All green.

## Next Step

Name Act 2 (#11). Thirty rooms in `levels/act2.tt`, each with a `:note` recording its set and
ramp; the same names go in the `levels.md` Act 2 table. Nothing else in the pipeline is waiting
on anything.

/home/menser/Dropbox/ai/code/treasure_trash
