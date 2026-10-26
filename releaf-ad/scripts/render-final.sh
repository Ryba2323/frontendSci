#!/bin/bash
# Render końcowy: 1080×1920, 60 fps, 17 s, H.264 + AAC stereo.
# 1) 8 podklatek na klatkę (kompozycja ReLeaf30-subframes, 480 kl./s) → 2) FFmpeg uśrednia każdą ósemkę
#    (migawka 180°, prawdziwy motion blur z geometrii, nie z rozmycia obrazu) → 3) dźwięk → 4) kontrola ffprobe.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out build
python3 scripts/music.py public/audio/soundtrack.wav
npx remotion render ReLeaf30-subframes build/subframes.mov --codec=prores --prores-profile=hq --props='{"audio":false}' --log=error
ffmpeg -y -loglevel error -i build/subframes.mov -i public/audio/soundtrack.wav \
  -filter_complex "[0:v]tmix=frames=8:weights='1 1 1 1 1 1 1 1',select='eq(mod(n\,8)\,7)',setpts=N/(60*TB),format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 14 -profile:v high -level 5.1 -pix_fmt yuv420p \
  -x264-params keyint=60:min-keyint=60 -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart -shortest \
  out/releaf-30-days-final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,channels,sample_rate:format=duration,size,bit_rate -of default=nw=1 out/releaf-30-days-final.mp4
