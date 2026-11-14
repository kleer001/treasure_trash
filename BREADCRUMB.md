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

Each todo says who decides it. **Deducible** means a written rule or an earlier owner statement
already answers it; the source is named. **Owner** means only the owner can answer, and the
question is named. Every commit and push still needs the owner's yes.

The D items come from `tmp/review/codebase-review.md` § D. Todos in the same file group run in
series; separate file groups run in parallel:

| File group | Todos, in order |
|---|---|
| `src/rules.js` | #81, then the `rules.js` part of #91 |
| `src/main.js`, `src/sprites.js`, `src/art` | #85, then #86 and #87 in parallel; #88 at any time |
| `tools/` | #89, then #66 |
| `pixel.js`, `clips.js`, `crowWatch.js` | #90 |
| `art/bench/` float, skate, raccoon | #80, then #79 |
| no tracked files | #83, #84 |

### Parallel

- [ ] #81 **The single-thing moves still copy their own cell fields:** the train in `pushRollers`,
      the sweep in `pushBroom`, and the run of things ahead in `shoveCart`. Move them onto
      `lift`/`put`, and prove it with the golden master (see Context).
      **Deducible:** the DRY-first rule (three copies are a defect), and the owner's "a DRY
      issue with a need for SOLID applications". No rule changes.

- [ ] #85 **D3: one direction table and one frame length.** The direction table is copied 5 times
      in `main.js`, 3 in `sprites.js` and 3 in `src/art`; `DIRS` in `rules.js` is the source. The
      60 Hz frame length is in five places. Goes first in its group because it touches all three
      places that #86 and #87 change.
      **Deducible:** the DRY-first rule.

- [ ] #88 **D8: `src/wipeTune.js:56` prints an explanation line on its page.** Delete the line.
      The file is in `src/` and `main.js` imports it, so it is in the review's scope.
      **Deducible:** the global rule "No explanatory text on pages".

- [ ] #89 **D5: one home for the pack gates and the room measure.** Seven tools restate them; move
      them to `tools/metrics.mjs`. `survey.mjs` keeps its own copy of the fan geometry.
      **Deducible:** the DRY-first rule.
      **Owner:** `pick.mjs` and `act2.mjs` both write Act 2. Which one keeps that job?

- [ ] #90 **D6: container shed handling in one place.** It is split between the `DUMPS` table in
      `pixel.js` and `noteDump` in `clips.js`; a new shed kind gets no clip and no error.
      `crowWatch.js` mixes English wording with the watcher.
      **Deducible:** the project rule "fail loudly", and one job per module.

- [ ] #80 **A notes feature on the float, skate and raccoon bench pages** (`art/bench/float.html`,
      `skate.html`, `raccoon.html`). The note is saved together with the page's settings at that
      moment. Copy the pattern of `art/bench/couch-wear.html`: a note field, and an autosave
      that sends the note and the settings to `/notes` on each change. `barrow.html` uses an
      older Send button; do not copy it.
      **Deducible:** the owner asked for it, and the memories "Editor pages autosave" and
      "Editor pages reset" set the controls.

- [ ] #83 **Propose a skill that codifies the whole-codebase review and refactor.** The process
      record is `tmp/review/HOW.md` (lint setup, anti-slop rules, measurements).
      **Deducible:** the memory "Codify the review as a skill" says to propose it.
      **Owner:** a yes before the skill is written.

- [ ] #84 **Remove the session scratch.** `git worktree list` still names four worktrees `wt-a` to
      `wt-d` in an old session scratchpad, detached at `8085875`, each with uncommitted changes.
      Check that their work is in `main`, then `git worktree remove --force` each (or
      `git worktree prune` if the directories are gone). `tmp/d1/runs/base500.jsonl` (1.7 GB) is
      the golden master at `21491cc`, before the last three commits, and is obsolete.
      **Deducible:** these are a session's own scratch files. Look at each target first.

- [ ] #51 **The crow is built as the coach** (`CROW.md`, `dialogue/crow.json`, the director).
      **Owner:** Act 1's pack line still reads "(raccoon only, crow pinned)". Keep it or reword?

- [ ] #73 **L57 carries stranding traps.** Undo is free and unbounded, so it was left as is.
      **Owner:** soften it or not. Difficulty is a design call.

- [ ] #76 **Every animation gets animated by hand**, frame by frame, in code, cell-perfect against
      the rules. No AI video clip is usable. Still to animate: the raccoon (sitting, crawling,
      pushing a thing; not a walk cycle), the can tip, the jug pour (the jug stands free), the
      pane shatter. Bench pages exist for `can-tip`, `jug-tip`, `pane` and
      `raccoon_cartoon_v1`–`v3`.
      **Deducible:** the motion, from everyday physics (memory "Physics answers art questions").
      **Owner:** the look, and the state of the existing bench pages.

- [ ] #78 **Object art is straight side views.** The stills in `tmp/pixelart/out/` were rendered
      and none was chosen. Standing objects are side elevations with no skew; only the floor and
      loose trash are top-down.
      **Owner:** which stills to use.

- [ ] #67 **Parked idea, not approved work: the roller skate.** The slot the barrow occupies
      structurally but not fictionally.
      **Owner:** whether it becomes work at all.

### Sequential

- [ ] #86 (needs: #85) **D2: split `src/main.js`** (1,107 lines, about ten jobs, 24 module `let`s)
      into about eight modules. "Is anything animating" is written three times with three lists.
      **Deducible:** the project rule "one job per module". Show the module plan to the owner
      before the split; the boundaries are a design choice.

- [ ] #87 (needs: #85) **D4: the copies in `src/art`.** Wet cardboard has two implementations; the
      sprite-from-rows loop has 13 copies; there are three hash/noise helpers, and copies of the
      fall curve, ease, clamp and trig. Compare stills before and after to catch a pixel change.
      **Deducible:** the DRY-first rule.

- [ ] #91 (needs: #81, #86, #87, #88, #89, #90) **D7: dead code.** About 30 unused exports in
      `rules.js`, 10 in `src/art`, several in `tools/`; `logo.js` is imported only by its test;
      dead state in `raccoon.js`, `can.js`, `slick.js`, `flight.js`; `gallery.mjs` writes `:par 1`
      for refused rooms. Measure last, because each refactor above adds or removes dead code.
      **Owner:** the global rule says to report unrelated dead code, not delete it, so deletion
      needs a yes. Also: keep and document `gallery.mjs` and `crowjudge.mjs`, or delete them?

- [ ] #66 (needs: #89) **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last
      constraint in the chooser nobody has measured. Run Act 3 at `--maxpiece 1` and judge the
      two acts on ramp mix, outline count, par band and `onPath` spread. If the unbounded pool
      wins, delete the flag. Waits for #89 because #89 rewrites the tools this search uses.
      **Owner:** blocked by "rules before levels" until the owner says the rules are settled.
      It is also a heavy local job, so ask before it runs.

- [ ] #79 (needs: #80) **The owner's notes on the float, skate and raccoon bench pages.** The owner
      writes them in the note field that #80 adds.
      **Owner:** only the owner.

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

Start the deducible Parallel todos together: #81, #85, #88, #90, #80, #84 and the #83 proposal.
Ask the owner the two questions that unblock the most: which tool writes Act 2 (#89), and keep or
delete `gallery.mjs` and `crowjudge.mjs` (#91).

/home/menser/Dropbox/ai/code/treasure_trash
