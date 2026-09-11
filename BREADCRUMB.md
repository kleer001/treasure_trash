fresh

## Summary

**The build is green and the skateboard has a new rule.** Every gate passes: `npm test` 425/425,
`tools/verify.mjs` ALL PASS over all 61 rooms, `tools/conform.mjs` ALL AGREE, `tools/matrix.mjs`
16520 cases clean. This is the first green build in months.

Two threads landed. First, the red build was cleared — it was one unsolvable room (L20) plus one
room whose walk-in exceeded the cap (L58, fixed by re-siting its whole set). Then the owner
played the skateboard ladder room by room and found a real rules fault, which was catalogued,
implemented and paid for across the level data.

**The skateboard rule, as the owner ruled it.** A deck rolls freely ALONG its long axis and moves
exactly ONE CELL across it — the wheels do not turn, and it is not a rug. That one cell comes from
the axis, never from the load. A load changes what the deck carries and nothing about how it
travels. Weight stays the barrow's rule alone.

The hold rework (`grip`) is still the older live thread underneath all this; its step 3, the
anchor rule, has not been touched.

## Todos

### Parallel

- [ ] #72 **The anchor rule — step 3 of the hold rework.** Capture still drags the metal to the
      magnet (`magnetResolve`, `src/rules.js`), and `settleMagnets` is still one raster pass with
      a comment defending it. The owner's rule: metal already held is an ANCHOR, and a loose
      magnet coming into range travels to IT. Only loose magnets move, they move toward, the reach
      bounds the distance — so the sweep is monotone, no pass undoes an earlier one, and settle
      becomes a worklist of the magnets that moved. One place stays order-dependent by design: two
      loose magnets reaching the same loose metal on the same sweep.

- [ ] #69 **Does a scraped grip stay cleared for the rest of the beat?** Objects do not stop the
      field — a magnet grips through a two-cell couch — so a scraped magnet is usually still
      looking straight at what it lost. If the settle re-grips on the same beat, scraping is a
      no-op by construction and nothing on screen ever shows it. If the cut persists, dragging a
      load past a blocker to strip a magnet off it becomes a technique. Same question as the
      barrow's hook; answer it once for both.

- [ ] #70 **The hold is invisible.** The magnet has a sprite; the hold has none — nothing in
      `stage.js` or `sprites.js` draws it. Survivable while a complex is one magnet and one can.
      The moment complexes are shared and scrape-able, the player is asked to reason about a
      structure the screen does not show, and a scrape reads as the game dropping things at
      random. This is the same omission `src/audit.js` counts as known: `grip` is a lane the
      account does not carry, because a hold has no sprite and no entry.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it lands
      occupant codes, refusals and `stateKey` lanes at once.

- [ ] #65 **The solver's representation change, inside `src/`.** About half of a discovery run's
      work is `analyze` itself and a sixth is garbage collection: string state keys hashed into a
      `Map`, one object per node, one per edge, one per back-pointer. Integer keys over a flat
      edge array plausibly buys another 2-4x. `CLAUDE.md` names it as the thing to spend first.

- [ ] #66 **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last constraint in
      the chooser nobody has measured. Half buys 24 rooms, 0.8 buys 27, 0.9 buys 30 — on the
      evidence so far the cap only ever costs sets. Run Act 3 at `--maxpiece 1` and judge the two
      acts on ramp mix, outline count, par band and `onPath` spread. If the unbounded pool wins,
      delete the flag rather than picking a new number.

- [ ] #73 **L57 carries 93 stranding traps, up from 16.** That is the price of tightening set 9:
      fewer right answers means more wrong ones. Undo is free and unbounded so it was left as is.
      Soften it only if the owner wants it softened.

- [ ] #67 **Parked idea, not approved work: the roller skate.** The one-cell version of the
      skateboard — the slot the barrow already occupies structurally but not fictionally. On the
      record before the vocabulary settles; nobody is asking for it yet.

## Context

### The gates, and what green means now

All four pass. These are the numbers to compare against, not a baseline of known failures.

- `npm test` — 425/425.
- `node tools/verify.mjs` — ALL PASS, 61 rooms (act1 L0–L30, act2 L31–L60, contiguous).
- `node tools/conform.mjs` — ALL AGREE, 109 rooms, 46512 steps.
- `node tools/matrix.mjs` — 16520 cases.
- `npm run test_rules` — 388/388.

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
  before replaying, or the browser plays the old rooms.

## Next Step

**The anchor rule, #72.** It is the live design thread, it is the owner's already-stated rule, and
it is the thing the hold rework has been waiting on since step 2 landed. #69 has to be answered
before the scrape can land on top of it, and #70 is what makes any of it visible to a player.

Everything else on the list is independent of it.

/home/menser/Dropbox/ai/code/treasure_trash
