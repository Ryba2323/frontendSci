#!/usr/bin/env bash
# Render finalny: out/releaf-to-tez-sie-liczy-final.mp4 (1080×1920, 60 kl/s, 25 s, H.264 + AAC stereo).
# Nie ruszy, dopóki brakuje któregokolwiek ujęcia albo muzyki — film nie może wyjść z planszami zastępczymi.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'EOF'
import json, sys
d = json.load(open('src/dostepne.json', encoding='utf-8'))
cfg = json.load(open('ujecia.json', encoding='utf-8'))
brak = [k for k, v in d['ujecia'].items() if not v]
brak += [a['id'] for a in cfg['audio'] if a.get('wymagane') and not d['audio'].get(a['id'])]
if brak:
    print('Render finalny wstrzymany — brakuje: ' + ', '.join(brak))
    print('Wrzuć licencjonowane pliki do surowe/ (patrz ASSET_SOURCES.md) i uruchom: npm run ujecia')
    sys.exit(1)
EOF

if [ ! -f public/ui/checkin/f0000.png ]; then
  echo "Brak klatek ekranu aplikacji — nagrywam (npm run nagraj-ui)…"
  node scripts/nagraj-ui.cjs
fi

mkdir -p out
npx remotion render ReLeaf-ToTezSieLiczy out/releaf-to-tez-sie-liczy-final.mp4 \
  --codec=h264 --crf=12 --x264-preset=slow --pixel-format=yuv420p \
  --audio-codec=aac --audio-bitrate=320k --color-space=bt709

python3 scripts/sprawdz.py out/releaf-to-tez-sie-liczy-final.mp4
