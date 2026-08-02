#!/usr/bin/env node
// Bundle the spike into ONE self-contained HTML file for publishing.
//
// The spike is ES modules + a fetched level pack, which needs a server. An Artifact is a
// single file behind a CSP that blocks every external request, so this inlines the module
// sources and the level data into one script. It is a PUBLISHING step, not a build step:
// spike/ is still the source of truth and still runs unbundled via ./run.sh, and this
// script only ever concatenates — it never edits logic.
//
//   node build-artifact.mjs [out.html]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(resolve(here, f), 'utf8');
const out = process.argv[2] ?? resolve(here, 'artifact.html');

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
const asciiMarkup = s => s.replace(/[^\x00-\x7F]/gu, c => `&#x${c.codePointAt(0).toString(16)};`);
// No `u` flag here on purpose: iterating UTF-16 code units turns an astral character into
// the surrogate pair JS source actually wants.
const asciiScript = s => s.replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const page = read('index.html');
const style = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
const body = /<body>\s*([\s\S]*?)\s*<script type="module">/.exec(page)[1];
const script = /<script type="module">([\s\S]*?)<\/script>/.exec(page)[1];

// Levels are data on disk; inline them verbatim so the pack stays the single source.
const pack = read('levels/act1.tt');
// The win chime is the one binary asset. It stays an .mp3 in the repo — playable, editable,
// diffable as a file — and only becomes base64 here, because the artifact is one document
// behind a CSP that blocks every request, data: URIs included.
const chime = readFileSync(resolve(here, 'sfx/win-chime.mp3')).toString('base64');

const inlined = demodule(script)
  .replace(/const res = await fetch\([^)]*\);[\s\S]*?LEVELS = parseLevelPack\(await res\.text\(\)\)\.levels;/,
    'LEVELS = parseLevelPack(LEVEL_PACK).levels;')
  .replace(/const sfx = await fetch\([^)]*\);[\s\S]*?winBytes = await sfx\.arrayBuffer\(\);/,
    'winBytes = Uint8Array.from(atob(WIN_CHIME_B64), c => c.charCodeAt(0)).buffer;');

if (inlined.includes('fetch(')) throw new Error('a fetch survived bundling — the CSP would block it');
if (/^\s*(import|export)\s/m.test(inlined)) throw new Error('module syntax survived bundling');

const page_out = `<style>
${style}
/* Artifact-only: the spike normally owns the whole page. Inside the viewer it sits in a
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

${asciiMarkup(body.replace('<canvas id="cv"', '<p class="focusnote" id="focusnote">Click the board once, then use the arrow keys — or tap the buttons below.</p>\n<canvas tabindex="0" id="cv"'))}

<script type="module">
const LEVEL_PACK = ${asciiScript(JSON.stringify(pack))};
const WIN_CHIME_B64 = ${JSON.stringify(chime)};

// ---- rules.mjs ----
${asciiScript(demodule(read('../src/rules.mjs')))}
// ---- format.mjs ----
${asciiScript(demodule(read('../src/format.mjs')))}
// ---- spike ----
${asciiScript(inlined)}

// Artifacts render in an iframe, so keystrokes go nowhere until the frame has focus.
cv.addEventListener('click', () => cv.focus());
cv.addEventListener('focus', () => document.getElementById('focusnote').classList.add('gone'));
addEventListener('load', () => cv.focus());
cv.focus();
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
