fresh

## Summary

**A rules session, then a governance one.** Six rules changes landed and were played; the browser
harness was rebuilt to plan interactions rather than replay solves; and the studio's directive
backlog — eleven releases unread — was worked to v0.24.0.

Everything is committed and pushed. 22 commits went up; the tree is clean.

The through-line of the second half: **prose was being treated as law.** A test NAME was read as a
design decision and used to narrow a change the owner had asked for, with an invented rationale
reported as fact. That is now a directive in `CLAUDE.md` (**NO PROSE IS EVER A RULE**), and the
studio turns out to have shipped the same rule at 0.14.0, unread since 2026-08-05.

## Todos

### Parallel

- [ ] #57 **Decide the two build plans.** `ROSTER-BUILD-PLAN.md` (222 lines) and
      `WEIGHT-BUILD-PLAN.md` (135) both open with "this file is scaffolding and it gets deleted
      when the last stage lands", and both state rules deliberately. They are now the largest
      rule-stating prose in the repo. Their last stage is THE PORT, which is gated — so they
      cannot land by their own terms. Delete them (`SPEC-SHEET.md` went for this reason) or say
      they stay.

- [ ] #58 **The dead-board indicator names a state, not a cause.** It says the board is dead; it
      does not say which shove killed it. Recorded as the thin answer to design question 5 in
      `GAME-SHEET.md` — a loss the player cannot attribute. Naming the move is the work.

- [ ] #59 **Open rule: should a blocked barrow hook let go and STAY let go?** Fields break when
      the group cannot travel; hooks do not. The reason is not "a hook is mechanical" — it is
      that a barrow shoved at something too big to scoop TAKES HOLD, so cutting the link hands it
      the same couch back on the same beat. Making it stay broken needs the re-hook suppressed for
      that beat.

- [ ] #60 **Open rule: should a slider carried by grease hand off momentum?** A roller crossing a
      slick into another roller transfers correctly. A can skating three cells into a tyre
      transfers nothing — consistent with a can never handing off on dry, but "momentum always
      lands somewhere" reads otherwise.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it lands
      occupant codes, refusals and `stateKey` lanes on every implementation at once.

- [ ] #62 **Bench room T5 "One-way" is a stub.** Its teach line promises a one-way; the room is an
      empty corridor with no terrain block and no pieces. It affords ZERO interactions. Solves at
      par, so every replay-to-a-win check passes it. Found by `tools/sweep.mjs`.

### Sequential

- [ ] #56 (needs: #57) **`--mark-read` the studio pin to 0.24.0.** All 16 directives are worked
      except the build-plan question, which came out of 0.14.0/0.15.0. Command:
      `python3 /home/menser/Dropbox/ai/code/trace_rom_studio/scripts/check_updates.py . --mark-read`

- [ ] #61 (needs: #56) **Send one clause upstream.** The studio's 0.14.0 CONTRACT names docs,
      comments and consequence-asserting tests, but not that a test NAME is prose too — which is
      the specific hole this session fell through. There is no contribute-back script; the studio
      is written to, by hand, as a CONTRACT amendment.

- [ ] #53 **`engine/target/release/tt-engine` does not match its source.** Built from a Rust edit
      since reverted, and `survey`/`harvest` pick it up automatically when it exists. Rebuild or
      delete — OWNER'S CALL, and the one thing left touching `engine/`.

- [ ] #47 **The Rust port is GATED — do not touch `engine/` without an explicit okay for that
      specific change.** It now owes: the weight ruleset, the cabinet swap, the live magnet field,
      the stack cut, bodies on grease, the leading-cell rule, settle-at-load and the breaking hold.

- [ ] #48 **Rebuild the rooms from `TEACHING-PLAN.md`** (now 75, renumbered after the stack). Held
      behind the rules settling, same gate as #53.

## Context

### What the rules do now that they did not this morning

Read `src/rules.js`; these are pointers, not statements of the rules.

- An impact that opens a cabinet reports it — `born`/`gone` are forwarded through the roller-train
  branch, which was the one path missed when `born` was added. It threw inside the rAF tick and
  killed the render loop.
- A tow names plain occupants, not only carts and pieces.
- Shutting a cabinet goes through `drop`, so a fold-in over a grate falls.
- The bag-on-can stack is CUT. Occupant code 6 retired, never reissued.
- Bodies run a slick, decided by the LEADING cell.
- `toState` settles magnet fields, so a room opens with its fields already holding.
- A magnet's hold breaks when the group cannot travel; a barrow's hook does not (see #59).

### The harness

- `tools/sweep.mjs` plans a bench pack's MEETINGS — piece against piece, piece onto lane — filtered
  to what a board can be driven to, ordered greedily. `--write` puts the plan where the dev server
  serves it. **For a rules change, never a verdict on a room.**
- `?debug` gives a play-by-play panel and `window.__tt`: `walk(keys)` presses through the game's
  own handler and compares the stage's sprites to a stage rebuilt from the board, every beat;
  `sweep(plan)` runs a whole plan. A disagreement names the sprite drawn that the board has not
  got and the one the board has that was never built.
- **Screenshots are the failure artifact, not the check.** The census disagreement that caught the
  cabinet bug was ~200 bytes on the first keypress.
- Last full run: 60 runs, 149 meetings, clean.

### Gates, and what "green" means here

`npm run test_rules` — 367/367, 17s, the specs that never read a file. `npm test` — 402/2, and the
two failures are `deadscan` against stale `act1` pars: BASELINE, not regression. `tools/matrix.mjs`
green at 1820 cases (690 of them now doing something, up from 672 once settle-at-load let links
exist in the census). `tools/conform.mjs` reference ALL AGREE; `--engine` fails and will until #47.

### Governance

- **`CLAUDE.md` § NO PROSE IS EVER A RULE** — no comment, doc, test name, `:teach` line, commit
  message or line of that file decides what a piece does. A red test is the expected result of a
  rules change, not a veto. Never invent a rationale for prose you find.
- **NOTHING IS SHIPPED.** Never cite authored levels as the cost of a rules change.
- **Rules before levels.** No solving, no par computation, no chasing level failures. The one
  exception is `tests/bench.test.js`, which replays each bench pack's declared `:solve` and asserts
  `par == length` — satisfy it quietly, without reporting routes.

### Studio

Pin is `.trace_rom_studio.toml` at **0.13.0** (the old `.trace_rom_studio_version` jammed the tool
at the gate). Studio is 0.24.0 at `/home/menser/Dropbox/ai/code/trace_rom_studio`. All 16
directives worked; the pin is deliberately NOT advanced — see #56.

**GitHub Pages was serving `publishing/` publicly** because the source was `legacy` (branch), and
the gate in `pages.yml` only fires when the source is Actions. Fixed and verified: `promo.html`
now 404s, the game still serves.

## Next Step

**#57 — decide the build plans.** It is the only thing between here and advancing the studio pin
(#56), and it is the same question `SPEC-SHEET.md` already answered once this session.

/home/menser/Dropbox/ai/code/treasure_trash
