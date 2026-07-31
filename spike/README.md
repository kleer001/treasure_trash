# Spike — Treasure Trash L0–L3

**Throwaway feasibility spike. NOT the game.** Per the studio design gate, this is the
one allowed pre-gate artifact: a spike to answer a specific risk before any real
`src/` code exists. It lives here, outside `src/`, and can be deleted once it's served
its purpose.

## The question it answers
Does the raccoon's core loop — **directional 2×3 burst + persistent trash + the
side-cell corollary** — actually feel like a good puzzle, i.e. does *"fire your mess
away from the path you still need"* read and play cleanly?

**Second question (added with the exit):** does requiring the raccoon to *leave*
sharpen that lesson or just tax it with walk-back moves? Every room's exit is placed
to forbid at least one strike or push direction — L1's forbids the down-strike, L2's
forbids shoving the can left, L3's sits in the corridor the room already taught you
to protect. If it still reads as a tax in play, that's the finding.

## Run
- Open `index.html` in any browser (self-contained, no server, no build).
- Arrows / WASD to move-strike-push · **U** undo · **R** restart · level tabs.
- The **fan preview** tints where your trash will land: yellow = valid strike,
  red = blocked (can't tear that way).

## Verify (proves the rooms are solvable in par)
```
node verify.mjs
```
All logic mirrors `index.html`. It checks:
- **L0–L3 solve in par** (2 / 4 / 7 / 5), where winning means *every bag torn **and**
  the raccoon standing on the exit*.
- **Par is minimal, not asserted** — a BFS over the whole state space finds the
  shortest win for each room and confirms it equals the stated par (Laws list 4:
  ship a solver, and surface unintended solutions).
- **The exit stays inert while bags remain** — L2 walks over it mid-solve and nothing
  happens.
- **Three soft-locks fire:** L1's legal-but-fatal down-strike buries the exit, L2's
  mirror solve parks the can on the exit with no way to shove it off, and L3's wrong
  strike seals the corridor *and* the exit under one trash row.

## Scope / omissions (deliberate)
- Raccoon only (crow pinned). No cans-as-bridges, no multi-fan interference yet.
- No compositor / RNG / audio — a spike, not the house-stack game.
- Levels are the verified ones from `../levels.md` (L0 Out, L1 Pounce, L2 Heavy Can,
  L3 Fire Away From the Path).
