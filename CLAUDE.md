# Treasure Trash

A browser game budded from **Trace ROM Studio**. Vanilla JS, ES modules, no build
step. This file is the studio's house brief in miniature — it travels with the
game so a Claude Code session here keeps the context it had in the studio.

## This game

An untimed, single-raccoon, Sokoban-family block-pusher. Tearing a bag sprays a
**2×3 fan of permanent trash** ahead of the strike; nothing ever clears it. Win by
opening every bag **and** standing on the exit, which is terrain the engine refuses
to let anything else occupy.

- **The ruleset lives in `levels.md`; what to build lives in `SPEC-SHEET.md`.** Where
  prose and code disagree, `src/rules.mjs` is the engine of record.
- **The game lives in `src/` and there is exactly one of it.** `src/rules.mjs` (the
  rules), `src/solver.mjs` (exhaustive analysis) and `src/format.mjs` (the `.tt` level
  format, `FORMATS.md`) are imported by the game, the verifier, the metrics tool
  and the tests alike; the presentation modules around them (`session`, `view`, `layers`,
  `sprites`, `anim`, `input`, `audio`, `hud`, `theme`) are the game itself, wired by
  `src/main.js`. **Never re-author any of it in a second place.** If it needs to change
  shape, move and edit it — a rewrite is how a codebase ends up with two engines that
  disagree.
- **`tools/` owns no rules and no rendering.** The verifier, the metrics tool and the
  publishing bundler import `src/`; they never restate it. Levels are data in `levels/`.
- **No randomness in logic at all.** Every room is hand-authored and deterministic;
  `src/rng.js` is for *cosmetic* variation only, seeded from the level id. A replay is
  the level id plus the move sequence.
- **The crow is pinned** — parked deliberately until the raccoon-alone game proves fun.
- Gate status: the design gate is closed. The MVP gate is next and blocks further
  building once the slice first plays.

## Run & test

- `./run.sh [port]` — no-cache dev server (default 8000). Open the URL.
- `npm test` — Node's built-in runner (`node --test`); specs in `tests/*.test.js`.
- `npm run verify` — proves every claim both level packs make against the engine, and
  that `levels.md` still draws the rooms it documents. Runs in CI beside the tests.
- `npm run metrics` — the room-quality table. Prints, never fails.
- `npm run artifact` — bundles the game into one self-contained HTML file for publishing.

## Platform

- Vanilla JavaScript, ES modules, **no build step**, runs in the browser.
- HTML5 Canvas, composited in **ordered layers** (`src/compositor.js`). WebAudio for sound.
- Seeded `mulberry32` (`src/rng.js`) for any randomness — **never `Math.random()`**.
  This game keeps its logic entirely deterministic, so the seed reproduces appearance
  only (see *This game*).
- Ships to GitHub Pages via `.github/workflows/pages.yml`; tests run in CI via
  `.github/workflows/test.yml`.

## Conventions

- `camelCase` functions/vars, `PascalCase` classes, `UPPER_SNAKE` constants.
- Validate at boundaries; trust internal functions; **fail loudly** — one path,
  no silent fallbacks.
- New behavior gets a test that fails before the change and passes after.
- Atomic conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Architecture

- **Separate code from data.** Logic lives in `src/`; the numbers that tune the
  game — levels, tables, tuning constants, content — live as data (JSON or plain
  data modules), never hard-coded in functions. You should be able to retune or add
  content without editing logic.
- **Layered rendering.** The canvas is composited in ordered passes
  (`src/compositor.js`). The board runs four (`src/layers.js`): `terrain`, `pieces`,
  `guides`, `confetti`. Each layer is a small module honoring one contract,
  `{ name, draw(ctx, frame) }`, added with `compositor.add(...)`, and reads only the
  frame it is handed. Anything else — a CRT pass, a HUD overlay, the studio logo — is
  another layer *on top of or under* those. Reach for a new layer before you reach into
  the loop.
- **DRY.** One source of truth for every rule and constant. If a value or a piece
  of logic appears twice, hoist it — copy-paste is a bug waiting to drift.
- **SOLID, pragmatically** (this is a small game, not an enterprise app):
  - *Single responsibility* — each module does one thing (`rng`, `board`, `render`,
    `audio`, `input`). If it's doing two, split it.
  - *Open/closed* — extend with new data or new modules, not by editing the core
    loop every time.
  - *Liskov* — variants of a thing honor the same contract; a caller shouldn't have
    to special-case which one it got.
  - *Interface segregation* — small, focused module/function surfaces; don't make
    callers depend on what they don't use.
  - *Dependency inversion* — core logic never reaches for the DOM, canvas, or audio
    directly; pass those in at the boundary. Keep game logic pure and deterministic
    (it's the half that gets tested).

## Docs

- `SPEC-SHEET.md` — the buildable spec.
- `levels.md` — the authoritative ruleset and the room-by-room design.
- `FORMATS.md` — the `.tt` level format and what the verifier enforces.
- `MARKETING-PLAN.md`, `promo.html`, `ITCH-PAGE.md` — launch assets, finalized at the
  release gate. They still carry template placeholders.

## Staying in sync with the studio

This game descends from **trace_rom_studio**; `.trace_rom_studio_version` records the
studio version it was born from. When the studio's conventions improve, pull them
forward from a local studio checkout:

```sh
python3 /path/to/trace_rom_studio/scripts/check_updates.py .
```

It prints the changelog directives between this game's stamp and the studio's current
`VERSION`. For each: read the referenced studio files, compare to this game, and
propose changes to the user — **never auto-apply**. Then `--mark-read` to advance the
stamp. Independence is the default; this is opt-in, one directive at a time.

## House ethos

Lead with the answer; cut filler. **Never fabricate** a fact, source, quote, or
date — in code, docs, or marketing copy. "I don't know" is a valid answer.
