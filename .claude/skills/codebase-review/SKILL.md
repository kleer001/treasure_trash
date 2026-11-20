---
name: codebase-review
description: Whole-codebase review and refactor of Treasure Trash — measure, review by area, write one review file in sections R, B, T, C and D, let the owner pick, then fix and refactor with proof that nothing else changed (golden master, speed bench, drawing snapshots). Scope is src/, tools/ and tests/. TRIGGER when the user asks for a whole-codebase review, a full review, a code audit, a review and refactor pass, or "review everything", or invokes /codebase-review.
---

# Whole-codebase review and refactor

Scope is `src/`, `tools/` and `tests/`. Bench pages (`art/bench/`) and other pages are never in
scope, and the review asks no question about them.

`S` below is the session scratchpad. `K` is this skill's `scripts/` folder. Review output goes in
the repo's `tmp/review/`.

## 1. Commit first

The review starts from a clean tree. If the tree has uncommitted work, ask the owner for a yes to
commit it. Every commit and every push needs the owner's yes.

Record the commit the review starts from. The review file names it.

## 2. Mechanical gates

```sh
npm test
node tools/verify.mjs
node tools/conform.mjs
node tools/matrix.mjs
```

Each gate passes before the review goes on. A failure is the first finding. Do not run meeting
sweeps (`tools/sweep.mjs` with `__tt.sweep`).

## 3. Measurements

Install the tools in the scratchpad. This needs no question to the owner: nothing touches the repo.

```sh
bash $K/lint.sh $S/lint src tools tests        > tmp/review/lint.txt
ACORN=$S/lint node $K/erosion.mjs --top 30 src > tmp/review/erosion-src.txt
ACORN=$S/lint node $K/erosion.mjs --top 30 tools > tmp/review/erosion-tools.txt
```

- `lint.sh` installs Oxlint, its plugin package, acorn and esbuild. It builds the
  dmmulroy/anti-slop rules, then runs those rules and Oxlint's default checks on each directory.
- `erosion.mjs` is SlopCodeBench's erosion measure: the share of complexity mass (CC × √SLOC) in
  functions above cyclomatic complexity 10. Keep the before figure; measure again after the
  refactors.

## 4. Review by area

Start one review agent for each area. Give each agent its files, the measurements of step 3 and
the project `CLAUDE.md`. Each agent writes `tmp/review/stage2-<area>.md` with a quote, a line
number and, where it can, a probe script for each finding.

| Area | Files |
|---|---|
| rules | `src/rules.js`, `src/solver.js`, `src/format.js` and their tests |
| shell | `src/main.js`, `src/play.js`, `src/stage.js`, `src/debug.js`, the crow modules and their tests |
| drawing | `src/sprites.js`, `src/pixel.js`, `src/clips.js`, `src/compositor.js` and their tests |
| art | `src/art/` and its tests |
| tools | `tools/` and its tests |

Each agent looks for: bugs; rule questions (behaviour the code does that the owner may not want);
tests that cannot fail or test the wrong thing; comments that break the `CLAUDE.md` comment
rules; copied knowledge (DRY); dead code.

Then run, on the same commit:

- `/code-review high`
- `/karen --jury 3`

## 5. One review file

Merge every finding into `tmp/review/codebase-review.md`. Drop duplicates. Check each finding
against the code before it goes in. Number each item inside its section.

```markdown
# Whole-codebase review (commit <hash>)

Per-area reports: `stage2-rules.md`, `stage2-shell.md`, ...

## R. Rule questions (owner)
- **R1** `file` `function`: what the code does, and the room or board that reaches it.

## B. Bugs with one obvious fix
Game / Harness / Tools / Latent (no current data reaches them)
- **B1** `file:line`: the input, and the wrong result.

## T. Tests that cannot fail or test the wrong thing

## D. Design (one refactor at a time)
- **D1** what is copied or tangled, where, and the proof the refactor needs.

## C. Comments that break the CLAUDE.md rules
Counts by area. One `comment-sweep` pass per area.
```

An R item asks the owner about a rule. It never says what the rule should be.

## 6. The owner picks

Give the owner the review file. The owner picks which items to fix and answers each R item. Write
each answer next to its item.

## 7. Fixes

- A bug fix starts with a test that fails. The fix makes it pass.
- A test fix proves the test can fail: break the code under it once, and see it go red.
- A rule change is played in the browser before it is called done (see **Headless play**).
- One fix per commit. Run the gates of step 2 per commit.

