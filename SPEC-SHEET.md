# SPEC-SHEET — Treasure Trash

A sketchpad. Notes toward a build: what you're thinking, what you tried, what you
decided and why you decided it. It **supports** development and never drives it.

**Nothing here is binding.** This is not a contract, not a task list, not a
schedule, and not a mirror of the code. No section has to be filled in. Nothing on
this page blocks a commit, a refactor, or a release. The running game is the source
of truth — when the code and this page disagree, **the code is right and this page
is just old.**

Write here when thinking on the page is faster than thinking in your head, and when
you'd otherwise re-derive the same decision in three months. Then close it and go
build.

## How to work it

- **Don't sync it.** Reconciling the spec to the code is not work — it is the
  appearance of work. Ship the change; leave the page stale.
- **Rewrite a section only when the old note actively misleads you**, not because
  the implementation moved.
- **A stale note is not a defect**, and finding one is not a reason to stop what
  you're doing. Fix it if it's in your way; otherwise ignore it.
- **Delete freely.** A section you never used is noise. A decision that's now
  obvious in the code doesn't need a paragraph.
- **Use the headings you want** and cut the rest. They're prompts, not a schema.
- If you ever find yourself building something *because the spec sheet says so*,
  the spec sheet is wrong. Build what the game needs and change the page after — or
  don't.

## Design decisions

What you settled on, in your own voice: what the design does, and why. Written from
the playable slice, once it plays. Write it so it still makes sense to someone who
was not in the room — that's the whole point of the section, and the only reason it
earns its space.

- **Scope & core loop:** _…_
- **What it's about, and where that lives in the mechanics:** _…_
- **Lineage, and what's actually new:** _…_
- **The genre's players, and what they get:** _…_
- **Direction** — keep going / re-scope / pivot / shelve: _…_

## Vertical slice

The smallest playable thing that proves the loop is fun. What's in; what you're
deliberately not doing yet. An aim, not a commitment.

## Systems

Whatever's worth writing down: what a system does, its inputs and outputs, the data
it owns. Sketch the ones you're still figuring out; skip the ones the code already
explains.

## Data

Key data shapes — the ones you keep having to look up.

## RNG & determinism

What's seeded and what a seed reproduces. House rule (this one *is* a rule, and it
lives in `CLAUDE.md`, not here): `mulberry32`, never `Math.random()` in game logic.

## The fertility survey

`tools/survey.mjs` samples 200 random placements of every legal group of four pieces on an
8×4, and writes one row per group to `levels/fertility.jsonl`. It answers one question —
which mixtures of the roster make rooms at all — and it is a map, not a source of levels.

Run: 586 groups, 117,200 placements, 74 minutes on 30 workers. 4,783 solvable, 907 that
also clear par ≥ 12, ≤ 2 shortest solves and ≥ 1 trap. 289 groups never yielded a single
solvable room.

**Homogeneous bag sets are barren.** Every group whose only carrier is the loose bag —
`$$$$` through `$$$P` — came in at or near zero. The roster, not the box count, is where
the rooms are. That is the assumption the survey was built to test, and it does not hold
here.

**Marginal fertility, per 1000 placements of every group containing the piece:**

| piece | solvable | interesting |
|---|---|---|
| `B` full recycle bin | 86.6 | 14.5 |
| `P` cart | 62.0 | 11.5 |
| `x` spilled trash | 50.4 | 9.1 |
| `j` water jug | 45.7 | 9.0 |
| `$` bag | 42.6 | 9.7 |
| `F` couch | 41.9 | 8.4 |
| `w` empty wheelie | 40.4 | 8.2 |
| `c` empty can | 32.6 | 6.2 |
| `W` wheelie | 30.8 | 7.6 |
| `C` full can | 14.0 | 4.2 |
| `S` bag-on-can stack | 5.1 | 1.0 |

**The stack is the barren one, by an order of magnitude.** 5.1 against 62.5 for every group
without it — and not a measurement artifact: stack groups hit the enumeration cap at 21%,
against 19% for the rest, so they were not discarded more often, they simply do not make
rooms. Its best group manages 5 interesting rooms in 200.

