# CROW — the coach

**This file is a sketch and binds nothing.** It is character and lore: who the crow is, how he
talks, what he looks like. What any piece does is `src/rules.js`. Where a line of dialogue here
seems to describe a rule, it is the crow's opinion, and when the two disagree the rule wins and
the line is rewritten.

---

## What the owner has decided

- **He is the coach.** A grizzled old crow: cocky voice, snappy grumpy instructions, impatient
  but encouraging. Part Star Fox wingman, part Yoda.
- **He is a guardian angel with a chip on his shoulder.** Where the chip comes from doesn't
  matter. He's just grumpy, and he's a professional: he would never tell an unproven soul.
- **The raccoon is in raccoon limbo, and the game is limbo.** Figure it out and get to raccoon
  heaven; stay until you're done or give up. It proves itself worthy by solving every trash
  puzzle.
- **Nothing in the game mentions death.** Not a line, not a joke.
- **There is no metaphor.** It's a game, and the trash is trash.
- **Limbo has no look of its own.** It is the game's alley: no clocks, no wrong details.
- **He is a voice and a portrait, never a piece.** He never touches the board.
- **No halo.**
- **He shows up as a talking head:** a square portrait with the beak opening and closing, about
  six frames, with his text in a panel to the right. It is always docked at the bottom of the
  screen; when he's quiet, the beak stays closed.
- **He seems smart.** He comments on undos, restarts, too many refused pushes, dead ends and
  soft locks, and more. See **Event lines**.
- **He knows everything and says so.** He may tell the player a board is still winnable, or that
  it isn't. The 🔎 lines are in.
- **How much he talks is a setting with three levels: verbose, chatty, quiet.** Skips from the
  player make him quieter, one level at a time.
- **The opening is a speech.** He gives it alone in the middle of the screen, and the board
  waits. When he is done, his panel drops to its dock with a bounce, and play starts.
- **He never has a conversation.** The player acts and he answers. Nothing in the game asks him
  anything, and the raccoon never speaks.
- **He talks to the raccoon,** never to the player.
- **He has no name.** He introduces himself as "Your guide."
- **He never mentions the other raccoons he has guided.**
- **He does not warm up from act to act.** His mood has no arc across the game.
- **Story is light.** Short beats at the opening, the act breaks and the ending; mostly implied.
- **The ending, far in the future:** raccoon heaven. One beautiful screen, pixel-art parallax
  revealing clouds and garbage cans.

Everything below this list is still a draft.

---

## Who he is

A scruffy old crow who has walked a lot of raccoons through a lot of alleys. He has opinions
about all of them. He gripes first, then hands over the one thing you need. When you're truly
stuck he goes quiet, then wise, and his word order goes a little Yoda.

### Voice rules

- **Ten words at most** in a line, unless the event sets `words`. One line per event, except a
  monologue: a chain of short lines, one per beat. A move does not end it.
- **Gripe, then point, then push.** *"Ugh. Look at the door. Now go."*
- **He sounds smart because he's specific.** He counts ("third time"), names what moved, knows
  when a move was fine, and knows how far back you went wrong. A vague line ("Hmm, tricky!") is
  a wasted line.
- **He never guesses.** If he says the board is lost, it's lost. If he can't tell, he says
  nothing.
- **He points; he doesn't explain.** The board already shows why. He says where to look.
- **Silence is his default.** A coach who never shuts up is Navi.
- **Yoda mode is rare.** Flipped word order only when the board is lost or the player is truly
  stuck.
- **He calls the raccoon "kid."**
- **Old-timer grump, not a dialect.** See the "steer clear" note under Art references.
- **He never tells his own story.**

---

## The talking head

```
┌────────┬──────────────────────────────────────┐
│ ▓▓▓▓▓▓ │ Not on the door! Never on the door,  │
│ ▓(o)▓> │ kid!                                 │
│ ▓▓▓▓▓▓ │                                      │
└────────┴──────────────────────────────────────┘
  square portrait          text panel
```

### Frames (about six)

