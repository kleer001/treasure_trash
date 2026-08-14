stale

## Summary

**The roster is built, the port has caught up, and the barrow now stacks.** Stage K landed:
`engine/` implements the whole roster and `tools/conform.mjs --engine` agrees with `src/rules.js`
across four seeds. `ROSTER-BUILD-PLAN.md` has served its purpose and is waiting to be deleted.

The last feature in: **a barrow carries a loaded barrow, to any depth.** A cell holds a CHAIN
now — `o` is the outermost thing and `hold` is what rides inside it — and every link but the last
is a carried barrow. The chain is what moves: a slot shift carries the stack as it stands, a
scoop takes it one level deeper, setting it down turns the head back into a cart still holding
what it held. Every thing in a chain keeps a sprite, drawn over the one carrying it, two pixels
right and down per level.

386 tests, `verify.mjs` ALL PASS, matrix 1785 cases with no disagreements, conformance ALL AGREE
on seeds 7/11/23/47 (~176k steps). Act 1 (31 rooms) and Act 2 (30) ship unchanged.

## Todos

### Parallel

- [ ] #42 **A grate that swallows a whole BODY cannot say so.** The board is right and the sprite
      stays drawn on the grate. `gone` names a thing by its OCCUPANT code; a body's sprite is
      keyed by kind and ref, so the schema cannot express it. Nothing throws, because no `gone`
      entry is emitted at all — only the matrix census sees it. Repro: a two-cell rug shoved onto
      two grate cells. The fix has the same shape as `fromCart`/`toCart`: a body form for `gone`,
      or a `consumed` list beside `piece`. Long-form in `TODO.md`.

- [ ] #43 **Run every matrix pair again with a one-cell gap.** 1176 of 1785 cases are refusals,
      because the two pieces start adjacent and most pairs are "B blocks A". A gapped variant is
      what lets a travelling piece actually arrive at the thing it is being tested against.

- [ ] #44 **Delete `ROSTER-BUILD-PLAN.md`.** It said so itself: it goes when Stage K lands, and
      Stage K has landed. Check nothing else still references it first.

- [ ] #45 **The Rust port caps stack depth at 12 (`MAX_HOLD`) where the JS is unbounded.** It
      aborts past it rather than answering, so it cannot be quietly wrong, and nothing the
      pipeline builds comes within half of it. Revisit only if a room ever needs more — the cost
      of lifting it is that `Cell` stops being `Copy`, which is an allocation on every board the
      search touches.

- [ ] #37 **Blind spots the matrix does not cover.** The interaction matrix now sweeps every
      piece against every terrain lane and every other piece, wheeled pieces included, and it
      checks the ACCOUNT of the move rather than the board. What it still does not ask:

      - **Undo and replay** through the new branches. Nothing has replayed a `.sol` across a
        cabinet, a magnet or a stacked barrow, and `applyAction` throws when the declared kind
        and the board disagree.
      - **The solver over links.** `deadScan` and `analyze` are key-based so links ride along,
        but no room with a link has been analysed for traps.
      - **Three or more of anything.** Two magnets facing each other; a line with two containers
        that both want to shed.

- [ ] #39 **Should a magnet resolve its field when something OTHER than a shove moves it?** Today
      it only resolves on a direct shove. Swept by a broom, dragged by a tow or knocked by a
      transfer, it moves without capturing and without its chain keeping pace. Consistent with
      "nothing moves unbidden", inconsistent with "the field moved". A design call, not a bug.

- [ ] #40 **The stack (`S`) is still undecided.** Last in the fertility survey by an order of
      magnitude, and in no shipped room. It was to be decided with Act 3 or cut, and Act 3 has
      not been designed since the roster grew.

- [ ] #41 **Play every new piece in the real game, and play it again after any rules change.**
      This is a GATE, not a chore. A dozen bugs across these sessions were invisible to
      `npm test` AND to board-level conformance, and showed only on screen: a body named as an
      occupant, a container that shed without saying what it became, a `gone` naming the wrong
      cell, a sprite that kept a stale `ck` after it stopped being a cart.

