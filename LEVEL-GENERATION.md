# LEVEL GENERATION — Treasure Trash

How to build the next room: what the ruleset makes possible, what to select on, and the
pipeline that gets from an idea to a verified level.

Numbers come from `spike/metrics.mjs`, which replays a room through the rules engine:

```sh
cd spike && node metrics.mjs                  # the shipped pack
cd spike && node metrics.mjs levels/new.tt    # a candidate
```

`verify.mjs` asks *is this room legal?* and fails a build. `metrics.mjs` asks *is this room
worth playing?* and only prints. Nothing here is enforced — the last step is taste, and no
checker has any.

---

## 1. What the ruleset gives you

Four structural facts. Everything below is built on them.

**The floor budget is exact, and known before you place anything.** The board is monotone:
walkable ground only ever changes by amounts you can compute in advance.

| Action | Walkable cells |
|---|---|
| tear a bag | **−5**, **+2** for each of those five fan cells that lands in water |
| shove the recycle bin | **−1** on dry floor, **+1** into water |
| shove the water jug | **−1** — it turns floor into water |

A fan must be entirely free to fire, so fans never overlap and the five is always five.
Water is not floor; it is **floor you can buy**, at five fan cells a bag or one a bin. Price
a bridge as the expensive, deliberate act it is.

**Only walking leaves the board alone.** Every other verb writes to it, and almost nothing
writes back: a tear and a full-can push have no inverse at all, and an empty can returns only
if you can reach its far side. So the state graph is nearly a DAG — walking moves you *within*
a layer, everything else moves you *down* one. Generation should treat the board as a budget
being spent, not a space being navigated. (This is a fact about the graph, not about the
player: undo reverses anything. What it costs the player is covered by Law 6.)

**Each bag is a four-way choice, not a destination.** Nothing is ever pushed *to* anywhere;
the win is a transformation plus egress. A room's intent space is therefore at most `b!`
orders × `4^b` orientations, before clearance prunes it. That product — not the grid — is
the puzzle, and it is small enough to enumerate exhaustively.

**Difficulty here is made of four things:** the **order** you open bags in, the **direction**
you fire each one, the **floor budget**, and **irreversibility**. Nothing measures
distance-to-goal, because there are no goals.

---

## 2. Size the board from the pieces

Pick the piece count first, then set the floor area to fit it:

```
floor ≈ 5 × bags / 0.55
```

Small boards are a feature, not a compromise. Sampling a fixed grid and sprinkling pieces on
it produces a sparse, uncoupled, walk-heavy room almost every time — because that is what
most large boards with few pieces *are*.

Then place, in this order:

1. **The exit, against a piece.** A fan only reaches cells Chebyshev-adjacent to its bag, so
   an exit that is not adjacent to anything forbids nothing and is a pure walk-back tax. Put
   it where it kills at least one direction, by construction rather than by rejection
   sampling.
2. **The raccoon, adjacent to the first piece he must act on** — not at a random free cell.
3. **Everything else**, from the intent enumeration in §4.

---

## 3. The laws

Thresholds are **working figures** — starting points for playtest to move, not measured
optima.

**Law 1 — Rank on decisions, not par.** Par counts three different things, and only two of
them are choices. The walking component also has a floor you do not control: every container
parks the bag it produces in a cell adjacent to itself, so freeing that bag costs two
relocations before a strike is even possible. That *adjacency tax* means par measures board
geometry at least as much as puzzle content. **Metric:** `decisions` (tears + pushes). A
ladder climbs decisions; par is a tiebreak.

**Law 2 — The first move should be a choice. Target `opening = 0`.** Nothing in the ruleset
argues for a forced opening walk. If the raccoon must take *k* steps before any
board-changing action is available, those are *k* inputs the player supplies for no
information. The one exception is a walk that **branches** — where the choice of approach *is*
the first decision, as when a bag can be reached from two sides that fire it two different
ways. A forced corridor of length 4 is a tax; a fork at distance 1 is a puzzle.
**Metric:** `opening`, qualified by whether more than one distinct board-changing action is
reachable at that distance.

**Law 3 — A high `walkRatio` means the board is too big, not badly routed.** Par is provably
minimal, so *every* walking move in an optimal line is already necessary. You cannot fix
transit by re-routing; it means the pieces were placed too far apart for the board they are
on. **Metric:** `walkRatio` (plain moves per decision), read as an alarm, never as a lever.
The lever is Law 5.

