fresh

## Summary

**The build is green, the anchor rule is in, and holds are drawn.** Every gate passes.

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

- [ ] #74 **`stateKey` is where the solver's time goes, not the graph.** The integer-id idea over
      flat edge arrays is dropped. The untested lever: `stateKey` builds its key a character at a
      time. It lives in `src/rules.js`, so any change to it is a rules-file change and gets every
      gate. GC is mostly board clones: `explain` returns many repeat boards, which are thrown away.

- [ ] #66 **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last constraint in the
      chooser nobody has measured. On the evidence so far the cap only ever costs sets. Run Act 3 at
      `--maxpiece 1` and judge the two acts on ramp mix, outline count, par band and `onPath`
      spread. If the unbounded pool wins, delete the flag rather than picking a new number.

- [ ] #73 **L57 carries stranding traps.** That is the price of tightening set 9: fewer right
      answers means more wrong ones. Undo is free and unbounded so it was left as is. Soften it only
      if the owner wants it softened.

- [ ] #76 **Every animation gets animated by hand.** Owner's call: none of the AI video clips
      (MiniMax H3, every keyframe set and seed) is usable. Each animation is to be animated
      painstakingly, frame by frame, in code, cell-perfect against the rules. Done that way so
      far: the bag rip and the recycling box tip, in `art/bench/`. Still to animate:
      - the raccoon: sitting, crawling, pushing a thing. Not a walk cycle.
      - the can tip.
      - the jug pour. The jug stands free, not on a cooler.
      - the pane shatter.

- [ ] #77 **The empty recycling box must record which way it fell.** The renderer draws from the
      board alone. Proposed: four occupant codes for an empty box, one per facing, as the filing
      cabinet has, with its moves unchanged. A rules-file change, so it waits for the owner's okay.

- [ ] #78 **Object art is straight side views.** The object stills in `tmp/pixelart/out/` were
      rendered, and none was chosen. Standing objects are side elevations with no skew; only the
      floor and loose trash are top-down.

- [ ] #67 **Parked idea, not approved work: the roller skate.** It is the slot the barrow already
      occupies structurally but not fictionally. On the record before the vocabulary settles; nobody
      is asking for it yet.

## Context

### The gates

- `npm test`
- `node tools/verify.mjs`
- `node tools/conform.mjs`
- `node tools/matrix.mjs`
- `npm run test_rules`

### The skateboard rule, and where it lives

`skateRollsAlong(s, cid, dx, dy)` in `src/rules.js`.

The owner's three rulings are written up in `tmp/skateboard-catalogue.md`.

### Authoring machinery in `tmp/` (gitignored)

- `tmp/author.mjs` — `judge(level)` runs every check `tools/verify.mjs` makes, against a level held
  in memory, so a candidate room can be judged before it is written into a pack. Also
  `teachesTheDeck(level)`.
- `tmp/write-room.mjs` — replaces one room's grid, cart mask, declared numbers and note across
  the `.tt`, the `.sol` and `levels.md` together, from a small JSON file.
- `tmp/remeasure.mjs` — measures every room against the engine and says which declared numbers
  moved, which rooms went unsolvable, and which fail a check no number can fix.

**Sharding these searches across node processes is what makes them finish.**

### How a room gets redone, and what is held fixed

A room in a SET shares its outline, its door, its raccoon and its constant furniture with its two
siblings, and each rung adds one piece. So a redo holds the set's identity fixed and enumerates
only what is free to move, then requires all three rooms sound with pars strictly ascending. The
levers, in the order they were worth trying: the pieces each rung adds, then the decks, then the
door and the raccoon. For set 9 only the last two TOGETHER moved the number.

`tools/resite.mjs` is the tool for the door-and-raccoon lever; the searches here were written ad hoc
because they also had to hold a rung's added piece.

### Governance

- **`CLAUDE.md` § NO PROSE IS EVER A RULE** — no comment, doc, test name, `:teach` line or commit
  message decides what a piece does. A red test is the expected result of a rules change, not a
  veto. But CHECK each red test before updating it: read the new behaviour off the engine board by
  board and confirm it follows the ruling, rather than writing down whatever the code does.
- **NOTHING IS SHIPPED.** Never cite authored levels as the cost of a rules change.
- **Rules before levels.** While the ruleset moves, do not solve levels or compute pars.
- **Do not mention `engine/` at all** — not in a summary, not as a caveat, not as a one-line note.
- **The dead-board indicator stays a bare state.** Owner's call.
- **A blocked barrow hook keeps re-taking.** Owner's call.
- **Copy work uses the global `copy:` skills**, which live in their own plugin repo. The
  project-local copies under `.claude/skills/` were deleted deliberately; those deletions are
  uncommitted, and the owner said not to worry about them.

### Driving the page, and its traps

`?debug` gives a play-by-play panel and `window.__tt`. Screenshots are the artifact for a human to
look at once something has failed, not the check.

Things that cost time:

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
- **A beat (`CELL_MS`) is too fast for a screenshot to land mid-beat.** Freeze the page clock
  (`performance.now = () => t`) after a press, screenshot, then restore it.
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
- **The recycling box** is a side view: upright with trash heaped over the rim. In the game the
  trash over the rim keeps its look through the stage's draw seed, not the rules.
- **The AI work** (ComfyUI stills, H3 clips, `anim.html`, `seeds.html`) is in `tmp/pixelart/`,
  gitignored. The GPU is used only from 23:00 to 05:00.

## Context: the hold, as built

- `closeGap` and `settleMagnets` in `src/rules.js`.
- Latent, older than this work and not fixed: a magnet shoved across its field slides its load
  across and can then pull it in on the same step, which names the load twice.
- The hold is drawn by the `holds` and `grips` layers in `src/main.js`, read off the beat's board
  the way the terrain layer is. The account does not carry `grip`.

/home/menser/Dropbox/ai/code/treasure_trash