## 8. Refactors

One refactor at a time, in its own commit. A refactor changes no behaviour, and it is proven so:

| What changes | Proof |
|---|---|
| `src/rules.js` | golden master and speed bench |
| drawing (`src/art/`, `src/sprites.js`, `src/pixel.js`, `src/stage.js`, `src/wipe.js`) | drawing snapshots |
| the shell (`src/main.js` and its modules) | headless play, and drawing snapshots where the drawing code moved |
| `tools/` | the tool tests, `tools/verify.mjs`, and one run of each changed tool on a small input |

The old tree for a comparison is a `git worktree` of the start commit in `S`. **Never put a copy
of the tree under the repo, `tmp/` included:** `tools/verify.mjs` fails "the engine is defined
once" on it.

### Golden master

```sh
bash $K/golden.sh <old tree> $S/gm old 24 500
bash $K/golden.sh <new tree> $S/gm new 24 500
cmp $S/gm/old.jsonl.digests $S/gm/new.jsonl.digests
```

- It walks every room of every `levels/*.tt` pack, and every case of `tools/matrix.mjs`, breadth
  first to the cap. It hashes every `explain(s, d, {trace: true})` answer.
- Each `.jsonl` file is large. Delete it after the comparison; keep `.digests` and `.totals`.
- When digests differ, ask both engines every state of each changed room:

  ```sh
  SN=24 SK=<k> node $K/gmdiff.mjs <old tree> <new tree> $S/gm/old.jsonl.digests $S/gm/new.jsonl.digests 500
  ```

  Run one process for each `k` from 0 to 23. `gm.mjs` hashes `undefined` values as `"~u"`, so a
  raw digest count can differ when no answer does. Trust `gmdiff.mjs`.
- One room and state: `node $K/gm.mjs <tree> --dump <room name> <state index>`.

### Speed bench

```sh
node $K/bench.mjs <old tree> 5 3000
node $K/bench.mjs <new tree> 5 3000
```

Run six interleaved old/new pairs on a quiet machine (check `uptime` first). Compare the medians.
More than about 3% slower is a defect.

### Drawing snapshots

```sh
ROOT=<old tree> node $K/snapshot-shell.mjs $S/shell-old.json
ROOT=<new tree> node $K/snapshot-shell.mjs $S/shell-new.json
ROOT=<old tree> node $K/snapshot-art.mjs $S/art-old.json
ROOT=<new tree> node $K/snapshot-art.mjs $S/art-new.json
cmp $S/shell-old.json $S/shell-new.json && cmp $S/art-old.json $S/art-new.json
```

- `snapshot-shell.mjs` records sprites, the press, the door, stills, the timeline and the wipe
  panel through a recording canvas.
- `snapshot-art.mjs` records every sprite, clip frame, facing and wet variant.
- An entry that throws is recorded as `ERR` and compared like any other entry. Set
  `ONLY=<name prefix>` to keep the full text of matching entries for a diff.
- A snapshot script imports module exports by name. When a refactor renames an export, change
  the script in the same way for both trees.

### Headless play

Serve the tree with `./run.sh <port>`. Then:

```sh
PLAYWRIGHT=$(ls ~/.npm/_npx/*/node_modules/playwright/index.js | head -1) \
  node $K/play.mjs 'http://localhost:<port>/index.html?acts=act1.tt&debug&pixel' $S/shots <room>=<keys> ...
```

- Walk one small and one large room, plus `sandbox.tt`. Not every room.
- A room with `:arm on` needs two presses per shove.
- The script exits non-zero on a beat that does not agree, land or rest, or on a page error.
- Headless only. Never the Playwright MCP, which opens a window.

### Agents in worktrees

- An agent worktree starts at `HEAD`, not at uncommitted work. Commit before the agents start.
- `npm test` in the main tree also runs the tests inside agent worktrees under `.claude/`. While
  a worktree exists, run `node --test tests/*.test.js` in the main tree.
- An agent runs only the tests of the files it changed. The coordinator runs the full gates once
  per merge.

## 9. Comments

Fix comments with the `comment-sweep` skill, one pass per area, and run its check. A comment fix
is its own commit.

## 10. Close

- Run the gates of step 2 and the measurements of step 3 again. Put the before and after
  figures in the review file.
- Run `/marie --session` on the corrections the owner made during the review.
