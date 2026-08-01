# LEVEL GENERATION — Treasure Trash

How rooms get made, how they get grouped, and what a generator should select on.
`levels.md` is the ruleset and the room-by-room design; this is the layer above it —
the authoring theory, and the numbers that back it.

Everything numeric here is produced by `spike/metrics.mjs`, which replays each room
through the rules engine. Run it:

```sh
cd spike && node metrics.mjs            # the shipped pack
cd spike && node metrics.mjs levels/other.tt
```

`verify.mjs` asks *is this room legal?* and fails a build. `metrics.mjs` asks *is this
room worth playing?* and only prints. Nothing here is enforced, because the last step
is taste and no checker has any.

---

## 1. Why the Sokoban literature only half-ports

There is a real body of work on generating Sokoban levels, and roughly half of it
applies to us.

**What ports.** The generate-then-prove architecture: build a candidate, run an
exhaustive solver, keep it only if the solver says it is solvable, and use the solver's
optimal line as the level's par. Taylor & Parberry's generator does exactly this and
lists the criteria any such system owes — *novelty, structure, interest, controllability,
speed*. Kartal, Sohre & Guy's MCTS generator does it by simulated play, which guarantees
solvability by construction. The spike already works this way, and the fact that our
rooms are tiny means we get something those papers can only approximate: the **whole
reachable state graph**, so liveness is computed exactly rather than pattern-matched.
Their deadlock tables and our `dead` set are the same idea at different scales.

The community advice ports too, and it is blunt: a one-box level is uninteresting, two
boxes tend to be easy, three start to get interesting; a level is well-pitched when you
cannot solve it on the first try but can on the second; and the classic failure is a
level the designer loved that an optimizer reveals to have a trivial solution.

**What does not port — and this is most of it.** Every published *difficulty* feature for
Sokoban is a **box-to-goal** feature: box count, goal distance, and congestion along the
path a box must travel to its goal. Those are the three features Kartal et al. found
correlated with perceived difficulty, and all three assume an assignment problem — which
box goes to which target, and what is in the way.

**Treasure Trash has no goals.** Winning is a *transformation* (every bag torn) plus a
destination for the raccoon only. Nothing is ever pushed *to* anywhere. Goal distance has
nothing to measure and congestion has no path to measure it along. Box-line and
box-change counts — the standard "how many times does the solution turn a corner"
proxies — assume boxes that can be pushed repeatedly; our bags cannot be pushed at all,
only torn once.

So the useful features have to come from what this game actually is:

| Sokoban's difficulty is about | Ours is about |
|---|---|
| which box goes to which goal | which **order** you open bags in |
| the path a box takes | the **direction** you fire each one |
| maneuvering room around a box | the **floor budget** — free cells only ever decrease |
| reversible pushes, so you can retry in place | irreversible tears, so the state graph is nearly a DAG |

Three structural facts fall out of the ruleset and drive everything below:

1. **The board is monotone.** Trash is permanent and nothing clears it. A tear spends
   *exactly* five cells of floor (the fan must be entirely free, so there are never
   overlaps); a recycle-bin shove spends exactly one. Total floor consumption is known
   before you generate anything: `5 × bags + binPushes`.
2. **Only walking is reversible.** Measured over the shipped pack: moves 100%, tears 0%,
   full-can pushes 0%, empty-can pushes 44%. So the game is not about maneuvering — it is
   about committing in the right order and the right direction.
3. **Each bag is a 4-way choice, not a destination.** The intent space of a room with
   *b* bags is at most `b! × 4^b` (order × orientation), before clearance prunes it. That
   product, not the grid, is the puzzle.

---

## 2. What the measurements say about the pack we have

**The 14 shipped rooms are not exemplars, and nothing below treats them as one.** They are
two piles of non-reference material: L0–L6 are *teaching* rooms, deliberately kept trivial
(1–3 decisions, par 2–11) so that each introduces one piece in isolation — a good tutorial
room is a bad puzzle on purpose, so it cannot set an upper bar. L7–L13 are raw search
output selected on the wrong quantities, as the numbers below show. Neither half is a
standard to hit. The pack is the patient here; §3's laws come from the ruleset, not from
the pack.

