#!/usr/bin/env bash
# Cut the recorded takes in clips/ into everything the promo needs: captioned
# 4:3 clips, 9:16 versions for short-video feeds, looping GIFs, and the trailer.
# Output lands in clips/out/. Re-runnable — it overwrites its own output.
#
# Companion to video_shot_list.md (what each clip is for) and capture.sh (which
# records them). Usage, from the game root: publishing/post.sh
#
# THE TWO TABLES BELOW — clip_cut and TRAILER — ARE THE PER-GAME TUNING SURFACE.
# Retime a clip, recaption it, or reorder the trailer by editing the numbers
# there, not by re-shooting. Everything under them is generic ffmpeg plumbing.
set -uo pipefail
cd "$(dirname "$0")/.."   # this script lives in publishing/; every path below is game-root-relative

IN=clips
OUT=clips/out
WORK=clips/out/.segments
FONT=fonts/VT323-Regular.ttf   # the game's own display face, for burned captions
AMBER=0xffb000                 # caption colour; match the game's phosphor
CANVAS=800x400                 # must match capture.sh's window size
URL="kleer001.itch.io/GAME_SLUG"

[ -f "$FONT" ] || { echo "missing font: $FONT" >&2; exit 1; }
mkdir -p "$OUT" "$WORK"

# TUNING TABLE 1 — trim windows, measured off the takes: where each clip's beat
# actually sits, past the title splash and with a little air on both ends.
# Captions are the shot list's, burned in because social video autoplays muted.
#   name = in_seconds duration_seconds caption
clip_cut() {
  case "$1" in
    title)      echo "2.0 6.0|" ;;
    core-loop)  echo "3.3 15.0|CAPTION ONE" ;;
    mechanic)   echo "11.9 13.6|CAPTION TWO" ;;
    aesthetic)  echo "4.3 18.2|CAPTION THREE" ;;
    payoff)     echo "9.6 6.0|CAPTION FOUR" ;;
    *)          echo "" ;;
  esac
}

# A window capture comes out heavier than the game's own audio spec claims: the
# takes pick up subsonic wander and a boxy resonance that read as no pitch at
# all, but eat headroom and flatten the crest factor, so the bed arrives as one
# unrelenting slab. That is what makes takes tiring rather than atmospheric.
# This clears both and leaves the band the game actually speaks in alone.
#
# Per game: measure your own takes rather than trusting these numbers —
#   ffmpeg -i clips/core-loop.mp4 -af astats,ebur128=framelog=quiet -f null -
# reports DC offset, peak and loudness. Set the notches from what it says.
AUDIO_FIX="highpass=f=250:p=2,highpass=f=250:p=2,\
equalizer=f=285:w=1.3:width_type=q:g=-4,\
equalizer=f=3200:w=1.0:width_type=q:g=-2,\
lowpass=f=4500:p=2"

# Clearing the low end raises crest factor, which pushes transient bursts back up
# toward full scale -- so cap them. Catches transients only; AAC needs the headroom
# because its intersample peaks land above what the PCM peak meter reports.
CEILING="alimiter=limit=-1.5dB:level=disabled"

# Then put every clip on one loudness bed so no cut slams. Measured on the treated
# audio, since the filter itself changes level. A linear gain, not loudnorm's
# dynamic ride: short takes are short on dynamics already and compression costs more.
TARGET_LUFS=-16
SILENT_FLOOR=-35   # below this a clip has no content to normalise, only a noise
                   # floor to amplify -- a title splash is often silent because
                   # WebAudio cannot start before the player's first input.

# in: clip_name start_seconds duration_seconds -> gain in dB to reach TARGET_LUFS
norm_gain() {
  local measured
  measured=$(ffmpeg -nostdin -hide_banner -nostats -ss "$2" -t "$3" -i "$IN/$1.mp4" \
    -af "$AUDIO_FIX,ebur128=framelog=quiet" -f null - 2>&1 \
    | grep -m1 -E "^ +I:" | awk '{print $2}')
  [ -n "$measured" ] || { echo "could not measure loudness of $1" >&2; exit 1; }
  awk -v m="$measured" -v t="$TARGET_LUFS" -v f="$SILENT_FLOOR" \
    'BEGIN { printf "%.2f", (m < f) ? 0 : t - m }'
}

