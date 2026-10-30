# Art benches

Pages for tuning the code-drawn trash and the motion of the things that spill it. They import
`src/` for the board and the rules, so a bench shows what the game would do. Nothing in `src/`
imports them.

Run `./run.sh`, then open a page under `/art/bench/`.

| Page | What it tunes |
|---|---|
| `trash.html` | The trash catalog: every item, its alternate palettes and turns, and a pile on the alley floor. |
| `spread.html` | How a board's TRASH cells are filled with pieces: mound, A, B and C side by side. B is the layout the other benches use. |
| `flight.html` | A torn bag: each piece's speed, arc and spin, and the window in which they all land. |
| `shadow.html` | The shadow a piece casts in the air, from wide and faint up high to the landed shadow at the floor. |
| `bin.html` | The recycling box: upright and full. |
| `can.html` | The trash can: upright with a bag in it. |
| `jug.html` | The water jug: upright and full. |
| `pane.html` | The glass pane. |
| `water.html` | Trash on water: a bag torn beside a canal. |
| `crossing.html` | The crossing's edge: how far it breaks up into the open water it meets, and in what pattern. The Trash on Water bench reads these settings. |
| `float.html` | Things afloat: an empty box, can or jug shoved into a canal, or a full can tipped into it or beside it. |
| `skate.html` | The skateboard: a deck lying up and down the picture can be seen three ways. |
| `raccoon.html` | The raccoon: sitting, crawling, and pushing, drawn by hand from its parts. |
| `raccoon_cartoon_v1.html` | The cartoon raccoon, version 1: crawling, pushing, and sitting idle, from the side, the front and the back, frame by frame, with each frame's hold on a slider. |
| `raccoon_cartoon_v2.html` | The cartoon raccoon, version 2, at game speed: one press or a run of them, each split into a wind-up, the move and a settle the next press cuts; the idle beats on a seeded timer. |
| `raccoon_cartoon_v3.html` | The cartoon raccoon, version 3: a fifth recovery, a nose rub on three legs; a press that winds up from any pose but a low one; a second stride that every other press in a run takes; every hold and gap counted in 60 Hz screen frames. |
| `tear.html` | The bag rip, with mound piles. |
| `screen.html` | The whole screen at 480×270 with 24 px cells: a top strip for the room's name and moves, a room from a level pack centred in the board area at 1×, 1.5× or 2× its art's size, and the crow's dock at the bottom with a sample line and a choice of portrait. A portrait with frames says the line one syllable at a time, its beak opening 1 → 2 → 3 → 2 → 1 for each, and blinks on a seeded timer; every timing is counted in 60 Hz frames. |
| `draft.html` | Pixel-art drafts for the pieces. Each piece has up to three versions, shown at 1×, at 4× and in a 4×3 room beside a can and a box. Keep, Toss and Redo verdicts and notes go to `/notes`. |

Each page saves its controls in `localStorage` under a `trash-*` key and reads the others'
keys, so a change on one page shows on the next. `src/art/look.json` holds the defaults a page
starts from before anything is saved.

Each animation bench checks itself: its first frame against a still of the board before the
move, its last frame against a still of the board after, and the cells what it spills lands in
against the cells the rules filled.

## Files

| Path | What it holds |
|---|---|
| `src/art/items.json` | The item sprites as palette-indexed character grids, the colour ramps and the accent hues. |
| `src/art/pile.js` | Item sprites, the per-pile picker, the mound layout and the pile drawer. |
| `src/art/spread.js` | Layouts A, B and C, and `pourPile`, which lays a given set of pieces by B. |
| `src/art/flight.js` | The flight plan, the flying shadow, and the stills a bench compares against. |
| `src/art/tip.js` | The fall of any standing thing seen from the side: turned about its foot, or folded toward the viewer or away unless the thing draws that fall itself. |
| `src/art/box.js` | The recycling box drawings and what a full box holds. |
| `src/art/can.js` | The trash can drawings, where its bag stands, and the turn of a sprite in the picture. |
| `src/art/jug.js` | The water jug drawings at each water level, and its fall toward the viewer or away, traced from the round solid its rows describe. |
| `src/art/water.js` | A water cell seen from above, the crossing trash packs it into, the fade where a crossing meets open water, the colour trash takes on when soaked, and the water's colours. |
| `src/art/skate.js` | The deck built as a model of blocks and drawn from it: from the side, or, lying up and down the picture, end on, from 45° above, or with its top at the floor's scale; and where a load stands on it. |
| `src/art/raccoon.js` | The raccoon's front, side and back views cut into parts, the poses and timing of each action, and its turn to face a press. |
| `src/art/cartoon.js` | The cartoon raccoon's parts, every frame of every action in each view drawn by hand and marked with its beat, the idle beats, and the frame that turns him between facings. |
| `art/bench/trash/cartoon_v1.js` | The frames of `raccoon_cartoon_v1.html`, kept as they were. |
| `art/bench/trash/cartoon_v2.js` | The frames of `raccoon_cartoon_v2.html`, kept as they were. |
| `src/art/pane.js` | The pane drawings, and the shards a glass cell holds. |
| `art/bench/trash/settings.js` | The saved settings each page reads. |
| `src/art/objects.json` | Room objects cut from pixel-art renders, for the catalog's test room. |
| `art/bench/crow/` | Candidate portraits for the crow, 40 px square, and `candidates.json`: each one's label, seed, LoRA and prompt. Each was rendered at 1040 px and refined to a 40 px grid. 68B is the crow; `68B_render.png` is its render before refining, and `68B_g130.png` the same render refined to a 130 px grid. `68B_frames.json` holds its frames as palette-index grids: 1 beak closed, 2 half open, 3 wide open, 4 blink, 5 squint, 6 looking away. Frames 4 to 6 change only the eye, so an eye can be laid over any beak. |
| `art/bench/crow/h3/` | Reference clips of the crow from MiniMax H3, each pinned to 68B at its first and last frame: `<name>.mp4` with its sound, `<name>_40/` its frames cut back to the 40 px grid in 68B's palette plus any `symbol_colours` its entry lists, and `<name>_pose.png` the pose it holds, voted pixel by pixel from the frames round the one furthest from 68B. `ph_*` clips are mouth shapes; `ex_*` clips are comic expressions from manga and webtoons, with the head held still and the beak shut. `clips.json` lists each clip's kind, shape or label, seed, length, size and prompt. A clip whose frames were edited by hand says what changed in its `hand_edit` entry, and `<name>.ase` holds the edited frames with their hold times, to open in LibreSprite. |
| `art/bench/trash/preview.py` | Renders every item and alternate palette to `art/bench/trash/preview.png`. |
| `src/art/assets.json` | The bag, the burst bag and the raccoon. |
