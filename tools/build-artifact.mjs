#!/usr/bin/env node
// Bundle the game into one self-contained, ASCII-only HTML file for publishing.
// A publishing step, not a build step: it concatenates sources, it never edits logic.
// `node tools/build-artifact.mjs [out.html]`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(repo, f), 'utf8');
const out = process.argv[2] ?? resolve(repo, 'artifact.html');

// Dependency order: one scope means no module resolution, so each module's top-level
// consts must already exist when the next one evaluates.
const MODULES = [
  'rng.js', 'rules.mjs', 'theme.js', 'format.mjs', 'anim.js', 'compositor.js',
  'sprites.js', 'layers.js', 'session.js', 'audio.js', 'hud.js', 'input.js', 'view.js',
];

/** Strip module syntax so the sources share one script scope. Import aliases cannot survive. */
const demodule = src => src
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^import\s+[\s\S]*?\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '');

// The page has no <head> of its own, so it cannot declare a charset. Emit pure ASCII
// rather than depend on the host serving UTF-8.
const asciiMarkup = s => s.replace(/[^\x00-\x7F]/gu, c => `&#x${c.codePointAt(0).toString(16)};`);
const asciiScript = s => s.replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const body = /<body>\s*([\s\S]*?)\s*<!-- ES modules/.exec(read('index.html'))?.[1];
if (!body) throw new Error('index.html no longer has the body the bundler slices');

const main = read('src/main.js');
const cut = main.indexOf('export async function loadAssets');
if (cut < 0) throw new Error('main.js no longer exports loadAssets — the bundler cannot find its cut');

const pack = read('levels/act1.tt');
const chime = readFileSync(resolve(repo, 'sfx/win-chime.mp3')).toString('base64');

const boot = `
startGame({
  levels: parseLevelPack(LEVEL_PACK).levels,
  chimeBytes: Uint8Array.from(atob(WIN_CHIME_B64), c => c.charCodeAt(0)).buffer,
});

// Artifacts render in an iframe, so keystrokes go nowhere until the frame has focus.
const board = document.getElementById('board');
board.addEventListener('click', () => board.focus());
board.addEventListener('focus', () => document.getElementById('focusnote').classList.add('gone'));
addEventListener('load', () => board.focus());
board.focus();`;

const script = [
  ...MODULES.map(m => `// ---- ${m} ----\n${demodule(read(`src/${m}`))}`),
  `// ---- main.js (wiring only) ----\n${demodule(main.slice(0, cut))}`,
  boot,
].join('\n');

if (script.includes('fetch(')) throw new Error('a fetch survived bundling — the CSP would block it');
if (/^\s*(import|export)\s/m.test(script)) throw new Error('module syntax survived bundling');

// Compile, never run: catches top-level name clashes between modules by name, at build
// time, instead of as a blank page in the browser.
try {
  new Function('LEVEL_PACK', 'WIN_CHIME_B64', script);
} catch (e) {
  throw new Error(`the bundle does not parse — ${e.message}`);
}

const page_out = `<style>
${read('styles.css')}
/* Artifact-only: the viewer frames the page in its own theme, so pin the light ground
   this was designed against rather than half-inherit a dark one. */
:root, :root[data-theme="dark"], :root[data-theme="light"]{ color-scheme: light; }
body{ background:#ffffff; color:#1a1a1a; }
.focusnote{background:#fff8d6;border:2px solid #1a1a1a;border-radius:4px;padding:.5rem .8rem;
  font-size:.85em;font-weight:600;margin:.6rem 0;transform:rotate(-.4deg)}
.focusnote.gone{display:none}
canvas:focus{outline:3px solid #2d7dd2;outline-offset:3px}
@media (prefers-reduced-motion: reduce){ canvas{transition:none} }
</style>

${asciiMarkup(body.replace('<canvas id="board"',
  '<p class="focusnote" id="focusnote">Click the board once, then use the arrow keys — or tap the buttons below.</p>\n<canvas tabindex="0" id="board"'))}

<script type="module">
const LEVEL_PACK = ${asciiScript(JSON.stringify(pack))};
const WIN_CHIME_B64 = ${JSON.stringify(chime)};

${asciiScript(script)}
</script>
`;

const stray = [...page_out].find(c => c.codePointAt(0) > 0x7F);
if (stray) {
  const at = page_out.indexOf(stray);
  throw new Error(`non-ASCII ${JSON.stringify(stray)} survived at offset ${at}: ` +
                  JSON.stringify(page_out.slice(Math.max(0, at - 40), at + 40)));
}

writeFileSync(out, page_out);
console.log(`wrote ${out} (${page_out.length} bytes, ASCII-only)`);
