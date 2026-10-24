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
- **The raccoon is dead and in raccoon limbo.** It's implied, never dwelt on. If it ever comes
  up, this is what every raccoon goes through when it dies. It proves itself worthy by solving
  every trash puzzle.
- **He is a voice and a portrait, never a piece.** He never touches the board.
- **No halo.**
- **He shows up as a talking head:** a square portrait with the beak opening and closing, about
  six frames, with his text in a panel to the right. It is always docked at the bottom of the
  screen; when he's quiet, the beak stays closed.
- **He seems smart.** He comments on undos, restarts, too many refused pushes, dead ends and
  soft locks, and more. See **Event lines**.
- **He knows everything and says so.** He may tell the player a board is still winnable, or that
  it isn't. The 🔎 lines are in.
- **How much he talks is a setting with three levels: verbose, chatty, quiet.** The game picks
  the level from how often the player skips through his lines. The tuning comes later.
- **He never has a conversation.** The player acts and he answers. Nothing in the game asks him
  anything, and the raccoon never speaks.
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

- **Ten words at most.** One line per event. If it needs two, the second one waits for the
  next event.
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
- **Heaven is "Upstairs."** He talks about it like a tired employee talks about head office.
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

- Text types out in step with the blips. A keypress finishes the line at once, and that skip is
  what sets how much he talks.
- **He never takes input away from the board.** Moves keep working while he talks; the board is
  never covered.
- A new event replaces the line he's on, unless the line on screen is about a lost board.

---

## Event lines

The lines are in `dialogue/crow.json`, one entry per event, keyed by the name the game will
trigger it with. Each row is something the player does, and what he says back.

- `event` says what the player did.
- `hint` marks a line that tells the player whether the board can still be won.
- `lines` are the variants he rotates through. `byCount` instead picks the line by how many
  times the event has happened in this room: each step's `from` is the count it starts at.
- `then: "teach"` means the room's own `:teach` line follows his.
- `{n}` and the like are filled in by the game.

`lost.step1` to `lost.step4` are a ladder: each step fires only if the player keeps moving on a
lost board. Undo or restart leaves the ladder.

The `piece.*` lines describe what a piece did, so they get rewritten when the piece changes.

---

## Story beats

Light. A line or two at each act break, plus an opening and an ending. Death and limbo are
implied, never explained.

**Opening**
```
[Black. A flicker. The alley fades in at 3 a.m. Static crackle.]
[The talking head pops up.]
CROW: Hrrk. Another one. Don't look at me like that.
CROW: Everybody comes through here. Every raccoon. Your turn.
CROW: See that sign? That's the way out. Walk to it.
```

**After Act 1**
```
CROW: Not bad for a fresh soul. Not good, either.
```

**After Act 2**
```
CROW: Nobody comes through here clean. Trick's not buryin' yourself.
```

**Late game**
```
CROW: You wanna know why I'm stuck with you? ...No. You don't.
```

**Ending (sketch; far future)**
```
[Last exit. The alley falls away. Pixel-art clouds part in parallax layers.]
[Garbage cans, gleaming, on the clouds. Raccoon heaven.]
CROW: Go on, kid. They're waitin' on you.
CROW: ...You did good. Don't tell nobody I said it.
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

### Limbo look

- **The alley at 3 a.m., forever.** The current target look (`art/reference/alley-gold.png`)
  already works for this. Limbo is shown by small wrong details, not a new palette.
- **Ideas for wrongness:** a wall clock that always reads 3:00; bags that rustle with no wind;
  the same flat sky every room; a streetlight humming over nothing.

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
| **Beetlejuice** (1988): the afterlife waiting room | The afterlife as a tired office | — |
| **Kazooie**, *Banjo-Kazooie* (1998) | A sarcastic bird with gibberish voice blips | — |
| **Undertale** (2015) | Each character gets their own text blips | — |
| **Kaepora Gaebora**, *Ocarina of Time* (1998) | — | **Don't:** a bird who talks too long and won't let you skip |
| **Navi**, *Ocarina of Time* | — | **Don't:** "Hey! Listen!" nagging |

**Steer clear:** the crows in Disney's *Dumbo* (1941) are widely recognised as a racist
caricature. Keep his voice "grumpy old-timer" and don't drift toward anything that echoes them.

### Real crow behaviour worth using

- **They remember faces,** for years, and teach other crows to scold a face they don't like
  (University of Washington mask studies). A crow who notices everything is just a crow.
- **They gather round their dead.** Researchers have recorded crows crowding noisily around a
  dead crow. A crow in the afterlife business is less of a stretch than it sounds.
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
   GAME-SHEET answer #5 names. `lost.step4Shown`, `lost.exitWalled`, `lost.bagUnreachable` and
   `lost.bagNoRoom` need to know *why* the board is lost, which nothing computes today. Neither
   does `progress.back`, which needs to know when the player last played.
2. **The `piece.*` lines** depend on what a move changed. The move's account in the stage looks
   like the place to read that.
3. **Most events will repeat.** Refusals, undos and restarts each probably want three or so
   variants in rotation before they sound canned.
