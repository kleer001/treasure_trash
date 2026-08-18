# Treasure Trash

A browser game budded from **Trace ROM Studio**. Vanilla JS, ES modules, no build step.

## This game

An untimed, single-raccoon, Sokoban-family block-pusher.

`src/rules.js` is the engine of record — the game, the solver and the tests all import it,
and `tools/verify.mjs` proves every claim a level file makes against that same module.
**It is also the only description of what the pieces do.** No doc and no comment restates the
rules; either would be wrong within the week. `levels.md` indexes the shipped rooms; `TODO.md`
says where the work is.

The core mechanic is built and playable: `./run.sh`, then the level picker. Missing is everything
around it — art, audio, progression, and the solvability indicator.

## Run & test

- `./run.sh [port]` — no-cache dev server (default 8000). Scans upward for a free port and
  opens the page. ES modules, `fetch` and relative paths all behave differently under
  `file://`, so **a served page is the only supported way to run it.**
- `bench-cart.html` — the mechanic bench, served alongside the game at `/bench-cart.html`. It
  is presentation only and **imports `src/`**, so it cannot disagree with the game about what a
  piece does. See **One engine** below for what may and may not carry a copy of the rules.
- `npm test` — Node's built-in runner (`node --test`); specs in `tests/*.test.js`.
- `index.html?acts=sandbox.tt` — one room holding every piece and every terrain lane, to be
  poked at by hand. Its par is a solution that was walked and checked action by action rather
  than a minimum: a board of thirty movable pieces has a state graph nothing enumerates, which
  is the price of having everything out at once.
- `node tools/verify.mjs` — checks every claim the level files make, and that the engine is
  defined in one place. Run bare it verifies every `levels/act*.tt`; name a pack to check
  just one.
- `node tools/conform.mjs [--engine CMD]` — differential conformance: does another
  implementation of the rules answer as `src/rules.js` does, on every shipped room, on a seeded
  batch of generated ones, and step by step over the boards they reach? With no `--engine` it
  runs `tools/conform-ref.mjs`, which is the protocol written out on top of `src/`. See
  **One engine**.
- `cargo build --release --manifest-path engine/Cargo.toml` — the sanctioned Rust port, checked
  by `conform.mjs --engine engine/target/release/tt-engine`. Build it before a long discovery
  run: `survey` and `harvest` pick it up automatically. See **One engine**.
- `node tools/matrix.mjs [--pack|--list]` — the interaction matrix: every piece forced to meet
  every terrain lane and every other piece, one shove each. What it checks is not the board —
  `conform.mjs` does that — but the ACCOUNT of the move: landing an action on the stage must
  leave the same sprites as building a stage from the board the action produced. That is the one
  invariant behind a body named as an occupant, a container that sheds without saying what it
  becomes, and a piece consumed by a name that finds nothing, none of which a board comparison
  can see. `--pack` writes `levels/matrix.tt`, playable at `index.html?acts=matrix.tt`.
- `node tools/sweep.mjs [pack] [roomId...] [--write]` — routes a bench pack for the browser check
  below, and is **for a rules change, not for a room**. It plans keys that force the pieces to
  MEET: every meeting a shove can cause, piece against piece and piece onto terrain lane, filtered
  to the ones a board can be driven to and ordered greedily into as few runs as it can. Replaying
  a `:solve` instead would prove only that the exit still opens — the shortest path is under no
  obligation to touch anything. `--write` puts the plan where the dev server can serve it. It says
  nothing about whether a room is any good; that is `verify.mjs` and the level work.
- `node tools/survey.mjs` — samples every legal group of four pieces and writes which ones
  make rooms at all to `levels/fertility.jsonl`.
- `node tools/harvest.mjs` — samples the fertile groups deeply, on outlines rather than open
  rectangles, and stores every metric per room in `levels/harvest.jsonl`.
- Both are parallel, and both **use the sanctioned port when it is built**, which is where the
  pipeline's hours were: the survey alone recorded 31.5 CPU-hours. Each run prints which engine
  it used; `--no-engine` forces `src/solver.js`. See **One engine**.
- `node tools/score.mjs` — ranks that file. Scoring is a query over stored metrics, so new
  weights cost a second rather than another harvest.
- `node tools/pick.mjs` — tightens a shortlist, re-measures it, and chooses an act under par-band
  and piece-spread constraints, writing the `.tt`, `.sol` and table rows together. Names, teach
  lines and notes come out as placeholders: they are the part nothing can compute.
