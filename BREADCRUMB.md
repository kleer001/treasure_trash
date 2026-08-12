fresh

## Summary

**The roster is built in JS and the port is not.** Stages A-J of `ROSTER-BUILD-PLAN.md` are
done: five terrain lanes and 22 new occupant codes, from the sponge through the magnet, each
with specs and each played in the real game. Stage K — teaching `engine/` the same rules — is
the only stage left, and it is large.

352 tests, `verify.mjs` and `conform.mjs` green. Act 1 (31 rooms) and Act 2 (30) ship unchanged.
`levels/scratch.tt` is a bench pack, never shipped, played via `index.html?acts=scratch.tt`.

`SPEC-SHEET.md` -> *The candidate roster* is the design; `ROSTER-BUILD-PLAN.md` is the order and
the gate, and it gets deleted when Stage K lands.

## Todos

### Sequential

- [ ] #35 **Stage K — the port, and the pipeline. The last stage.**

      `engine/` is behind by everything from Stage E on. Effectively this whole build again in
      Rust, then proved equal. What it needs:

      - **22 occupant codes**, 13-34: sponge, cardboard, pane, two tyres, bicycle, rug, chair,
        broom, four closed cabinets, four open bodies, the drawer, four magnets.
      - **Four mutable terrain values** past water and bridge — grease, tar, glass, covered —
        plus the two STATIC lanes, grate and one-way, which stay out of the key exactly as
        `wall` does.
      - **A widened cell in `state_key_into`.** It packs a cell into a `u8` and this roster
        needs ten bits. Widen the encoding so kinds, terrain and cart membership stop sharing
        one byte, rather than raising a number.
      - **Two key lanes it has not got**: each cart's KIND beside its label, and link
        membership. Both are silent if missed — two different boards keying alike.
      - **The branches**: transfer with trains, anisotropy (`rollsAlong`, `rollsHere`, the long
        axis read off a footprint), the broom's line push and its shed-only-at-the-head rule,
        the cabinet's body-and-drawer with the drawer opening as a push, the barrow's
        scoop/tip/no-eject, the magnet's capture, keep-pace and chain, and the tow.

      **Start with the cell encoding** — everything else is written against it. And build a
      corpus that HOLDS the new pieces as you go: see #38.

### Parallel

- [ ] #37 **Where are the remaining blind spots in the new pieces?** The open question, and it
      is not rhetorical — two rounds of auditing found four real bugs after every unit test was
      green. What has been swept, and what has not:

      **Swept, clean:** every piece with a facing or an axis, in all four directions — the
      cabinet at 4 facings x 4 shove directions (16/16 consistent), the magnet's capture and
      keep-pace at all 4 facings, tyres and rugs on both axes, the broom and grease vertically,
      the chair's flee in all four.

      **Swept, found bugs:** new pieces meeting each other. That is where the sweep-drops-a-link
      and the double-hold bugs were.

      **NOT swept, and the likeliest place left:**
      - **Terrain under the new pieces.** Each piece was tested on bare floor and against the
        lane it was built for. A rug rolling onto a grate it exactly fits; a towed couch dragged
        into tar; a cabinet whose drawer opens over a grate; a chair knocked onto grease; the
        broom's line crossing a one-way mid-run.
      - **Undo and replay.** Every new action reports PUSH; nothing has replayed a `.sol` through
        the new branches, and `applyAction` throws when the declared kind and the board disagree.
      - **The solver over links.** `deadScan` and `analyze` are key-based so links should ride
        along, but no room with a link has been analysed for traps.
      - **Three or more of anything.** Two carts, two magnets facing each other, a line with two
        containers that both want to shed.

- [ ] #38 **Make the conformance gate bite.** It reports ALL AGREE today only because no room in
      its corpus holds a new piece — **it is blind, not clean.** `tools/draft-room.mjs` generates
      from a piece list that has not grown. Adding the new pieces there is what turns the gate
      real, and it is the thing that would have caught every silent bug this session found by
      hand. Do it as part of #35 rather than after.

