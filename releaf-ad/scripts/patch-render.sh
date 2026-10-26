#!/bin/bash
# Szybka poprawka końcowego filmu: renderuje ponownie tylko wskazane zakresy klatek (np. 0-45 250-285).
# Każda klatka jest czystą funkcją czasu, więc wynik jest taki sam jak przy pełnym renderze (scripts/render-final.sh).
# Wymaga build/subframes.mov z pełnego renderu.
set -euo pipefail
cd "$(dirname "$0")/.."
SUB=8
mkdir -p build/frames build/patch
AVG="tmix=frames=$SUB:weights='$(printf '1 %.0s' $(seq $SUB))',select='eq(mod(n\,$SUB)\,$((SUB - 1)))'"
if [ ! -f build/frames/f0000.png ]; then
  ffmpeg -y -loglevel error -i build/subframes.mov -vf "$AVG" -fps_mode passthrough -start_number 0 build/frames/f%04d.png
fi
for r in "$@"; do
  a=${r%-*}; b=${r#*-}
  npx remotion render ReLeaf30-subframes build/patch/p$a.mov --frames=$((a * SUB))-$((b * SUB + SUB - 1)) --codec=prores --prores-profile=hq --props='{"audio":false}' --log=error
  ffmpeg -y -loglevel error -i build/patch/p$a.mov -vf "$AVG" -fps_mode passthrough -start_number $a build/frames/f%04d.png
done
ffmpeg -y -loglevel error -framerate 60 -start_number 0 -i build/frames/f%04d.png -i public/audio/soundtrack.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 14 -profile:v high -level 5.1 -pix_fmt yuv420p \
  -x264-params keyint=60:min-keyint=60 -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart -shortest \
  out/releaf-30-days-final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,channels,sample_rate:format=duration,size -of default=nw=1 out/releaf-30-days-final.mp4
