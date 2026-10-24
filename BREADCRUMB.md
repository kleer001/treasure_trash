fresh

## Summary

**The build is green, the anchor rule is in, and holds are drawn.** Every gate passes:
`npm test` 431/431, `tools/verify.mjs` ALL PASS over all 61 rooms, `tools/conform.mjs` ALL AGREE,
`tools/matrix.mjs` 16520 cases clean.

**The skateboard rule, as the owner ruled it.** A deck rolls freely ALONG its long axis and moves
exactly ONE CELL across it — the wheels do not turn, and it is not a rug. That one cell comes from
the axis, never from the load. A load changes what the deck carries and nothing about how it
travels. Weight stays the barrow's rule alone.

The hold rework (`grip`) is done as planned: the edge on the holder, sharing, the anchor rule,
the scrape, and the drawing. **The scrape is built, green and played, but NOT committed** — it
sits in the working tree (`src/rules.js`, `tests/magnet.test.js`) awaiting the owner's okay.

## Todos

### Parallel

- [ ] #79 **The owner has notes on the Afloat, Skateboard and Raccoon benches** (`art/bench/float.html`,
      `skate.html`, `raccoon.html`). Ask for them; the owner gives them when ready.

- [ ] #80 **A notes feature on those bench pages.** The owner writes a note on a page, and the note
      is saved together with the page's settings at that moment, so each note is tied to the
      settings it is about.

- [ ] #75 **Commit and push the scrape once the owner says so.** Working tree only: `src/rules.js`
      and `tests/magnet.test.js`. Proposed message: `feat(rules): a magnet that cannot follow is
      scraped off, and stays off for the beat`. Commit path-scoped; leave the deleted
      `.claude/skills/` copies out.

- [ ] #51 **The crow is the coach, and never a piece** (owner, 2026-10-23): a guardian angel with a
      chip on his shoulder, coaching a raccoon through raccoon limbo. A voice and a portrait; he
      never touches the board. Character, dialogue and art references are in `CROW.md`. Act 1's
      pack name still reads "(raccoon only, crow pinned)".

- [ ] #74 **`stateKey` is where the solver's time goes, not the graph.** Measured over act1 and
      act2 (186,591 states, 469,712 edges): `stateKey` is 41% of `analyze`, `explain` 23%, the
      string hash and `Map` insert 15%, `isWon` 7%, the whole graph layout about 13%. Integer ids
      over flat edge arrays can buy 1.15x at most, so that idea is dropped. The untested lever:
      `stateKey` builds its key a character at a time, and key plus hash is 56% of the time. It
      lives in `src/rules.js`, so any change to it is a rules-file change and gets every gate.
      GC is under 10%, and most of it is board clones: 60% of the boards `explain` returns are
      repeats that are thrown away.

- [ ] #66 **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last constraint in
      the chooser nobody has measured. Half buys 24 rooms, 0.8 buys 27, 0.9 buys 30 — on the
      evidence so far the cap only ever costs sets. Run Act 3 at `--maxpiece 1` and judge the two
      acts on ramp mix, outline count, par band and `onPath` spread. If the unbounded pool wins,
      delete the flag rather than picking a new number.

- [ ] #73 **L57 carries 93 stranding traps, up from 16.** That is the price of tightening set 9:
      fewer right answers means more wrong ones. Undo is free and unbounded so it was left as is.
      Soften it only if the owner wants it softened.

- [ ] #76 **Every animation gets animated by hand.** Owner's call: none of the AI video clips
      (MiniMax H3, every keyframe set and seed) is usable. Each animation is to be animated
      painstakingly, frame by frame, in code, cell-perfect against the rules. Done that way so
      far: the bag rip and the recycling box tip, in `art/bench/`. Still to animate:
      - the raccoon: sitting, crawling forward one cell, pushing a thing. Not a walk cycle.
      - the can tip.
      - the jug pour. The jug stands free, not on a cooler.
      - the pane shatter.

