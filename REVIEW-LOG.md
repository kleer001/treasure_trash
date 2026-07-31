# REVIEW-LOG — Treasure Trash

The panel's memory. Each persona keeps notes here across the game's life, in their
own voice, so the later gates can measure the game against its own promises. Three
sessions, three gates.

---

## Session 1 — Design review · Gate 1 (unlocks code)

Date: 2026-07-29 — first conversation, before any game code.

Convened on `GAME-SHEET.md` (rewritten this session to the live untimed one-raccoon
design) and the ruleset in `levels.md`, with the playable `spike/` in hand.

### The Shipper

- **First read:** The loop is one sentence and I didn't have to ask for it: *walk into
  a bag, trash sprays in a fan ahead of you and stays there, so pick the direction
  that doesn't wall you in.* That's designed. Most pitches I get here aren't. And the
  risk is already retired — `spike/verify.mjs` runs the whole sim headless, which
  means the rules are separable from the canvas. That is the single hardest thing to
  fix later and it's already right. I'd normally spend this whole session arguing for
  a spike; someone did it before I got here.
- **Where I pushed:** the item table lists nine objects. That's three games. A wheelie
  bin that rolls until it hits a wall is its own push-resolution problem; rigid
  furniture polyominoes are another; the bag-on-can launch is a third. Three objects
  are verified. Ship three. I got that cut, and I want it held — the pressure to add
  a fourth object will come from the room designer running dry, and the answer then is
  a better room, not a new noun.
- **My other cut:** L1 is a two-move win that the design doc itself says "doesn't
  exercise direction/mess." Your first room teaches the player nothing about the only
  thing your game is. Open on L3. If that's too steep, the fix is a smaller
  *direction* room, not a room about pressing Up twice.
- **Watching for at MVP:** (1) Is `rules` still pure — can I run the sim with no
  canvas? If the DOM has crept into it, that's a re-scope conversation. (2) Did the
  object count stay at three? (3) Time-to-fun: a stranger, no instructions, on the
  first room — do they tear a bag in under fifteen seconds? (4) Is the solver fast
  enough to run after every move without a hitch, or did it get quietly downgraded to
  a menu button?

### The Critic

- **First read:** I came in ready to be bored and I'm not. This game is about
  **irreversibility**, and unusually, that word lives in the mechanics rather than in
  the flavor text. Every action strictly subtracts from your options. You cannot tidy.
  You cannot undo *in fiction* — only out of it, at the menu level, which is honest
  about being a convenience rather than pretending the world forgives you. The
  "maximum mess, nothing gets cleaned up" identity is a thesis, and the fan is the
  argument for it. I'll take that over a hundred crafting loops.
- **Where I pushed, and it isn't settled:** the game is called *Treasure Trash* and
  the design explicitly cuts treasure. No shiny, no collecting, no score. You win by
  tearing every bag open. So the title is selling a loot fantasy the game refuses to
  provide, and the first thirty seconds of a player's relationship with this thing is
  a promise it immediately breaks. I don't want a shiny bolted back on to justify a
  name — that's the tail wagging the raccoon. I want the name to say what the game
  says: you make a mess you can't take back. This is logged as unresolved and I
  expect it back.
- **My second objection, overruled and I accept it:** bright flat Memphis geometry for
  a game about grime and decay is the aesthetic arguing against the mechanic. I was
  told legibility wins — the mess has to read at a glance or the puzzle isn't fair —
  and that's a real answer, not a dodge. Fine. But I'm the one who checks it at MVP.
- **What worries me most:** one verb. The fan is the whole game. Anyone can make a
  clever first room out of a novel rule; the question is what room forty looks like
  when the player has fully internalized "fire away from the path." The pitch's answer
  is fan-on-fan interference — trash from one bag pre-blocking another's fan. That
  had better be the *middle* of the game, not the last idea in the backlog.
