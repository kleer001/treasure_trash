# Video shot list — GAME_NAME

What to record for promotion, and how. Fill this in before shooting anything:
the clip names here are the same names `capture.sh` and `post.sh` use, so the
list is the schedule and the two scripts execute it. Companion to
`MARKETING-PLAN.md` and `ITCH-PAGE.md` (positioning) and `PUBLISHING-RUNBOOK.md`
(what the publishing surfaces do with the result).

Every claim a caption makes goes through the release gate like any other copy.
See `CLAUDE.md` → "The release gate."

## The governing constraint

Social video autoplays **muted**, and most viewers never unmute. Whatever the
hook is, it has to read silently, in the first three seconds, on a phone.

> **Name this game's on-screen proxies.** If the hook is audio, timing, or
> anything else the picture does not show by itself, list the specific on-screen
> elements that stand in for it — a meter, a counter, a spectrogram, a tell in
> the animation — and make sure every clip frames them. If the game has no such
> proxy, that is a design note, not a video note: the clip cannot invent one.

If any of those readouts is off by default, turn it **on** for the clips where it
is the tell, and say so here. Burn captions into every clip.

## Recording setup

`./capture.sh` records just the game window at its native size with the sound you
hear and no mouse cursor. `./capture.sh -s` starts recording immediately; without
`-s` it arms and waits for Enter so you can get set before the first frame.

> **A run takes over the desktop.** The window is real, visible, and held on top
> of everything else, and the audio track is whatever the machine is playing —
> not just the game. Anything you move across that rectangle lands on the take,
> and so does any notification sound. Do not start a run and keep working; the
> damage is invisible until playback.

Naming a clip — `./capture.sh core-loop` — plays that scripted take instead,
boots the game from factory settings so the previous take's settings cannot leak
in, and stops recording on its own. Scripted takes need a demo driver in the
game that honors `?demo=NAME` and the `&go=` handshake; the contract is written
out at the top of `capture.sh`. Without one, every clip below can still be shot
by hand.

- `--seed CODE` pins the run's seed, so the same take can be re-shot verbatim
  until the framing is right. Without it, anything procedural differs every run.
- `-t SECONDS` overrides the clip's recording length.

Record more than you need and cut in. A clean take of the same beat three times
gives an editor room to find the loop point.

## The clips

Six shots covers most games. Rename them for this game if a name is misleading,
but keep the vocabulary in sync with `clip_seconds` in `capture.sh` and the
tables in `post.sh` — the three lists are one list.

| # | Clip | Command | Length | Where it goes |
|---|---|---|---|---|
| 1 | Core loop | `core-loop` | 12–15s | itch GIF, `promo.html` share card, social — the one that sells it |
| 2 | The mechanic tell | `mechanic` | 12–18s | Explains the one rule; the "oh, I get it" post |
| 3 | Aesthetic pillar | `aesthetic` | ~18s | The look, doing the thing only this game's look does |
| 4 | The payoff | `payoff` | 6–10s | Seamless loop; usually the strongest muted performer |
| 5 | Title | `title` | 5–8s | Trailer opener, page header |
| 6 | Trailer | — | ~40s | Cut from the others by `post.sh` |

### 1. Core loop

The single most representative thirty seconds of play, cut to fifteen. Whatever
the player does over and over, done once, cleanly, with the outcome visible.

- **First 3 seconds:** the action and its consequence, together. Not the walk-up.
- **Caption:** CAPTION ONE — the loop in one lowercase line.

### 2. The mechanic tell

The one rule that has to be understood before the game makes sense, shown rather
than described. Set it up, break it, show the result.

- **First 3 seconds:** the moment the rule visibly asserts itself.
- **Caption:** CAPTION TWO — the rule, stated as a fact about the game.

If the tell is an **absence** — something that fails to happen — hold on it a
beat longer than feels comfortable, and write the caption about what *is* there
rather than about what is missing. A clip about nothing happening reads as
nothing happening. This is usually the strongest teaching clip and the weakest
trailer segment, for the same reason.

### 3. Aesthetic pillar

Walk whatever the game's look actually does — a settings pass that degrades the
picture live, a lighting change, a mode flip. One continuous take, biggest jump
last.

- **Caption:** CAPTION THREE.

### 4. The payoff

The moment the game rewards the player: the win, the transition, the level
resolving. Cut it so the last frame matches the first and it loops invisibly.

Usually needs no caption of its own — if it does, the beat is not reading.

### 5. Title

The title screen, held. Short, no gameplay. This is also the end card's source,
so shoot enough of it to hold four seconds under a URL.

### 6. Trailer

Assembled by `post.sh` from the clips above: title, core loop, aesthetic, payoff,
then the title held with the play URL. Keep it under 45 seconds; the first five
seconds decide whether the rest is watched.

Aspect ratio decides how it uploads — a 4:3 or wider cut is a normal video, a
9:16 cut becomes a Short and cannot be A/B tested. Cut verticals for feeds, never
for the trailer slot. See `PUBLISHING-RUNBOOK.md`.

## Staged shots

Some beats the game will not perform to camera: the thing that makes them
striking in play is rare, slow, or only legible across a session. A staged shot
lives on its own page (`promo-staged-beat.html`) and takes the same go-file
handshake, so `capture.sh` records it like any other clip.

The trade is legibility for literal accuracy, and it has a limit. Draw every
shape with the game's own code — its geometry, its renderer, its font, its post
pass — so that everything on screen is something the game builds, and stage only
the *arrangement*. A staged shot that shows the game doing something it cannot do
is a false claim, and it fails the release gate as one.

Document any staged shot here, in the open, with what was staged and why.

## Post

`./post.sh` cuts everything in `clips/` into `clips/out/`: each clip trimmed to
its beat with its caption burned in, 9:16 versions, looping GIFs, and the
trailer. It is re-runnable and overwrites its own output, so a re-shot take just
needs another pass.

The trim windows and the trailer's running order live in the two tables at the
top of `post.sh` — retime a clip, recaption it, or reorder the trailer by editing
the numbers there, not by re-recording.

- **Vertical (9:16)** cuts for short-video feeds. **Pad** the frame rather than
  cropping — the HUD usually carries the readouts that make a muted clip legible,
  and cropping to vertical throws exactly that away. The caption moves into the
  black band below the frame, where it covers nothing.
- **Looping GIF** for the itch page and README, held to a few seconds so the file
  stays light enough to autoplay.
- **Static frames** for stills and the 1280×720 thumbnails: pick the settings that
  make the most striking single frame, which are rarely the default ones.
