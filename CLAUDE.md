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
  prose and code disagree, `spike/rules.mjs` is the engine of record.
- **`spike/` is a throwaway prototype, not the game.** It holds a working rules engine,
  an exhaustive solver, the `.tt`/`.sol` level formats (`spike/FORMATS.md`) and a
  verifier that proves every claim a level file makes. Port it into `src/`; don't grow
  the spike into the product, and don't write a second implementation of the rules —
  one engine, imported by the game, the solver and the tests alike.
- **`DESIGN-BIBLE.md` is superseded — history only.** It specifies a retired real-time
  two-animal design. Never implement from it.
- **No randomness in logic at all.** Every room is hand-authored and deterministic;
  `src/rng.js` is for *cosmetic* variation only, seeded from the level id. A replay is
  the level id plus the move sequence.
- **The crow is pinned** — parked deliberately until the raccoon-alone game proves fun.
- Gate status: the design decisions are recorded (`SPEC-SHEET.md` → *Design
  decisions*). The game itself is not built — see *State*, below.

## Run & test

- `./run.sh [port]` — no-cache dev server (default 8000). Open the URL.
- `npm test` — Node's built-in runner (`node --test`); specs in `tests/*.test.js`.

## Platform

- Vanilla JavaScript, ES modules, **no build step**, runs in the browser.
- HTML5 Canvas, composited in **ordered layers** (`src/compositor.js`). The
  character grid is the default base layer, not the whole frame — layering on top
  of and around it is endorsed (sprites, HUD, logo, overlays, a WebGL CRT pass).
  WebAudio for sound.
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
  (`src/compositor.js`): the character grid is layer 0, and everything else — a
  scanline/CRT overlay, sprites, HUD, the studio logo — is another layer *on top of
  or under* it. Each layer is a small module honoring one contract,
  `{ name, draw(ctx, frame) }`, added with `compositor.add(...)`. Reach for a new
  layer before you reach into the loop; the grid is a starting point, not a ceiling.
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

- `GAME-SHEET.md` — the player-facing pitch.
- `SPEC-SHEET.md` — the buildable spec (with the design-gate record).
- `levels.md` — the authoritative ruleset and the room-by-room design.
- `LEVEL-GENERATION.md` — how to build the *next* room: the floor budget, the laws a
  generator selects on, the intent-first pipeline, and the `OLRP` signature to generate to.
  Forward-looking only; measured by `spike/metrics.mjs`.
- `rules.html` — the Block-Pusher Laws, house doc style.
- `spike/FORMATS.md` — the `.tt`/`.sol` file formats and what the verifier enforces.
- `MARKETING-PLAN.md`, `promo.html`, `ITCH-PAGE.md` — launch assets, finalized at the
  release gate. They still carry template placeholders.
- `DESIGN-BIBLE.md` — superseded, kept as history.

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

The studio's review panel is a chat-time lens. **Never write a persona's words to a
file, and never cite one in a doc, comment, test, or commit message.** What survives
a review is a decision you author in your own voice, defended on its merits — a
constraint nobody can check the reason for is a constraint nobody can renegotiate.
CI enforces this; see the `no panel voice on disk` step.
