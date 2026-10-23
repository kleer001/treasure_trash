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

Each row is something the player does, and what he says back.

Legend:

- 🔎 **gives a hint.** The line tells the player something about whether the board can still be
  won.
- **Signal** is a guess at what the game needs in order to notice the event (Claude, 2026-10-23,
  from reading `src/main.js` and `src/progress.js`; not checked by building anything):
  - ● the game already tracks it
  - ◐ a small new check on things it already tracks
  - ○ needs new analysis
- `{n}`, `{piece}` and the like are filled in by the game.

### Arriving in a room

| # | Event | Line | Signal |
|---|---|---|---|
| 1 | The very first room ever | "Hrrk. Another soul. Let's see what you got." | ● |
| 2 | A room you've never opened | "New alley. Look it over before you move." | ● |
| 3 | Back in a room you haven't solved | "This one again. It's still got your number." | ● |
| 4 | Replaying a room you've solved | "Already beat this one. What, showin' off?" | ● |
| 5 | Replaying a room you solved at par | "You've done this one at par. Again." | ● |
| 6 | A room that teaches something new | "Oh, this one. Pay attention, I'm sayin' it once." + the room's `:teach` line | ● |
| 7 | Skipped ahead to a room past your progress | "Skippin' ahead? Bold. This one bites, kid." | ◐ |

### Walking

| # | Event | Line | Signal |
|---|---|---|---|
| 8 | A long walk without touching anything | "Sightseein'? The bags ain't gonna tear themselves." | ◐ |
| 9 | Walked a loop back to the exact same board | "Full circle. Nothin' changed but your mood." | ◐ |
| 10 | Pacing back and forth | "Back, forth, back, forth. Pick a thought, kid." | ◐ |
| 11 | Standing at the dark exit, bags left | "Door's still dark. You're early, kid." | ◐ |
| 12 | Walked to the exit's doorstep, then away | "Close. Wrong order, but close." | ◐ |

### Tearing bags

| # | Event | Line | Signal |
|---|---|---|---|
| 13 | First tear of the room | "There it goes. That's yours forever now." | ◐ |
| 14 | Facing a bag, not moving | "Thinkin' it over? Good. That's the job." | ◐ |
| 15 | A tear, and the board can still be won | "Good spray. Board's still breathin', kid." 🔎 | ● |
| 16 | Half the bags torn | "Halfway. Don't get cocky, that's when it goes." | ◐ |
| 17 | One bag left | "One left. Think where that spray's goin'." | ◐ |
| 18 | Last bag torn, exit lights | "That's the last one. Now get out." | ◐ |
| 19 | Last bag torn, but the exit can't be reached | "Door's lit. Shame you bricked yourself in." 🔎 | ● |

### Things moving (rewrite when the piece changes)

| # | Event | Line | Signal |
|---|---|---|---|
| 20 | A can coughs up its bag | "Can coughed one up. Now that's two problems." | ◐ |
| 21 | Something goes down a grate | "Down the grate. No refunds in limbo." | ◐ |
| 22 | Something gets stuck in tar | "Tar's got it now. Hope you didn't need it." | ◐ |
| 23 | Glass shatters | "Glass. Hope you weren't plannin' to walk there." | ◐ |
| 24 | Trash fills a canal | "A bridge made of garbage. Gorgeous. Disgusting. Gorgeous." | ◐ |
| 25 | Something rolls a long way | "Look at it go. Somebody's gotta stop that." | ◐ |
| 26 | One roller knocks into another | "Ha! Passed it on, like a bad rumor." | ◐ |
| 27 | The couch moves | "Couch on the move. Mind your back, kid." | ◐ |

### Refused pushes

First time each reason comes up in a room:

| # | Reason | Line | Signal |
|---|---|---|---|
| 28 | `edge` | "That's the end of the alley. Nothin' past it." | ● |
| 29 | `wall` | "That's brick, kid. Brick wins every time." | ● |
| 30 | `trash` | "Your own mess. It ain't movin' for you." | ● |
| 31 | `fan` | "That bag needs elbow room. Try another side." | ● |
| 32 | `canRoom` | "Where's it supposed to go? Look past it." | ● |
| 33 | `exit` | "Not on the door! Never on the door, kid!" | ● |
| 34 | `water` | "Raccoons wash their food, kid. Not their feet." | ● |
| 35 | `afloat` | "That's out in the canal. Let it go." | ● |
| 36 | `pour` | "Can't pour that there. Find some dry ground." | ● |
| 37 | `glass` | "Broken glass. You wanna limp through the afterlife?" | ● |
| 38 | `tar` | "Tar's got it. Tar don't give back." | ● |
| 39 | `oneway` | "Wrong way down a one-way. Classic rookie." | ● |
| 40 | A move pressed while one is still playing | "One thing at a time. You got two paws." | ● |

When it keeps happening:

| # | Event | Line | Signal |
|---|---|---|---|
| 41 | Same refusal, third time in a row | "Third time. The wall ain't learnin', kid." | ◐ |
| 42 | Same refusal, fifth time in a row | "You think it'll change its mind? It won't." | ◐ |
| 43 | Lots of different refusals, fast | "Easy. You're slappin' at everything. Breathe." | ◐ |
| 44 | Lots of refusals across the whole room | "{n} noes this room. The alley's tellin' you somethin'." | ◐ |

### Undo

