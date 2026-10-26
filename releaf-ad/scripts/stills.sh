#!/bin/bash
# Użycie: scripts/stills.sh <katalog> <klatki...> — renderuje klatki i składa arkusz kontrolny
set -e
dir="$1"; shift
mkdir -p "$dir"
find "$dir" -maxdepth 1 -name 'f*.png' -delete
for f in "$@"; do npx remotion still ReLeaf30 "$dir/f$(printf %04d "$f").png" --frame="$f" --log=error; done
python3 scripts/contact.py "$dir/sheet.png" $(ls "$dir"/f*.png | sort)