**Law 4 — A multi-bag room must couple.** Not a matter of degree at the bottom end: if no
opening of bag A removes any option from bag B, the room's state space factors. It is two
one-bag rooms sharing a grid, solvable in either order, and the player is running errands.
Permanent trash is precisely the mechanism that should make coupling the default — a fan is
five cells of board that every later bag has to work around. **Metric:** `coupling` (the
fraction of legal bag openings that cost some *other* bag a direction). Reject 0 outright;
prefer high, but see Law 8 — coupling that leaves one legal intent among one *plausible*
intent is a lock, not a puzzle.

> **Water exception.** `coupling` only sees bag-on-bag interference, so a room whose first
> bag's fan *creates the route to the second* scores 0 while being maximally coupled. That is
> coupling through terrain, which is the strongest kind there is. `metrics.mjs` reports
> **`bridges`** alongside: **`coupling 0` is only a Law 4 failure when `bridges` is also 0.**

**Law 5 — Spend the floor.** The budget in §1 is exact and nothing is ever returned. A room
begins with `floor` cells and must end with at least a walkable route to the exit; any floor
left over beyond that route never participated and could be deleted without changing a single
decision. **Metric:** `slack` (free cells at the win) and `tightness` (`5×bags/floor`, dry
ground only). **Use it as a generation input, not a filter** — that is what §2 is.

**Law 6 — Bound the regret distance.** Free undo makes a trap cheap to *escape* and does
nothing to make it cheap to *diagnose*. If a room stays playable for 30 moves after it became
unwinnable, the player has to work out which of 30 moves was the mistake with no feedback
distinguishing them. The quantity to bound is the distance between the fatal action and the
moment it becomes discoverable. This is the player-side of deadlock detection: a solver
prunes a dead branch as soon as it can prove it dead, and a room owes the player the same
courtesy. **Metric:** `pm` (post-mortem — moves still playable after the room is lost).
**Target ≈ 8 at 1–2 bags, ≈ 12 at three; it scales with bag count**, because a room with more
bags has more board left over after a mistake. Reject a room whose `pm` is far above the
floor *for its own size*. Prefer this over a cap on raw trap count: trap count says how often
you can lose, `pm` says how expensive losing is to understand.

**Law 7 — Make the decoys refusals, and put one in reach immediately.** The game has two ways
to say no and they cost very differently. A **refusal** is performed and rewound, spends no
move, and states its reason — a free decoy. A **trap** is legal, silent, and costs an undo
plus the diagnosis Law 6 is about. So teach the room's rule with refusals and reserve traps
for consequences the player has been given the tools to foresee, and get the first refusal in
early while the board is still simple enough to read. This is "start near decoys" made
precise: not proximity to a tempting object, but **the shortest distance to an action the
room will refuse**. **Metric:** `firstRefusal`; target ≤ 2.

**Law 8 — Many plausible intents, one legal one.** The intent space is explicit and small
(§1). A room is interesting exactly when a good number of those tuples *look* like they
should work and exactly one does — that is the difference between a puzzle and a lock.
**Metric:** count intent tuples that survive a purely local clearance check (does each tear
look legal in isolation?) against those that survive full simulation; want a high
plausible-to-legal ratio. This subsumes what `solves = 1` buys: `solves` counts *shortest*
wins and says nothing about how many wrong answers looked right.

**Law 9 — Reject dihedral symmetry.** If any of the 8 reflections or rotations maps the start
position to itself, the mirror solve is free and the room reads as half its size.

**Law 10 — Count near-optimal solutions, not just optimal ones.** A room with one optimal
line and 400 wins at par+2 is loose, and its par is a technicality. Measure
`solves(par) / solves(≤ par+2)`.

### The metrics, and which are computed

| Metric | Meaning | Target | In `metrics.mjs` |
|---|---|---|---|
| `decisions` | tears + pushes | climb it | yes |
| `walkRatio` | plain moves per decision | ≤ 2.5, as an alarm | yes |
| `opening` | moves walked before the first decision | 0, or a branching 1 | yes |
| `tightness` | `5×bags / dry floor` | ≈ 0.55 | yes |
| `slack` | free cells left at the win | small | yes |
| `coupling` | openings that cost another bag a direction | > 0, with `bridges` | yes |
| `bridges` | water cells filled on the winning line | — | yes |
| `order` | `safe/first` (see §5) | `safe < first` | yes |
| `solves` | distinct wins at exactly par | 1, but see Law 8 | yes |
| `traps` | legal actions taking a winnable board to a lost one | some, bounded by `pm` | yes |
| `firstTrap` | moves before the earliest losable action | late | yes |
| `pm` | moves still playable after the room is lost | ≤ 8 at 1–2 bags | yes |
| `firstRefusal` | distance to the first action the room refuses | ≤ 2 | yes |
| `firstExitRefusal` | same, counting only refusals caused by the exit | early | yes |
| plausible-to-legal | Law 8 | high | **no** |
| dihedral symmetry | Law 9 | none | **no** |
| near-optimal multiplicity | Law 10 | low | **no** |

