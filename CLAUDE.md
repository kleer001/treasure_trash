# Treasure Trash

A browser game budded from **Trace ROM Studio**. Vanilla JS, ES modules, no build step.

## This game

An untimed, single-raccoon, Sokoban-family block-pusher. Tearing a bag sprays a 2×3 fan of
permanent trash ahead of the strike; nothing ever clears it. Win by opening every bag and
standing on the exit, which the engine refuses to let anything else occupy.

`src/rules.js` is the engine of record — the game, the solver and the tests all import it,
and `tools/verify.mjs` proves every claim a level file makes against that same module.
`levels.md` documents the shipped rooms; `TODO.md` says where the work is.

The core mechanic is built and playable: `./run.sh`, then L0–L17. Missing is everything
around it — art, audio, progression, and the solvability indicator.

## Run & test

- `./run.sh [port]` — no-cache dev server (default 8000). Open the URL.
- `npm test` — Node's built-in runner (`node --test`); specs in `tests/*.test.js`.
- `node tools/verify.mjs` — checks every claim the level files make.

## Platform

- Vanilla JavaScript, ES modules, no build step, runs in the browser.
- HTML5 Canvas, composited in ordered layers (`src/compositor.js`). WebAudio for sound.
- Seeded `mulberry32` (`src/rng.js`) for cosmetic variation, seeded from the level id.
  Game logic is deterministic — a replay is the level id plus the move sequence.
- Ships to GitHub Pages via `.github/workflows/pages.yml`; tests run in CI via
  `.github/workflows/test.yml`.

## Conventions

- `camelCase` functions/vars, `PascalCase` classes, `UPPER_SNAKE` constants.
- Validate at boundaries; trust internal functions; fail loudly — one path, no silent
  fallbacks.
- New behavior gets a test that fails before the change and passes after.
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
- **SOLID, pragmatically** (this is a small game): one job per module (`rng`, `board`,
  `render`, `audio`, `input`); extend with new data or new modules rather than editing the
  core loop; variants of a thing honor the same contract; small module surfaces; core
  logic never reaches for the DOM, canvas or audio directly — pass those in at the
  boundary, so the game logic stays pure and testable.

## Docs

- `README.md` — what it is, how to play, how to check it.
- `levels.md` — the shipped rooms, with diagrams, solves and measured counts.
- `FORMATS.md` — the `.tt`/`.sol` file formats and what the verifier enforces.
- `TODO.md` — where we are, what's open, what's next.
- `GAME-SHEET.md` — the player-facing pitch.
- `MARKETING-PLAN.md`, `promo.html`, `ITCH-PAGE.md`, `video_shot_list.md` — launch
  assets, still carrying template placeholders.
- `PUBLISHING-RUNBOOK.md` — how itch.io and YouTube actually behave.

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
