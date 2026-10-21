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
| `tear.html` | The bag rip, with mound piles. |

Each page saves its controls in `localStorage` under a `trash-*` key and reads the others'
keys, so a change on one page shows on the next. `trash/look.json` holds the defaults a page
starts from before anything is saved.

Each animation bench checks itself: its first frame against a still of the board before the
move, its last frame against a still of the board after, and the cells the trash lands in
against the cells the rules filled.

## Files

| Path | What it holds |
|---|---|
| `trash/items.json` | The item sprites as palette-indexed character grids, the colour ramps and the accent hues. |
| `trash/pile.js` | Item sprites, the per-pile picker, the mound layout and the pile drawer. |
| `trash/spread.js` | Layouts A, B and C, and `pourPile`, which lays a given set of pieces by B. |
| `trash/flight.js` | The flight plan, the flying shadow, and the stills a bench compares against. |
| `trash/box.js` | The recycling box drawings, its fall frames, and what a full box holds. |
| `trash/settings.js` | The saved settings each page reads. |
| `trash/objects.json` | Room objects cut from pixel-art renders, for the catalog's test room. |
| `trash/preview.py` | Renders every item and alternate palette to `trash/preview.png`. |
| `tear/assets.json` | The bag, the burst bag and the raccoon. |