---

## 4. Generate the intent, not the layout

Sampling layouts and solving them is backwards for this game. The intent space is small and
explicit, so enumerate *that* and let the layout follow:

1. **Size the board from the pieces** (§2).
2. **Place the exit against a piece, and the raccoon against his first one** (§2).
3. **Enumerate the intents.** For each (order, orientation) tuple, ask the engine twice: does
   each tear look legal *in isolation* — the **plausible** set — and does the whole sequence
   survive simulation — the **legal** set?
4. **Keep boards where the legal set is a single tuple and the plausible set is several.**
   That is a room with one answer and a handful of convincing wrong ones (Law 8).
5. **Only now run the exhaustive solver**, for par, liveness, `pm` and the rest. It is the
   expensive step and should see few candidates.
6. **Filter on §3, then read the survivors by hand.** A searched room is verified, not
   designed. The metrics can reject a bad room; they cannot certify a good one.

Steps 1–4 target coupling and forced order directly. Layout sampling can only hope for them.

---

## 5. Signatures — pick the question, then generate to it

Every room asks some subset of exactly four questions:

| | Question | Active when |
|---|---|---|
| **O** | **Orientation** — which way do I fire this? | some bag has one legal direction at strike time, where more than one was geometrically plausible |
| **R** | **Order** — which bag first? | some bag ordering wins and another loses |
| **L** | **Relocation** — what is in the way, and where does it go? | the optimal line contains a container push |
| **P** | **Path** — will I still be able to walk, and to leave? | at least one stranding trap exists **and** slack at the win is low |

Each is computable from the state graph, so a room's **signature** — a subset of `OLRP` — is a
measurement rather than an opinion. That makes the design intent machine-checkable: **generate
to a signature.**

Four binary axes give **15 non-empty signatures**, which is a whole progression that needs no
new pieces to unlock:

- **Singletons** `O` `R` `L` `P`
- **Pairs** `OR` `OL` `OP` `RL` `RP` `LP`
- **Triples** `ORL` `ORP` `OLP` `RLP`
- **All four** `ORLP` — and probably where a genuinely new piece earns its slot rather than
  opening one.

Within a signature: an introduction (low `decisions`, arming on if it introduces a piece), two
or three rooms escalating it, then a room combining it with a signature already taught. **One
new thing per room** stays the rule — but "thing" now means a *question*, of which there are
four, rather than a *piece*.

**Reading the `order` metric.** It reports `safe/first`: how many bags can be torn first at
all, and how many of those leave a winnable board. `safe < first` is the room asking *which
one first?*; `safe === first` means order is free and the room only asks about direction. Two
limits, both worth knowing before you trust it:

- **It counts cells, not bags.** A tear always ends on its bag's cell, so for loose bags the
  two are identical — but a can or a wheelie bin can present the same bag at several cells.
- **It cannot tell "can't" from "shouldn't".** A bag whose every direction is *refused* at the
  start never enters `first`, so a room that forbids the wrong order outright scores `1/1` and
  looks orderless — while actually being the better room, since Law 7 prefers refusals to
  traps.

---

## 6. What a new piece has to earn

Every piece in the game is the same verb — *an obstacle placer with a different delivery
curve*. A seventh delivery curve adds inventory, not questions. To earn a slot, a piece has to
pass all three:

- **It adds a question, not a curve.** Either a new one on the `OLRP` axes, or it changes what
  the existing pieces are *for* — a piece that multiplies the pack is worth more than one that
  sits beside it.
- **It does not violate the pillar.** *Maximum mess, nothing gets cleaned up.* Filling a hole
  with garbage is fine; the board still only ever gets messier. Removing mess is not.
- **Its mistakes stay attributable.** Undo means nothing is truly unrecoverable, so the cost
  of a bad piece is never "you lost" — it is "you lost twenty moves ago and nothing said so."
  Measure a candidate piece by what it does to `pm` (Law 6), not by whether its actions can be
  walked back. A piece whose errors only surface late is the expensive kind, however cheap it
  looks on the object budget.
