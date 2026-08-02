#!/usr/bin/env node
// Bundle the game into ONE self-contained HTML file for publishing.
//
// The game is ES modules plus a fetched level pack, which needs a server. An Artifact is a
// single file behind a CSP that blocks every external request, so this inlines the module
// sources and the data into one script. It is a PUBLISHING step, not a build step: the game
// is still the source of truth and still runs unbundled via ./run.sh, and this script only
// ever concatenates — it never edits logic.
//
//   node build-artifact.mjs [out.html]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(repo, f), 'utf8');
const out = process.argv[2] ?? resolve(repo, 'artifact.html');

// Dependency order. One scope means no module resolution, so a module's top-level consts
// must already exist when the next one evaluates — `theme` reads the engine's occupant
// codes, `sprites` reads the board geometry, and so on down the list.
const MODULES = [
  'rng.js', 'rules.mjs', 'theme.js', 'format.mjs', 'anim.js', 'compositor.js',
  'sprites.js', 'layers.js', 'session.js', 'audio.js', 'hud.js', 'input.js', 'view.js',
];

// Strip module syntax so the sources can share one script scope. Import ALIASES cannot
// survive this — there is nothing left to bind them to — so the modules above declare their
// shorthands as plain consts instead.
const demodule = src => src
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^import\s+[\s\S]*?\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '');

// This file is inserted into a document whose <head> belongs to the viewer, so it cannot
// carry a <meta charset>. If the host serves it as anything but UTF-8, every em dash and
// arrow turns to mojibake. So emit pure ASCII and stop depending on the host: markup text
// becomes numeric character references, script text becomes \u escapes. Both mean exactly
// the same character under every encoding.
const asciiMarkup = s => s.replace(/[^\x00-\x7F]/gu, c => `&#x${c.codePointAt(0).toString(16)};`);
// No `u` flag here on purpose: iterating UTF-16 code units turns an astral character into
// the surrogate pair JS source actually wants.
const asciiScript = s => s.replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const body = /<body>\s*([\s\S]*?)\s*<!-- ES modules/.exec(read('index.html'))?.[1];
if (!body) throw new Error('index.html no longer has the body the bundler slices');

// `main.js` splits into the wiring and the fetching, and only the wiring survives here —
// there is nothing to fetch inside one file. Anchored on the exported name, so this throws
// the day the split moves rather than quietly shipping a page that loads nothing.
const main = read('src/main.js');
const cut = main.indexOf('export async function loadAssets');
if (cut < 0) throw new Error('main.js no longer exports loadAssets — the bundler cannot find its cut');

// Levels are data on disk; inline them verbatim so the pack stays the single source. The
// win chime stays an .mp3 in the repo — playable, editable, diffable as a file — and only
// becomes base64 here, because the artifact is one document behind a CSP that blocks every
// request, data: URIs included.
const pack = read('levels/act1.tt');
const chime = readFileSync(resolve(repo, 'sfx/win-chime.mp3')).toString('base64');

// The boot the bundle uses in place of `loadAssets`: the same wiring, handed data that is
// already in the file.
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

// Collapsing thirteen module scopes into one is exactly where two modules turn out to have
// each used the same short name at the top level, and the browser reports that as a blank
// page. Compiling the bundle here — never running it — catches every such clash, plus any
// other syntax the stripping mangled, at build time and by name.
try {
  new Function('LEVEL_PACK', 'WIN_CHIME_B64', script);
} catch (e) {
  throw new Error(`the bundle does not parse — ${e.message}`);
}

const page_out = `<style>
${read('styles.css')}
/* Artifact-only: the game normally owns the whole page. Inside the viewer it sits in a
   themed frame, so pin the ground it was designed against rather than half-inherit a dark
   one. The house doc style is deliberately light; this commits to it instead of shipping
   a broken-looking inversion. */
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

// The whole point of the escaping above: one non-ASCII byte is enough to make the page
// depend on the host's charset again, so fail here rather than ship mojibake.
const stray = [...page_out].find(c => c.codePointAt(0) > 0x7F);
if (stray) {
  const at = page_out.indexOf(stray);
  throw new Error(`non-ASCII ${JSON.stringify(stray)} survived at offset ${at}: ` +
                  JSON.stringify(page_out.slice(Math.max(0, at - 40), at + 40)));
}

writeFileSync(out, page_out);
console.log(`wrote ${out} (${page_out.length} bytes, ASCII-only)`);