- [ ] #77 **The empty recycling box must record which way it fell.** It is drawn lying on its
      side toward the push, but the board does not say which way that was, and the renderer
      draws from the board alone. Proposed: four occupant codes for an empty box, one per
      facing, as the filing cabinet has, with its moves unchanged. A rules-file change, so it
      waits for the owner's okay.

- [ ] #78 **Object art is straight side views.** The object stills in `tmp/pixelart/out/` were
      rendered at 55°, 70° and 85° and none was chosen. Standing objects are side elevations
      with no skew; only the floor and loose trash are top-down.

- [ ] #67 **Parked idea, not approved work: the roller skate.** The one-cell version of the
      skateboard — the slot the barrow already occupies structurally but not fictionally. On the
      record before the vocabulary settles; nobody is asking for it yet.

## Context

### The gates, and what green means now

All four pass. These are the numbers to compare against, not a baseline of known failures.

- `npm test` — 431/431.
- `node tools/verify.mjs` — ALL PASS, 61 rooms (act1 L0–L30, act2 L31–L60, contiguous).
- `node tools/conform.mjs` — ALL AGREE, 109 rooms, 46512 steps.
- `node tools/matrix.mjs` — 16520 cases.
- `npm run test_rules` — 392/392.

### The skateboard rule, and where it lives

`skateRollsAlong(s, cid, dx, dy)` in `src/rules.js` reads the deck's axis off its own footprint
via `longAxis(cartCells(...))` — the same reading a rug and a bicycle already use. It replaced
`isHeavyCart` in the four places that decided how far a deck travels: `rollsHere`, the `oneCell`
flag in `shoveCart`, the roll-loop break, and `strikeBack`'s rattle. The shed now fires on the
deck having nowhere to go rather than on weight; an empty blocked deck sheds nothing and falls
through to the refusal, which is what it already did.

The owner's three rulings are written up in `tmp/skateboard-catalogue.md`.

### Authoring machinery built this session, in `tmp/` (gitignored)

- `tmp/author.mjs` — `judge(level)` runs every check `tools/verify.mjs` makes, against a level
  held in memory, so a candidate room can be judged before it is written into a pack. Also
  `teachesTheDeck(level)`, which asks whether the shortest line actually puts trash aboard a deck
  and takes it off again. **It now also asks what the door forbids** — that check was missing and
  it let a bad candidate through once.
- `tmp/write-room.mjs` — replaces one room's grid, cart mask, declared numbers and note across
  the `.tt`, the `.sol` and `levels.md` together, from a small JSON file.
- `tmp/remeasure.mjs` — measures every shipped room against the current engine and says which
  declared numbers moved, which rooms went unsolvable, and which fail a check no number can fix.

**Sharding these searches across 5-6 node processes is what makes them finish.** A full placement
enumeration on a small board is tens of thousands of `analyze` calls.

### How a room gets redone, and what is held fixed

A room in a SET shares its outline, its door, its raccoon and its constant furniture with its two
siblings, and each rung adds one piece. So a redo holds the set's identity fixed and enumerates
only what is free to move, then requires all three rooms sound with pars strictly ascending. The
levers, in the order they were worth trying: the pieces each rung adds, then the decks, then the
door and the raccoon. For set 9 only the last two TOGETHER moved the number.

`tools/resite.mjs` is the shipped tool for the door-and-raccoon lever; the searches here were
written ad hoc because they also had to hold a rung's added piece.

### Governance

- **`CLAUDE.md` § NO PROSE IS EVER A RULE** — no comment, doc, test name, `:teach` line or commit
  message decides what a piece does. A red test is the expected result of a rules change, not a
  veto. But CHECK each red test before updating it: read the new behaviour off the engine board by
  board and confirm it follows the ruling, rather than writing down whatever the code now does.
- **NOTHING IS SHIPPED.** Never cite authored levels as the cost of a rules change.
- **Rules before levels.** While the ruleset moves, do not solve levels or compute pars.
- **Do not mention `engine/` at all** — not in a summary, not as a caveat, not as a one-line note.
- **The dead-board indicator stays a bare state.** Owner's call.
- **A blocked barrow hook keeps re-taking.** Owner's call: the magnet field breaks when the group
  cannot travel and the hook does not, and the asymmetry stands.
