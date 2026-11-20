// Walks rooms in the served game, headless, through the debug probe, and reports each beat that
// does not agree, land or rest.
//   PLAYWRIGHT=<path to playwright/index.js> node play.mjs <page url> <shot dir> <room>=<keys>...
// The page url carries `debug` (and `pixel` for the pixel renderer), e.g.
//   http://localhost:8001/index.html?acts=act1.tt&debug&pixel
import { createRequire } from 'node:module';
import fs from 'node:fs';
const [url, shots, ...walks] = process.argv.slice(2);
if (!process.env.PLAYWRIGHT || !url || !shots || !walks.length)
  throw new Error('usage: PLAYWRIGHT=<playwright/index.js> node play.mjs <page url> <shot dir> <room>=<keys>...');
const { firefox } = createRequire(import.meta.url)(process.env.PLAYWRIGHT);
fs.mkdirSync(shots, { recursive: true });
const b = await firefox.launch(), p = await b.newPage({ viewport: { width: 1400, height: 1000 } }), errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(url);
await p.waitForFunction(() => window.__tt && window.__tt.idle());
await p.waitForTimeout(4000);
// The crow's opening lines and the picker swallow keys until they are dismissed.
for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
let failed = errs.length > 0;
for (const walk of walks) {
  const [id, keys] = walk.split('=');
  const went = await p.evaluate(id => window.__tt.goto(id), id);
  await p.waitForTimeout(1500);
  const beats = await p.evaluate(k => window.__tt.walk(k), keys);
  await p.waitForTimeout(1200);
  const bad = beats.filter(r => !r.agree || !r.landed || !r.rested || r.errors.length);
  if (bad.length) failed = true;
  console.log(id, { went, keys: keys.length, beats: beats.length, bad: bad.length ? bad : 'none' });
  fs.writeFileSync(`${shots}/play-${id}.png`, await p.locator('#screen').screenshot());
}
console.log(errs.length ? errs : 'no page errors');
await b.close();
process.exit(failed ? 1 : 0);
