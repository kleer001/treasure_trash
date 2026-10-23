# CROW — the coach

**This file is a sketch and binds nothing.** It is character and lore: who the crow is, how he
talks, what he looks like. What any piece does is `src/rules.js`. Where a line of dialogue here
seems to describe a rule, it is the crow's opinion, and when the two disagree the rule wins and
the line is rewritten.

---

## What the owner has decided

- **He is the coach.** A grizzled old crow: cocky voice, snappy grumpy instructions, impatient
  but encouraging. Part Star Fox wingman, part Yoda.
- **He is a guardian angel with a chip on his shoulder.**
- **The raccoon is in raccoon limbo** and has to prove itself worthy by solving every trash
  puzzle.
- **He is a voice and a portrait, never a piece.** He never touches the board.

Everything below this list is still a draft.

---

## Who he is

A scruffy old crow perched on the EXIT sign, wearing a halo he clearly didn't pick. He has
guarded a lot of souls through a lot of alleys and he has opinions about all of them. He talks in
short bursts over a squawky radio-style portrait. He gripes first, then hands over the one thing
you need. When you're really stuck he goes quiet, then wise, and his word order goes a little
Yoda.

**The chip on his shoulder** has a few possible sources (pick one later, or none):

- **Demoted.** He used to guard something grander (an eagle, a racehorse, a person) and got
  handed a raccoon.
- **On probation himself.** He lost a raccoon once. This one is his second chance too.
- **Old grudge.** In life, a raccoon raided *his* nest. Guess whose soul he got assigned.

### Voice rules

- **Short.** About eight words a bark, two lines at most.
- **Gripe, then point, then push.** *"Ugh. Look at the door. Now go."*
- **He points at the board; he doesn't explain it.** The board already shows why. He says where
  to look.
- **Silence is his default.** Once per new thing, not every time it happens. A coach who never
  shuts up is Navi.
- **Yoda mode is rare.** Flipped word order only when the board is lost or the player is truly
  stuck.
- **He calls the raccoon "kid," and sometimes "Stripes."**
- **Old-timer grump, not a dialect.** See the "steer clear" note under Art references.
- **Angel talk is all office talk.** He speaks of Heaven like a tired employee: "Upstairs,"
  "Management," "the paperwork," "my caseload." Never solemn.

### Catchphrase candidates

- **"Think from the door!"**
- **"Throw it where you ain't walkin'."**
- **"Not on the door! Never on the door!"**
- **"Again."** Just the one word, after a restart.
- **"Upstairs is watchin'. ...Not really. But I am."**

---

## Dialogue trees

`>` is a branch. `[brackets]` are stage directions or game state. The raccoon never speaks;
when the player gets a choice, it's a gesture.

### Tree 1 — Arrival in limbo (first room)

```
[Black. A flicker. The alley fades in at 3 a.m. Static crackle.]
[A crow drops onto the EXIT sign. A crooked halo bobs over his head a beat late.]
CROW: Hrrk. Another one.
CROW: Don't look at me like that. I didn't pick you neither.
  > [raccoon looks around, confused]
      CROW: Yeah. You're dead. Sorta. It's complicated.
  > [raccoon looks at its own paws]
      CROW: Still got 'em. Good. You'll need 'em.
CROW: This is limbo. Raccoon limbo. Don't ask me why there's one.
CROW: See this sign I'm sittin' on? That's the way out.
CROW: You get out of every alley, Upstairs lets you through.
CROW: You don't... [looks around at the alley] ...you live here.
CROW: Walk to the door.
  [player walks to the exit]
  > [short way]
      CROW: Huh. Ya listen. That's one for the file.
  > [wandered a lot first]
      CROW: Scenic route. In the afterlife. Bold.
```

### Tree 2 — The first bag

