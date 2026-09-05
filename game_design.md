# GAME DESIGN — Treasure Trash

**What this file is.** A description of the game as the code plays it, read off the engine, the
level packs and the game shell at commit `776e766`. It is a **snapshot and non-binding**: it
decides nothing, and where it disagrees with the code the code is right. It is written for
someone who wants to know what the game IS without opening a source file, so it carries no
module names, no data shapes and no algorithms.

---

## 1. The fantasy

A raccoon in an alley at night. Every bag of garbage is a locked box, and the only way in is to
throw yourself at it. What comes out never goes away. The alley is small.

You are the mess you make.

## 2. The stance

This is a **puzzle**, and it is allowed to beat you. Undo is free and unbounded, so a room is
never softened to spare anyone a wrong move — the wrong move is the content. There is no timer,
no enemy, no failure state and no way to die. A room ends when you walk out of it or when you
decide to take it back.

## 3. The board

One screen. A grid of an alley, seen from above. Walls, floor, terrain, the raccoon, an exit,
and the junk.

You have exactly three things you can do, and all three are the same press — a direction:

- **Move.** Step onto a clear cell.
- **Push.** Shove whatever is in front of you.
- **Tear.** Walk into a bag. It bursts.

Which of the three you get is decided by what is standing in front of you. You never choose an
action, only a direction.

## 4. The core loop

**Walk into a bag and it bursts.** Trash sprays out in a fan around it — the two cells to either
side of the bag, the cell past it, and the two diagonally past it — and you step into the space
the bag was filling.

That trash is **permanent**. Nothing you do afterwards will move it by shoving. It is floor you
no longer have.

So the tear is aimed. Before every one you pick which five cells of your alley you are willing to
lose, and the answer changes every time you tear another one, because trash from one bag lands in
the fan of the next.

**The exit** is the way out. It lights when there is nothing left to open. You have to still be
able to reach it.

### Winning

A room is won when the raccoon is standing on the exit and:

- **no bags remain, anywhere** — loose on the floor, sealed inside a full can, a full recycle bin
  or a full wheelie bin, or stowed inside something being carried by something else. A bag out of
  sight is still a bag.
- **no spilled trash is riding on a cart.** You may not wheel your mess out of the room.

Nothing can ever be shoved onto the exit. The board refuses it outright, at every distance and
through every chain of pieces. You cannot bury your own way out — but you can absolutely wall
yourself off from it, and that is the real way to lose.

### Losing

You do not lose. You get **stranded**: the exit sitting there clear, and your own permanent trash
between you and it. Nothing announces it at the moment it happens, because the moment it happens
is usually several moves before you notice.

So the game watches. Each room is analysed once when it opens, and once it knows, it will tell
you plainly that the board in front of you can no longer be won. Undo or restart. It stays silent
until it is sure, and it gives up quietly on rooms too large to answer rather than stalling the
controls for a verdict that is not coming.

## 5. Refusal

An illegal press is not ignored. The raccoon lunges, the thing that would have happened is shown
happening, the board says which cells forbade it and why — *"the exit is your way out, you can't
dump on it"*, *"he's not wetting his paws"*, *"stuck in the tar for good"* — and the whole thing
rewinds. Nothing is written to the board.

Make the same mistake again in the same room and you get the short version. The full explanation
is offered once; after that it is a bump.

## 6. The pieces

Everything below is a thing you shove. It is grouped by what it teaches, not by what it is.

### Bags and trash

- **Bag** — the thing the room is about. Walk into it and it bursts in a fan. If any cell of that
  fan cannot take trash, the tear is refused entirely.
- **Spilled trash** — permanent. A shove will not touch it. Two things move it anyway: a broom
  sweeps it, and a grate swallows it. Thrown into a canal it packs the water full and becomes a
  crossing you can walk on forever after.

### Containers — things that shed when they land

Each of these slides one cell and pays a bill in the cell beyond, then reads as its empty self.

- **Full can** → puts a **bag** down beyond it.
- **Full recycle bin** → drops **trash** beyond it.
- **Water jug** → **pours water** beyond it, onto dry unoccupied ground only.
- **Empty can, empty bin, empty jug** — plain sliders that owe nothing.

A container will not empty onto the cell the raccoon is standing on. It keeps its load and stays
where it is until he moves.

