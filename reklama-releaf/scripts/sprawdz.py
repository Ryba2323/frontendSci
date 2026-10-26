"""
Kontrola gotowego pliku: parametry (ffprobe), czarne klatki, logo bez prostokąta.

Użycie: python3 scripts/sprawdz.py out/plik.mp4 [--bez-dzwieku]
"""
import json
import re
import subprocess
import sys

import numpy as np

plik = sys.argv[1]
bez_dzwieku = '--bez-dzwieku' in sys.argv
bledy, ok = [], []


def spr(warunek, opis):
    (ok if warunek else bledy).append(opis)


info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', plik],
                                 capture_output=True, text=True, check=True).stdout)
v = next(s for s in info['streams'] if s['codec_type'] == 'video')
a = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)
num, den = map(int, v['r_frame_rate'].split('/'))
dur = float(info['format']['duration'])
spr(v['codec_name'] == 'h264', f"wideo H.264 ({v['codec_name']}, {v.get('profile')})")
spr((int(v['width']), int(v['height'])) == (1080, 1920), f"rozmiar {v['width']}×{v['height']}")
spr(num / den == 60, f"{num / den:g} kl/s")
spr(abs(dur - 25) < 0.05, f"długość {dur:.3f} s")
spr(v.get('pix_fmt') == 'yuv420p', f"piksele {v.get('pix_fmt')}")
spr(int(v.get('nb_frames', 1500)) == 1500, f"klatki {v.get('nb_frames')}")
if bez_dzwieku:
    ok.append('dźwięk pominięty (podgląd)')
else:
    spr(a is not None and int(a.get('channels', 0)) == 2, f"dźwięk stereo ({a and a.get('codec_name')}, {a and a.get('channels')} kan.)")
    lo = subprocess.run(['ffmpeg', '-hide_banner', '-i', plik, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                        capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', lo)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', lo)[-1])
    spr(abs(lufs + 14) <= 1.0, f"głośność {lufs:.1f} LUFS (Instagram ≈ −14)")
    spr(tp <= -1.0, f"true peak {tp:.1f} dBTP")

# Czarne klatki
bd = subprocess.run(['ffmpeg', '-v', 'info', '-i', plik, '-vf', 'blackdetect=d=0.03:pix_th=0.06', '-an', '-f', 'null', '-'],
                    capture_output=True, text=True).stderr
czarne = [l for l in bd.splitlines() if 'black_start' in l]
spr(not czarne, 'brak czarnych klatek' if not czarne else 'CZARNE KLATKI: ' + '; '.join(czarne))

# Logo: na granicach obrazka (gdzie byłby prostokąt) tło musi przechodzić płynnie
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '24.6', '-i', plik, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True, check=True).stdout
img = np.frombuffer(raw, np.uint8).reshape(1920, 1080, 3).astype(float)
# Obrazek logo: szer. 560, środek poziomo, top 548, wys. ~548 (src/sceny/Marka.tsx); skala ≤1.012
x0, x1, y0, y1 = 260, 820, 548, 1096
skoki = []
# Próbki tylko po stronie tła (do środka są już krawędzie skrzydeł); okno ±3 px obejmuje ruch skali logo
for x, ds in ((x0, (-8, -4, 0)), (x1, (0, 4, 8))):
    for d in ds:
        # pas tła obok skrzydeł (y0+20…y0+120)
        skoki.append(np.abs(np.diff(img[y0 + 20:y0 + 120, x + d - 3:x + d + 4].mean(0), axis=0)).max())
# nad skrzydłami (między nimi) i pod znakiem słownym, na lewo od „R”
for y, xs, ds in ((y0, slice(420, 640), (-8, -4, 0)), (y1, slice(270, 340), (0, 4, 8))):
    for d in ds:
        skoki.append(np.abs(np.diff(img[y + d - 3:y + d + 4, xs].mean(1), axis=0)).max())
skok = max(skoki)
spr(skok < 3.0, f"logo bez prostokąta/krawędzi (największy skok tła na granicy obrazka: {skok:.2f}/255)")

for o in ok:
    print('  ✓', o)
for b in bledy:
    print('  ✗', b)
sys.exit(1 if bledy else 0)
