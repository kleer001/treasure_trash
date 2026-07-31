# DESIGN-BIBLE — Treasure Trash

> # ⚠ SUPERSEDED — HISTORY ONLY
>
> **This document describes a game that is no longer being built.** It specifies a
> **real-time, timed, two-animal click-and-drag command puzzle**. The game is an
> **untimed, single-raccoon, turn-based Sokoban-family puzzle** built on the
> directional trash fan.
>
> Retained as a record of the design's history. **Do not implement from this file.**
>
> | Authority | File |
> |---|---|
> | The ruleset | `levels.md` |
> | The buildable spec | `SPEC-SHEET.md` |
> | The pitch | `GAME-SHEET.md` |
>
> Superseded sections include the control model (§4 — click-to-aim, slow-mo read),
> the timer and loot thresholds, the crow's kit and the scrap-on-adjacency twist,
> hazards, bosses, and the phosphor/CRT aesthetic. The crow is **pinned**, not
> scheduled; its powers here are not carried forward. Where anything below conflicts
> with `SPEC-SHEET.md`, the spec wins.

> **Status: speculative / working.** This is the brainstorm bible — guesses at
> levels, equips, hazards, bosses, and story. It is *not* the buildable spec.
> Anything here is a candidate until it clears a playtest and gets folded into
> `SPEC-SHEET.md`. Confidence is marked per section: **[solid]** (panel-backed or
> mechanically forced), **[hunch]** (my guess, untested), **[stub]** (placeholder,
> needs a pass). Nothing here is a promise to the player.
>
> **Design pivot (superseded auto-battler).** ⚠ *This paragraph is itself superseded
> — a second pivot, real-time → untimed turn-based, happened after it was written.*
> Treasure Trash is now a **real-time
> command puzzle** — you *direct* the two animals with click-to-command, you don't
> pre-draft-and-watch. The old "place, equip, hit go, watch the raid resolve"
> auto-battler model is retired. This changed the genre from planning-puzzle to
> real-time timing-puzzle, and — crucially — **retired the panel's biggest risk**
> (emergent-sim legibility): under direct control the player causes every action,
> so every outcome is legible by construction.

---

## 1. High concept [solid]

A **real-time command puzzle** in the line of *The Lost Vikings* (Blizzard, ~1992
— coordinate multiple characters with distinct abilities across one puzzle screen)
and *Pikmin* (Nintendo, 2001 — send creatures to targets, they act on arrival).

You don't pilot the animals directly — you **command** them: click a **crow** or a
**raccoon**, drag to aim it at a target, release, and it walks over and performs
its kit action there. The puzzle is *sequencing and timing* two mismatched
scavengers over a shared pile so they crack the garbage and cash in the shiny loot
**without colliding** — because they're allies who don't get along.