| # | Frame | Used for |
|---|---|---|
| 1 | Beak closed | Rest, and between syllables |
| 2 | Beak half open | Talking |
| 3 | Beak wide open | Talking, loud lines, the caw |
| 4 | Blink | Idle, now and then |
| 5 | Side-eye / squint | Refusals, repeat mistakes, "really?" |
| 6 | Looking away | The board is lost |

Talking cycles 1 → 2 → 3 → 2 → 1 per syllable, with a gibberish voice blip on each.

### Behaviour

- Text types out in step with the blips.
- **Moves and his lines are independent.** A move never speeds up, skips or ends a line. Outside a
  speech he never takes input away from the board: moves keep working while he talks, and the
  board is never covered.
- **Esc, Space or Enter skips.** One press speeds up the line. A second quick press skips the
  rest of the monologue. When the player skips most of his recent lines, he gets one level
  quieter and says so. A press that only speeds a line up is not a skip.
- **One line at a time.** When several events fire together, only the highest-ranked one plays.
- **Only the player cuts a line short.** An event that fires while he talks does not replace the
  line.
- **A once-only line waits its turn.** When it loses, it waits for the line on screen to end.
  Then the game checks that it still applies: if it does, it plays; if not, it fires again at
  its next trigger. It counts as said only when it plays. Any other line that loses is dropped.
- **He waits about a second before he starts to talk.**
- **Moments get room to breathe.** One shared timer starts after a monologue, and no other
  monologue starts until it runs out. A common event, such as undo or a refused push, also has a
  timer of its own, and so does each lost-board line.
- **Common events speak on only some of their triggers.** After an event has played once, it
  plays again only by chance. The talk level sets the chance.
- **Variants come from a shuffle bag.** He picks at random from the variants he has not said
  yet. When he has said them all, the bag fills again.
- **A line can call back.** It can play only after a named earlier line has played, such as a
  second meeting with a piece that refers back to the first.
- **A line can be once per room.**
- **An undo or a restart ends what waited about the moves it took back.** Lines about the room,
  a win or the story still wait.
- **A new room ends what waited about the last one,** except lines about a win or the story.
- **Rank, highest first:** story beats and the openings; act starts, teach rooms and first
  sight of a piece; a lost board; rare wins; room arrivals and common wins; everything else.
  The rank is the order of this list, not a number: the game tries events from the top down,
  and the first eligible one plays. Every event has a place in it. Events of one kind with no
  place of their own, such as the `meet.*` lines, rank in the order `dialogue/crow.json` lists
  them.

---

## Event lines

The lines are in `dialogue/crow.json`, one entry per event, keyed by the name the game will
trigger it with. Each row is something the player does, and what he says back.

- `event` says what the player did.
- `hint` marks a line that tells the player whether the board can still be won.
- `face` is the face he makes: a still frame of the portrait (`closed`, `blink`, `squint`,
  `away`) or a banked expression clip (an `ex_*` name in `art/bench/crow/h3/clips.json`).
- `talk` is the quietest talk setting that still hears the line: `quiet`, `chatty` or
  `verbose`. The face plays at every setting.
- `lines` are the variants he rotates through. A variant that is a list of lines is a
  monologue: its lines play in order, one per beat, and a move does not end it. `byCount` instead picks
  the line by how many times the event has happened in this room: each step's `from` is the
  count it starts at, and a step names its own `face`.
- `words` raises the ten-word limit for that event's lines.
- `speech: true` gives the line the whole screen: the board waits until it ends.
- `once` makes the event a once-only line, and names how long "once" lasts: `ever`, `room`
  (once in each room), `sitting` (until the page reloads) or `visit` (until the raccoon leaves
  the room).
- `after` names an event that must have played before this one can, for a callback.
- A key with an act suffix, such as `room.actFirst.act2`, is said in that act in place of the
  plain key.
- `stretch: true` marks an event that needs a value the game does not work out today.
- `actBound: true` marks lines that name what an act holds, so they get rewritten when the act's
  pieces change.
- `{n}` is filled in by the game with the count the line is about.

`lost.step1` to `lost.step4` are a ladder: each step fires only if the player keeps moving on a
lost board. Undo or restart leaves the ladder.

A lost board counts once in an attempt: stepping back into it after an undo is the same loss. A
restart starts a new attempt.

The `piece.*` lines describe what a piece did, so they get rewritten when the piece changes.

