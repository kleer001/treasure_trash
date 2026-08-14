fresh

## Summary

**The wheels got a weight system, and every room is being rebuilt as a lesson.**

A wheeled thing is HEAVY while it is carrying objects, and weight decides distance and nothing
else: light rolls, heavy moves one cell. Carts joined the transfer system they were never in — a
bicycle took a knock and rolled while the two pieces with wheels in their name did not. Struck, a
light one rolls and a heavy one takes the blow and rattles. Pinned, what hit it goes INSIDE
instead. Two older fixes rode along: a grate takes a body only when the WHOLE of it fits, and a
rolled rug rolls when shoved against its SIDE.

Rules stages are built, played in the browser and proven at both grains. What is left is the
expensive half: the Rust port (deliberately deferred) and rebuilding every room from
`TEACHING-PLAN.md`.

Pushed through `7150d7b`. **CI is red on three gates, all of them known and none of them a
surprise** — see Context.

## Todos

### Sequential

- [ ] #46 **Walk the bench rooms and settle any remaining rule notes.** The owner wants to play
      before the port is written, because a rules change costs double while both engines are live.
      `index.html?acts=scratch.tt` — TR (grate takes a body whole or spans it), TS (too heavy to
      shift), TT (every wheeled piece, a lane each), TU (where the momentum goes: the catch, the
      closed-back wobble, the run as one unit, the broadside shed).
      `index.html?acts=sandbox.tt` — SB, every piece and every lane in one room.

- [ ] #47 (needs: #46) **Port the weight ruleset to `engine/`.** `engine/src/rules.rs` has the
      grate fit rule and the rug axis and nothing after them, so `tools/conform.mjs` fails with 34
      rooms disagreeing. The port copies BOARD-level rules only — the rattle and the whole step
      account are outside its protocol. What it owes: weight read once at shove start, heavy moves
      one cell, grease beats weight, carts as hand-off targets, the catch (barrow only through its
      mouth), the train reach-through, the blocked-push shed.

- [ ] #48 (needs: #46) **Rebuild every room from `TEACHING-PLAN.md`.** 76 rooms, nine chapters,
      flat difficulty — one new idea per room and nothing else on the board that can be got wrong.
      Drafted by hand and then proved, NOT searched for: `pick.mjs` and the fertility work sit this
      out, since they find rooms that are interesting rather than rooms that teach.

### Parallel

- [ ] #49 **The sandbox's declared solve is stale.** SB's 85-move walked solve dies at move 56,
      refused `canRoom`; bags are already 0 by move 55, so it is the walk out that broke. Nothing
      caught it because `verify.mjs` only checks `levels/act*.tt`. The room is fine to poke at —
      only the declared par is wrong. Re-walk it once the rules settle. Not recorded anywhere but
      here.

- [ ] #50 **Decide the stack (`S`).** Last in the fertility survey by an order of magnitude and in
      no shipped room. `TEACHING-PLAN.md` gives it a room because it is in the roster, and
      deliberately does not settle whether it stays.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it lands
      occupant codes, refusals and `stateKey` lanes on every implementation at once, which is the
      bill `CLAUDE.md` warns about.

## Context

### The rules, as settled

- **Weight** = carrying objects. A wheelie bin is light full or empty: its trash is a STATE of the
  bin, not cargo riding in it. Tyre, bicycle, chair can hold nothing and are never heavy.
- **Weight is read ONCE, at the top of the shove.** Read per beat and the cart becomes a barrow —
  it fills on the first thing it passes and stops, one item per push. This is the silent failure;
  it is written down in `WEIGHT-BUILD-PLAN.md` for that reason.
- **The cart is open-mouthed; the barrow is aimed.** A cart keeps its mouth open for the length of
  its roll. A barrow takes only what it was ALREADY touching, only along its facing, only while
  empty — so depth costs one empty barrow per level and a stack is built from the INSIDE OUT.
- **Picking up takes a raccoon-driven push.** A knocked cart travels with its mouth shut.
- **Momentum always lands somewhere:** it moves the wheels if there is room, goes inside if there
  is not, and rattles if neither. A barrow catches only through its mouth; its back is a wall.
- **Grease beats weight.** Anything moving on a slick keeps moving.

### Consequences that arrived from two rules meeting, not from a decision

- **A loaded cart end-on in a one-wide corridor cannot be emptied by shoving.** The shed needs a
  file the raccoon is not standing behind. Accepted as a dead end and now asserted in a spec so it
  cannot drift back.
- **Four specs were deleted, not re-laid.** All turned on the trail-versus-lead slot, and a cart is
  exactly two cells — so only end-on has a trail slot, and end-on is exactly what can no longer
  shed. No board left shows the difference.
- **`tools/survey.mjs` bounds at 50,000 states.** Cart rooms grew a lot when loaded carts stopped
  rolling. The pipeline will not crash, but it may drop cart rooms for exceeding the cap and push
  the cart down the fertility map for search cost rather than design. **If the cart falls off the
  map during the rebuild, suspect the bound before believing the piece got worse.**

### Why CI is red

| gate | | why |
|---|---|---|
| `npm test` | 2 fail | both read `levels/act1.tt` — shipped rooms whose pars are stale |
| `tools/verify.mjs` | 63 checks | same rooms; the rebuild is #48 |
| `tools/conform.mjs` | 34 rooms | the port is behind on purpose; #47 |

`tools/matrix.mjs` is GREEN — 1785 cases, zero disagreements. That is the gate that catches the
recurring bug class: a step that lands the right board while describing it wrongly.

### Traps this session actually fell into

- **`analyze` takes an OPTIONS OBJECT** — `analyze(s, { maxStates: N })`. Passing a bare number
  runs it unbounded, which reads as a state-space explosion that is not there.
- **Headless checks say the rule fires; only a DRIVEN board says it was driven right.** Two
  play-throughs were mis-driven — the raccoon walked into a piece and pushed it — and both nearly
  got reported as rules failures. Drive with real key presses and verify the raccoon's column.
- **Read a file before deleting it.** `ROSTER-BUILD-PLAN.md` was deleted on a todo's authority
  without reading it; it turned out to contain the grate fit rule that was being violated that same
  day. Restored, and its stale Stage E4 rug line corrected.

### Run it

`./run.sh` · `npm test` · `node tools/verify.mjs` · `node tools/matrix.mjs` ·
`cargo build --release --manifest-path engine/Cargo.toml && node tools/conform.mjs --engine
engine/target/release/tt-engine`

`<` and `>` step through the levels, wrapping round the pack.

## Next Step

**#46 — walk the bench rooms.** Everything downstream waits on it: the port copies whatever the
rules end up being, and the 76 teaching rooms are written against them. TU is the room to start
with; it holds the four newest rules and nothing else.

/home/menser/Dropbox/ai/code/treasure_trash