`node spike/metrics.mjs`, on the shipped 14 rooms. `decisions` counts board-changing
actions (tears + pushes); `walkRatio` is plain moves per decision; `opening` is how many
moves you walk before the first decision is available; `tightness` is `5×bags/floor`;
`slack` is free cells left standing at the win; `coupling` is the fraction of legal bag
openings that cost some *other* bag one of its directions; `pm` (post-mortem) is how many
further moves you can play after the room is already unwinnable.

```
  id par bags decisions walkRatio opening tightness slack coupling solves traps  pm
  L0   2    0         0         ·       2         0     3        ·      1     0   0
  L1   4    1         1         3       1       0.5     5        ·      1     0   0
  L2   7    1         3      1.33       0      0.33     9        ·      1     1   6
  L3   5    2         2       1.5       0      0.67     5      0.5      2     2   7
  L4   5    2         2       1.5       0       0.5    10      0.8      1     3  11
  L5   6    1         2         2       2       0.2    18        ·      1     1   5
  L6  11    1         3      2.67       0       0.2    19        ·      1     0   0
  L7  13    3         3      3.33       3       0.6    10     0.89      1    13  17
  L8  15    2         5         2       1      0.33    18        ·      1     7  24
  L9  17    2         3      4.67       6      0.28    24      0.5      2     3  11
 L10  19    2         4      3.75       4      0.33    19        ·      1    16  32
 L11  21    3         5       3.2       2      0.42    20        0      1    34  34
 L12  23    2         4      4.75       6      0.28    25        ·      3    12  13
 L13  25    3         5         4       5      0.42    20        0      2    43  25
```

**The searched ladder is padded, not harder.** L7–L13 were selected on a rising par, few
optimal lines, and few traps. Par rises 13 → 25. `decisions` over those same seven rooms
goes 3, 5, 3, 4, 5, 4, 5 — **flat.** The twelve extra par points are almost entirely
walking: `walkRatio` climbs from a hand-authored 1.33–2.67 into 2.0–4.75, and L9 and L12
each open with **six consecutive walking moves before the player can do anything at all**.
The ladder rises in the one currency that is free to spend.

Two more things the table says:

- **L11 and L13 have `coupling` 0.** Three bags and two bags respectively, and no bag's
  opening constrains any other. Those are independent one-bag puzzles sharing a grid —
  solvable in any order, which is a checklist, not a puzzle. They are also two of the
  three longest rooms in the pack.
- **`pm` is out of control in the searched rooms.** L11 lets you keep playing for 34
  moves after the room is dead; L10, 32. The hand-authored rooms sit at 0–11. A trap you
  discover 34 moves after you caused it is not a lesson, it is a chore, and free undo does
  not fix it — you still have to work out *which* of the last 34 moves was the mistake.

**The candidate bank is the wrong shape, not just badly sorted.** Scanning all 226 rooms
in `spike/levels/bank.jsonl` with the same metrics: median `opening` 4, median `walkRatio`
3.75, median `pm` 23, `tightness` never above 0.6 and usually 0.33, `slack` median 20.
Applying §3's working targets together (`opening ≤ 2`, `walkRatio ≤ 2.5`, `pm ≤ 8`,
`decisions ≥ 4`, `coupling ≥ 0.4`) leaves **0 of 226**; relaxing to `walkRatio ≤ 3`,
`pm ≤ 12` and dropping the coupling term leaves **2**. The binding constraints are `pm`
(6/226 pass alone) and `slack ≤ 12` (5/226) — both consequences of board size. The
generator that built the bank was sampling boards far too large for their piece count, so
re-selecting from the bank cannot fix the pack. The generator has to generate differently.

> **Missing artifact.** `levels.md` describes the search that produced L7–L13 — a seeded
> generator, 24 parallel workers, 1,474 solvable candidates. **That generator is not in
> the repo.** Only `bank.jsonl` survived. Any re-run of the pack has to start by writing
> it again, which is the first concrete task below.