**The cart earns its cost.** Second most fertile piece in the roster. It multiplies the
state graph, but the rooms are there.

**What the map cannot see.** 19.8% of placements exceeded the 50,000-state enumeration
bound and were counted rather than analysed. Fertility is flat across the groups that hit
that bound 0–39% of the time (43.8, 43.4 and 42.2 solvable per 1000), so the ranking is not
an artifact of the cap; only the 63 groups above 40% fall off, and those are the loosest
boards in the set. Sampling is random placement on an open rectangle: nothing here says
anything about outlines, and walls are the untested axis.

## The harvest, and the wall it hit

`tools/harvest.mjs` samples the groups the map calls fertile, builds them on OUTLINES rather
than open rectangles, and stores every metric per room to `levels/harvest.jsonl`.
`tools/score.mjs` ranks that file, so changing the weights is a query and not another run.

Two metrics come from Taylor & Parberry (GAMEON-NA 2011). **Box lines** — a run of shoves on
one piece in one direction counts once — is the one they find tracks difficulty; **box
changes** — how often the solution puts one piece down and picks another up — they suspect is
better still. Both are indifferent to walking, which is the point: push and move counts
measure tedium, not difficulty.

The same paper's structural rejects apply here, and one of them was load-bearing. A room
holding a 3×4 clear block has "very bushy, but not very deep state spaces". The survey's open
8×4 is nothing but such blocks; one placement in five blew past the state cap and returned
nothing for the cost. Outlined, that fell to one in fourteen and the keep rate roughly tripled.

Run: 62 groups, 74,400 outlined placements, 25 minutes, 6,651 rooms kept.

**The generated rooms beat the shipped pack on solution shape.** Top candidates reach 11 lines
and 8 changes; the shipped pack tops out at 5 and 4, and L12 spends par 23 on 4 lines — which
is the same thing `metrics.mjs` has been saying about L7–L13 all along, now with a number.

### The tradeoff that selection cannot fix

Two properties matter and they turn out to be nearly incompatible:

- **`onPath`** — the fraction of the solve's depths at which *optimal* play can still throw the
  room away. A trap off the line is a trap nobody meets.
- **`blind`** — how far the room stays playable after it has already been lost.

| | blind ≤ 5 | ≤ 10 | ≤ 15 | ≤ 20 | ≤ 30 |
|---|---|---|---|---|---|
| onPath ≥ 0.05 | 4 | 29 | 81 | 178 | 474 |
| onPath ≥ 0.10 | 0 | 1 | 15 | 41 | 128 |
| onPath ≥ 0.15 | 0 | 0 | 6 | 11 | 42 |
| onPath ≥ 0.20 | 0 | 0 | 1 | 1 | 10 |
| onPath ≥ 0.30 | 0 | 0 | 0 | 0 | 0 |

Of 5,578 eligible rooms, **one** both bites the road at 15% and ends within 12 moves of the
mistake. Median `onPath` is 0 — half of all eligible rooms are rooms optimal play cannot lose.

This is causal, not bad luck. The mess is permanent, so a room where the good line can go
wrong is a room with many live-to-dead edges, and every dead state is still *playable* — you
can keep shoving things around forever. Losable and self-announcing pull against each other by
construction. And it worsens with length: median `blind` runs 27 at par 12–17 and 47 at par
30–45, so the ambition of a par-35 room makes it worse, not better.

**So the solvability indicator is not a nicety, it is the enabling feature.** No amount of
sampling buys a pack of long, losable, self-announcing rooms, because the rules make them
nearly incompatible; a room that announces its own death is the only way to have both.

## Open questions

What you don't know yet, and what would answer it — usually a playtest. Scratch them
out as they resolve.

## Scratch

Half-thoughts, dead ends, things you tried that didn't work and why. Keeping the
dead ends saves you from walking back into them.

---

Shipping is gated by `RELEASE-CHECKLIST.md`, not by this file. That's the only hard
stop in the studio, it deliberately lives somewhere else, and it doesn't open until
after beta — so while you're prototyping and growing the game, neither document is
telling you what to do.
