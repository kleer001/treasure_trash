#!/bin/bash
# Oxlint with the dmmulroy/anti-slop rules, then Oxlint's default checks, over each directory.
#   lint.sh <tool dir> <dir to lint>...
# The tool dir holds the installed tools; put it in the session scratchpad, never in the repo.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$1"; shift
DIRS=(); for d in "$@"; do DIRS+=("$(cd "$d" && pwd)"); done
mkdir -p "$T"; cd "$T"
[ -d node_modules/oxlint ] || npm i oxlint@1.78.0 @oxlint/plugins@1.78.0 acorn acorn-walk esbuild
if [ ! -f anti-slop.mjs ]; then
  rm -rf anti-slop-repo anti-slop
  git clone --depth 1 https://github.com/dmmulroy/anti-slop anti-slop-repo
  cp -r anti-slop-repo/src anti-slop
  # Node cannot load the plugin's TypeScript source, so it is bundled to one ES module.
  npx esbuild anti-slop/index.ts --bundle --format=esm --platform=node --external:@oxlint/plugins --outfile=anti-slop.mjs
fi
cp "$HERE/antislop.oxlintrc.json" .
echo '{}' > default.oxlintrc.json
for d in "${DIRS[@]}"; do
  echo "== anti-slop: $d"; npx oxlint -c antislop.oxlintrc.json "$d" -f unix || true
  echo "== oxlint default: $d"; npx oxlint -c default.oxlintrc.json "$d" -f unix || true
done