---

## 3. Seven laws, derived from the ruleset

Each law below is argued from what the rules *are*, not from what the pack happens to do.
Where a law needs a threshold, the threshold is a **working figure** — a starting point for
playtest to move, not a measured optimum, because we have no exemplar rooms to fit against.
The pack's numbers appear only as diagnosis.

**Law 1 — Rank on decisions, not par.** *Why:* par counts three different things — tears,
pushes, and walking — and only the first two are choices. Worse, the walking component has
a floor the designer does not control: every container parks the bag it produces in a cell
adjacent to itself, so freeing that bag costs two relocations before a strike is even
possible (the adjacency tax; it is why L6 is par 11 on three decisions). Par therefore
measures board geometry at least as much as puzzle content. *Metric:* `decisions`. *Use:*
a ladder climbs decisions; par is a tiebreak. **Diagnosis:** L7–L13's par runs 13 → 25
while decisions runs 3, 5, 3, 4, 5, 4, 5 — the ladder is flat in the only currency that
counts.

**Law 2 — The first move should be a choice. Target `opening = 0`.** *Why:* there is no
argument from the ruleset for any forced opening walk. If the raccoon must take *k* steps
before any board-changing action is available, those *k* steps are input the player supplies
with no information gained. The one legitimate exception is a walk that **branches** — where
the choice of approach *is* the first decision, as when a bag can be reached from two sides
that fire it two different ways. *Metric:* `opening`, qualified by whether more than one
distinct board-changing action is reachable at that distance. A forced corridor of length 4
is a tax; a fork at distance 1 is a puzzle. **Diagnosis:** hand-authored median 0; searched
median 4; bank median 4, and none of those walks branch. This was the instinct that started
this document and it is the cleanest single discriminator in the data.

**Law 3 — Transit is a symptom of density, not a defect of routing.** *Why:* par is
provably minimal, so **every** walking move in an optimal line is already necessary. A high
`walkRatio` therefore cannot be fixed by re-routing — it means the pieces were placed too
far apart for the board they are on. *This makes `walkRatio` a diagnostic, not a lever.*
The lever is Law 5. *Metric:* `walkRatio`, read as an alarm. **Diagnosis:** 1.33–2.67
hand-authored, 2.0–4.75 searched, bank median 3.75 — the bank's boards are simply too big
for their contents.

**Law 4 — A multi-bag room must couple. `coupling > 0`, hard.** *Why:* this one is not a
matter of degree at the bottom end. If no opening of bag A removes any option from bag B,
then the room's state space factors — it is two one-bag rooms sharing a grid, solvable in
either order with no interaction, and the player is running errands. Permanent trash is
precisely the mechanism that *should* make coupling the default: a fan is five cells of
board that later bags now have to work around. A generated room with `coupling = 0` has
thrown away the game's central mechanic. *Metric:* `coupling`. *Use:* reject 0 outright;
prefer high, but see Law 7 — coupling that leaves only one legal intent among only one
*plausible* intent is a lock, not a puzzle. **Diagnosis:** L11 (3 bags) and L13 (2 bags)
are both 0.

**Law 5 — Spend the floor. `slack` small at the win.** *Why:* the floor budget is exact
and knowable before generation. A tear consumes exactly five cells (the fan must be
entirely free, so fans never overlap), a bin shove exactly one, and nothing is ever
returned. So a room begins with `floor` cells and must end with at least a walkable route
to the exit. Any floor left over beyond that route is floor that never participated: it
could be deleted from the level without changing a single decision. *Metric:* `slack`
(free cells at the win) and `tightness` = `5×bags/floor`. *Use as a generation input, not a
filter:* **size the board from the piece count** — `floor ≈ 5×bags / 0.55` — instead of
fixing 6×6 and sprinkling. **Diagnosis:** L12 ends with 25 free cells, i.e. most of its
board was scenery; the bank's median is 20.