The bill follows the container. If a can is carried across the room on a skateboard, it sheds its
bag where the skateboard sets it down, not where it was picked up.

### Rollers — things that travel

A roller shoved does not go one cell. It goes until something stops it.

- **Wheelie bin** — rolls any direction. Rolling, the rearmost one drops its bag out the back and
  reads empty afterwards.
- **Tyre** — comes in two lies. One rolls left and right, one rolls up and down. Shoved across its
  axis it is an ordinary one-cell slider.
- **Office chair** — rolls any direction, and is the one thing that gets out of the way of a
  bursting bag instead of blocking it. That is what turns the fan from a pure cost into something
  you can aim.

Two rules make rollers into a system:

- **A run of touching rollers is one thing to shove.** They travel together.
- **Impact hands motion on.** A rolling run that stops against something that rolls this way
  passes its motion into it, and into whatever THAT stops against. Cascades run in a straight
  line and always end.

### Bodies — things that span cells

- **Couch / furniture** — any connected blob. One cell a shove, and every cell of it needs
  somewhere to go, so it is cheapest to shove along its own length.
- **Bicycle** — two cells. Rolls when shoved along its length; otherwise shifts one cell.
- **Rug** — two cells or more. Rolls when shoved across its length.

A bicycle and a rug roll on opposite axes, so a pair lying across each other hands motion from one
to the other. A body is all of it or none of it: nothing moves half of a couch.

### Tools

- **Broom** — sweeps the whole contiguous line ahead of it one cell, of whatever kinds. It is the
  **only** thing that moves a bag without bursting it, which is what gives broken glass something
  to do. On a slick it carries the whole line the length of the slick.
- **Sponge** — dries the cell it lands on: water or grease, gone. It is not spent doing it, so it
  is the one unlimited cleaner in the game. Its bound is that it sticks forever to tar and to
  broken glass.
- **Cardboard** — covers a hazard and is spent doing it. Water, tar, broken glass — one sheet, one
  cell, walkable afterwards. Anywhere else it is just a sheet on the floor.
- **Pane of glass** — the inverted piece. Shove it and it does not travel: it **breaks**, in the
  cell beyond, leaving broken glass there. Boxed in it is safe. Given room it is destroyed. Every
  other piece on the board is the other way round.

### Machines

- **Filing cabinet.** Closed, it faces a way. Struck on the back — the face opposite the drawer —
  the drawer shoots out and it becomes a two-cell open cabinet; the blow is spent doing it and
  nothing slides. A rolling tyre or a swept line knocks it open exactly as the raccoon does.
  Struck on any other face it is an ordinary slider. Open, shoved on the drawer toward its body it
  shuts where it stands; driven drawer-first into something that will not take the drawer, it
  folds in and the body carries on into the space the drawer was filling.
- **Magnet.** Faces a way, with a reach of three. It takes hold of the first metal thing along its
  facing. Walls stop the field; objects do not, so it will reach past something to grab what is
  behind it. Once it has hold, it draws its catch in and stops alongside. Fields act on their own
  after every action — a magnet does not wait to be pushed — and a room is already holding what it
  holds the moment it opens. Something a magnet is holding, shoved from the far side, drags the
  magnet along behind it: the one place in the game where pulling happens. The sponge is not
  metal, deliberately.

### Carts — things that carry

- **Skateboard.** Two cells. **Empty it is light** and rolls, taking aboard whatever it rolls over
  for the whole length of the roll. **Carrying anything it is heavy** and moves one cell a shove.
  Shoved heavy with nowhere to go, it slops one item off the back rather than refusing — the only
  way to unload one deliberately. The raccoon steps on behind it only when the cell it left is
  actually clear.
- **Barrow.** One cell, and it faces a way. It is **aimed** where the skateboard is open-mouthed,
  and that is the whole difference: a barrow takes in only what it was already touching, only
  along its facing, only while empty, and only one thing per shove. Shoved across its axis it
  **tips** — it goes one cell and its load flies one further. Shoved at something too big to
  scoop, it hooks on and **tows** it: the pair is rigid, moving together or refusing together.
  What a barrow scoops stays in it until it tips, which is what scooping buys over a skateboard.
- Barrows ride inside carts, load and all, and inside other barrows, as deep as anyone wants to
  stack them. Set down anywhere, a carried barrow is a barrow again, still facing the way it
  faced, still holding what it held.