**Theme (the Critic's throughline):** conducting an odd couple. You make two
creatures who dislike each other work in concert, live, by reading where they are
and when to move them. You win with the plan, not the reflexes.

---

## 2. Design pillars [solid]

1. **Legibility by construction.** The player commands every action, so every
   outcome is traceable to a choice. (The old emergent-AI readability risk is gone
   — this is the pivot's biggest payoff.) State changes stay telegraphed on the
   grid regardless.
2. **Travel time is the resource.** Distances between animals, containers, and
   spilled loot create the timing windows. Positioning still matters — you just
   spend it *dynamically* (where you send an animal now sets what's possible next),
   instead of all up front.
3. **Actions commit; travel doesn't.** Once an animal *starts* an action (tipping a
   can, tearing a bag, snatching a gem) it finishes — you can't abort mid-swing.
   You *can* redirect an animal that's still walking. This is what gives timing
   teeth: you must plan the exit before you start the action.
   **[SUPERSEDED — and it was borrowed from the wrong genre.]** This pillar splits
   "actions" from "travel", which is a real-time squad-tactics idea: weapons commit,
   movement doesn't. Treasure Trash is a Sokoban variant, and Sokoban's actual law is
   simpler and harsher — **you cannot pull**, so *everything* that touches the board is
   permanent, pushes included. The turn-based design replaces this pillar outright: see
   `levels.md`, "Two presses for anything permanent".
4. **No autonomy, no punishment for focus.** The animal you're not commanding
   finishes its current action, then **idles**. It never acts on its own. All
   pressure comes from the clock and travel time, never from babysitting.
5. **One new idea per level.** Command → roles → timing windows → tools → hazards.
6. **Downsides are transformable, not erasable.** No tool is strictly better; a
   combo can *move* a compromise, never delete it. (Tools are now a *secondary*
   layer — see §5 — but the rule still holds where they appear.)
7. **Playful premise, real where it helps.** The crow loves shiny — that's the
   fantasy, full stop. Raccoon dexterity and crow cleverness inform the *verbs*.
   The slop gate governs real-world claims, not the game's own fiction.
8. **Deterministic.** Every level replays exactly from its seed (`mulberry32`), no
   `Math.random()` in logic — so hazard patterns and timing are learnable and the
   sim is testable.

---

## 3. The two animals [solid on grounding, hunch on numbers]

Real strengths turned into verbs; each triggers its kit action on arrival at a
target.

**The Crow** — *precision, speed, air, and an eye for shiny.*
- **Drawn to shiny.** Gems / glinting treasure are what she's for — that's the
  premise and a mechanic (see priorities below).
- Fast; reaches gems in **narrow gaps** a paw can't; **flies over** low hazards;
  light — can't open heavy/sealed containers; can **snatch** an exposed gem in one
  quick action.

**The Raccoon** — *strength, dexterity, weight, persistence.*
- **After the food/trash**, and strong enough to get at it: **tips / tears / opens**
  containers the crow can't; works **latches**; heavy — won't be knocked off
  ledges, but **slow**, and can't reach fine gaps.

**Different appetites = the loop's engine:** the crow wants shiny (= score), the
raccoon wants food — but the good shiny is *buried in* the trash. So the natural
play is **command raccoon to open → shiny spills → command crow to grab** — with
the "get the raccoon clear first" beat wedged in the middle. Neither clears a level
alone past L1: the crow can't open, the raccoon can't reach (and doesn't want the
shiny anyway). Cooperation is forced by capability *and* appetite; their animosity
means it's always one mistimed command from a brawl.

---

## 4. Control model & the level sim [solid on shape, hunch on tuning]

**The command (all the player does):**
- **Click** an animal to select it; **drag** to aim (sets destination + approach
  direction); **release** to send. On arrival it performs the kit action matching
  what's there (raccoon → tip/tear/open; crow → snatch/thread-the-gap).
- **Re-click while walking** to redirect. **Cannot** interrupt an action already
  underway (pillar 3).
- **Hold [key]** for a generous **slow-mo "read"** — time crawls so you can plan a
  tight window. Free and forgiving by default (accessibility over challenge); tune
  later if it kills tension.
- No unit is ever auto-controlled; the un-selected one idles after finishing.

**The level resolves on legible rules:**
- **Containers** have a state machine: `sealed → opened → spilled(empty)`. Only the
  right verb advances the right container (metal can: *tip* or *claw*; bag: *tear*;
  gap-gem: *beak*). Opening **spills** loot onto adjacent tiles.
- **Loot** on the ground is grabbed by whoever reaches it and wants it (crow →
  shiny; raccoon → food, which may convert to minor gems).
- **Collision / scrap:** if the two are adjacent and at least one is *agitated*
  (both drawn to the same tile, or the crow reaching for shiny the raccoon is
  standing on), they **scrap** — both frozen, timer bleeding, until they separate.
  Agitation is telegraphed (raised feathers / hiss glyph) *before* the scrap, so
  it's always foreseeable. Avoiding it — the send-away-first skill — is the game.
- **Timer** bounds the raid. **Pass** = loot threshold met; **bonus** = clean/total
  clear (replay incentive). See §6 for the "par-command" mastery layer.

Legibility hooks: a live **sight-line + ghost marker** on aim; flash on each
container state change; the pre-scrap agitation tell. The player should never be
surprised by an outcome they didn't cause.

---

## 5. Equip catalog [hunch — now a SECONDARY layer]

Direct control is the headline; tools are a *spice* layer that enters ~L4 and adds
options to the command puzzle. Chosen before a level, not swapped mid-raid. Each
keeps a load-bearing downside (pillar 6). Costs are placeholders. **Open question:
whether tools earn their keep at all under direct control, or get cut (§12.4).**

### Crow tools
| Tool | Upside | Downside (transformable) |
|---|---|---|
| **Coffee Dregs** | 2× move speed | Random 1–2s "distracted" freeze mid-trip |
| **Magpie Eye** | Reveals gem values before the level | Slow first action |
| **Shoplifter's Beak** | Snatches a gem out from under the raccoon | Spikes the raccoon's agitation (bigger scrap radius) |
| **Oil-Slick Feathers** | Immune to one splash hazard (water/skunk) | Heavier → slightly slower |

### Raccoon tools
| Tool | Upside | Downside (transformable) |
|---|---|---|
| **Iron Claws** | Opens a metal can in one swipe | 2× slower |
| **Nimble Paws** | Opens latched / tricky containers | Drops loot if startled by a hazard |
| **Compactor Gut** | Eats junk → small gems (converts trash) | Gets "full," moves sluggish after |
| **Bandit Mask** | Ignores the noise meter for one container | Short target range |

### Shared / command tools
| Tool | Upside | Downside (transformable) |
|---|---|---|
| **Panic Whistle** | Once per level, instantly recalls an animal — **cancels its committed action** (the one escape from pillar 3) | Single use; the animal drops whatever it was carrying |
| **Decoy Shiny** | Drop a fake gem to pull an animal off a tile (anti-collision) | Consumed; one use |
| **Grease Trail** | A lane that speeds movement | Animals on it overshoot — can't stop precisely |
| **Night-Vision** | Extended target range in dark levels | Blinded by the motion-light hazard |

*(Retired from the auto-battler draft: "Tin-Whistle Caw" and "Alley-Cat Truce" —
indirect-steering / anti-fight tools that made no sense once you command directly.
"Bungee Leash" survives only if playtests want a hard anti-collision option.)*

---

## 6. Progression & meta structure [hunch]

- **Campaign spine:** hand-authored levels in **worlds** (~5 levels + a boss each).
  The Lost Vikings model fits perfectly — crafted, legible, escalating. This is the
  vertical slice's home.
- **Gem economy:** gems buy tools between levels (light, kept across the campaign) —
  *if* tools survive §12.4. If they don't, gems are pure score.
- **Par-command (the mastery hook):** each level has a **par** — a target number of
  commands (or a target time) for a clean solve, like golf par or a "fewest moves"
  puzzle. This is the theorycrafter's tail (the Superfan's home now that the draft
  economy is gone): optimize a level from "solved" to "solved in 4 commands."
- **Post-slice modes:** time-attack, daily seeded layout, mirror/hard variants.
  Procedural endless is a *weak* fit now (no draft loop to power it) — deprioritize.

---

## 7. Level designs [L1–L6 hunch-detailed, W2/W3 stubbed]

### World 1 — "The Diner Alley" (teaches the whole grammar)
Spring, a greasy-spoon back alley at 3 a.m. Green-on-black CRT, security-cam feed.

**L1 · "Tip-Off"** — *teaches: command + the clear-then-send beat.* [solid]
One metal can, a gem inside. Send the raccoon → he tips it, gem + trash spill; but
he's now standing on the loot. Send the crow in *now* → they scrap. So: send the
raccoon *off* a few tiles, *then* send the crow to snatch the gem. The core gesture
in one level. Timing window is generous — this is the teacher, not the test.

**L2 · "Out of Reach"** — *teaches: roles differ.* [hunch]
A can plus a gem wedged in a narrow gap the raccoon can't reach. Raccoon opens the
can; crow both grabs the spill *and* threads the gap. First forced role split, same
clear-then-send tempo.

**L3 · "Tight Window"** — *teaches: travel time is the resource.* [hunch]
Layout makes the send-away window *short* — where you send the raccoon decides
whether the crow's path is clear in time. Now *where* you send the idle animal is a
real choice, not a throwaway. This is positioning-as-timing, the heart of the game.

**L4 · "Locked Down"** — *teaches: a tool + its downside.* [hunch]
A latched dumpster no bare kit opens. Equip **Iron Claws** (or **Nimble Paws**) —
and now command *around* the raccoon's new slowness. First transformable-downside
puzzle (if tools survive §12.4; else this level teaches multi-container sequencing).

**L5 · "Lights Out"** — *teaches: timing commands around a hazard.* [hunch]
A motion-sensor light cone over the richest bin. Crossing it trips a freeze/noise
spike. You sequence commands to move through the cone between sweeps — and because
actions commit (pillar 3), you must not *start* an open you can't finish before the
light swings back. Hazard + commitment together.

**L6 · BOSS "The Alpha"** — *combines everything.* [hunch]
A big rival raccoon patrols the dumpster and **contests the pile** (a steal timer:
loot left exposed too long, he grabs it). He can't be out-muscled, only
out-commanded: split labor, use the clear-then-send beat under a moving patrol, and
draw him off with a **Decoy Shiny** or a well-timed feint. "Phases" = his patrol
tightening as the dumpster empties. Beating him proves you've learned the grammar.

### World 2 — "Festival Grounds" (summer; noise & air) [stub]
Richer trash, more eyes. Introduces:
- **Noise meter** (a light-sleeper human — too much racket ends the raid early;
  sequence quiet commands, use Bandit Mask).
- **The Hawk** — a predator: the crow can't linger in open sky or she's swooped.
  Forces cover-timing and breaks the "crow is always safe" habit.
- **Grease Trail / lanes** and first real tool-synergy levels.
- **Boss candidate:** *Animal Control van* (clear a sweep ahead of a closing net
  radius) **or** *The Hawk* as a moving no-fly zone.

### World 3 — "Winter Yards" (scarcity; the stakes) [stub]
Fewer gems, harsher hazards. **Ice** modifies movement (everyone overshoots — a
free, forced Grease Trail). Introduces **skunk** (area denial) and **the dog**
(chained radius). **Boss candidate:** *The Exterminator* — a human on a multi-phase
routine (set traps → flashlight sweep → radio call) you read like clockwork. The
hardest timing-read in the game.

---

## 8. Enemies & hazards [hunch]

"Enemies" are **hazards that react to position and timing** — you command *around*
them, you don't fight them. Each teaches a lesson:

- **Motion Light** — a cone; entering trips a freeze/noise spike. *Routing + timing.*
- **Noise Meter / sleeping human** — cumulative racket ends the raid. *Quiet
  sequencing, order of operations.*
- **The Hawk** — swoops the crow if she lingers exposed. *Cover-timing; don't leave
  the crow idle in the open.*
- **The Dog** — chained, fixed radius; anything inside gets chased off. *Respect a
  no-go zone when routing.*
- **Skunk** — sprays an area, denies it for N seconds (Oil-Slick counters). *Area
  denial timing.*
- **Rival scavengers** (stray cat, rival murder, the Alpha) — **contest the pile**
  on a steal timer. *Speed vs. thoroughness.*
- **Ice / water / grease** — movement modifiers (overshoot). *Momentum; commit
  carefully.*

**Rule:** every hazard is deterministic and telegraphed — cone, radius, and patrol
visible before you commit. No hazard is a coin-flip (pillar 1 & 8).

---

## 9. Bosses [hunch]

Bosses are **timing set-pieces with a legible phase structure**, not HP bars. You
win by out-commanding; each phase is a sub-puzzle:

1. **The Alpha (raccoon rival)** — W1. Steal timer + tightening patrol. Beaten by
   labor-split + decoy timing under the clear-then-send beat.
2. **Animal Control / The Hawk** — W2. A closing net radius or a moving no-fly
   zone; clear containers in an order that stays ahead of it. Sequencing under a
   moving constraint.
3. **The Exterminator (human)** — W3. Multi-phase routine you read and thread
   through. The capstone timing test.
4. **(Stretch) The Landlord** — a final "clean out the whole block" set-piece that
   stacks every mechanic into one long, perfectly-sequenced raid.

---

## 10. Story beats [hunch — deliberately thin]

Understated connective tissue as short retro-terminal interstitials between worlds.
No lore walls (the Shipper will cut them). Theme lives in the *mechanics* — you
spend the whole game making two creatures who dislike each other work together — so
the text just names it.

- **Cold open:** a crow on a phone line, a raccoon under a bush, both eyeing the
  same can. They realize it takes both of them. Title card.
- **W1 → W2:** they've started a shared **hoard** (a hollow under a loose
  floorboard — the "treasure" in *Treasure Trash*). First gem stashed together.
