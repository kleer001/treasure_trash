stale

## Summary

**Two systems landed on top of the weight work: the cabinet was rebuilt as a real piece, and the
magnet's field went live.**

The cabinet used to be an occupant plus a separate `DRAWER` occupant, paired by re-deriving the
facing on every question — nine codes, three helpers, four predicate clauses and two hand-written
copies of "it opens". It is now one cell shut and ONE TWO-CELL PIECE open, with a piece id like the
couch. Opening destroys the shut piece and mints the open one; folding in and closing-in-place do
the reverse. `DRAWER` is gone, so half a cabinet is not refused — it cannot be written down.

The magnet no longer waits to be shoved. Every magnet on the board is asked again after every
action, so a field holds whatever is in it. That is what makes a magnet carry a cabinet that was
merely standing beside it.

**Everything from this session is UNCOMMITTED.** Working tree is dirty across `src/`, `tests/`,
`tools/`, `levels/`, `CLAUDE.md`, plus a new untracked `src/debug.js`.

## Todos

### Parallel

- [ ] #52 **Commit this session.** Nothing is committed. Suggested split: the debug panel; the
      grate/pane account fixes; the cabinet swap; the live magnet field; the `CLAUDE.md` note.

- [ ] #53 **`engine/target/release/tt-engine` does not match its source.** The binary on disk was
      built from a Rust edit that has since been reverted, and `survey`/`harvest` pick it up
      automatically when it exists. Either rebuild it from the reverted source or delete it —
      OWNER'S CALL, and it is the one thing left touching `engine/`.

- [ ] #54 **A magnet tow reports nothing that moved.** `towMove` names bodies by cart id and piece
      id, so a magnet towing a plain occupant (a can, a wheelie, a shut cabinet) hands back an
      empty step: the board is right and the sprites stay put until the stage is rebuilt.
      Reproduced and confirmed against the matrix census. An open cabinet is a piece now, so it is
      already fine — the bug is the plain-occupant case.

- [ ] #55 **Decide whether the field settles at level LOAD.** It settles after every action, but a
      room authored with a magnet beside metal starts unheld until the first move. Settling at load
      would relink the sandbox at move zero and re-par anything built around the current start.

- [ ] #50 **Decide the stack (`S`).** Last in the fertility survey by an order of magnitude and in
      no shipped room. `TEACHING-PLAN.md` gives it a room because it is in the roster, and
      deliberately does not settle whether it stays.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it lands
      occupant codes, refusals and `stateKey` lanes on every implementation at once.

### Sequential

- [ ] #46 **Walk the bench rooms.** `index.html?acts=scratch.tt` — TR, TS, TT, TU for the weight
      rules; TF, TL, TM for the cabinet; TH for the magnet (rebuilt this session).
      `index.html?acts=sandbox.tt` — SB, every piece and every lane in one room. Add `&debug` for
      the play-by-play panel.

- [ ] #48 (needs: #46) **Rebuild every room from `TEACHING-PLAN.md`.** 76 rooms, nine chapters,
      flat difficulty — one new idea per room. Drafted by hand and then proved, NOT searched for.
      Two new constraints from this session, both in Context: metal that must be emptied cannot
      start inside a magnet's field, and a cabinet plus a grate makes a room losable.

- [ ] #47 (needs: #46) **The Rust port is GATED — do not touch `engine/` without the owner's
      explicit okay for that specific change.** Not now. When it is time it owes: the weight
      ruleset, the cabinet swap, and the live magnet field. `tools/conform.mjs --engine ...` fails
      on 34 rooms and has since before this session; the reference run is green.

## Context

### The cabinet, as it now stands

- Shut is one cell with a `SLIDES` row, so it takes the lanes like anything its size: **down a
  grate, along a slick, stuck in tar** — and a cart the raccoon pushes onto it takes it aboard. A
  cart arriving on a KNOCK still strikes it and opens it, because a cart only has its mouth open
  when the raccoon is pushing.
- Open is one two-cell piece with a `pid`, out of `ROLL_AXIS`, so it shifts one cell like the
  couch. A body is swallowed by a grate only when ALL of it lands in holes — so a hole in front of
  a cabinet does not stop it opening, and the drawer spans it.