- **Copy work uses the global `copy:` skills**, which live in their own plugin repo. The
  project-local copies under `.claude/skills/` were deleted deliberately; those deletions are
  still uncommitted and the owner said not to worry about them.

### Driving the page, and two traps in it

`?debug` gives a play-by-play panel and `window.__tt`. `walk(keys)` presses through the game's own
handler and compares the stage's sprites to a stage rebuilt from the board. Screenshots are the
artifact for a human to look at once something has failed, not the check.

Two things that cost time:

- **A room with `:arm on` needs two presses per shove** — one to aim, one to commit. A declared
  solve is one key per action, so replaying it raw reports false refusals. Wrap each press in a
  retry that fires again when the move count did not advance.
- **Close the picker dialog after choosing a room.** Left open it swallows every arrow key, and
  the room silently never advances.
- **The page holds the level data it fetched at load.** After rewriting a pack, navigate again
  before replaying, or the browser plays the old rooms. The same goes for `__tt.sweep(plan)`: the
  page must have the plan's pack loaded, or every room reports "no such room in this pack".
- **A bench pack can live in `tmp/`**: `index.html?acts=../tmp/anchor.tt&debug`. It needs `:par`
  and `:solve` lines to parse (placeholders are fine; nothing verifies it). `tmp/anchor.tt` holds
  the magnet bench rooms A1–A4 (anchor, walk, closure, held-magnet) and S1–S2 (scrape, cut beat).
- **A beat is 110 ms per cell** (`CELL_MS`), too fast for a screenshot to land mid-beat. Freeze
  the page clock (`performance.now = () => t`) after a press, screenshot, then restore it.
- **Agent worktrees under `.claude/worktrees/` double the `npm test` count**, because
  `node --test` finds their specs too.

## Next Step

**#75** — ask whether to commit the scrape, then commit it. After that, #74 is the one item that
needs no decision from the owner; the rest are the owner's calls.

## Context: the pixel art

- **The target look** is `art/reference/alley-gold.png`. Its README says how it was made.
- **The benches** are in `art/bench/` (see its README): the trash catalog, the layout of trash
  over TRASH cells (layout B is the chosen one), the landing flight, the flying shadow, and the
  recycling box. Each imports `src/` and checks its first and last frames against stills of the
  board. The owner's tuned values are the defaults in `art/bench/trash/look.json`.
- **The recycling box** is a side view: upright with trash heaped over the rim, then lying on its
  side toward the push. The pieces seen over the rim are the pieces that land, poured as B into
  the TRASH cell. In the game that continuity goes through the stage's draw seed, not the rules.
- **The AI work** (ComfyUI stills, H3 clips, `anim.html`, `seeds.html`) is in `tmp/pixelart/`,
  gitignored. The GPU is used only from 23:00 to 05:00.

## Context: the hold, as built

- Metal that nothing holds moves only when it is shoved or when a magnet pulls it. A free magnet
  goes to metal that something holds (owner's ruling). `closeGap` in `src/rules.js` picks the end
  that moves; `settleMagnets` runs to closure, one step per pass that changes the board.
- A step names each thing once: `applyStep` resolves every entry before it moves any. So a
  shoved magnet does not walk in its own shove step; the settle walks it on the next beat.
- Latent, older than this work and not fixed: a magnet shoved across its field slides its load
  across and can then pull it in on the same step, which names the load twice.
- A scrape cuts only the fields on what cannot travel, in both directions, never a barrow's hook
  (`towOrBreak`). A cut magnet takes nothing for the rest of the beat (owner's ruling): the
  `CUT` mark rides in the `grip` lane, so every mover carries it, and `explain` clears it.
- The hold is drawn by the `holds` and `grips` layers in `src/main.js`, read off the beat's
  board the way the terrain layer is. The account still does not carry `grip`.

/home/menser/Dropbox/ai/code/treasure_trash
