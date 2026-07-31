#!/usr/bin/env bash
# Launch GAME_NAME in a borderless Chrome window at the canvas's native size and
# record just that window (video + the sound you hear) to an MP4.
#
# THIS TAKES OVER THE DESKTOP FOR THE LENGTH OF THE TAKE. The window is real and
# visible on DISPLAY=:0, it is raised to the top and kept there, and the audio
# track is the default sink's monitor — everything the machine is playing, not
# just the game. The recorder grabs a screen *region*, not the window's own
# pixels, so anything that drifts over that rectangle (a terminal, a
# notification, an editor) is recorded instead of the game and the take looks
# fine until you play it back. Never start a run and walk away expecting to keep
# working, and mute anything else that might speak.
#
# Borderless & 1:1: Chrome --app strips all browser chrome, --window-size with
# --force-device-scale-factor=1 makes the content exactly the game canvas, and a
# unique --class lets the recorder grab it without you clicking anything.
#
# Naming a clip hands the game to the scripted take of the same name and stops
# recording on its own; without one you play by hand and stop with 'q'+Enter or
# Ctrl-C. Either way the game window stays open after.
#
# Usage: ./capture.sh [-s] [-t SECONDS] [--seed CODE] [clip] [output_dir]
#   -s           start recording immediately (manual takes only; a clip always
#                starts immediately and waits for the recorder before playing)
#   -t SECONDS   override the clip's recording length
#   --seed CODE  pin the run's RNG seed, so the same take can be re-shot verbatim
#   clip         one of the names in clip_seconds below (see video_shot_list.md)
#   output_dir   where the MP4 lands (default: current dir)
#
# WHAT THE GAME HAS TO PROVIDE. Scripted takes are a contract between this script
# and the game's own demo driver; a game with no driver can still shoot every
# clip by hand, one manual take at a time.
#   ?demo=NAME  run the scripted take called NAME instead of a normal session.
#   &go=/FILE   park that take on a poll of FILE and do not play until it exists;
#               this script creates it once the recorder is rolling, so nothing
#               is missed before frame one.
#   ?seed=CODE  seed the run (src/rng.js), so a take is reproducible.
# A take that fails to land its beat should throw rather than bank silent
# footage — a scripted shot nobody watched is worth less than a loud failure.
set -uo pipefail

# ---- per-game knobs --------------------------------------------------------
PORT_BASE=8000
PORT_TRIES=20
CLASS=GAME_REPO_capture      # unique WM_CLASS; the recorder finds the window by it
GO_FILE=.demo-go             # the go-file handshake, served from this directory
WIN_W=800                    # the canvas's native size, from index.html
WIN_H=400
HERE="$(cd "$(dirname "$0")" && pwd)"
# The OS-level window recorder (kleer001/utilities, private). It does the ffmpeg
# work; this script only sets up a window worth pointing it at.
RECORDER="$HERE/../utilities/window_recorder.sh"
[ -x "$RECORDER" ] || { echo "recorder not found: $RECORDER" >&2; exit 1; }

# Some beats the game will not perform to camera. Those are staged on their own
# page, which takes the same go-file handshake and so records like every other
# clip. List them here; everything else plays through the demo driver.
#   clip-name) echo "promo-staged-beat.html" ;;
clip_page() {
  case "$1" in
    *) echo "" ;;
  esac
}

# Recording length per clip: the shot list's target plus handle, so there is
# something to trim to on both ends. These names are the clip vocabulary — the
# same names appear in video_shot_list.md and in post.sh's tables.
clip_seconds() {
  case "$1" in
    title)      echo 10 ;;
    core-loop)  echo 20 ;;
    mechanic)   echo 28 ;;
    aesthetic)  echo 24 ;;
    payoff)     echo 22 ;;
    *)          echo "" ;;
  esac
}
# ---- end knobs -------------------------------------------------------------

START_NOW=0
DURATION=""
SEED=""
CLIP=""
OUTDIR="$PWD"
while [ $# -gt 0 ]; do
  case "$1" in
    -s|--start-now) START_NOW=1; shift ;;
    -t|--duration)  DURATION="$2"; shift 2 ;;
    --seed)         SEED="$2"; shift 2 ;;
    -*)             echo "unknown flag: $1" >&2; exit 2 ;;
    *)
      if [ -z "$CLIP" ] && [ -n "$(clip_seconds "$1")" ]; then CLIP="$1"; else OUTDIR="$1"; fi
      shift ;;
  esac
