#!/usr/bin/env node
// Bundle the game into ONE self-contained HTML file for publishing.
//
// The game is ES modules + a fetched level pack, which needs a server. An Artifact is a
// single file behind a CSP that blocks every external request, so this inlines the module
// sources and the level data into one script. It is a publishing step, not a build step —
// the repo still runs unbundled via ./run.sh.
//
//   node tools/build-artifact.mjs [out.html]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Everything it reads lives at the repo root, one level up from tools/.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(root, f), 'utf8');
const out = process.argv[2] ?? resolve(root, 'artifact.html');

// Strip module syntax so the sources can share one script scope.
const demodule = src => src
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^import\s+[\s\S]*?\s+from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '');

// This file is inserted into a document whose <head> belongs to the viewer, so it cannot
// carry a <meta charset>. If the host serves it as anything but UTF-8, every em dash and
// arrow turns to mojibake. So emit pure ASCII and stop depending on the host: markup text
// becomes numeric character references, script text becomes \u escapes. Both mean exactly
// the same character under every encoding.
//
// The rule covers what a reader sees, so comments are dropped from the bundle rather than
// held to it — source keeps its punctuation and the artifact ships without the commentary.
const asciiMarkup = s => s.replace(/[^\x00-\x7F]/gu, c => `&#x${c.codePointAt(0).toString(16)};`);
// No `u` flag here on purpose: iterating UTF-16 code units turns an astral character into
// the surrogate pair JS source actually wants.
const asciiScript = s => s.replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
// Comments only: a CSS string like content:"\u2192" still renders, so it stays and is
// still held to the ASCII rule by the check at the end.
const stripCssComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n');

const page = read('index.html');
const style = stripCssComments(read('styles.css'));
const body = /<body>\s*([\s\S]*?)\s*<script type="module"/.exec(page)[1];
// The page now loads its module from src/main.js rather than carrying it inline.
const script = read('src/main.js');

// Levels are data on disk; inline them verbatim so the pack stays the single source.
const pack = read('levels/act1.tt');
// The win chime is the one binary asset. It stays an .mp3 in the repo and only becomes
// base64 here, because the artifact is one document behind a CSP that blocks every request.
const chime = readFileSync(resolve(root, 'sfx/win-chime.mp3')).toString('base64');

const inlined = demodule(script)
  .replace(/const res = await fetch\([^)]*\);[\s\S]*?LEVELS = parseLevelPack\(await res\.text\(\)\)\.levels;/,
    'LEVELS = parseLevelPack(LEVEL_PACK).levels;')
  .replace(/const sfx = await fetch\([^)]*\);[\s\S]*?winBytes = await sfx\.arrayBuffer\(\);/,
    'winBytes = Uint8Array.from(atob(WIN_CHIME_B64), c => c.charCodeAt(0)).buffer;');

if (inlined.includes('fetch(')) throw new Error('a fetch survived bundling — the CSP would block it');
if (/^\s*(import|export)\s/m.test(inlined)) throw new Error('module syntax survived bundling');

// Artifact-only: the game normally owns the whole page, but inside the viewer it sits in a
// themed frame. Pin the light ground it was designed against rather than half-inherit one.
const page_out = `<style>
${style}
:root, :root[data-theme="dark"], :root[data-theme="light"]{ color-scheme: light; }
body{ background:#ffffff; color:#1a1a1a; }
.focusnote{background:#fff8d6;border:2px solid #1a1a1a;border-radius:4px;padding:.5rem .8rem;
  font-size:.85em;font-weight:600;margin:.6rem 0;transform:rotate(-.4deg)}
.focusnote.gone{display:none}
canvas:focus{outline:3px solid #2d7dd2;outline-offset:3px}
@media (prefers-reduced-motion: reduce){ canvas{transition:none} }
</style>

${asciiMarkup(body.replace('<canvas id="cv"', '<p class="focusnote" id="focusnote">Click the board once, then use the arrow keys — or tap the buttons below.</p>\n<canvas tabindex="0" id="cv"'))}

<script type="module">
const LEVEL_PACK = ${asciiScript(JSON.stringify(pack))};
const WIN_CHIME_B64 = ${JSON.stringify(chime)};

// ---- src/rules.js ----
${asciiScript(demodule(read('src/rules.js')))}
// ---- src/format.js ----
${asciiScript(demodule(read('src/format.js')))}
// ---- src/main.js ----
${asciiScript(inlined)}

// Artifacts render in an iframe, so keystrokes go nowhere until the frame has focus.
cv.addEventListener('click', () => cv.focus());
cv.addEventListener('focus', () => document.getElementById('focusnote').classList.add('gone'));
addEventListener('load', () => cv.focus());
cv.focus();
</script>
`;

// The whole point of the escaping above: one non-ASCII byte is enough to make the page
// depend on the host's charset again, so fail here rather than ship mojibake. Anything
// reaching this line is text a reader would actually see — comments are already gone.
const stray = [...page_out].find(c => c.codePointAt(0) > 0x7F);
if (stray) {
  const at = page_out.indexOf(stray);
  throw new Error(`non-ASCII ${JSON.stringify(stray)} survived at offset ${at}: ` +
                  JSON.stringify(page_out.slice(Math.max(0, at - 40), at + 40)));
}

writeFileSync(out, page_out);
console.log(`wrote ${out} (${page_out.length} bytes, ASCII-only)`);
