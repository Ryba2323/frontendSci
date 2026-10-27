"""Kopiuje oficjalne logo ReLeaf do public/ bez zmiany kształtu ani kolorów.

Jedyna poprawka: plik ma pojedyncze, prawie niewidoczne piksele (alfa 1–40) rozsiane
po przezroczystym tle. Zerujemy alfę tylko poza bezpośrednim sąsiedztwem znaku.
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
a = np.array(im)
core = Image.fromarray(((a[..., 3] > 128) * 255).astype("uint8"))
near = np.array(core.filter(ImageFilter.MaxFilter(9))) > 0
a[..., 3] = np.where(near, a[..., 3], 0)
Image.fromarray(a).save(dst, optimize=True)
ys, xs = np.where(a[..., 3] > 8)
print("bbox", xs.min(), xs.max(), ys.min(), ys.max(), "size", im.size)
