fresh

## Summary

The recycle bin now has a terminal state and counts as a bag, and the fertility survey has
run: `levels/fertility.jsonl` maps which mixed groups of four pieces make rooms at all.
The next job is the **deep harvest** — the survey ranks groups against each other at 200
samples, which surfaces only a handful of keepers per group, nowhere near enough to pick
twenty levels from.

## Todos

### Parallel
- [ ] #2 **A scorer worth the compute.** Rank candidates on where the traps sit, not how
      many; on distinctness from the rooms already chosen; and on order-sensitivity. Each is
      expensive per room, which is what the cores are for. Existing pieces: `tighten` in
      `tools/draft-room.mjs`, and the metrics in `tools/metrics.mjs`.
- [ ] #3 **The solvability indicator** (also in `TODO.md`). `solver.js` computes deadness
      offline already; wire it to run after each state change and surface a non-blocking "can
      no longer be won". Best done before any long room ships — see the frustration note in
      Context. **Design note not yet settled:** `analyze()` from the current state is the
      wrong primitive — it computes far more than the question needs. What the indicator
      wants is "is a win still reachable from here", a forward search that stops at the first
      win. Unwinnable is the expensive case, since it enumerates everything still reachable.
      Whether that runs on the main thread or in a worker is the open call.
- [ ] #5 **A cart rolls into open water and comes to rest there.** Nothing stops it, the
      water is unchanged, and the raccoon can neither follow it nor stand on it — so a cart
      can be lost permanently, by accident, with no warning. Undesigned rather than broken.
      Costs nothing until a room holds both a canal and a cart.
- [ ] #10 **Decide the stack's fate.** The survey put a number on what was already suspected:
      `S` is last in the roster by an order of magnitude, 5.1 solvable per 1000 against 62.5
      for every group without it, at the same enumeration-cap rate. Cut it from the roster or
      keep it as an expert-act piece — but it will not carry an introduction. Owner's call;
      the evidence side is closed.

### Sequential
- [ ] #7 (needs: #1) **Harvest deep on the groups the map calls fertile.** 62 groups produced
      6 or more interesting rooms per 200 placements; they are listed in Context. Sample those
      at depth rather than re-running the whole space.
- [ ] #8 (needs: #7) Build the act. Target ~20 rooms on a deliberate par curve, 14 climbing to
      35 — Microban's band, and roughly double the current ceiling of 23.

## Done
- [x] #1 The fertility survey — `tools/survey.mjs`, map in `levels/fertility.jsonl`.

## Context

### The survey, and what it settled

- **Run:** 586 legal groups, 117,200 placements on 8×4, 74 minutes on 30 workers. 4,783
  solvable; 907 also clear par ≥ 12, ≤ 2 shortest solves, ≥ 1 trap. 289 groups never yielded
  one solvable room. Findings written up in `SPEC-SHEET.md`; raw map in
  `levels/fertility.jsonl`.
- **Homogeneous bag sets are barren.** Every group whose only carrier is the loose bag came
  in at or near zero. That was the assumption worth testing and it does not hold here.
- **Marginal fertility, solvable per 1000:** `B` 86.6, `P` 62.0, `x` 50.4, `j` 45.7, `$` 42.6,
  `F` 41.9, `w` 40.4, `c` 32.6, `W` 30.8, `C` 14.0, `S` 5.1.
- **What the map cannot see.** 19.8% of placements exceeded the 50,000-state bound and were
  counted, not analysed. Fertility is flat across the 0–39% bands (43.8 / 43.4 / 42.2), so the
  ranking is not a cap artifact; only the 63 groups above 40% fall away. Placement is random
  on an open rectangle — **outlines are the untested axis.**
- **The empty bin is not a starting piece.** Emptied, it slides one and sheds nothing, which
  is the empty can's whole behaviour; sampling both would rank one piece twice. It still
  arises in play, as what a full bin becomes.

