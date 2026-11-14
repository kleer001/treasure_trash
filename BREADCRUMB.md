fresh

## Summary

**`main` is at `47f394e`, pushed, and every gate is green.** The working tree is clean except the
deleted `.claude/skills/` copies, which stay out of commits.

The whole-codebase review (`tmp/review/codebase-review.md`) is worked through sections R, B, T, C
and D1. The last three commits answer the owner's rule questions: a magnet's pull over an arrow
goes the whole way in one beat; a roll that carries a thing off ends the holds it is part of; one
move function (`lift`/`put` in `src/rules.js`) carries every body and cart. A thing may still
take the cell the raccoon leaves (owner: keep as is).

## Todos

### Parallel

- [ ] #81 **The single-thing moves still copy their own cell fields:** the train in `pushRollers`,
      the sweep in `pushBroom`, and the run of things ahead in `shoveCart`. Move them onto
      `lift`/`put`. A rules-file refactor: ask the owner first, then prove it with the golden
      master (see Context).

- [ ] #82 **Design refactors D2–D8** in `tmp/review/codebase-review.md` § D, one at a time, each
      after the owner's yes: D2 split `main.js`; D3 one direction table and one frame length;
      D4 `src/art` copies; D5 pack gates and room measure into `metrics.mjs`; D6 container shed
      handling; D7 dead code; D8 `wipeTune.js:56` explanation line.

- [ ] #83 **Propose a skill that codifies the whole-codebase review and refactor.** The process
      record is `tmp/review/HOW.md` (lint setup, anti-slop rules, measurements). Propose; do not
      write it without a yes.

- [ ] #84 **Remove the session scratch.** `git worktree list` still names four worktrees `wt-a` to
      `wt-d` in an old session scratchpad, detached at `8085875`, each with uncommitted changes.
      Check that their work is in `main`, then `git worktree remove --force` each (or
      `git worktree prune` if the directories are gone). `tmp/d1/runs/base500.jsonl` (1.7 GB) is
      the golden master at `21491cc`, before the last three commits, and is obsolete.

- [ ] #79 **The owner has notes on the Afloat, Skateboard and Raccoon benches** (`art/bench/float.html`,
      `skate.html`, `raccoon.html`). Ask for them; the owner gives them when ready.

- [ ] #80 **A notes feature on those three bench pages.** The owner writes a note on a page, and
      the note is saved together with the page's settings at that moment. Other bench pages
      (`bike-v`, `barrow`, `bag-rip`, `can-handles`, `couch-wear`) already have notes; these three
      do not.

- [ ] #51 **The crow is built as the coach** (`CROW.md`, `dialogue/crow.json`, the director). Open:
      Act 1's pack line still reads "(raccoon only, crow pinned)".

- [ ] #66 **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last constraint in the
      chooser nobody has measured. Run Act 3 at `--maxpiece 1` and judge the two acts on ramp mix,
      outline count, par band and `onPath` spread. If the unbounded pool wins, delete the flag.

- [ ] #73 **L57 carries stranding traps.** Undo is free and unbounded, so it was left as is. Soften
      it only if the owner wants it softened.

- [ ] #76 **Every animation gets animated by hand**, frame by frame, in code, cell-perfect against
      the rules. No AI video clip is usable. Still to animate: the raccoon (sitting, crawling,
      pushing a thing; not a walk cycle), the can tip, the jug pour (the jug stands free), the
      pane shatter. Bench pages exist for `can-tip`, `jug-tip`, `pane` and
      `raccoon_cartoon_v1`–`v3`; their state is the owner's call.

- [ ] #78 **Object art is straight side views.** The stills in `tmp/pixelart/out/` were rendered
      and none was chosen. Standing objects are side elevations with no skew; only the floor and
      loose trash are top-down.

- [ ] #67 **Parked idea, not approved work: the roller skate.** The slot the barrow occupies
      structurally but not fictionally.

## Context

### The gates

`npm test`, `node tools/verify.mjs`, `node tools/conform.mjs`, `node tools/matrix.mjs`.
A rules change is also played in the browser (headless) before it is called done.

### Golden master, for any refactor of `src/rules.js`

