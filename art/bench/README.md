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
| `bin.html` | The recycling box: upright and full, tipped by a shove, its trash poured as B into the next cell. |
| `can.html` | The trash can: upright with a bag in it, tipped by a shove, the bag tumbling out into the next cell. |
| `jug.html` | The water jug: upright and full, tipped by a shove, pouring a puddle that fills the next cell. |
| `pane.html` | The glass pane: toppled by a shove, shattering into the shards that lie in the next cell. |
| `water.html` | Trash on water: a bag torn beside a canal; what lands in the water splashes, soaks through and packs the canal into a crossing. |
| `crossing.html` | The crossing's edge: how far it breaks up into the open water it meets, and in what pattern. The Trash on Water bench reads these settings. |
| `float.html` | Things afloat: an empty box, can or jug shoved into a canal, or a full can tipped into it or beside it, sinks in, bobs a few times, each bob smaller, and lies still; a shove at a thing afloat is refused. Which way a thing lies comes from what came before and from the stage's `decorAfter`, never from the board. |
| `skate.html` | The skateboard: rolled along its deck until something stops it, scooted one cell across it, or shoved while pinned so a load slops off the back; loads ride at full size, emptied containers lie as the stage's decoration says, and a deck lying up and down the picture can be seen three ways. |
| `raccoon.html` | The raccoon: sitting, crawling one cell, and pushing a thing that moves or is held fast, from any facing to any press, drawn by hand from its parts. |
| `cartoon.html` | The cartoon raccoon: crawling one cell, pushing a thing that moves or is held fast, and sitting idle, from the side, the front and the back, frame by frame, with each frame's hold on a slider. |
| `tear.html` | The bag rip, with mound piles. |

Each page saves its controls in `localStorage` under a `trash-*` key and reads the others'
keys, so a change on one page shows on the next. `trash/look.json` holds the defaults a page
starts from before anything is saved.

Each animation bench checks itself: its first frame against a still of the board before the
move, its last frame against a still of the board after, and the cells what it spills lands in
against the cells the rules filled.

The empty box, can and jug lie the way they fell, and the board does not record that way: each
bench takes it from its own push direction.

## Files

| Path | What it holds |
|---|---|
| `trash/items.json` | The item sprites as palette-indexed character grids, the colour ramps and the accent hues. |
| `trash/pile.js` | Item sprites, the per-pile picker, the mound layout and the pile drawer. |
| `trash/spread.js` | Layouts A, B and C, and `pourPile`, which lays a given set of pieces by B. |
| `trash/flight.js` | The flight plan, the flying shadow, and the stills a bench compares against. |
| `trash/tip.js` | The fall of any standing thing seen from the side: turned about its foot, or folded toward the viewer or away unless the thing draws that fall itself. |
| `trash/box.js` | The recycling box drawings and what a full box holds. |
| `trash/can.js` | The trash can drawings, where its bag stands, and the turn of a sprite in the picture. |
| `trash/jug.js` | The water jug drawings at each water level, and its fall toward the viewer or away, traced from the round solid its rows describe. |
| `trash/water.js` | A water cell seen from above, the crossing trash packs it into, the fade where a crossing meets open water, the colour trash takes on when soaked, and the water's colours. |
| `trash/skate.js` | The deck built as a model of blocks and drawn from it: from the side, or, lying up and down the picture, end on, from 45° above, or with its top at the floor's scale; and where a load stands on it. |
| `trash/raccoon.js` | The raccoon's front, side and back views cut into parts, the poses and timing of each action, and its turn to face a press. |
| `trash/cartoon.js` | The cartoon raccoon's parts and every frame of every action in each view, drawn by hand. |
| `trash/pane.js` | The pane drawings, and the shards a glass cell holds. |
| `trash/settings.js` | The saved settings each page reads. |
| `trash/objects.json` | Room objects cut from pixel-art renders, for the catalog's test room. |
| `trash/preview.py` | Renders every item and alternate palette to `trash/preview.png`. |
| `tear/assets.json` | The bag, the burst bag and the raccoon. |
