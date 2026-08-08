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
  piece does. Nothing here may carry its own copy of the engine; `verify.mjs` enforces that.
- `npm test` — Node's built-in runner (`node --test`); specs in `tests/*.test.js`.
- `node tools/verify.mjs` — checks every claim the level files make, and that no page inlines
  the engine instead of importing it. Run bare it verifies every `levels/act*.tt`; name a pack
  to check just one.
- `node tools/survey.mjs` — samples every legal group of four pieces and writes which ones
  make rooms at all to `levels/fertility.jsonl`. Long-running and parallel; findings are
  read in `SPEC-SHEET.md`.
- `node tools/harvest.mjs` — samples the fertile groups deeply, on outlines rather than open
  rectangles, and stores every metric per room in `levels/harvest.jsonl`.
- `node tools/score.mjs` — ranks that file. Scoring is a query over stored metrics, so new
  weights cost a second rather than another harvest.
- `node tools/pick.mjs` — tightens a shortlist, re-measures it, and chooses an act under par-band
  and piece-spread constraints, writing the `.tt`, `.sol` and table rows together. Names, teach
  lines and notes come out as placeholders: they are the part nothing can compute.
- `node tools/shapes.mjs` — the outline families, enumerated and filtered. Draw one to see it.
- `node tools/sets.mjs` — finds SETS of three rooms sharing an outline, each set getting harder
  in one stated way. Writes `levels/sets.jsonl`.
- `node tools/resite.mjs` — moves a set's exit and raccoon to the pair that walks the player
  least, the same pair across all three of its rooms. Run it before `shrink`: walls cannot fix
  a distant door, and a raccoon moved off the end of a corridor is what lets `shrink` take it.
- `node tools/shrink.mjs` — walls off the floor a set's solutions never touch, the same walls
  across all three of its rooms. Par is preserved; what goes is the travel across dead space.
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

When a new piece needs a new occupant code, a new glyph or a new lane in `stateKey`, add it.
The engine is meant to grow.

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
- `SPEC-SHEET.md` — the design sketchpad: decisions and why, systems, open questions.
  Nothing in it is binding, and it is never synced to the code.
- `RELEASE-CHECKLIST.md` — the one hard stop, worked once at ship.
- `publishing/` — every launch surface and the tools that build it: `MARKETING-PLAN.md`,
  `promo.html`, `ITCH-PAGE.md`, `PUBLISHING-RUNBOOK.md`, the shot list, and the
  capture/post/package scripts. None of it is needed to build or run the game; the scripts
  live there but work on the game root, so run them from the root
  (`publishing/capture.sh`) and their inputs and outputs (`clips/`, `dist/`) land there.
  The Pages deploy withholds the whole directory until the release-gate checkbox in
  `RELEASE-CHECKLIST.md` is ticked, then serves `promo.html` and nothing else.

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
