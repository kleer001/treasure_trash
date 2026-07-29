# Spike — Treasure Trash L1–L3

**Throwaway feasibility spike. NOT the game.** Per the studio design gate, this is the
one allowed pre-gate artifact: a spike to answer a specific risk before any real
`src/` code exists. It lives here, outside `src/`, and can be deleted once it's served
its purpose.

## The question it answers
Does the raccoon's core loop — **directional 2×3 burst + persistent trash + the
side-cell corollary** — actually feel like a good puzzle, i.e. does *"fire your mess
away from the path you still need"* read and play cleanly?

## Run
- Open `index.html` in any browser (self-contained, no server, no build).
- Arrows / WASD to move-strike-push · **U** undo · **R** restart · level tabs.
- The **fan preview** tints where your trash will land: yellow = valid strike,
  red = blocked (can't tear that way).

## Verify (proves the rooms are solvable in par)
```
node verify.mjs
```
Checks L1–L3 solve in par (2 / 5 / 3) and that L3's wrong strike seals the corridor
(soft-lock). All logic mirrors `index.html`.

## Scope / omissions (deliberate)
- Raccoon only (crow pinned). No cans-as-bridges, no multi-fan interference yet.
- No compositor / RNG / audio — a spike, not the house-stack game.
- Levels are the verified ones from `../levels.md` (L1 Pounce, L2 Heavy Can,
  L3 Fire Away From the Path).