CLIPS=(title core-loop mechanic aesthetic payoff)
VERTICAL=(core-loop mechanic payoff)   # the shot list's short-video cuts
GIFS=(core-loop payoff)

# Captions go through a file, not an inline string: drawtext reads ':' as an
# option separator and a quote as end-of-text, so an apostrophe in the copy comes
# out swallowed. textfile= has no such reading.
cap_file() {
  local f="$WORK/cap-$2.txt"
  printf "%s" "$1" > "$f"
  printf "%s" "$f"
}

# Caption plate: sits above the HUD strip so it never covers whatever the game
# puts there, which is usually the part carrying the clip with the sound off.
# Near-opaque, or the picture reads straight through the text. The y offset is
# per game — set it from where this game's HUD actually starts.
caption_4x3() {
  printf "drawtext=fontfile=%s:textfile=%s:fontsize=30:fontcolor=%s:x=(w-text_w)/2:y=h-150:box=1:boxcolor=black@0.9:boxborderw=16" \
    "$FONT" "$(cap_file "$1" "$2")" "$AMBER"
}

# In 9:16 the caption goes in the black band under the frame, where it covers
# nothing at all and needs no plate.
caption_9x16() {
  printf "drawtext=fontfile=%s:textfile=%s:fontsize=44:fontcolor=%s:x=(w-text_w)/2:y=h/2+460" \
    "$FONT" "$(cap_file "$1" "$2")" "$AMBER"
}

encode=(-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart)

echo "== captioned 4:3"
for c in "${CLIPS[@]}"; do
  spec="$(clip_cut "$c")"
  read -r ss dur <<<"${spec%%|*}"
  cap="${spec#*|}"
  vf="null"
  [ -n "$cap" ] && vf="$(caption_4x3 "$cap" "$c")"
  g="$(norm_gain "$c" "$ss" "$dur")"
  ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$IN/$c.mp4" -vf "$vf" \
    -af "$AUDIO_FIX,volume=${g}dB,$CEILING" "${encode[@]}" "$OUT/$c.mp4"
  printf "   %-12s %ss  %+gdB\n" "$c.mp4" "$dur" "$g"
done

echo "== 9:16"
# Pad rather than crop: cropping to vertical throws away the HUD, and the HUD is
# usually the reason a muted clip reads at all.
for c in "${VERTICAL[@]}"; do
  spec="$(clip_cut "$c")"
  read -r ss dur <<<"${spec%%|*}"
  cap="${spec#*|}"
  vf="scale=1080:-2,pad=1080:1920:0:(1920-ih)/2:black"
  [ -n "$cap" ] && vf="$vf,$(caption_9x16 "$cap" "$c-9x16")"
  ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$IN/$c.mp4" -vf "$vf" \
    -af "$AUDIO_FIX,volume=$(norm_gain "$c" "$ss" "$dur")dB,$CEILING" "${encode[@]}" "$OUT/$c-9x16.mp4"
  printf "   %-12s %ss\n" "$c-9x16.mp4" "$dur"
done

echo "== gif"
for c in "${GIFS[@]}"; do
  spec="$(clip_cut "$c")"
  read -r ss dur <<<"${spec%%|*}"
  [ "$(echo "$dur > 5" | bc)" -eq 1 ] && dur=5   # a longer GIF gets too heavy to autoplay
  filters="fps=10,scale=400:-1:flags=lanczos"
  ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$IN/$c.mp4" \
    -filter_complex "$filters,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
    -loop 0 "$OUT/$c.gif"
  printf "   %-12s %ss  %s\n" "$c.gif" "$dur" "$(du -h "$OUT/$c.gif" | cut -f1)"
done