### The 62 groups worth harvesting deep

```
xBBj BBBF BBBP $wBP WBPP WBjP WwBP xBBP $BPP $BjF xWwB WBFP $xWP $cBB $WjP CwBj wBBP
BBFF $BjP $wwB xWBP $xwB WwwB xxWB CxBj CxwB xWWj xxBB wBBj $BFP xWBF $BBP xWBj $cBj
WwBF $WPP CxxB CBFP cWBF cWwB BBjP BBPP cxBB BBjF xBBB $wBF CBPP $cxB cxWB cBBB WwBj
CBjP xWWP $wBB $cWw $Wjj $CxP CBjF $Www $CPP $WwB $xWF
```

### Measured earlier, still worth trusting

- **Trap position beats trap count.** L29 shipped with 17 traps all off the par line — the
  first way to lose was eight moves down a branch a player would have restarted from. Score
  rooms on `biteSteps` and `firstBite`, not on `:traps`.
- **`tighten` strips teeth if allowed to.** Its default refuses to remove a room's last trap.
  Walls cannot lower par — they only remove options — but they do remove ways to lose, and
  can create new ones (L27 gained a trap when walled).
- **The documented Sokoban frustration is not length.** It is a long solution with no way to
  tell whether you already derailed it — "negative freedom, where a lack of constraints sows
  doubt" (Electron Dance, *Claustrophobia*). This game has an answer Sokoban lacks: its mess
  is permanent and visible, and `solver.js` already computes deadness. That is what makes #3
  a prerequisite for long rooms rather than a nicety.
- **Verification scales; enumeration does not.** 8×8 with four bags and a cart is 42,662
  states and 4.2s to verify — but 2.4×10¹¹ boards to enumerate. Hand-design plus `tighten`
  plus verify is the method above roughly 6×4.
- **Bag count is monotone.** Only a tear reduces it, and by one. A full can, a stack and a
  wheelie all conserve it. The state graph is layered in that dimension.
- **Comparator, measured from source.** Microban's 155 levels: median 10×8 including the wall
  border, median 4 boxes, early solutions 33–41 moves.

### Backward generation, pinned for after the first rooms exist

Walking back from a win is how most Sokoban generators work, and it half-applies here. Pushes
invert cleanly, emitters too if the history is being constructed rather than read. Tearing
does not: all trash is identical, so the board cannot say which cells came from which tear.
The inverse is one-to-many — which suits generation, since the choice of which five cells
revert to floor *is* the construction. **The real reason to want it is that it is the only
way to aim at a par directly** rather than fish for one.

### Tools

- `tools/survey.mjs` — `groups()`, `place()`, `staticallyDead()`, and the CLI. Caps
  enumeration at 50k states and reports per group. `analyze()` takes `maxStates` and THROWS
  `TooManyStates`; it never truncates, because a partial graph reports a wrong par.
- `tools/draft-room.mjs` — `draft` (every check `verify.mjs` applies), `cartMustMove`,
  `rooms({w,h,pieces,exitAt,plan})`, `tighten`, `ttBlock`. `rooms()` always places a cart;
  a cartless search needs its own sampler.

Adding a room: draft or search → `tighten` → paste `ttBlock` output into `levels/act1.tt` →
add the `:solution` entry to `levels/act1.sol` → add the row to the `levels.md` table →
`node tools/verify.mjs` and `npm test`.

### Watch for

Groups that are duplicates in disguise. A full can and a stack ask the cart almost the same
question; the map will rank both while they teach one thing.

## Next Step

Harvest deep (#7) on the 62 groups listed above. The survey ranked groups at 200 samples
each, which surfaces only a handful of keepers per group — far short of what picking twenty
levels needs. Reuse `place()` and the 50k cap from `tools/survey.mjs`; what is missing is a
scorer (#2) good enough to choose between the keepers once there are hundreds of them.

/home/menser/Dropbox/ai/code/treasure_trash