```
[Exit is dark. One bag on the board.]
CROW: Door's dark. Know why?
CROW: [taps the sign with his beak] Not till the bags are done.
  [player lines up a tear; the preview shows]
  CROW: [head tilts, watching]
  [player tears]
  > [trash lands away from the route]
      CROW: HA! Look at that spray. Beautiful.
  > [trash lands across the route]
      CROW: ...Proud of yourself?
        > [player undoes]
            → Tree 5, first undo
        > [player keeps going and the board dies]
            → Tree 4
```

### Tree 3 — Refusal barks

Keyed to the refusal reasons the game already gives (the `WHY` table in `src/main.js`), so they
follow the reason codes rather than restating rules. First line the first time a reason fires in
a room, second line once if the player keeps at it, then silence: the red cell does the talking.

| Reason | First time | Keeps doing it |
|---|---|---|
| `edge` | "That's the end of limbo, kid. Nothin' past it." | "Still the edge." |
| `wall` | "Brick. Brick wins." | "You're losin' to a wall. In the afterlife." |
| `trash` | "Your mess." | "Told ya." |
| `fan` | "Bag needs elbow room." | "Elbow room! Turn around!" |
| `canRoom` | "Where's it supposed to GO?" | "Nowhere to put it. Think." |
| `exit` | "Not on the door! Never on the door!" | "THE DOOR, kid." |
| `water` | "Raccoons wash food, not feet." | "Nope." |
| `glass` | "Glass. You wanna limp into Heaven?" | "Still glass." |
| `tar` | "Tar's got it." | "Say goodbye to it." |
| `oneway` | "Wrong way down a one-way. Classic." | "Other way." |
| busy (*"two paws"*) | "One thing at a time, hotshot." | — |

### Tree 4 — The board is lost

A hint ladder. Each step fires only if the player keeps moving on a dead board. Undo or restart
drops straight out of it.

```
[the dead-board scan says this board can't be won]
Step 0: [no words. Crow slowly turns his back. His halo dims.]
  [a few more moves, still dead]
Step 1: CROW: Kid. It's done. Nobody's gettin' out from here.
  [a few more]
Step 2: CROW: Back it up. Not one. More.
  [a few more]
Step 3 (Yoda mode):
  CROW: Lost it, you did. Three moves back.
  CROW: The bag by the couch. At the door, you threw it.
        [the bag that killed it flashes]
  > [player undoes to before that move]
      CROW: [turns back around; halo brightens] There. Alive again.
      CROW: ...Well. Not alive. You know what I mean.
  > [player restarts]
      CROW: Again.
```

### Tree 5 — Undo and restart (his one miracle)

The lore hook: **undo is his power.** A guardian angel turning back time is the one miracle he's
allowed, and he's sick of doing it.

```
[first undo, ever]
CROW: [wing flick; the halo flickers] There. Took it back.
CROW: That's a miracle, by the way. Don't make it weird.

[lots of undos in a row]
CROW: Hrrk. You know how much paperwork these are?
CROW: ...Fine. There's no limit. Just stop lookin' so happy about it.

[restart]
CROW: Again.

[restart, a lot of times in one room]
CROW: Again. ...Again. I said it slower that time. Did it help?

[long idle, once per room, then never again]
CROW: I'm not gettin' any younger.
CROW: ...I'm not gettin' any older, either. Limbo. Take your time.
```

### Tree 6 — Win

```
[exit reached]
  > [at par, no undos]
      CROW: No miracles? Not one?
      CROW: ...Huh. I'm writin' that down.
  > [at par]
      CROW: Not bad. Don't let it go to your head. Halos don't fit big heads.
  > [over par]
      CROW: Out's out. Ugly, but out.
  > [over par, tons of undos]
      CROW: Forty miracles, kid. Forty.
      CROW: Took me forty-one, once. Don't tell Management.
  > [any win, sometimes]
      CROW: One more alley. One more stamp. [stamps a little card with his beak]
```

### Tree 7 — New-piece intros

The crow reads the room's own `:teach` line and puts a grumble from a small pool in front of it.
He never has his own version of what a piece does, so he can never disagree with the room.