- **Watching for at MVP:** does the fifth room make me think about something the
  second room didn't? If the rooms are the same insight at increasing sizes, this is a
  toy with one trick, and one trick is a jam entry, not a game.

### The Archivist

- **First read:** Delighted. This is *Sokoban* (Thinking Rabbit, 1982 — Hiroyuki
  Imabayashi) with the sign flipped, and the docs already know it: "no pull (Sokoban
  law)" is cited in the ruleset, which is more self-awareness about lineage than I
  usually get. The interesting ancestors are the modern thinky wave, and the relevant
  inheritance is *how they made irreversibility bearable*. Stephen Lavelle's
  **Stephen's Sausage Roll** (2016) and Draknek's **A Monster's Expedition** (2020)
  both solved it the same way: make the consequence legible *before* the commit, and
  make taking it back frictionless. Your fan preview and your instant undo are exactly
  that solution. You inherited it rather than rediscovering it. Good.
- **On the novelty question — and I want this quoted back to me:** the ruleset records
  a 2026-07 search that found no game combining *interact → directional multi-cell
  spray of permanent new obstacles*, and it correctly says the PuzzleScript and itch.io
  long tail is unindexed so absence cannot be proven. That caveat is the honest part
  and it must stay welded to the claim. My gate: the words **"novel," "first," and
  "never been done"** do not appear in any marketing copy for this game. "Uncommon" is
  defensible. A description of the mechanic with no priority claim is always
  defensible. I will personally check the store page.
- **The thing I actually had to fix:** this game's own documentation described a
  different game. The pitch and the design bible specified a real-time, timed,
  two-animal, click-and-drag command game. The ruleset and the working prototype
  implement an untimed, one-raccoon, turn-based puzzle. Those are not two phases of
  one plan; they are two games, and the panel was about to review the wrong one. It's
  corrected now — the pitch is rewritten, the bible is marked superseded, the spec is
  authoritative. I note it here because the near-miss is the lesson: **a stale document
  is a false claim about your own game**, and this panel's baseline would have been
  worthless if we'd convened an hour earlier. I gate real-world facts, not your
  mechanics or your raccoon's motives — but the accuracy of your own spec is squarely
  mine.
- **Watching for at MVP:** (1) Do the docs still describe the build, or has the spec
  drifted behind the code the way the bible drifted behind the ruleset? (2) Is the
  fan preview actually load-bearing, i.e. can a player see the wall before they build
  it — because that's the borrowed solution and if it's cosmetic the borrowing failed.
  (3) No priority claims anywhere.

### The Superfan · genre: turn-based "thinky" puzzle / Sokoban-family block-pusher

- **First read:** Okay, the **side-cell corollary** is the good stuff. A rule that
  *generates* puzzles instead of one you decorate rooms with — "an object beside a bag
  falls in either the fan or the launch cell for every strike direction, so it must be
  relocated" — that's the kind of forced consequence this community pulls apart in a
  Discord thread for a week. And "a bag flush against a wall can *never* be opened"
  falling out of the same rule for free, rather than being a special case someone
  wrote? That's elegant. I'd post that.
- **The contract, and you keep it:** no timer, no hidden information, no execution
  skill, no randomness, whole room on one screen, undo is sacred. Six for six. That's
  the unwritten contract of this genre and you didn't break any of it. The people who
  live in *Bonfire Peaks* (2021) and *Patrick's Parabox* (2022) will feel immediately
  at home.
- **Where I pushed hardest, and I got it:** soft-lock as your only failure state, with
  nothing detecting it. Look, the strike itself is safe — blocked fan, refused move,
  fine. But the *real* soft-lock is positional: in L3 you seal the corridor and the far
  bag is stranded, and the game says nothing. I can wander eleven moves past a dead
  board. The modern wave in this genre moved away from silent soft-locks for exactly
  this reason — undo doesn't help if you don't know *when* to undo, and "reload from
  twenty moves ago" is the single most common bounce complaint you'll get. A
  solvability check in the slice is the right call and I'm glad it's in.