- **W2 → W3:** the city's wising up (traps, control vans). Easy alleys are closing;
  the hoard's worth protecting now. Stakes rise.
- **W3 climax:** winter, scarcity, one last big score to make it through.
- **Ending (light):** biggest hoard on the block — two loners built something
  neither could alone. (Optional bittersweet: relocated, they start a new hollow.)

---

## 11. Look & sound [solid — inherits house style]

- Retro-terminal / phosphor. Alley + pile on a character grid (bins, bags, cans,
  gems as glyphs); crow and raccoon as sprite layers; a HUD layer (loot, timer,
  equipped tool); a CRT/scanline pass on top. Composited via `src/compositor.js`
  ordered layers.
- **Command feedback layer:** live sight-line + ghost destination marker on aim;
  selection highlight; the agitation tell before a scrap.
- Palette: grimy green-on-black, a security cam on a dumpster at 3 a.m.
- Procedural WebAudio: skitter, the clang of a tipped can, a bright chime on a
  snatched gem, and the ugly hiss-and-squabble on collision — the sound you play to
  *avoid*.

---

## 12. Open questions / needs-playtest [solid — the real risks]

The pivot retired the old #1 risk (sim legibility). New ones:

1. **Do travel-time windows create real puzzles,** or do levels collapse to "click
   in the obvious order"? If any sane sequence works, there's no puzzle. **This is
   the make-or-break prototype** — the direct successor to the old input-richness
   question.
