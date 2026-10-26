"""
Wspólny grading filmu jako LUT 3D (.cube, 33³) — nakładany przez ffmpeg (lut3d) na każde ujęcie w `npm run ujecia`.

Kierunek (brief, pkt 5): ciepłe, neutralne światła; naturalna skóra; miękkie cienie z lekką szałwią;
powściągliwe brzoskwiniowe ciepło; naturalny kontrast. Bez teal-orange, bez przyciemniania, bez przesycenia.

Użycie: python3 scripts/lut.py [ścieżka.cube]   (domyślnie public/lut/releaf-grade.cube)
"""
import sys
import os
import numpy as np

N = 33


def grade(rgb):
    """rgb: tablica (..., 3) w zakresie 0–1 (wartości wyświetlane, Rec.709)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b

    # 1. Krzywa tonalna: lekko podniesiona czerń, łagodne S, miękkie zejście świateł
    def curve(x):
        x = np.clip(x, 0, 1)
        s = x + 0.055 * (x - 0.42) * 4 * x * (1 - x)      # delikatny kontrast wokół półtonów
        s = 0.022 + s * (1 - 0.022 - 0.012)                # czerń nie jest martwa, biel nie przepala się
        return np.clip(s, 0, 1)

    yc = curve(y)
    ratio = np.where(y > 1e-4, yc / np.maximum(y, 1e-4), 1.0)
    by_lum = np.clip(rgb * ratio[..., None], 0, 1)         # zachowuje odcienie
    per_ch = curve(rgb)
    out = 0.7 * by_lum + 0.3 * per_ch

    # 2. Split-toning: szałwia w cieniach, brzoskwinia w światłach (bardzo subtelnie)
    ws = np.clip(1 - y, 0, 1) ** 2.4
    wh = np.clip(y, 0, 1) ** 2.2
    sage = np.array([-0.006, 0.011, -0.001])
    peach = np.array([0.016, 0.006, -0.012])
    out = out + ws[..., None] * sage + wh[..., None] * peach

    # 3. Nasycenie: −6% globalnie, skóra (odcienie ok. 10–50°) prawie bez zmian
    mx, mn = out.max(-1), out.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    rr, gg, bb = out[..., 0], out[..., 1], out[..., 2]
    hue = np.where(mx == rr, ((gg - bb) / d) % 6, np.where(mx == gg, (bb - rr) / d + 2, (rr - gg) / d + 4)) * 60
    skin = np.clip(1 - np.abs(hue - 28) / 24, 0, 1) * (mx - mn > 0.03)
    sat = 0.94 + 0.05 * skin
    lum = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb)[..., None]
    out = lum + (out - lum) * sat[..., None]
    return np.clip(out, 0, 1)


def write_cube(path):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    grid = np.linspace(0, 1, N)
    # Kolejność .cube: R zmienia się najszybciej
    b, g, r = np.meshgrid(grid, grid, grid, indexing='ij')
    rgb = np.stack([r, g, b], -1).reshape(-1, 3)
    out = grade(rgb)
    with open(path, 'w') as f:
        f.write('TITLE "ReLeaf — To też się liczy"\n')
        f.write(f'LUT_3D_SIZE {N}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for v in out:
            f.write(f'{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
    print('Zapisano', path)


if __name__ == '__main__':
    write_cube(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'public', 'lut', 'releaf-grade.cube'))