**Law 6 — Bound the regret distance. Working target `pm ≤ 8`.** *Why:* free undo makes a
trap cheap to *escape* and does nothing to make it cheap to *diagnose*. If the room stays
playable for 30 moves after it became unwinnable, the player must work out which of 30
moves was the mistake, with no feedback distinguishing them. The constraint is attribution,
not punishment, so the quantity to bound is the distance between the fatal action and the
moment it is discoverable. This is the player-side of deadlock detection: a solver prunes a
dead branch as soon as it can prove it dead; a room owes the player the same courtesy.
*Metric:* `pm`. *Use:* prefer this over the current cap on raw trap count — trap count says
how often you can lose, `pm` says how expensive losing is to understand. **Diagnosis:**
hand-authored 0–11, searched 11–34 (L11 and L10 at 34 and 32), bank median 23.

**Law 7 — Make the decoys refusals, and put one in reach immediately.** *Why:* the game
has two ways to say no and they cost the player very differently. A **refusal** is
performed and rewound, spends no move, and states its reason — a free decoy. A **trap** is
legal, silent, and costs an undo plus the diagnosis Law 6 is about. It follows that a room
should teach its rule with refusals and reserve traps for consequences the player has been
given the tools to foresee. It also follows that the refusal should arrive early, while the
board is still simple enough to read. *This is "start near decoys", made precise:* not
proximity to a tempting object, but **the shortest distance to an action the room will
refuse**. *Metric:* `firstRefusal`; working target ≤ 2. *And the deeper form:* a decoy is
only a decoy if it is **plausible** — see Law 8.

**Law 8 — Many plausible intents, one legal one.** *Why:* the intent space of a room is
explicit and small — at most `b!` orders × `4^b` orientations. A room is interesting
exactly when a good number of those tuples *look* like they should work and exactly one
does. That is the difference between a puzzle and a lock: a lock has one visible option, a
puzzle has several and one right. *Metric:* not yet implemented — count intent tuples that
survive a purely local clearance check (does each tear look legal in isolation?) against
those that survive full simulation. High ratio of plausible-to-legal is the target. This
subsumes what `solves = 1` was trying to buy: `solves` counts *shortest* wins and says
nothing about how many wrong answers looked right.

Two more that are not yet measured, listed so they are not forgotten:

- **Reject dihedral symmetry.** If any of the 8 reflections/rotations maps the start
  position to itself, the mirror solve is free and the room reads as half its size. L2's
  note records the exit killing exactly such a mirror by hand; it should be a filter.
- **Count near-optimal solutions, not just optimal ones.** `solves` counts wins at exactly
  par. A room with 1 optimal line and 400 wins at par+2 is loose, and its par is a
  technicality. Measure `solves(par) / solves(≤ par+2)`.

---

## 4. Generate the intent, not the layout

The bank was built by sampling layouts and solving them. For this game that is backwards,
and §2 shows what it costs: sampling a 6×6 grid and dropping two bags on it produces a
sparse, uncoupled, high-walk board almost every time, because that is what most 6×6 boards
with two bags *are*.

The ruleset hands us a better generator. Because the intent space is small and explicit —
`b!` orders × `4^b` orientations — enumerate it directly:

1. **Size the board from the pieces.** Pick `b` (and any containers), then set the floor
   area from Law 5's tightness band. Small boards are a feature; L3 is 3×5.
2. **Place the exit against a piece.** `levels.md` already establishes that a fan only
   reaches cells Chebyshev-adjacent to its bag, so an exit that is not adjacent to a piece
   forbids nothing and is a walk-back tax. Place it where it kills at least one direction,
   by construction rather than by rejection sampling.
3. **Place the raccoon adjacent to the first piece** (Law 2), not at a random free cell.
4. **Enumerate the intents.** For each (order, orientation) tuple, ask the engine twice:
   does each tear look legal *in isolation* (the plausible set), and does the whole
   sequence survive simulation (the legal set)? Keep boards where the legal set is a
   single tuple and the plausible set is several — Law 8. That is a room with one answer
   and a handful of convincing wrong ones, which is what `solves = 1` was trying to buy
   and could not, because it only ever counted the right answers.