## 7. The ground

Terrain is not a piece. It is what a cell IS, and it decides what may stand there.

- **Wall** — nothing crosses.
- **Canal (open water)** — he will not wade in. **Trash thrown in packs it full and becomes a
  permanent crossing.** Anything else that lands in there stays, in plain sight and out of reach.
  A bag lost in the canal still counts, so the room is over — the mistake floats there being
  looked at rather than sinking out of the game.
- **Grease** — a slick carries motion instead of eating it. A thing that arrives on grease keeps
  going to the end of the slick, whatever it weighs, and settles every bill where it finally
  stops.
- **Tar** — anything that enters is held there for good. Nothing drags it off again. The
  permanence is the piece.
- **Broken glass** — he will not stand in it, which also means he cannot shove what is standing in
  it. A bag swept onto it bursts.
- **Grate** — anything that lands wholly inside one falls through and is gone. A body longer than
  the hole spans it and comes to rest across it.
- **Covered ground** — a hazard with cardboard over it. Ordinary floor now.
- **One-way** — admits travel in one direction only, and binds the raccoon and the junk alike.
- **Exit** — the way out. Nothing may ever be shoved onto it.

## 8. Progression and scoring

**Acts.** Twenty-five teaching rooms, then Act 1 (thirty-one rooms), then Act 2 (thirty). A picker
folds by act and shows what has been finished. Rooms are always reachable — nothing is locked.

**Par is not a designer's guess.** Every room's par is the provably minimal number of actions, and
the room's stated solution is checked to replay to a win in exactly that many. So the game can say
"optimal" and mean it.

- **Three stars — you matched par.** Not "very good": optimal.
- **Two stars — within a quarter over par.** Proportional rather than a flat number, so being
  three actions over on a short room is not treated the same as three over on a long one.
- **One star — you finished it.**

The best run is what is kept, never the latest: finishing a room badly after finishing it well
does not take the stars away.

**Undo** is free, instant and unbounded. **Restart** puts the room back. Neither costs anything —
the number that is kept is your best run, not your last one.

**Arming.** Some rooms — the early teaching ones, and a handful of Act 1 — require the direction to
be pressed twice to commit anything that changes the board. Walking is unaffected. It is there so
the room whose lesson IS the irreversible mistake gives you the beat to see it coming.

## 9. Presentation

- Keyboard: arrows or WASD to act, U to undo, R to restart, `<` and `>` between rooms.
- A move count against the room's par, a bag count, the stars already earned, and the standing
  unwinnable notice when the board is dead.
- Refusals paint the offending cells red and say what is in the way by name — "the couch is in the
  way", not "blocked".
- Sound is three things: a short beep for a refusal, another for arming a shove, and one chime on
  the win. Mutable.
- Cosmetic variation is seeded off the room, so a room looks the same every time you open it. The
  game itself is deterministic: a replay is the room plus the sequence of presses.

## 10. What makes a room ship

Rooms are data, and every claim a room makes about itself is machine-proved before it counts as a
room. The design contract, stated as what a room must survive:

- **Solvable**, and its declared par is the proven shortest solve.
- **The exit starts empty and is never occupied on any reachable board.** Not "the solution avoids
  it" — no line of play can put anything there.
- **All the open floor is one region.** No sealed pockets that look reachable.
- **The board is authored at rest** — nothing fires on the first press that was already true.
- **Every piece is handled or binding.** A piece the solution never touches must be a piece the
  solution could not do without. No scenery.
- **The walk in and the walk out are short.** Dead travel at either end is bounded, or the room
  declares the number and is held to it exactly. Par counts walking, so a room that marches you
  across itself after the last decision reads clean on every other measure and is still a worse
  room.
- **A teaching room holds its exit shut until its lesson is done.** The claim is proved by taking
  the lesson away — cover it, and the room must become unsolvable. A room you can walk around the
  lesson to finish is not teaching it.
- **The ways to lose are counted**, and where they sit relative to optimal play is measured. A room
  with seventeen traps that a reasonable player would never meet is a different room from one with
  a single trap eight moves down the obvious line.
- **Structure:** no large open rectangle (bushy and shallow — expensive to reason about, and it
  buys nothing), no niche walled on three sides.