- **Where I got overruled, and I'll take it for now:** I want a level editor. Rooms are
  data, the sim is pure, the solver can auto-validate community rooms — that's a
  200-hour tail nearly for free, and this genre's players *make things*. Told it's out
  of the slice on scope. Fair. But par-move counts alone are a thin mastery layer, and
  I'm raising the editor again at the MVP gate.
- **Watching for at MVP:** (1) Does the dead-board indicator fire on L3's trap the
  moment the corridor seals, or a move later? A late warning is worse than none. (2)
  Do par counts feel like real optimization targets, or arbitrary numbers? (3) Is
  there one room whose solution I'd want to explain to somebody?

### Where the panel actually disagrees

Recorded rather than split, per the studio brief.

- **The Critic vs. the owner, on Memphis.** He says the aesthetic argues against the
  mechanic; the call was legibility over atmosphere. Consciously accepted, revisited
  at MVP with a full board of trash on screen.
- **The Superfan vs. the Archivist, on soft-locks.** He sees Sokoban's soft-lock plus
  undo as the classic, solved and honorable. She says this genre's current audience
  reads a *silent* soft-lock as a defect regardless of undo. Both are right about
  their own era; the solvability check is the concession to hers, and it's the sharper
  read for players in 2026.
- **The Superfan vs. the Shipper, on the tail.** Editor and community rooms versus a
  three-object slice that actually ships. The Shipper won this round on the explicit
  condition that levels stay pure data, which keeps the Superfan's ask cheap later.
- **The Critic vs. everyone, on the title.** Nobody defended *Treasure Trash* on the
  merits. It survives this gate only because no code depends on it.

**Gate 1:** decision recorded in `SPEC-SHEET.md` → Panel gate. Code may begin: `[x]`

---

## Session 2 — Post-MVP review · Gate 2 (state of things)

Date: DATE — the vertical slice is playable; no further building until this clears.

Each persona rereads their Session 1 notes: did the first read hold up?

### The Shipper
- Held up / didn't: _…_
- State of things: _…_
- Verdict — keep going / re-scope / pivot / shelve: _…_

### The Critic
- Held up / didn't: _…_
- State of things: _…_
- Verdict: _…_

### The Archivist
- Held up / didn't: _…_
- State of things: _…_
- Verdict: _…_

### The Superfan
- Held up / didn't: _…_
- State of things: _…_
- Verdict: _…_

**Gate 2 — direction chosen:** _…_ — DATE.

---

## Session 3 — Release readiness · Gate 3 (HARD — before publishing)

Date: DATE — before any itch.io page goes live or a GitHub release is cut. This is
a hard stop; see `CLAUDE.md` → "The release gate."

Release checklist:
- [ ] Runs clean from a fresh clone (`./run.sh`, no console errors)
- [ ] `npm test` green, and CI green on the release commit
- [ ] No fabricated history or specs anywhere — including the store page (Archivist has fact-checked)
- [ ] No priority claims ("novel", "first", "never been done") anywhere in copy — the scatter-mechanic search cannot prove absence
- [ ] Title question resolved (see `SPEC-SHEET.md` → Open questions)
- [ ] `honest-copy` skill run against every public-facing document
- [ ] `LICENSE` present; attribution for any borrowed assets
- [ ] `promo.html` + `ITCH-PAGE.md` + `MARKETING-PLAN.md` finalized; every claim fact-checked (Archivist), none oversold (Critic)
- [ ] Budded to its own repo first, if graduating (see `BUDDING.md`)

Per-persona sign-off — each must clear, or the concern is consciously accepted here:
- **The Shipper** — ships clean, tests green: _…_
- **The Critic** — it's about what it claims, and the page tells the truth: _…_
- **The Archivist** — every historical / technical claim on the page is accurate: _…_
- **The Superfan** — the genre's players get what they're promised: _…_

- [ ] **Release gate cleared — DATE. Ship it.**