5. **Only now run the exhaustive solver**, for par, liveness, `pm` and the rest. It is the
   expensive step and should see few candidates.
6. **Filter on §3, then read the survivors by hand.** A searched room is verified, not
   designed; the metrics can reject a bad room but cannot certify a good one.

Steps 1–4 target coupling and forced order directly. The old pipeline could only hope for
them.

---

## 5. Grouping — four questions, not one ladder

The pack currently splits into a lesson plan (L0–L6, one new piece per room) and a
difficulty ladder (L7–L13, par + 2 per room). The lesson plan runs out the moment the
pieces do, and §2 shows the ladder is measuring the wrong thing. Both problems have the
same fix: **group rooms by the question they ask, not by the piece they contain or the par
they hit.**

Every room in this game asks some subset of exactly four questions:

| | Question | Active when |
|---|---|---|
| **O** | **Orientation** — which way do I fire this? | some bag has one legal direction at strike time, where more than one was geometrically plausible |
| **R** | **Order** — which bag first? | some bag ordering wins and another loses |
| **L** | **Relocation** — what is in the way, and where does it go? | the optimal line contains a container push |
| **P** | **Path** — will I still be able to walk, and to leave? | at least one stranding trap exists **and** slack at the win is low |

Each is computable from the state graph, so a room's **signature** (a subset of `OLRP`) is
a measurement, not an opinion. That turns the caveat in `levels.md` — *"a searched room is
verified, not designed"* — into something a generator can actually chase: **generate to a
signature.** The signature *is* the design intent, and it is machine-checkable.

Reading the current pack this way:

- **L0** — none (it teaches the exit in isolation, correctly).
- **L1** `O` · **L2** `LP` · **L3** `OP` · **L4** `OP` · **L5** `L` · **L6** `LL` (the same
  question twice, which is the honest description of the wheelie bin's double relocation).
- **L7** `OR` — the strongest of the searched rooms, and the only one with real coupling
  (0.89).
- **L11, L13** — nominally `R`, but `coupling` 0 means the order question is not actually
  asked. Their signature is `L` with extra walking.

**The gap is `R`.** Order is the question this ruleset is best suited to ask — permanent
trash means an early tear can close a later bag's only direction — and almost no room asks
it. `levels.md` already wants the room ("a bag that must be opened last... a room where one
bag's fan is the only route to the other"); it is `R` in pure form, and §4's intent
enumeration finds it directly.

**The act structure that follows.** Four binary axes give 15 non-empty signatures — a
natural progression that does not depend on inventing new pieces:

- **Act 1 — singletons and the first pairs.** `O`, `L`, `P`, then `OP`, `OL`, `LP`. This is
  roughly the pack we have; it is missing `R` and `OR`.
- **Act 2 — the rest of the pairs and the triples.** `OR`, `RP`, `RL`, `OLP`, `ORP`, `ORL`,
  `RLP`.
- **Act 3 — `ORLP`.** All four at once, and probably where a genuinely new piece earns its
  slot rather than opening one.

Within a group: an introduction (low `decisions`, arming on if it introduces a piece), two
or three rooms escalating that signature, then a room that combines it with the previous
group's. One new thing per room stays the rule — but "thing" now means a *question*, of
which there are four, rather than a *piece*, of which there are eight.

---

## 6. Objects — what to add, and what not to

**First, a correction to the ledger.** `levels.md` says *"Object budget (aim ~8): bag, can
(full/empty), spilled trash = 3 used"* — that line is stale. Implemented and verified:
**bag, can, spilled trash, recycle bin, wheelie bin** = 5, plus the **bag-on-can stack**,
which is implemented and unit-tested but has no room. The exit is terrain and costs
nothing. So the budget is **5 spent of ~8, with a sixth piece built and parked**, not 3.
Fixed in `levels.md` in this change.

**The design problem with adding a seventh.** Every piece in the game is currently the same
verb: *an obstacle placer with a different delivery curve.*

| Piece | Delivery |
|---|---|
| bag | 5 cells, directional fan, one shot |
| recycle bin | 1 cell, precise, repeatable |
| full can | slides 1, ejects a bag 1 further — placer plus blocker |
| wheelie bin | rolls until stopped, dumps out the back — aimed, not placed |
| stack | launches a bag 2 — the only *repositioner* |

A seventh delivery curve adds inventory, not questions. Both remaining budgeted pieces from
the item table — furniture and the shopping cart — are *relocation* pieces with a bigger
footprint, i.e. more `L`, which is already the pack's best-served axis, and they are both
blocked on a multi-cell state-model change that the board does not currently support. That
change should wait until a room needs it, not lead.

**Recommendation: spend the next slot on water / gap, which is already reserved.**
**— Taken. Built, unit-tested, and introduced in L14 "Wet Paws" (par 7).** A cell the
raccoon cannot cross; **trash landing in it fills it, and the filled cell becomes ordinary
walkable ground.**

It is the only candidate on the table that adds a question rather than a piece:

- It is the first reason to aim a fan *at* something. Every existing piece makes the mess a
  cost; this makes it, situationally, a resource — and inverts the game's own core
  proposition on purpose, which is exactly what a mid-game piece should do.
- It multiplies the existing pieces instead of sitting beside them. A gap changes what
  every bag, can, bin and wheelie bin is *for*, so it adds design space proportional to the
  pack rather than adding one room.
- It does not violate the pillar. **You never clean anything up** — you fill a hole with
  garbage and walk over it. "Maximum mess, nothing gets cleaned up" survives intact; the
  board still only ever gets messier.
- It attacks the `P` (Path) axis, which is the second-least-served, and it makes `R`
  (Order) sharper: fill the gap too early and you have spent a fan you needed elsewhere.

**What building it settled, and two things it taught.**

*The floor-budget question* — does a filled gap count against the budget? Resolved in the
metrics: **water is not floor, it is floor you can buy**, at five cells a bag or one a bin.
`tightness` counts dry ground only, so bridging is priced honestly as an expensive,
deliberate act.

*Only a bag can bridge a canal.* This was not designed in, it fell out of the geometry, and
it kills an obvious room before anyone builds it. A water cell's only dry neighbours are the
two banks, so the cell that approaches a new bridge is the bank cell directly behind it —
and every piece except the bag **parks itself on exactly that cell**. Push the recycle bin
at a canal and it slides onto the approach and drops its trash beyond, sealing the bridge it
just built. The bag is the exception because the raccoon ends a tear standing on the *bag's*
cell, which is behind the fan, so the bridge is in front of him with nothing in between. So
the bin *can* fill water — one cell spent for one gained, the cheapest bridge in the game —
but never for its own benefit. Unit-tested, because it is the kind of rule a later refactor
would break silently.

*Water inverts two of the metrics, and they need reading together.* Trash in water **adds**
walkable ground, so `slack` counts bridges as free floor and a water room reads looser than
it is. And `coupling` only ever sees bag-on-bag interference, so L14 scores **0** while
actually being maximally coupled — its first bag's fan *creates the route to the second*.
That is coupling through terrain, which is the strongest kind there is. `metrics.mjs` now
reports **`bridges`** alongside, and the rule is: **`coupling 0` is only a Law 4 failure when
`bridges` is also 0.**

**Two calls in the other direction.**

- **The stack needs a rules change, not a level slot.** `levels.md` records the
  measurements: every solvable room built around it lands at par ~20 with 5–10 optimal
  lines and 300+ soft-locks, because both its bags pay the adjacency tax. The fix already
  proposed there — a stack whose can is *empty* underneath, costing one bag and one
  relocation instead of two — is the right one. Make it that, or leave it parked.
- **Reject one-way terrain** (a curb the raccoon can step down but not up), tempting though
  it is: it is terrain rather than an object, so it looks free against the budget. It is
  not. It breaks **move-reversibility**, and move-reversibility is what makes the "no
  silent traps" law true — a plain move currently cannot lose the room because you can
  always step back. `verify.mjs` carries a dormant guard for exactly this, and its comment
  already names ice as the mechanic that would break it. A one-way tile creates silent
  traps by construction. If it is ever wanted, it needs signposting strong enough that the
  trap is not silent, and that is a bigger cost than the piece is worth.

---

## 7. What to do next, in order

1. **Write `spike/generate.mjs`** — the missing artifact, rebuilt around §4's
   intent-first pipeline rather than layout sampling. Seeded, so a room id reproduces a
   room. (Note the house rule this does *not* violate: generation is an authoring tool run
   offline; the shipped rooms remain hand-checked deterministic data.)
2. **Build the `R` room** — the "bag that must be opened last" that `levels.md` has wanted
   since the sketches. It is the pack's clearest hole and the intent enumeration finds it.
3. **Re-cut the pack, don't patch it.** L7–L13 are padded and two of them ask nothing;
   the bank cannot supply replacements (0 of 226 pass), so they need generating, not
   re-sorting. L0–L6 keep their job — one piece each, in isolation — but they should be
   re-read against Law 2 (L5 opens with a two-step walk) and Law 7, and they are teaching
   rooms in any case, so they cannot carry the middle of an act. Assume the *puzzle* half
   of the pack is being rebuilt from scratch.
4. **Add Law 8's plausible-vs-legal count, symmetry, and near-optimal multiplicity to
   `metrics.mjs`** — the three laws that are currently argued but unmeasured.
5. **A second water room, this time a puzzle.** L14 is an introduction and behaves like
   one: two decisions, zero traps, nothing losable. The question water is *built* to ask is
   an Order question — a fan spent on the canal is a fan you cannot spend on a bag, so which
   one you bridge with, and when, is the puzzle. That room is `R` + `P`, which is precisely
   the gap §5 identifies. Build it with §4's intent enumeration.
6. **Then** a rules decision on the stack.

---

## Sources

Read at abstract and summary level — the full PDFs are not reachable from this
environment's network policy, so nothing above attributes a specific number to a paper
beyond what its abstract states.

- [Procedural Generation of Sokoban Levels](https://ianparberry.com/research/sokoban/) — Joshua Taylor & Ian Parberry, GAMEON-NA 2011. Generate-and-solve, guaranteed solvable; the *novelty / structure / interest / controllability / speed* criteria.
- [Data-Driven Sokoban Puzzle Generation with Monte Carlo Tree Search](https://ojs.aaai.org/index.php/AIIDE/article/view/12859) — Kartal, Sohre & Guy, AIIDE 2016. Generation by simulated play; the box-count / goal-distance / congestion difficulty features and the user study behind them.
- [Procedural Generation of Initial States of Sokoban](https://www.ijcai.org/proceedings/2019/0646.pdf) — IJCAI 2019.
- [Interpreting Multi-objective Evolutionary Algorithms via Sokoban Level Generation](https://arxiv.org/html/2406.10663v1) — arXiv 2406.10663.
- [Mixed-Initiative Methods for Designing Sokoban-like Puzzles](https://dekeyser.ch/puzzlescriptmis/thesis.pdf) — Kevin De Keyser. Closest to our situation: Sokoban-*like*, generalised rules, PuzzleScript.
- [How to build a good Sokoban level?](http://www.games4brains.de/sokoban-leveldesign.php) and [Some thoughts on designing Sokoban levels](https://alonso-delarte.medium.com/some-thoughts-on-designing-sokoban-levels-637fc953c0a3) — the community design advice quoted in §1.
- [Sokoban Wiki — Solver](http://sokobano.de/wiki/index.php?title=Solver) — dead fields, freeze deadlocks, PI-corral pruning; the solver-side analogue of our `dead` set.
- [Sokoban is PSPACE-complete](https://www.semanticscholar.org/paper/Sokoban-is-PSPACE-complete-Culberson/7a73f74c2943e5aafef364735302a36ee2f17b26) — Culberson. Why exhaustive analysis is a luxury of small boards and why the rooms should stay small.