Grumble pool (draft): "Hrrk. New junk." / "Oh, this one." / "Upstairs thinks this is funny." /
"Pay attention, I'm sayin' it once." / "Ugh. Fine."

> **"Oh, this one."** + *the room's `:teach` line*

### Tree 8 — Perch talk between acts

Short scenes, one per act break. Each one gives away a little lore and nothing gets explained.

**After Act 1: the caseload**
```
CROW: You know how many raccoons I got?
CROW: One. You. I used to have a whole flock.
  > [raccoon tilts head]
      CROW: Long story. Short version: I lost one.
  > [raccoon yawns]
      CROW: Oh, I'm borin' you? In limbo? Where you got all the time there is?
```

**After Act 2: why the trash**
```
CROW: Know why it's trash? Every room. Trash.
CROW: 'Cause that's what you did. Tore it open, left it, moved on.
CROW: Up here, they want to see you make a mess and still find the way out.
CROW: Nobody's clean. The trick is not buryin' yourself.
```

**Late game: the chip**
```
CROW: You wanna know why I'm stuck with you?
CROW: [long pause] ...No. You don't.
CROW: Tear the bags.
```

**Final door (sketch only; the ending is open)**
```
[last room. Exit lights. The crow doesn't hop off the sign.]
CROW: Go on.
CROW: ...What? You thought I was comin'?
CROW: I got another one waitin'. Some possum. Ugh.
CROW: [quieter] You did good, kid.
```

---

## Art references

### Character look

- **Build:** small, hunched, a bit lopsided. Older than he admits.
- **Feathers:** scruffy and mid-molt. One bent primary feather sticking out. A head tuft that
  won't lie flat. Greyed bristles round the beak.
- **Eyes:** one sharp, one squinting or milky. A permanent "I'm judging you" look.
- **The halo:** the gag. It's made from alley junk, crooked, and a beat late following his head.
  Candidates: a soda-can pull ring, a ring from a six-pack holder, a bent bottle cap, a rubber
  band. It dims and brightens with his mood (dims on a lost board, flares on a win).
- **Wings:** his own black crow wings, beat-up. Maybe one feather tinted gold, as if he's only
  partly signed off himself.
- **Props (one or two, not all):** a coach's whistle on a string; a twig in his beak like a
  cigar; a little punch-card he stamps on a win.
- **Where he sits:** on the EXIT sign. When it lights, he hops aside and the door is yours.

### Limbo look

- **The alley at 3 a.m., forever.** The current target look (`art/reference/alley-gold.png`)
  already works for this. Limbo is shown by small wrong details, not by a new palette.
- **Ideas for wrongness:** the clock on a wall always reads 3:00; no wind but the bags rustle;
  the sky is the same flat colour every room; a streetlight hums but nothing is out there.
- **The EXIT sign is the only warm light** that's clearly from somewhere else.

### Animations (minimum set)

| Pose | When |
|---|---|
| Idle preen / shuffle, halo bobbing late | Default |
| Head tilt, one eye on the board | Player is lining up a tear |
| Back turned, halo dim | Board is lost (Tree 4, Step 0) |
| Wing over eyes | Repeat refusals |
| Wing flick, halo flicker | Undo (the miracle) |
| Beak-tap on sign | Exit still dark |
| Hop + caw, halo flare | Win |
| Card stamp | Win, some of the time |

### Talking portrait (the Star Fox part)

```
┌──────────────────────────────┐
│   ○    │ Not on the door!     │
│ ▓▓▓▓▓▓ │ Never on the door!   │
│ ▓(o)▓> │                      │
│ ▓▓▓▓▓▓ │                      │
└──────────────────────────────┘
  bust, crooked halo, beak flaps per syllable, scanline static on pop-in
```

Pop in, say it, pop out. Never covers the board.

### Voice

