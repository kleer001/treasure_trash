"""Render every item and alt in trash/items.json onto the alley floor, scaled up. usage: python3 trash/preview.py [out.png] [--gold]"""
import json, pathlib, sys
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).parent
D = json.load(open(HERE / 'items.json'))
GOLD = '--gold' in sys.argv
OUT = next((a for a in sys.argv[1:] if not a.startswith('--')), str(HERE / 'preview.png'))
FLOOR, UP, PAD = '#896e6e', 8, 3

def ramp(name):
    if name in D['ramps']: return D['ramps'][name]
    a = D['accents'][name]
    return D['ramps'][a['gold']] if GOLD else a['ramp']

def colours(item, alt):
    slots = {**item['slots'], **alt}
    m = {'k': D['ink'], 'h': D['highlight']}
    for slot, keys in (('A', '1234'), ('B', 'abcd'), ('C', 'wxyz')):
        if slot in slots:
            r = ramp(slots[slot])
            for i, ch in enumerate(keys): m[ch] = r[i]
    return m

items = D['items']
rows = []
for name, it in items.items():
    w, h = len(it['px'][0]), len(it['px'])
    assert all(len(r) == w for r in it['px']), name
    rows.append((name, it, w, h))
cellw = max(w for _, _, w, _ in rows) + PAD * 2
cellh = max(h for _, _, _, h in rows) + PAD * 2
maxalts = max(len(it['alts']) for _, it, _, _ in rows)
cols = 2
per = (len(rows) + cols - 1) // cols
label = 130
img = Image.new('RGB', (cols * (label + maxalts * cellw * UP + 20), per * cellh * UP), '#fafafa')
dr = ImageDraw.Draw(img)
for i, (name, it, w, h) in enumerate(rows):
    c, r = divmod(i, per)
    x0, y0 = c * (label + maxalts * cellw * UP + 20), r * cellh * UP
    dr.text((x0 + 4, y0 + cellh * UP // 2 - 6), f"{name} {w}x{h}", fill='#1a1a1a')
    for k, alt in enumerate(it['alts']):
        bx = x0 + label + k * cellw * UP
        dr.rectangle([bx, y0, bx + cellw * UP - 2, y0 + cellh * UP - 2], fill=FLOOR)
        m = colours(it, alt)
        ox, oy = (cellw - w) // 2, (cellh - h) // 2
        for y, row in enumerate(it['px']):
            for x, ch in enumerate(row):
                if ch == '.': continue
                px, py = bx + (ox + x) * UP, y0 + (oy + y) * UP
                dr.rectangle([px, py, px + UP - 1, py + UP - 1], fill=m[ch])
img.save(OUT)
print(OUT, img.size, len(rows), 'items', sum(len(it['alts']) for _, it, _, _ in rows), 'variants')