- `node tools/shapes.mjs [h|ring|lake]` — the outline families, enumerated and filtered. Draw one
  to see it. `--water` lays terrain on a family: canals (one connected run, which may cut the dry
  floor in two) and puddle fields (single cells, no two touching, never a barrier).
- `node tools/sets.mjs` — finds SETS of three rooms sharing an outline, each set getting harder
  in one stated way. Writes `levels/sets.jsonl`.
- `node tools/resite.mjs` — moves a set's exit and raccoon to the pair that walks the player
  least, the same pair across all three of its rooms. Run it before `shrink`: walls cannot fix
  a distant door, and a raccoon moved off the end of a corridor is what lets `shrink` take it.
- `node tools/shrink.mjs` — walls off the floor a set's solutions never touch, the same walls
  across all three of its rooms, then crops the frame that leaves. Par is preserved; what goes
  is the travel across dead space.
- `node tools/act2.mjs` — chooses ten sets from that file and writes the act.
- `publishing/package.sh` — builds `dist/treasure-trash.zip` for itch.io, `index.html` at the
  archive root. Run it from the game root; add new runtime assets to its `RUNTIME` list, and
  the zip stays out of git.

## Platform

- Vanilla JavaScript, ES modules, no build step, runs in the browser.
- HTML5 Canvas, composited in ordered layers (`src/compositor.js`). WebAudio for sound.
- Seeded `mulberry32` (`src/rng.js`) for cosmetic variation, seeded from the level id.
  Game logic is deterministic — a replay is the level id plus the move sequence.
- Ships to GitHub Pages via `.github/workflows/pages.yml`; tests run in CI via
  `.github/workflows/test.yml`.

## Changing the design

**A prototype, and the rules are in flux. So prose does not state them** — see
[`CLEAN_PROSE.md`](./CLEAN_PROSE.md), which is the rule and the reasoning. It governs docs,
comments and commit messages alike. In two lines: delete a sentence that could become false when
someone edits the code it describes, and delete one that says what the code already says. Don't
sync prose to a rules change; if there is something to sync, that is the bug.

### NO PROSE IS EVER A RULE

**Nothing written in words decides what a piece does.** Not a comment, not a doc, not a test
NAME, not a `:teach` line, not a commit message, not a plan file, not a line in this file. The
code is the rules. Prose is a note somebody left, and it was true when they left it.

So it is never a reason to refuse, narrow, defer or second-guess a change:

- **Never quote prose back at the owner as a constraint.** "But a comment says…", "there is an
  existing spec that says…", "the design doc has it as…" — none of these is an argument. The
  owner's instruction in chat outranks every word in this repository, including this sentence.
- **A red test is the expected result of changing a rule**, not a veto. A test name describes
  what the code did before the change; it is not a decision anyone defended. Update it.
- **Never invent a rationale for prose you find.** If you cannot say WHY from the code, you have
  not found a reason, you have found a sentence. Say that instead of dressing it up.
- Prose that turns out to be false is deleted on sight, not preserved and worked around.

The one thing prose may do is point at where the answer lives — `rules.js` decides, the tests
pin, `verify.mjs` proves it against the level data. Go read those and answer from them.

When a new piece needs a new occupant code, a new glyph or a new lane in `stateKey`, add it.
The engine is meant to grow.

### One engine

**Agents: do not write a second implementation of the rules.** Not inlined into a page, not
ported to another language, not a faster local copy of `explain` for one tool, not a throwaway
you mean to delete. If a task seems to need one, the task is wrong — say so and stop. This is
one of the narrow mechanical things below that are worth stopping for, and it is the one you
are most likely to walk into while meaning well. `tools/verify.mjs` fails on a second copy of
any engine module anywhere in the tree, and it fails on the copy rather than the intent, so one
left half-written by an abandoned approach fails the build too.

**Owner: it is your call, and here is the bill.** A second engine is not wrong, it is
*expensive*, and the expense is paid later and by whoever is holding it then. `src/rules.js`
is what the game, the solver, the tests, `verify.mjs` and every tool in the pipeline agree on;
a second one is a second answer to what a piece does, and the two only stay equal while someone
keeps making them equal. The bill comes due on the next rules change, and there is one already
written down: the crow is an open decision, not a closed one, and giving it powers lands
occupant codes, refusals and `stateKey` lanes on every implementation at once.