- [ ] #39 **Should a magnet resolve its field when something OTHER than a shove moves it?**
      Today it only resolves on a direct shove. Swept by a broom, dragged by a tow or knocked by
      a transfer, it moves without capturing and without its chain keeping pace. Consistent with
      "nothing moves unbidden", inconsistent with "the field moved". A design call, not a bug.

- [ ] #40 **The stack (`S`) is still undecided.** Last in the fertility survey by an order of
      magnitude, in no shipped room. It was to be decided with Act 3 or cut, and Act 3 has not
      been designed since the roster grew.

## Context

### The shape of every silent bug this session

**A KIND named where a CATEGORY was meant**, four times, and none of them threw:

- the stage skipped the couch BY NAME when minting sprites, so a rug got a second sprite per cell
- per-kind id counters each restarted at 0, so a couch, a rug and a bicycle all held piece 0 —
  `pieceCells` finds a piece by id alone, so shoving one would have dragged the others
- `ck` was set when a level loaded and dropped by `repaint` on every move, so a barrow became an
  ordinary cart the moment it rolled
- the broom's line push moved only `o`, leaving `lk` behind on whatever it was standing on

Expect the Rust port to offer all four again. The fix in each case was to ask a predicate rather
than name a kind, and to carry the whole cell rather than one field of it.

### Two rules learned the hard way, worth keeping

- **An occupant with no drawing THROWS** rather than rendering nothing. A piece that is merely
  invisible reads as a rules bug and is found by playing rather than by testing.
- **Anything that moves cells must SAY so in the step**, or the board is right and the sprite is
  somewhere else. Cost two bugs: the consumed cardboard, and the magnet's pull.
- A consumed piece names itself in `gone` by the cell **the stage holds it at**, which is where
  it started, not where it was going.

### Decisions that are settled and should not be re-opened

- **Push is the raccoon's only verb.** Pull, carry and stacking are closed on purpose — they
  point at a 3D puzzle platformer. Board-level pulling is legal, which is what lets the magnet
  and the tow exist.
- **Only MUTABLE terrain reaches `stateKey`.** A static lane cannot differ between two states of
  one room, which is why `wall` was never in there and why the grate and the one-way are not.
- **Open and closed cabinets are different codes**, so `isMultiCell` stays a flat predicate on a
  code. An open cabinet is a BODY and a DRAWER in two ordinary cells — never a `pid` piece,
  because the stage only mints multi-cell bodies when a level loads, and a piece that grows a
  second cell mid-move has no sprite.
- **One link per piece**, and the tow and the chain share one lane. They differ in behaviour, not
  in how they are recorded.
- **Transfer belongs to rolling, not to a piece.** That is why the tyre kept no special power.

### The port's deferral is safe, and checked

`board.rs` errors on an unknown glyph — fed a sponge it answers `{"error":"unknown glyph 's'"}`
rather than guessing — so it cannot diverge quietly while it waits. Until it catches up, nothing
new may enter a shipped pack, and `survey`/`harvest` cannot measure any of it.

Do the port last on purpose: a rules change costs double while both engines are live.

### Run it

`./run.sh` · `npm test` (352) · `node tools/verify.mjs` · `node tools/conform.mjs` ·
`cargo build --release --manifest-path engine/Cargo.toml && node tools/conform.mjs --engine
engine/target/release/tt-engine`

Play the new pieces: serve the root, then `index.html?acts=scratch.tt` — 17 bench rooms, one
per piece. The `?acts=` override is a dev affordance and is inert in the built artifact.

## Next Step

**Stage K, starting at the cell encoding**, because every other branch is written against it.
Then #38 in the same pass: teach `draft-room.mjs` the new pieces so the conformance corpus
actually contains them. A gate that cannot see a piece cannot catch the class of bug that took
four rounds of hand-auditing to find here — and #37 is the standing question that gate is meant
to answer for you.

/home/menser/Dropbox/ai/code/treasure_trash