## Context

### The bug class that keeps recurring, and the one check that catches it

**A step that lands the RIGHT board while describing it wrongly.** Invisible to `npm test` and to
board-level conformance, because both compare boards and the stage animates from the step. The
invariant that catches the whole class:

> landing an action on the stage must leave the same sprites as building a stage from the board
> the action produced.

That is `tools/matrix.mjs`, and it is a gate that has been watched failing — `tests/matrix.test.js`
bends a step four ways on purpose and checks each bend is caught.

Its close cousin: **a KIND named where a CATEGORY was meant.** Ask a predicate rather than name a
kind, and carry the whole cell rather than one field of it.

### Chains, and what a step has to say about one

- `chainOf(c)` / `setChain(c, ch)` in `src/rules.js` are the only readers and the only write.
  `c.hold` exists only under a carried barrow, and `cloneState` deep-copies it — it is the one
  field a spread would SHARE.
- `stateKey` carries the stack with a per-cell length prefix. `bagsLeft` walks it, or a room opens
  its door on a bag hidden three barrows down.
- A `moved` entry carries **`depth`** (how far inside the destination cell it comes to rest) and
  **`wasDepth`** (where the stage is holding it now, defaulting to `depth`). `depth` is what tells
  two sprites of one code on one cell apart — which a barrow inside a barrow is.
- `applyStep` resolves EVERY sprite a step names before changing any of them, and throws if two
  entries claim one. Resolving them one at a time made the first entry's changes into what the
  second entry searched.

### Decisions that are settled and should not be re-opened

- **Push is the raccoon's only verb.** Board-level pulling is legal, which is what lets the magnet
  and the tow exist.
- **Only MUTABLE terrain reaches `stateKey`.** The grate and the one-way are static, like `wall`.
- **Open and closed cabinets are different codes**, so `isMultiCell` stays a flat predicate. An
  open cabinet is a BODY and a DRAWER in two ordinary cells, never a `pid` piece.
- **One link per piece**, and the tow and the magnet's chain share the lane.
- **The port follows; it never leads.** A rule is decided in `src/rules.js`, approved, and PLAYED
  in the browser before any of it is written in Rust. On a conformance disagreement: play the
  board first. If the played board says the JS is wrong, the JS is fixed and the port copies it.

### The format grew a `:hold` block

A LIST, not a mask (`4,2 >C` — the cell, then the chain from the outside in), because a chain is
not one character per cell. Barrow glyph pools widened to three per facing (`uvw`/`def`/`lmn`/
`rst`) so three of one facing can be written down. Spec in `FORMATS.md`.

The conformance corpus reached a *loaded* stack zero times in 116 generated rooms, so
`nestedRooms()` in `tools/conform.mjs` holds nine rooms that START stacked. Those caught the JS
reference itself dropping the hold block on the way in.

### Run it

`./run.sh` · `npm test` (386) · `node tools/verify.mjs` · `node tools/matrix.mjs` ·
`cargo build --release --manifest-path engine/Cargo.toml && node tools/conform.mjs --engine
engine/target/release/tt-engine`

Bench packs, dev-only and inert in the built artifact:
`index.html?acts=scratch.tt` — 26 rooms, one per piece. **TO/TP/TQ** are the stacking rooms: TP
stacks three barrows deep, TQ tips a stack out.
`index.html?acts=sandbox.tt` — every piece and every lane on one board. Its par is a WALKED
solution, not a proven minimum. It just gained a blank row along the bottom.

## Next Step

**#42, the body a grate swallows** — it is the one live correctness hole, it is reachable in a
shipped-shape room, and the fix has a worked precedent in the `fromCart`/`toCart` pattern. Then
**#43**, the gapped matrix pass, which is the cheapest large gain in coverage available.

/home/menser/Dropbox/ai/code/treasure_trash