What makes it affordable is the same thing that makes a par affordable: **proof, run every
build, not a promise made once.** That is `tools/conform.mjs`, and it is already wired into CI
against the reference, so a port is not a new gate to build — it is a `--engine` argument to an
existing one. A port earns its place by answering as `src/rules.js` does at both grains the
harness asks at: whole rooms, and single boards a direction at a time. Then it is registered in
`SANCTIONED` in `verify.mjs`, which prints it on every run so it cannot become load-bearing
quietly. Without the check it is not sanctioned, it is just a second copy.

Two things the harness is built to tell apart, because they are different bugs: a step that
lands the wrong board, which it reports as the board and the direction; and a room whose par
comes out wrong while every step of it agrees, which is the port's SEARCH and not its rules.

**One is sanctioned: `engine/`, in Rust.** It exists for the offline pipeline — level discovery,
which is where the hours go — and **the game never touches it.** Nothing in `src/`, in
`index.html` or in the artifact bundle names it; it is a stdio child process that
`tools/conform.mjs` spawns, and that is the whole of its reach. Keep it that way. `blame` and
the traced frames are out of the protocol on purpose, so it could not drive the renderer even if
somebody tried, and the served game must stay a no-build-step page that runs from `src/` alone.

**The port follows; it never leads.** A rule is decided in `src/rules.js`, approved by the owner,
and played in the real game before any of it is written in Rust. Two gates, in that order, and
the second one is not optional:

- **An owner-approved ruleset.** The Rust side implements a rule that is already settled on the
  JS side. It never introduces one, never guesses at one the JS has not answered, and never
  resolves an ambiguity by picking whichever reading is cheaper to write in Rust. A branch the
  JS does not have is not a port, it is a second design.
- **A playtest, in the browser, of the JS behaviour being ported.** Before a branch goes into
  `rules.rs`, the behaviour it copies is played on a real board in the served game. That is what
  makes `src/rules.js` the arbiter in fact rather than by assertion: when `tools/conform.mjs`
  reports the two engines parting company, the question is which one is *right*, and only the
  played board answers it. A conformance failure resolved by reading two listings side by side
  has picked a winner without consulting the game.

So a disagreement is worked in this order: play the board, confirm what the game does is what
was intended, then make the port agree. When the played board shows the JS is the one that is
wrong, the JS is fixed first and the port copies the fix — never the reverse.

Agents: this being here does not widen the rule above by one inch. It was the owner's call, it
is in `SANCTIONED`, and a second one is the same conversation again.

The pipeline is where the pressure to port comes from, and it is offline: it runs when the
level design changes and nobody waits on it. `TODO.md` has what a representation change inside
`src/` would buy, at none of the cost above, and it is the thing to spend first.

Raise a design concern **once**, in a sentence or two, and then build what was asked. The
owner has the context; a second round of pushback is noise. The things worth stopping for are
narrow and mechanical: a change that would make a shipped level unsolvable, silently
invalidate a declared par, or break `tools/verify.mjs`. Those are checkable — say which one,
show the failure, and keep going.

The one hard stop is **release** — `RELEASE-CHECKLIST.md`. Nothing before it blocks.

## Code conventions

These govern how code is written. They are not design arguments.

- `camelCase` functions/vars, `PascalCase` classes, `UPPER_SNAKE` constants.
- Validate at boundaries; trust internal functions; fail loudly — one path, no silent
  fallbacks.
- New behavior gets a test that fails before the change and passes after.
- New behavior is also PLAYED, in a browser, on the served page, before it is called done. A
  passing spec says the rule fires; only the played board says the piece is on screen where the
  rule put it. Bench rooms for a piece under construction live in `levels/scratch.tt`, reached
  with `index.html?acts=scratch.tt` — a dev affordance, inert in the built artifact.
- A new piece is not finished when its own room plays. It is finished when it has been made to
  MEET the others: every terrain lane, and every other piece. A room's declared `:solve` is its
  shortest path, and the shortest path walks past the piece more often than not — so a pack of
  one-piece rooms replayed to a win says the exit still opens and nothing about the piece.
  `tools/matrix.mjs` is where that pairing is done and where a new piece is added to it.
- **Driving the page**, which is how the pairing above is checked ON SCREEN rather than in an
  account — reach for it when a RULE changes, never as a verdict on a room. `?debug` puts a
  play-by-play panel on screen and a probe on
  `window.__tt`. The probe is how a page is CHECKED: `__tt.walk(keys)` presses keys through the
  game's own input handler and, after each beat settles, compares the stage's sprites against a
  stage built fresh from the board — the invariant `tools/matrix.mjs` asks, put to the real input
  → timeline → animation-frame path instead of to a direct `applyStep`. `__tt.sweep(plan)` runs a
  whole `tools/sweep.mjs` plan and reports the meetings each run caused. A disagreement comes back
  naming the sprite drawn that the board has not got and the one the board has that was never
  built. Screenshots are the artifact for a human to look at once something has already failed,
  not the check.