---

## Story beats

Light. A line or two at each act break, plus an opening and an ending. Limbo is implied, never
explained. The lines are in `dialogue/crow.json`; the screen around them is here.

**Opening** (`room.firstEver`)
```
[Black. A flicker. The alley fades in. Static crackle.]
[The talking head pops up.]
```

**After Act 1** (`story.act1`), **after Act 2** (`story.act2`), **late game** (`story.late`):
the talking head only.

**Ending (sketch; far future)** (`story.ending`)
```
[Last exit. The alley falls away. Pixel-art clouds part in parallax layers.]
[Garbage cans, gleaming, on the clouds. Raccoon heaven.]
```

---

## Art references

### Character look

- **Build:** small, hunched, a bit lopsided. Older than he admits.
- **Feathers:** scruffy and mid-molt. One bent primary feather sticking out. A head tuft that
  won't lie flat. Greyed bristles round the beak.
- **Eyes:** one sharp, one squinting or milky. The squint is frame 5.
- **Props (one, maybe two):** a coach's whistle on a string; a twig in his beak like a cigar.
- **The portrait reads at a small size.** Big beak, one bright eye, a strong silhouette; the
  rest can go.

### Voice

Procedural gibberish blips to fit the game's WebAudio sound: short pitched "kraa" and "hrk"
syllables, low and gravelly, one per syllable. Grumbles drop in pitch at the end; Yoda lines are
slower.

### Games and film to look at

| Reference | What to take | What to avoid |
|---|---|---|
| **Star Fox 64** (1997): Peppy Hare, Falco | Comm-box pop-in, one-line barks mid-play, a catchphrase | Barks so often they turn into noise |
| **Star Fox** (SNES, 1993) | Chunky portraits with gibberish voice | — |
| **Donkey Kong Country** (1994): Cranky Kong | Grumpy old-timer who complains and still helps | Long rants |
| **Yoda**, *The Empire Strikes Back* (1980) | Small, hunched, more than he looks; flipped word order | Overusing the flipped word order |
| **Mickey**, *Rocky* (1976) | Hard on you because he believes in you | — |
| **Clarence**, *It's a Wonderful Life* (1946) | The guardian angel who's also being judged | Sentiment without a joke on top |
| **Kazooie**, *Banjo-Kazooie* (1998) | A sarcastic bird with gibberish voice blips | — |
| **Undertale** (2015) | Each character gets their own text blips | — |
| **Kaepora Gaebora**, *Ocarina of Time* (1998) | — | **Don't:** a bird who talks too long and won't let you skip |
| **Navi**, *Ocarina of Time* | — | **Don't:** "Hey! Listen!" nagging |

**Steer clear:** the crows in Disney's *Dumbo* (1941) are widely recognised as a racist
caricature. Keep his voice "grumpy old-timer" and don't drift toward anything that echoes them.

### Real crow behaviour worth using

- **They remember faces,** for years, and teach other crows to scold a face they don't like
  (University of Washington mask studies). A crow who notices everything is just a crow.
- **They use tools,** and city crows drop nuts on roads for cars to crack.

### Image-gen prompts (matching the `art/reference/` pipeline)

Same settings as `alley-gold.png`. Untested drafts.

> pixel art character portrait of a grizzled old crow, square frame, scruffy molting black
> feathers, squinting eye, twig in its beak, grumpy expression, beak slightly open as if
> talking, dark teal background

> pixel art sprite sheet of a grizzled old crow head, six square frames in a row: beak closed,
> beak half open, beak wide open, blinking, side-eye squint, looking away, dark teal background

---

## Observations

Noticed by Claude, 2026-10-23. Not decisions.

1. **"{n} moves back" (`lost.step4`)** looks cheap: walk the undo history back until a board is
   not in `deadKeys`; the move after it is the one that lost the room. It fills the gap
   GAME-SHEET answer #5 names. `lost.bagUnreachable` needs to know *why* the board is lost, which
   nothing computes today.
2. **The `piece.*` lines** depend on what a move changed. The move's account in the stage looks
   like the place to read that.
3. **Most events will repeat.** Refusals, undos and restarts each probably want three or so
   variants in rotation before they sound canned.
