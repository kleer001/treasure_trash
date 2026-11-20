#!/bin/bash
# Golden master for src/rules.js, sharded across processes, merged in room order.
#   golden.sh <tree root> <out dir> <label> [shards] [cap]
# Writes <out dir>/<label>.jsonl, .digests and .totals. Prints the totals line.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$1" && pwd)"; mkdir -p "$2"; OUT="$(cd "$2" && pwd)"; LABEL="$3"; N="${4:-16}"; CAP="${5:-2000}"
W="$OUT/$LABEL.work"
rm -rf "$W"; mkdir -p "$W"
pids=()
for ((k=0; k<N; k++)); do
  node "$HERE/gm.mjs" "$ROOT" "$W" --cap "$CAP" --shard "$k/$N" > "$W/shard$k.log" 2>&1 &
  pids+=($!)
done
fail=0; for p in "${pids[@]}"; do wait "$p" || fail=1; done
[ "$fail" = 0 ] || { echo "a shard failed; see $W/shard*.log"; exit 1; }
node "$HERE/gm.mjs" --merge "$W" "$OUT/$LABEL.jsonl"
rm -rf "$W"