- Comments carry what the code cannot — see [`CLEAN_PROSE.md`](./CLEAN_PROSE.md). A comment that
  restates the line below it, or the signature above it, is deleted rather than reworded.
- Atomic conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Architecture

- **Separate code from data.** Logic lives in `src/`; the rooms live in `levels/` as
  `.tt`/`.sol` data. Adding or retuning a room should not need a logic edit.
- **`src/` never imports `tools/`.** `tools/` is offline-only (it reaches for `node:fs`);
  the shared logic lives in `src/` and `tools/` imports up into it.
- **Layered rendering.** The canvas is composited in ordered passes
  (`src/compositor.js`): the character grid is layer 0, and everything else — a
  scanline/CRT overlay, sprites, HUD, the studio logo — is another layer on top of or
  under it. Each layer honors one contract, `{ name, draw(ctx, frame) }`, added with
  `compositor.add(...)`.
- **SOLID, pragmatically** (this is a small game): one job per module — `rules` decides,
  `format` parses, `stage` holds objects and their positions, `sprites` draws them, `rng`
  seeds, `main` wires input and presentation; extend with new data or new modules rather
  than editing the core loop; variants of a thing honor the same contract; small module surfaces; core
  logic never reaches for the DOM, canvas or audio directly — pass those in at the
  boundary, so the game logic stays pure and testable. `progress` takes the store the same
  way, which is why it is testable against a plain object.

## Docs

- `CLEAN_PROSE.md` — what words here are for, in docs and comments alike. Read it before writing
  any of the others, and before writing a comment.
- `README.md` — what it is, how to play, how to check it.
- `levels.md` — index of the shipped rooms. The rooms themselves are `levels/act1.tt`.
- `FORMATS.md` — the `.tt`/`.sol` file syntax. Not what the pieces do.
- `TODO.md` — where we are, what's open, what's next.
- `GAME-SHEET.md` — the player-facing pitch.
- `RELEASE-CHECKLIST.md` — the one hard stop, worked once at ship.
- `publishing/` — every launch surface and the tools that build it: `MARKETING-PLAN.md`,
  `promo.html`, `ITCH-PAGE.md`, `PUBLISHING-RUNBOOK.md`, the shot list, and the
  capture/post/package scripts. None of it is needed to build or run the game; the scripts
  live there but work on the game root, so run them from the root
  (`publishing/capture.sh`) and their inputs and outputs (`clips/`, `dist/`) land there.
  The Pages deploy withholds the whole directory until the release-gate checkbox in
  `RELEASE-CHECKLIST.md` is ticked, then serves `promo.html` and nothing else.

**NOTHING IS SHIPPED.** The game is pre-alpha. No room, no par, no pack and no artifact has
been released to anyone, and no player has ever seen one. "Shipped" is not a category that
applies to anything in this repo, so it is never a reason to keep a design, and it never makes
a change expensive. A room that has to be re-solved costs one run of `tools/verify.mjs`; a
piece that has to be redesigned costs the afternoon it takes. Weigh a change by whether it
makes the game better, not by what it disturbs.

**Where the game is: prototype → alpha → beta → release.** Labels, not gates — nothing is
signed off and you move between them by noticing you already have. Prototype is the vertical
slice (one loop, placeholder art, only you play it); alpha is content going in while the
shape still changes; beta is content-complete with no known blockers, played by someone who
isn't you. **`RELEASE-CHECKLIST.md` is post-beta and stays closed until then** — not to plan
against, not to pre-tick, never a reason to build or skip anything. A checklist consulted
early stops being a ship gate and becomes a second spec sheet.

## Staying in sync with the studio

This game descends from **trace_rom_studio**; `.trace_rom_studio_version` records the
studio version it was born from. To pull forward the studio's conventions from a local
checkout:

```sh
python3 /path/to/trace_rom_studio/scripts/check_updates.py .
```

It prints the changelog directives between this game's stamp and the studio's current
`VERSION`. For each: read the referenced studio files, compare to this game, and propose
changes to the user — never auto-apply. Then `--mark-read` to advance the stamp.