2. **Is "real-time forgiving" actually forgiving?** The line between a relaxed
   timing-read and fiddly micro is a pacing tuning problem. Playtest early.
3. **Two units, one cursor — does focus-switching feel fluid or clumsy?** Selection
   and re-command must be frictionless or the whole thing feels like chores.
4. **Do tools earn their keep** under direct control, or are they garnish to cut?
   The command layer may already be rich enough. Decide before building the shop.
5. **Is hold-to-slow a crutch** that removes tension, or an accessibility win? Tune
   its cost (free vs. limited) once the base timing feel exists.

---

## 13. Confidence summary

- **Solid:** genre (real-time command puzzle; Lost Vikings + Pikmin), legibility
  now via direct control, the control model (§4), the odd-couple twist, the L1
  gesture, no physics, house-style fit.
- **Hunch (needs playtest):** L2+ specifics, all tool numbers, whether tools stay
  at all, bosses, hazard tuning, pacing of "forgiving real-time."
- **Unknown until prototyped:** window-readability and real-time pacing (§12.1–2) —
  the two questions that decide whether this is a game or a nice idea.

*Note: the crow's love of shiny is the game's premise. Real-world grounding is
limited to crow cleverness and raccoon forepaw dexterity, used as design flavor.
Everything else is game invention.*