done

QUERY=""
if [ -n "$CLIP" ]; then
  [ -z "$DURATION" ] && DURATION="$(clip_seconds "$CLIP")"
  PAGE="$(clip_page "$CLIP")"
  if [ -n "$PAGE" ]; then
    QUERY="$PAGE?go=/$GO_FILE" # staged page: no demo driver to hand it to
  else
    QUERY="?demo=$CLIP&go=/$GO_FILE"
  fi
  [ -n "$SEED" ] && QUERY="$QUERY&seed=$SEED"
  START_NOW=1
elif [ -n "$SEED" ]; then
  QUERY="?seed=$SEED"
fi

# A stale go-file from an earlier run would start the take before the recorder.
rm -f "$HERE/$GO_FILE"

# Clips boot from factory settings: a game that persists preferences and
# progress would otherwise hand a take the last one's settings. Manual takes
# keep their profile, so a session can be resumed.
[ -n "$CLIP" ] && rm -rf "/tmp/${CLASS}-profile"

# Always serve this directory ourselves, on the first free port at or above the
# base — adopting whatever already holds the base port would happily record
# another project's page. (no-store: always fresh JS.)
PORT=""
for p in $(seq "$PORT_BASE" $((PORT_BASE + PORT_TRIES))); do
  lsof -ti "tcp:$p" -sTCP:LISTEN >/dev/null 2>&1 || { PORT="$p"; break; }
done
[ -n "$PORT" ] || { echo "no free port in $PORT_BASE-$((PORT_BASE + PORT_TRIES))" >&2; exit 1; }
( cd "$HERE" && exec python3 -c '
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", int(sys.argv[1])), H) as s: s.serve_forever()
' "$PORT" ) >/dev/null 2>&1 &
SERVER=$!
echo "capture -> serving $HERE on $PORT"

# Borderless game window at the canvas's native resolution, tagged with a unique
# WM_CLASS so the recorder can find it. Throwaway profile keeps your real one
# clean. A scripted take's synthetic keys cannot satisfy Chrome's autoplay gate,
# so a game with sound records silent without the policy override.
google-chrome --app="http://localhost:$PORT/$QUERY" \
  --class="$CLASS" --force-device-scale-factor=1 \
  --autoplay-policy=no-user-gesture-required \
  --window-size="$WIN_W,$WIN_H" --window-position=200,200 \
  --user-data-dir="/tmp/${CLASS}-profile" \
  --no-first-run --no-default-browser-check >/dev/null 2>&1 &

# Wait for the window to map before handing off to the recorder.
for _ in $(seq 40); do
  xdotool search --onlyvisible --class "$CLASS" >/dev/null 2>&1 && break
  sleep 0.25
done

# Raise it to the top and keep it there — the recorder grabs the rectangle the
# window happens to occupy, not the window itself.
GAME_WID="$(xdotool search --onlyvisible --class "$CLASS" | tail -1)"
if [ -n "$GAME_WID" ]; then
  xdotool windowraise "$GAME_WID"
  xdotool windowactivate "$GAME_WID" 2>/dev/null
  sleep 0.5
fi

REC_ARGS=(-c "$CLASS")
[ "$START_NOW" -eq 1 ] && REC_ARGS+=(-s)
[ -n "$DURATION" ] && REC_ARGS+=(-t "$DURATION")

# A manual take is a session: the window and its server stay up afterwards so
# you can keep playing, and a dead server would trip any lost-connection state.
if [ -z "$CLIP" ]; then
  exec "$RECORDER" "${REC_ARGS[@]}" "$OUTDIR"
fi

# Scripted take: the page is parked on the go-file poll, so start the recorder
# first and only then release it. Both ends are covered by the clip's handle.
"$RECORDER" "${REC_ARGS[@]}" "$OUTDIR" &
REC=$!
sleep 1.5
: > "$HERE/$GO_FILE"
echo "capture -> released clip '$CLIP' (${DURATION}s)"
wait "$REC"
rm -f "$HERE/$GO_FILE"

# A clip has nobody sitting at it, so it tears down its own window and server.
# Left up, they would be found first by the next clip's window lookup and port
# scan, and a run of several takes would record the wrong window.
pkill -f "user-data-dir=/tmp/${CLASS}-profile"
kill "$SERVER" 2>/dev/null