echo "== trailer"
# TUNING TABLE 2 — the trailer's running order. Open on the title and close on it
# with the URL. Hard cuts throughout, punctuated by the game's own transition
# (see build_cut); a dissolve fights a game that already cuts hard.
#
# A segment may run shorter than its standalone clip, and should when the beat
# lands early — a segment that keeps running past its point reads as a dropped
# frame rather than an ending. A shot whose beat is an *absence* usually belongs
# nowhere near a trailer: it needs more setup than a segment can give it and
# reads as nothing happening without one. The shot list decides which shots those
# are; this table only records the decision.
#   source in duration caption
TRAILER=(
  "title|2.0|6.0|"
  "core-loop|3.3|15.0|CAPTION ONE"
  "aesthetic|9.5|8.0|CAPTION THREE"
  "payoff|9.6|5.2|CAPTION FOUR"
)

# The cut between segments. A hard join butts two unrelated audio beds together
# and swaps the caption in the same frame, so neither the cut nor the new line
# gets a moment to register. Most games already have a vocabulary for "you have
# moved" -- a transition wipe, a flash, a burst of static -- so the trailer
# borrows it, then rests on black long enough for the next caption to arrive on a
# clear frame.
#
# The transition frame is lifted out of the footage rather than synthesised.
# Generated noise comes out flat beside it: the game's version carries whatever
# post-processing the renderer applies, which nothing downstream reproduces.
# Found by luma rather than by timestamp, so re-shooting the takes cannot
# silently break it. This is the one place post.sh assumes something about the
# footage — that the game's transition is markedly brighter than a normal frame.
# A game whose transition is a fade to black needs its own punctuation here.
#
# Under it, a swell of brown noise, faded at both ends, kept well under the
# segments so it reads as a breath rather than a hit.
CUT_STATIC=0.230 # the game's own transition length, as recorded
CUT_REST=0.180   # black after it, before the next caption lands
CUT_LUFS=-27     # a breath under the segments' bed, not a second voice

