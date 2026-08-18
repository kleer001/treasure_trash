# GAME-SHEET — Treasure Trash

The player-facing pitch. No jargon a player wouldn't use.

## Fantasy

You're a raccoon in an alley at 3 a.m., and every bag of garbage is a locked box.
You tear them open one by one. The catch: everything you spill **stays there
forever** — and the alley is small. You are the mess you make.

## Core loop

**Walk into a bag and it bursts.** Trash sprays out in a fan *ahead of you* — three
cells forward, plus the two cells to either side of the bag — and it never goes
away. So before every tear you pick a direction, because that garbage is about to
become a wall. Open every bag in the alley, then **walk out the way you came in**:
there's a green EXIT sign on every board, it lights up when the last bag tears, and
you have to still be able to reach it.

## Why it's fun in 30 seconds

Two bags, a narrow corridor between them, and the exit at the end of it. You walk up
into the first bag — *pop* — trash sprays away from you, harmlessly. Then you line up
the second one facing the wrong way, and the alley refuses you: the raccoon lunges,
the bag bursts, the garbage flies straight at your exit — and the whole thing rewinds
itself. **You cannot bury your own way out.** The board won't let you, and it shows you
why instead of telling you.

So you walk around and tear it the other way. That's the whole game in two moves:
**throw your mess where you don't need to walk.**

What it *won't* save you from is the quieter one — the exit sitting there perfectly
clear with your own garbage between you and it. Nothing kills you. You just walled
yourself off. Undo is free and instant, so finding that out costs you nothing but the
click.

## Why it's still fun at minute 30

Because the trash from one bag lands in the fan of another. Once there are three
bags in a room, you're not choosing a direction — you're choosing an *order*, and
most orders are already lost by the second tear. The rooms stop being about aiming
and start being about sequence.

## Genre & audience

**Turn-based puzzle** — the *Sokoban* family, the same shelf as *A Monster's
Expedition* and *Bonfire Peaks*. No timer, no reflexes, no hidden information, no
randomness: the whole room is on one screen, and every loss is a mistake you can
see and take back. For players who want to be *stuck* — pleasantly, for ten minutes
— and then see it.

## The one true twist

Most block-pushers give you a mess you can **fix**. Sokoban boxes go where you want
them. Bombs in bomb-Sokoban *clear* space. Here, tearing a bag is the only thing you
do, and it only ever **adds permanent obstacles**. The board gets strictly worse
forever, and you win by routing through the wreckage — never by tidying it.

## Look & sound

Bright, flat, geometric — bold blocks and hard color on a light field, closer to a
board game than a simulation. The alley reads as a clean grid; garbage reads as
solid shapes stacking up in it, so the mess is legible at a glance. When you line up
a tear, a preview tints the cells the trash is about to fill, so you always see the
wall before you build it. The one exception to the flat bright palette is the exit: a
real white-on-green EXIT sign, dark while bags remain, lit the moment the last one
tears. Procedural WebAudio — a dry step, a paper-and-plastic burst on the tear, a flat
clunk when a can won't budge, a short buzz when the alley refuses you — of which only the
win chime is built so far.

## The design answers

Five questions, answered from the running game rather than the pitch. An answer that cannot name
a mechanic is recorded as thin rather than written up to sound finished.

**1. What does the player learn by repeating the loop?** That a torn bag sprays trash in a fan
and that trash never comes up again, so the ORDER things are burst in decides whether the exit is
still reachable. By the second hour the room is read backwards from the door, and the question is
which bag to spend where — the same knowledge applied to a board that keeps producing new
geometry for it. Mechanic: `fan()` plus `layTrash`, which has no inverse.

**2. Which uncertainty is this game selling?** Not randomness — the game is deterministic and its
seeded RNG is cosmetic. It sells whether the board you have made is still winnable: every
irreversible piece (a grate that swallows, tar that holds, glass you cannot cross) shrinks the
space while you work, and the dead-board scan is what tells you it has closed. **Thin:** the scan
reports that a room is dead, which is a state, and a game selling uncertainty wants the player
guessing before it resolves rather than being informed after.

**3. Does a mechanic produce the aesthetic the pitch promises?** Yes, and it is one line: every
piece degrades one way only — a full can sheds its bag and becomes an empty one, a bin sheds
trash, a pane shatters into glass that stays — so the alley is measurably worse when you leave
than when you arrived, which is what "trashy alley" has to mean if it means anything.

**4. What does the action feel like, and where is the latency?** One press is one shove, and the
board commits the instant the shove is legal: `explain` decides, the stage animates afterwards,
and cutting an animation short still lands it. A shove arriving mid-animation is refused with "he
only has the two paws" rather than queued — a deliberate choice that the raccoon has one pair of
hands, felt in play rather than reasoned about.

**5. What is the failure state, and does losing teach anything?** There is no lose state: the game
is untimed and the only failure is a board that can no longer be won. **Thin, and this is the
finding.** The HUD says the board is dead; it does not say which shove killed it. A player cannot
name what they would do differently from that, which is exactly the bad answer the standard
describes — punished by something they cannot attribute. Naming the move is the work this points
at.

## Where this comes from

Sokoban (Thinking Rabbit, 1982) for the push-only grid and the irreversible-state puzzle; its
descendants for the convention that a level is data and the rules are one module. The departure
is that a Sokoban board is restored by undo alone, and this one is not: trash, glass and tar are
one-way, so the room degrades along the solution rather than only permuting. `.tt`/`.sol` is this
game's own format and answers to `FORMATS.md`.

## Open naming question

The title promises treasure. The game has none — collecting was cut, and winning means
every bag is torn open and the raccoon walks out **empty-pawed**, having carried off
nothing at all. Either a shiny comes back as a real object, or the game gets a name
about the mess.