| # | Event | Line | Signal |
|---|---|---|---|
| 45 | First undo, ever | "Took it back. No shame. Nobody's countin'." | ● |
| 46 | Undid the move that lost the board, straight away | "Good catch. You saw that before I did." 🔎 | ◐ |
| 47 | Undid a move that was fine | "That one was fine, kid. Trust yourself more." 🔎 | ◐ |
| 48 | Undid, then made the same move again | "Same move again? Bold. Let's see what happens." | ◐ |
| 49 | That undo-and-redo, third time | "Third time doin' that. It ain't changin', kid." | ◐ |
| 50 | Undid a long way back | "Way back. Good. Sometimes the mistake's early." | ◐ |
| 51 | Undid not far enough; still lost | "Still dead. Further back than that, kid." 🔎 | ◐ |
| 52 | Undid all the way to the start | "Could've just hit restart. But sure, scenic route." | ◐ |
| 53 | A lot of undos in one room | "{n} undos. I've seen worse. Not many, though." | ● |

### Restart

| # | Event | Line | Signal |
|---|---|---|---|
| 54 | First restart | "Again. Fresh eyes this time, kid." | ● |
| 55 | Restart a few moves in | "Barely even started. Somethin' spook ya?" | ◐ |
| 56 | Restart deep into a room | "All that work, gone. Sometimes that's right." | ◐ |
| 57 | Restart while the board could still be won | "Wasn't dead yet. But fine. Again." 🔎 | ◐ |
| 58 | Restart onto a board that was already lost | "Yeah. That one was done. Again." 🔎 | ● |
| 59 | Many restarts in one room | "Again. Try startin' from the door this time." | ◐ |
| 60 | Same opening moves as the last attempt | "Same opening as last time. Expectin' different?" | ◐ |

### Dead ends and soft locks

The ladder: each step fires only if the player keeps moving on a lost board. Undo or restart
leaves the ladder.

| # | Event | Line | Signal |
|---|---|---|---|
| 61 | The board is lost (step 0). The line depends on how many times this room has been lost. | 1st: "Oof. Try again." · 2nd: "Oof. Again. Somethin' different this time." · 3rd: "Third one. Slow down. Read the room." · 4th–5th: "Oof. Think from the door this time, kid." · 6th–9th: "Again. Every one of these teaches you somethin'." · 10th on: "{n} tries. Stubborn. I like stubborn." | ◐ |
| 62 | Still moving on a lost board (step 1) | "Kid. Stop. Nobody's gettin' out from here." 🔎 | ● |
| 63 | Still moving (step 2) | "You're polishin' a corpse. Back it up." 🔎 | ● |
| 64 | Still moving (step 3) | "Back it up. Not one. More than that." 🔎 | ● |
| 65 | Still moving (step 4, Yoda mode) | "Lost it, you did. {n} moves back." 🔎 | ◐ |
| 66 | Step 4, the move is shown | "That one. Toward the door, it sprayed." 🔎 | ○ |
| 67 | First lost board ever (said in place of #61's line, that once) | "First dead end. Won't be your last." | ● |
| 68 | Lost because your trash walled off the exit | "Door's walled off. Your own trash did it." 🔎 | ○ |
| 69 | Lost because a bag can't be reached now | "That bag over there? You'll never reach it." 🔎 | ○ |
| 70 | Lost because a bag has no room to burst now | "No room left to pop that one. Ever." 🔎 | ○ |
| 71 | Undid out of a lost board | "There. Alive again. Well, you know what I mean." | ◐ |
| 72 | Idle on a lost board | "Starin' won't fix it, kid. Back it up." 🔎 | ◐ |

### Idle

| # | Event | Line | Signal |
|---|---|---|---|
| 73 | Idle, once per room | "Take your time. Limbo's got plenty of it." | ◐ |
| 74 | Idle a second time, same room | "Still here. Still waitin'. Still not gettin' older." | ◐ |

### Winning

| # | Event | Line | Signal |
|---|---|---|---|
| 75 | At par, no undos, no restarts | "No take-backs? Who taught you that? Oh, me." | ◐ |
| 76 | At par | "Par. Clean work. Don't let it go to your head." | ● |
| 77 | Under par | "Under par? Upstairs is gonna hear about this." | ● |
| 78 | A little over par | "A few extra steps. Nobody died. Again." | ● |
| 79 | Way over par | "Ugly, but out. Ugly still counts up there." | ● |
| 80 | After a lot of undos | "Took you {n} tries. Took me {n+1}, once." | ● |
| 81 | After a lot of restarts | "Restart number {n}, and out. I'll allow it." | ◐ |
| 82 | Beat your own best | "Better than last time. I noticed. Don't tell." | ● |
| 83 | After losing the board earlier in the attempt | "Dead twice and still walked out. Not bad." | ◐ |

### Progress

| # | Event | Line | Signal |
|---|---|---|---|
| 84 | Finished an act | "That's an act. Upstairs might even notice you." | ◐ |
| 85 | Left a room unsolved | "Walkin' away? It'll still be here. Trust me." | ◐ |
| 86 | Back after time away | "Oh, you're back. Thought you'd moved on. Ha." | ○ |

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

1. **"{n} moves back" (line 65)** looks cheap: walk the undo history back until a board is not
   in `deadKeys`; the move after it is the one that lost the room. It fills the gap GAME-SHEET
   answer #5 names. Line 66 and lines 68–70 need to know *why* the board is lost, which nothing
   computes today.
2. **The lines that react to pieces (20–27)** depend on what a move changed. The move's account
   in the stage looks like the place to read that.
3. **Frequent events need more than one line.** Refusals, undos and restarts will repeat; each
   probably wants three or so variants in rotation before it sounds canned.