- `bash tmp/d1/golden.sh <tree root> <label> 24 500` walks every pack room and matrix case to
  500 states and hashes every `explain` answer. About 7 minutes on 24 cores. It writes
  `tmp/d1/runs/<label>.jsonl` (about 1.7 GB; delete it after) plus `.digests` (one line per room)
  and `.totals`.
- `tmp/d1/runs/fix23.jsonl.digests` is the baseline for the current `src/rules.js`.
- Old tree for a comparison: `git archive <ref> src levels tools package.json | tar -x -C <dir>`.
- `node tmp/rq/gmdiff.mjs <old tree> <new tree> <old digests> <new digests> 500 [per-family sample]`
  asks both engines every state and direction of each changed room and sorts the first
  difference by kind. Shard it with env `SN=24 SK=<k>`.
- **Trap:** `gm.mjs` hashes a key whose value is `undefined` as `"~u"`. A change that writes
  `undefined` to new keys changes every digest and no answer. `gmdiff.mjs` ignores such keys;
  trust it, not a raw digest count.
- Speed: `node tmp/d1/bench.mjs <tree root> 5 3000`, four interleaved old/new pairs. The median
  is about 1,020–1,050 ms. A slowdown above about 3% is a defect.

### Headless play

`tmp/rq/play.mjs` is a working example: Playwright Firefox from
`/home/menser/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js` via `createRequire`;
`index.html?acts=../tmp/rq/pack.tt&debug&pixel`; press Escape four times first; then
`__tt.goto(id)`, `__tt.walk(keys)`, `__tt.grid()`.

### Driving the page, and its traps

- **A room with `:arm on` needs two presses per shove.** Wrap each press in a retry that fires
  again when the move count did not advance.
- **Close the picker dialog after choosing a room**, or it swallows every arrow key.
- **The page holds the level data it fetched at load.** Navigate again after rewriting a pack.
- **A bench pack can live in `tmp/`** (`index.html?acts=../tmp/x.tt&debug`). It needs `:par` and
  `:solve` lines to parse; placeholders are fine.
- **A beat is too fast for a mid-beat screenshot.** Freeze `performance.now` after a press.
- **Agent worktrees under `.claude/worktrees/` double the `npm test` count.**

### Authoring machinery in `tmp/` (gitignored)

- `tmp/author.mjs` — `judge(level)` runs every `verify.mjs` check against a level in memory.
- `tmp/write-room.mjs` — replaces one room across the `.tt`, the `.sol` and `levels.md` together.
- `tmp/remeasure.mjs` — says which declared numbers moved and which rooms went unsolvable.
- A room in a SET shares outline, door, raccoon and constant furniture with its siblings. A redo
  holds those fixed; the levers are the added pieces, then the decks, then door and raccoon
  (`tools/resite.mjs`). Shard searches across node processes.

### Governance

- **Commits and pushes are the owner's call.** Ask first, every time.
- **`CLAUDE.md` § NO PROSE IS EVER A RULE.** Check each red test against the ruling before
  updating it.
- **NOTHING IS SHIPPED. Rules before levels.**
- **Do not mention `engine/` at all.**
- **The dead-board indicator stays a bare state. A blocked barrow hook keeps re-taking.** Owner's
  calls.
- **Copy work uses the global `copy:` skills.** The deleted `.claude/skills/` copies stay
  uncommitted; the owner said not to worry about them.

### The hold, as built

- `grip` is an edge on the holder. `CUT = 0` is the scrape's mark for the beat; `holds()`
  excludes it, and `letGo` does not clear it.
- `letGo` (in `src/rules.js`) ends every hold that a rolled thing is part of. `lift`/`put` carry
  `grip` with a moving cart.
- Drawn by the `holds` and `grips` layers in `src/main.js`, read off the beat's board.

### The pixel art

- Target look: `art/reference/alley-gold.png`. Benches: `art/bench/` (see its README); tuned
  values are the defaults in `art/bench/trash/look.json`.
- The AI work is in `tmp/pixelart/`, gitignored. The GPU is used only from 23:00 to 05:00.

## Next Step

**#81** — ask the owner for a yes, then move the three single-thing moves onto `lift`/`put` and
prove it with the golden master against `fix23.jsonl.digests`.

/home/menser/Dropbox/ai/code/treasure_trash
