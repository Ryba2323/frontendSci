# Wykrywanie skoków: średnia luminancja i różnica klatka-do-klatki (64×114) — piki poza zaplanowanymi cięciami = błąd
import subprocess, sys
import numpy as np
w, h = 64, 114
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(float)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
med = np.median(d)
print('klatek:', len(f), 'mediana różnicy:', round(med, 2))
# pik = różnica dużo większa niż sąsiedzi (pojedyncza klatka „wyskakuje”)
for i in range(1, len(d) - 1):
    neigh = max(d[i - 1], d[i + 1], 0.5)
    if d[i] > 3 * neigh and d[i] > 4:
        print(f'skok przy klatce {i}->{i + 1}: {d[i]:.1f} (sąsiedzi {d[i - 1]:.1f}, {d[i + 1]:.1f})')
# szew pętli
print('szew pętli (ostatnia→pierwsza):', round(np.abs(f[-1] - f[0]).mean(), 2), ' typowo:', round(med, 2))