- **Over a grate the piece is safe while it is a body and gone the moment it becomes one cell
  again**: folding a cabinet in over a hole destroys it.
- Two ways to shut it: drawer-first into something that will not take the drawer (folds in, body
  advances), and shoved on the drawer toward the body (closes where it stands).
- New account lane: **`born`** — `{ kind, ref, o, cells }`, board cells in raster order, anchor
  first. Its mirror is a `piece` entry with `effect: 'swaps'`. Nothing else in the game mints a
  body mid-action.
- Glyphs: `a/e/k/m` shut; open takes a POOL PER FACING — `A/L`, `D/T`, `I/P`, `J/Q` — because
  `MULTI_POOLS` is keyed per occupant code. The format checks the SHAPE, not just the count: a
  two-cell blob lying across its own facing is refused.

### The magnet, as it now stands

- `settleMagnets` runs every magnet in raster order after every successful action. ONE pass: a
  piece drawn into a second magnet's field is taken only if that magnet comes later in the order.
- A hold is never permanent. It survives while what is held stays on the line, within three, and
  able to keep pace; fail any one and it is let go. A wall beside the held piece when the magnet
  moves sideways breaks it — confirmed on a board.
- **Anything metal that must be EMPTIED cannot start inside a field.** A held can cannot be tipped
  (shoving it is a rigid tow), so its bag never comes out. This made `scratch.tt` TH unsolvable;
  the room was rebuilt with the can at reach four.
- A magnet holding something looks identical to one standing next to it — nothing draws the link.
  The owner's decision is to rely on people's understanding of magnets rather than draw it.

### Why the gates read the way they do

| gate | | why |
|---|---|---|
| `npm test` | 393 pass / 2 fail | both read `levels/act1.tt` — shipped rooms whose pars are stale; #48 |
| `tools/verify.mjs` | 63 checks | same rooms. Failing set diffed against HEAD: IDENTICAL |
| `tools/matrix.mjs` | GREEN, 1908 cases | the gate that catches a step describing a board wrongly |
| `tools/conform.mjs` | reference ALL AGREE | `--engine` fails 34 rooms; predates this session; #47 |

**Measure against that baseline, not against green.** The tree has not been green for a while and
the reason is level data, not rules.

### The weight rules, still standing

- **Weight = carrying objects**, read ONCE at the top of the shove. Read per beat and the cart
  becomes a barrow. A wheelie bin is light full or empty.
- **The cart is open-mouthed; the barrow is aimed.** Picking up takes a raccoon-driven push.
- **Momentum always lands somewhere:** moves the wheels, goes inside, or rattles.
- **Grease beats weight.**
- A loaded cart end-on in a one-wide corridor cannot be emptied by shoving. Accepted dead end.
- `tools/survey.mjs` bounds at 50,000 states. **If the cart falls off the fertility map during the
  rebuild, suspect the bound before believing the piece got worse.**

### Traps worth not falling into again

- **A source comment is a note, not a constraint.** Two comments in `src/rules.js` described the
  cabinet in ways that contradicted each other and the code. Argue from what the code does.
- **`analyze` takes an OPTIONS OBJECT** — `analyze(s, { maxStates: N })`. A bare number runs it
  unbounded.
- **Headless checks say the rule fires; only a DRIVEN board says it was driven right.** Drive with
  real key presses and verify the raccoon's column.
- **Order matters in `explain`.** The open-cabinet branch has to be asked BEFORE the multi-cell
  branch, or the generic body mover catches the shove and refuses the fold-in. Found by playing.
- `tests/bench.test.js` replays every non-act pack on every run, so a rules change that breaks a
  bench solve fails `npm test` — that is the gate that holds the rooms `verify.mjs` never sees.

### Run it

`./run.sh` · add `&debug` to any URL for the play-by-play panel (`index.html?acts=sandbox.tt&debug`)
`npm test` · `node tools/verify.mjs` · `node tools/matrix.mjs [--pack]` · `node tools/conform.mjs`

`<` and `>` step through the levels, wrapping round the pack.

## Next Step

**#52 — commit this session**, before anything else touches the tree. Then #46, walking the bench
rooms with the debug panel open: the cabinet rooms (TF, TL, TM) and the rebuilt magnet room (TH)
are the ones whose rules changed under them.

/home/menser/Dropbox/ai/code/treasure_trash
