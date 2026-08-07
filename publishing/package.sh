#!/usr/bin/env bash
# Package the game for itch.io: a .zip with index.html at the archive ROOT.
# itch.io's HTML5 player requires index.html at the top level, .zip only, and
# fewer than 1000 files — a zip of the project folder does not work, because the
# folder becomes the root and the player finds no index.html.
set -euo pipefail
cd "$(dirname "$0")/.."   # this script lives in publishing/; it packages the game root

NAME="$(node -p "require('./package.json').name")"
OUT="dist/$NAME.zip"

# What a player needs at runtime — not the repo. Docs, tests, tools, promo
# pages and workflows stay out; add asset directories here as the game grows.
# The .sol packs and the jsonl banks are verifier and generator data, not runtime.
RUNTIME=(index.html styles.css src fonts sfx)
RUNTIME+=(levels/act*.tt)   # every act; .sol and the jsonl banks are offline data

rm -f "$OUT"
mkdir -p dist
zip -r "$OUT" "${RUNTIME[@]}" -x '*.DS_Store' '**/.gitkeep'

echo "Built $OUT"
echo 'Upload it to itch.io and tick "This file will be played in the browser."'