Procedural gibberish blips to fit the game's WebAudio sound: short pitched "kraa" and "hrk"
syllables, low and gravelly. Grumbles drop in pitch at the end; Yoda lines are slower. A faint
choir "ahh" under the win line, cut off mid-note, would be the angel joke in sound.

### Games and film to look at

| Reference | What to take | What to avoid |
|---|---|---|
| **Star Fox 64** (1997): Peppy Hare, Falco | Comm-box pop-in, one-line barks mid-play, a catchphrase | Barks so often they turn into noise |
| **Star Fox** (SNES, 1993) | Chunky portraits with gibberish voice | — |
| **Donkey Kong Country** (1994): Cranky Kong | Grumpy old-timer who complains and still helps | Long rants |
| **Yoda**, *The Empire Strikes Back* (1980) | Small, hunched, more than he looks; flipped word order | Overusing the flipped word order |
| **Mickey**, *Rocky* (1976) | Hard on you because he believes in you | — |
| **Clarence**, *It's a Wonderful Life* (1946) | The guardian angel who still has to earn his own wings | Sentiment without a joke on top |
| **Beetlejuice** (1988): the afterlife waiting room | The afterlife as a tired office | — |
| **The Good Place** (2016–2020) | Moral points, a bureaucratic Heaven, an ethics coach | — |
| **Kazooie**, *Banjo-Kazooie* (1998) | A sarcastic bird with gibberish voice blips | — |
| **Kaepora Gaebora**, *Ocarina of Time* (1998) | — | **Don't:** a bird who talks too long and won't let you skip |
| **Navi**, *Ocarina of Time* | — | **Don't:** "Hey! Listen!" nagging |
| **Undertale** (2015) | Each character gets their own text blips | — |

**Steer clear:** the crows in Disney's *Dumbo* (1941) are widely recognised as a racist
caricature. Keep his voice "grumpy old-timer" and don't drift toward anything that echoes them.

### Real crow behaviour worth using

- **They remember faces,** for years, and teach other crows to scold a face they don't like
  (University of Washington mask studies). A crow who holds a grudge is just a crow.
- **They gather round their dead.** Researchers have recorded crows crowding noisily around a
  dead crow, which some call crow "funerals." A crow in the afterlife business is less of a
  stretch than it sounds.
- **They use tools,** and city crows drop nuts on roads for cars to crack.

### Image-gen prompts (matching the `art/reference/` pipeline)

Same settings as `alley-gold.png`. Untested drafts.

> pixel art character portrait of a grizzled old crow with a crooked halo made from a soda can
> pull ring, scruffy molting black feathers, one bent wing feather, squinting eye, grumpy
> expression, bust shot inside a radio communication window, dark teal background

> pixel art screenshot of a top-down puzzle video game, a scruffy old crow with a small glowing
> halo perched on a green EXIT sign above a back-alley door at night, a raccoon below on a square
> tile grid, trash bags, eerie quiet lighting, a wall clock reading 3:00

---

## Observations

Noticed by Claude while sketching, 2026-10-23. Not decisions.

1. **Undo as his miracle** gives a lore reason for a mechanic that already exists, and the dim
   halo gives the board-is-lost state a picture without a word of HUD text.
2. **Almost every moment he reacts to already exists:** refusal reasons (`WHY` in
   `src/main.js`), the lost-board flag (`lost` / `deadKeys`), undo, restart, win, par and each
   room's `:teach` line. He sits on top of those as presentation.
3. **"Three moves back" (Tree 4, Step 3)** looks cheap: walk the undo history back until a state
   is not in `deadKeys`; the move after it is the one that lost the board. That also fills the
   gap GAME-SHEET answer #5 names.
4. **Limbo reframes "you walk out empty-pawed."** You can't take anything with you, which is a
   reason for the GAME-SHEET's open naming question to go either way: the treasure is the soul,
   or the name drops treasure.
5. **Act 1's pack name** still reads "(raccoon only, crow pinned)."