build_cut() {
  local src="$IN/core-loop.mp4" peak from dur
  peak=$(ffmpeg -nostdin -v error -i "$src" -vf "fps=30,scale=64:48"     -f rawvideo -pix_fmt gray - 2>/dev/null | python3 -c '
import sys
d = sys.stdin.buffer.read(); n = 64 * 48
frames = len(d) // n
if not frames: raise SystemExit("no frames to scan for a transition")
lum = sorted(range(frames), key=lambda i: sum(d[i*n:(i+1)*n]))
peak, mid = lum[-1], lum[frames // 2]
bright = lambda i: sum(d[i*n:(i+1)*n]) / n
# A transition burst is far brighter than any gameplay frame. If nothing stands
# out, the take has no transition in it and the brightest frame is just a lit
# wall -- say so rather than cutting the trailer with a picture of a room.
if bright(peak) < bright(mid) * 2.5:
    raise SystemExit("no transition burst found: brightest frame is not a transition")
print("%.3f" % (peak / 30))')
  [ -n "$peak" ] || { echo "could not find a transition burst in $src" >&2; exit 1; }
  from=$(awk -v p="$peak" -v d="$CUT_STATIC" 'BEGIN { printf "%.3f", (p - d/2 < 0 ? 0 : p - d/2) }')
  dur=$(awk -v a="$CUT_STATIC" -v b="$CUT_REST" 'BEGIN { printf "%.3f", a + b }')

  ffmpeg -v error -y -ss "$from" -t "$CUT_STATIC" -i "$src" -an "${encode[@]}" "$WORK/cut-a.mp4"
  ffmpeg -v error -y -f lavfi -i "color=c=black:s=$CANVAS:r=30000/1001:d=$CUT_REST"     -an "${encode[@]}" "$WORK/cut-b.mp4"
  ffmpeg -v error -y -f lavfi     -i "anoisesrc=color=brown:duration=$dur:amplitude=0.9:sample_rate=48000:seed=7"     -af "afade=t=in:st=0:d=0.13,afade=t=out:st=$(awk -v d="$dur" 'BEGIN{printf "%.3f", d-0.13}'):d=0.13,lowpass=f=2200"     -c:a pcm_s16le "$WORK/cut.wav"
  ffmpeg -v error -y -i "$WORK/cut-a.mp4" -i "$WORK/cut-b.mp4"     -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[v]" -map "[v]" -r 30000/1001     "${encode[@]}" "$WORK/cut-v.mp4"
  local raw
  raw=$(ffmpeg -nostdin -hide_banner -nostats -i "$WORK/cut.wav" -af ebur128=framelog=quiet     -f null - 2>&1 | grep -m1 -E "^ +I:" | awk '{print $2}')
  ffmpeg -v error -y -i "$WORK/cut-v.mp4" -i "$WORK/cut.wav" -map 0:v -map 1:a -shortest     -af "volume=$(awk -v r="$raw" -v t="$CUT_LUFS" 'BEGIN{printf "%.2f", t-r}')dB"     "${encode[@]}" "$CUT"
  rm -f "$WORK"/cut-a.mp4 "$WORK"/cut-b.mp4 "$WORK"/cut-v.mp4 "$WORK"/cut.wav
}

rm -f "$WORK"/*.mp4
CUT="$WORK/cut.mp4"
build_cut
printf "   %-12s %ss  (transition %ss + black %ss)\n" "cut" \
  "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$CUT")" "$CUT_STATIC" "$CUT_REST"

SEGS=()
i=0
for row in "${TRAILER[@]}"; do
  IFS='|' read -r src ss dur cap <<<"$row"
  vf="null"
  [ -n "$cap" ] && vf="$(caption_4x3 "$cap" "t$i")"
  seg="$(printf "%s/%02d-%s.mp4" "$WORK" "$i" "$src")"
  ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$IN/$src.mp4" -vf "$vf" \
    -af "$AUDIO_FIX,volume=$(norm_gain "$src" "$ss" "$dur")dB,$CEILING" "${encode[@]}" "$seg"
  # A cut before every segment but the first. Not before the end card either:
  # the last segment should already land on something quiet, and that running
  # straight into the URL is the one piece of punctuation the trailer had.
  [ "$i" -gt 0 ] && SEGS+=("$CUT")
  SEGS+=("$seg")
  i=$((i + 1))
done

# End card: the title splash held with the play URL, audio faded out. The URL is
# painted over the menu row — left showing, a trailer ends on what reads as a
# screenshot of a menu rather than on where to go. The drawbox geometry is per
# game: measure it off a frame of the title take.
END_DUR=4
ffmpeg -v error -y -ss 3.0 -t "$END_DUR" -i "$IN/title.mp4" \
  -vf "drawbox=x=60:y=345:w=680:h=100:color=black@1:t=fill,$(printf "drawtext=fontfile=%s:textfile=%s:fontsize=34:fontcolor=%s:x=(w-text_w)/2:y=372" "$FONT" "$(cap_file "$URL" "end")" "$AMBER")" \
  -af "afade=t=out:st=$((END_DUR - 2)):d=2" "${encode[@]}" "$WORK/99-end.mp4"
SEGS+=("$WORK/99-end.mp4")

# Concat filter, not the concat demuxer with -c copy: a segment's video and
# audio never come out exactly the same length, and stream-copy concatenation
# accumulates that drift into gaps and backwards timestamp jumps. Re-encoding
# through the filter lays every segment onto one continuous timeline.
inputs=()
graph=""
n=0
for seg in "${SEGS[@]}"; do
  inputs+=(-i "$seg")
  graph+="[$n:v][$n:a]"
  n=$((n + 1))
done
graph+="concat=n=$n:v=1:a=1[v][a]"
# Pin the rate: left to itself the concat filter emits 25fps against these
# 29.97fps takes, which throws away a frame in six and judders any motion.
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$graph" -map "[v]" -map "[a]" \
  -r 30000/1001 "${encode[@]}" "$OUT/trailer.mp4"
printf "   %-12s %ss\n" "trailer.mp4" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/trailer.mp4")"

echo
echo "out -> $OUT"
