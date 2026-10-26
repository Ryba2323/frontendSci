# Ścieżka dźwiękowa „ReLeaf — 30 dni” — w całości syntetyczna (numpy/scipy), oryginalna kompozycja.
# 127,06 BPM, 36 uderzeń = 17 s = dokładnie długość filmu. Zdarzenia wynikają z tej samej siatki co obraz
# (src/timing.ts). Renderujemy 3 przebiegi pętli i bierzemy środkowy — ogony pogłosu przechodzą przez szew pętli.
#
# Użycie: python3 scripts/music.py public/audio/soundtrack.wav
import sys
import numpy as np
from scipy import signal

SR = 48000
DUR = 17.0
BEATS = 36
B = DUR / BEATS                      # 0,4722 s
FR = 1 / 60                          # klatka
N = int(SR * DUR)
rs = np.random.RandomState(2026)


def b(n):
    return n * B


def fr(f):
    return f * FR


# ---------------- zdarzenia z osi czasu obrazu (src/timing.ts) ----------------
T = dict(
    landStep=b(0.125), detach=b(2), impact01=b(3), s2=b(4), hinge0=b(4), hingeStep=b(0.5),
    fold0=b(7), foldStep=b(0.75), cap29=b(9.25), cap30=b(9.75), explode=b(10), s3=b(12),
    pullback=b(18), lock=b(20), still=b(21.2), lift30=b(22.5), card=b(24.5), morph=b(28.25),
    logo=b(31), outro=b(34.25), loop=b(34.5),
)
LOCKS = [T['lock'] - (29 - i) * 0.95 * FR for i in range(30)]  # zatrzaskiwanie płyt (World.scatterPose)

# ---------------- narzędzia ----------------
L = 3 * N + SR * 4
mixL = np.zeros(L)
mixR = np.zeros(L)
revL = np.zeros(L)
revR = np.zeros(L)
duckEnv = np.zeros(L)   # obwiednia stopy do sidechainu
bus = {}


def track(name):
    if name not in bus:
        bus[name] = [np.zeros(L), np.zeros(L)]
    return bus[name]


def place(name, t, sig, pan=0.0, gain=1.0, rev=0.0):
    """Wstaw dźwięk mono/stereo w chwili t (s) na wszystkich 3 przebiegach pętli."""
    if sig.ndim == 1:
        l = sig * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        r = sig * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    else:
        l, r = sig[0], sig[1]
    tl = track(name)
    for k in range(3):
        i0 = int(round((t + k * DUR) * SR))
        if i0 >= L:
            continue
        i1 = min(L, i0 + len(l))
        n = i1 - max(0, i0)
        if n <= 0:
            continue
        s0 = max(0, -i0)
        tl[0][max(0, i0):i1] += l[s0:s0 + n] * gain
        tl[1][max(0, i0):i1] += r[s0:s0 + n] * gain
        if rev > 0:
            revL[max(0, i0):i1] += l[s0:s0 + n] * gain * rev
            revR[max(0, i0):i1] += r[s0:s0 + n] * gain * rev


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def noise(sec):
    return rs.uniform(-1, 1, int(sec * SR))


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f, SR / 2 - 100), btype='low', fs=SR, output='sos'), x)


def reson(x, f, q):
    b_, a_ = signal.iirpeak(f, q, fs=SR)
    return signal.lfilter(b_, a_, x)


def sweep_filter(x, f0, f1, kind='band', q=0.8, block=256):
    """Filtr o zmiennej częstotliwości (blokami, ze stanem)."""
    out = np.zeros_like(x)
    nb = (len(x) + block - 1) // block
    zi = None
    for i in range(nb):
        u = i / max(1, nb - 1)
        f = f0 * (f1 / f0) ** u
        if kind == 'band':
            bw = f / q
            lo, hi = max(30, f - bw / 2), min(SR / 2 - 200, f + bw / 2)
            sos = signal.butter(2, [lo, hi], btype='band', fs=SR, output='sos')
        else:
            sos = signal.butter(2, min(f, SR / 2 - 200), btype='low', fs=SR, output='sos')
        seg_ = x[i * block:(i + 1) * block]
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, seg_, zi=zi)
        out[i * block:i * block + len(y)] = y
    return out


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def saw(f, sec, detune=0.0):
    t = tt(sec)
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))


# ---------------- instrumenty ----------------
def kick(vel=1.0, long=1.0):
    t = tt(0.55 * long)
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (0.22 * long))
    click = hp(noise(0.006), 2500) * np.linspace(1, 0, int(0.006 * SR))
    s = np.tanh(1.6 * body) * 0.95
    s[:len(click)] += click * 0.35
    return s * vel


def sub_boom(sec=2.2, f0=62, f1=31):
    t = tt(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(1.3 * np.sin(ph)) * np.exp(-t / (sec * 0.38))


def clap():
    n = noise(0.25)
    e = np.zeros_like(n)
    for d in (0, 0.009, 0.019):
        i = int(d * SR)
        e[i:] += np.exp(-np.arange(len(n) - i) / (0.012 * SR))
    e += 0.6 * np.exp(-np.arange(len(n)) / (0.09 * SR))
    return bp(n, 900, 3200) * e * 0.9


def hat(open_=False, vel=1.0):
    sec = 0.22 if open_ else 0.045
    t = tt(sec)
    s = np.zeros_like(t)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        s += np.sign(np.sin(2 * np.pi * f * 1.62 * t))
    s = hp(bp(s + noise(sec) * 0.8, 6500, 14000), 7000)
    return s * np.exp(-t / (0.07 if open_ else 0.012)) * vel * 0.35


def tick(f=2800, q=18, vel=1.0, body=0.0):
    """Mechaniczne kliknięcie: krótki impuls przez rezonans + opcjonalny niski stuk."""
    sec = 0.09
    x = np.zeros(int(sec * SR))
    x[:int(0.0015 * SR)] = rs.uniform(-1, 1, int(0.0015 * SR))
    s = reson(x, f, q) * 6 + bp(x, f * 1.9, min(f * 3.2, 20000)) * 2
    s *= np.exp(-np.arange(len(s)) / (0.018 * SR))
    if body > 0:
        t = tt(sec)
        s += np.sin(2 * np.pi * (110 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.025) * body
    return s * vel


def thunk(f=70, vel=1.0):
    t = tt(0.35)
    s = np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.09)
    s += lp(noise(0.35), 900) * np.exp(-t / 0.03) * 0.8
    return np.tanh(1.5 * s) * vel


def whoosh(sec, f0, f1, q=1.2, shape='swell'):
    n = noise(sec)
    s = sweep_filter(n, f0, f1, 'band', q)
    u = np.linspace(0, 1, len(s))
    if shape == 'swell':
        e = np.sin(np.pi * u) ** 1.5
    elif shape == 'in':
        e = u ** 2.5
    else:
        e = (1 - u) ** 2
    return s * e


def crash(sec=2.0):
    t = tt(sec)
    s = hp(noise(sec), 4000) * np.exp(-t / 0.55)
    m = np.zeros_like(t)
    for f in (3120, 4470, 5310, 6880, 8150):
        m += np.sin(2 * np.pi * f * t + rs.uniform(0, 6))
    return (s + m * 0.05 * np.exp(-t / 0.4)) * 0.5


def fm_bell(f, sec=1.6, ratio=3.5, index=3.2, vel=1.0, decay=0.45):
    t = tt(sec)
    idx = index * np.exp(-t / 0.18)
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t))
    a = np.minimum(1, t / 0.002) * np.exp(-t / decay)
    return s * a * vel


def pluck(f, sec=0.35, vel=1.0, bright=4000):
    t = tt(sec)
    s = saw(f, sec) * 0.6 + np.sign(np.sin(2 * np.pi * f * t)) * 0.25
    s = lp(s, bright)
    return s * np.minimum(1, t / 0.003) * np.exp(-t / 0.09) * vel


def bass_note(f, sec, vel=1.0, cutoff=900):
    t = tt(sec)
    s = saw(f, sec) * 0.55 + saw(f, sec, 0.004) * 0.45
    s = sweep_filter(s, cutoff * 2.2, cutoff * 0.5, 'low', block=512)
    s += np.sin(2 * np.pi * f / 2 * t) * 0.7
    a = np.minimum(1, t / 0.004) * np.exp(-t / (sec * 0.9))
    a[-int(0.008 * SR):] *= np.linspace(1, 0, int(0.008 * SR))
    return np.tanh(1.4 * s * a) * vel


def pad(freqs, sec, cutoff=1800, attack=0.4):
    t = tt(sec)
    l = np.zeros_like(t)
    r = np.zeros_like(t)
    for f in freqs:
        for d, p in ((-0.006, -0.7), (0.0, 0.0), (0.0065, 0.7)):
            v = saw(f, sec, d)
            l += v * (1 - p) / 2
            r += v * (1 + p) / 2
    l, r = lp(l, cutoff), lp(r, cutoff)
    a = np.minimum(1, t / attack) * np.minimum(1, (sec - t) / 0.6).clip(0, 1)
    return np.stack([l * a, r * a]) / (len(freqs) * 1.6)


def riser(sec, f0=200, f1=2400):
    t = tt(sec)
    f = f0 * (f1 / f0) ** (t / sec)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    nz = sweep_filter(noise(sec), 400, 9000, 'band', 1.0)
    u = t / sec
    return (tone + nz * 0.8) * u ** 2


# ---------------- kompozycja ----------------
# Tonacja d-moll → na logo D-dur (nowa perspektywa).
D2, F2, A2, C3, Bb1 = midi(38), midi(41), midi(45), midi(48), midi(34)

# --- Scena 1: werbel liter (1/32) i uderzenie „01”
for k in range(8):
    t0 = k * T['landStep']
    place('fx', t0, tick(1500 + k * 260, 10, 0.9, body=0.9), pan=(-0.5 if k % 2 else 0.5) * (0.4 + k * 0.08), rev=0.15)
    place('fx', t0, thunk(60 + k * 6, 0.55), pan=0, gain=0.8)
place('drums', 0, kick(1.0, 1.4), gain=0.95)
place('fx', 0, sub_boom(1.2, 70, 34), gain=0.5)
# kamera przelatuje między literami
place('fx', b(1.6) - 0.15, whoosh(0.85, 300, 3500, 1.1), pan=-0.3, gain=0.5, rev=0.2)
place('fx', T['detach'], tick(3600, 25, 0.9), pan=0.2, rev=0.2)
place('fx', T['detach'] + 0.04, tick(2400, 20, 0.6), pan=0.1)
# napęd haka: puls basu 1/16 z otwierającym się filtrem + tykające hi-haty (bity 0,5–3)
for k in range(2, 12):
    t0 = k * B / 4
    u = k / 12
    place('bass', t0, bass_note(D2 / 2 if k % 4 else D2, B / 4 * 0.85, 0.35 + 0.4 * u, 250 + 1400 * u ** 2), gain=0.55)
    place('drums', t0, hat(False, 0.25 + 0.55 * u), pan=0.3 if k % 2 else -0.3)
    if k % 2 == 0:
        place('fx', t0, tick(3400 + k * 90, 40, 0.18 + 0.2 * u), pan=-0.5 if k % 4 else 0.5)
place('drums', b(1), kick(0.7))
place('drums', b(2), kick(0.8))
place('fx', b(1.2), riser(b(1.8), 220, 3200), gain=0.32)
place('fx', T['impact01'] - 0.33, whoosh(0.33, 800, 6000, 1.5, 'in'), gain=0.55)
place('drums', T['impact01'], kick(1.2, 1.6))
place('fx', T['impact01'], sub_boom(1.6, 80, 33), gain=0.75)
place('fx', T['impact01'], crash(1.4), gain=0.35, rev=0.4)
place('fx', T['impact01'], tick(1900, 8, 1.0, body=1.0), rev=0.3)
place('fx', T['impact01'] + 0.05, riser(b(1) - 0.05, 300, 1800), gain=0.22)

# --- Groove: bity 4–18 (sceny 2–3), półtakt w scenie 4, powrót w budowaniu sceny 5
def groove_beat(n, density=1.0, clapon=True):
    t0 = b(n)
    place('drums', t0, kick(0.95))
    duckEnv_add(t0)
    for s in range(4):
        if density < 1 and s % 2:
            continue
        acc = [1.0, 0.45, 0.75, 0.5][s]
        place('drums', t0 + s * B / 4, hat(s == 2, acc * 0.8 * density), pan=0.25 if s % 2 else -0.15)
    if clapon and n % 2 == 1:
        place('drums', t0, clap(), gain=0.55, rev=0.25)


def duckEnv_add(t0):
    for k in range(3):
        i0 = int((t0 + k * DUR) * SR)
        n = int(0.32 * SR)
        if i0 + n < L:
            duckEnv[i0:i0 + n] = np.maximum(duckEnv[i0:i0 + n], np.exp(-np.arange(n) / (0.11 * SR)))


for n in range(4, 18):
    groove_beat(n, 1.0 if n >= 8 else 0.7, clapon=n >= 6)

# bas: 1/16 w d-moll, akcenty zgodne z zawiasami i zagięciami
BASS_SEQ = [D2, 0, D2, D2 * 2, 0, D2, F2, 0, D2, 0, D2, A2, 0, D2, C3, D2]
for n in range(4, 18):
    root = D2 if (n // 2) % 4 != 3 else Bb1
    for s in range(4):
        f = BASS_SEQ[((n - 4) * 4 + s) % 16]
        if f == 0:
            continue
        f = f * (root / D2)
        place('bass', b(n) + s * B / 4, bass_note(f, B / 4 * 0.92, 0.55 if s else 0.75, 600 + 500 * ((n - 4) / 14)), gain=0.6)

# zawiasy harmonijki (1/8), zagięcia pudełka, wieczka
for j in range(6):
    place('fx', T['hinge0'] + j * T['hingeStep'], tick(2200 + j * 300, 22, 0.8, body=0.5), pan=-0.4 + j * 0.16, rev=0.2)
for r in range(3):
    t0 = T['fold0'] + r * T['foldStep']
    place('fx', t0 - 0.16, whoosh(0.2, 600, 3000, 1.3, 'in'), pan=0.4 - r * 0.4, gain=0.45)
    place('fx', t0 + 0.06, thunk(78 - r * 6, 0.85), pan=0.3 - r * 0.3, rev=0.15)
    for j in range(7):
        place('fx', t0 + 0.02 + j * 1.1 * FR, tick(3200 + j * 120, 30, 0.25), pan=-0.3 + j * 0.1)
for t0, pan in ((T['cap29'], -0.3), (T['cap30'], 0.35)):
    place('fx', t0 - 0.3, whoosh(0.3, 500, 5000, 1.4, 'in'), pan=pan, gain=0.5)
    place('fx', t0, thunk(55, 1.0), pan=pan * 0.5, rev=0.25)
    place('fx', t0, tick(1700, 12, 0.9, body=0.6), pan=pan, rev=0.25)
# wybuch miesiąca
place('fx', T['explode'], crash(2.2), gain=0.5, rev=0.5)
place('fx', T['explode'], sub_boom(1.4, 70, 35), gain=0.55)
place('fx', T['explode'], whoosh(1.1, 5000, 300, 0.9, 'out'), gain=0.6, rev=0.3)
for k in range(16):  # werbel budujący do sceny 3
    tk = T['explode'] + b(1) + k * B / 8
    place('drums', tk, clap() * (0.25 + 0.6 * k / 16), pan=(k % 2 - 0.5) * 0.3, rev=0.15)

# --- Scena 3: motyw — dzwonki FM (d-moll 7), przelot
ARP = [midi(62), midi(65), midi(69), midi(72), midi(74), midi(72), midi(69), midi(65)]
for n in range(12, 18):
    for s in range(2):
        f = ARP[((n - 12) * 2 + s) % 8]
        place('keys', b(n) + s * B / 2, fm_bell(f, 1.1, 3.5, 2.6, 0.32), pan=(-0.35 if s else 0.35), rev=0.35)
        place('keys', b(n) + s * B / 2 + B / 4, pluck(f / 2, 0.25, 0.22, 2600), pan=0.0, rev=0.1)
for k, n in enumerate(np.arange(12.4, 17.6, 0.85)):  # płyty mijają kamerę
    place('fx', b(n), whoosh(0.32, 900, 4200, 1.6), pan=(-0.7 if k % 2 else 0.7), gain=0.28, rev=0.15)

# --- Odjazd (b18) → cisza, zamek z 30 kliknięć, odsłonięcie (b20)
pb = T['pullback']
place('fx', pb - 0.6, crash(1.0)[::-1] * 0.8, gain=0.6)                     # odwrócony talerz
place('fx', pb, whoosh(0.9, 6000, 200, 0.9, 'out'), gain=0.55, rev=0.4)
# „tape stop”: opadający ton basu
t_ = tt(0.5)
fstop = D2 * 2 * np.exp(-t_ / 0.18)
place('bass', pb, np.tanh(2 * np.sin(2 * np.pi * np.cumsum(fstop) / SR)) * np.exp(-t_ / 0.25) * 0.5)
for i, tl_ in enumerate(LOCKS):
    place('fx', tl_, tick(2600 + i * 70, 35, 0.22 + 0.5 * i / 29), pan=((i * 7) % 11 / 5.5 - 1) * 0.6)
place('fx', T['lock'] - 0.35, riser(0.35, 900, 5000), gain=0.25)
lock = T['lock']
place('drums', lock, kick(1.1, 1.8))
place('fx', lock, sub_boom(3.0, 58, 29), gain=0.9)
for f, g in ((midi(50), 0.5), (midi(57), 0.38), (midi(62), 0.34), (midi(65), 0.28), (midi(69), 0.24), (midi(76), 0.18)):
    place('keys', lock, fm_bell(f, 3.4, 2.0, 1.6, g, 1.3), pan=rs.uniform(-0.5, 0.5), rev=0.6)
place('pad', lock + 0.05, pad([midi(50), midi(57), midi(62), midi(65), midi(69)], b(8.2), 1400, 0.8), gain=0.32, rev=0.5)

# --- Scena 4: puls wraca łagodnie; dzień 30 wylatuje; karta
for n in range(21, 28):
    t0 = b(n)
    if n % 2 == 1:
        place('drums', t0, kick(0.6))
        duckEnv_add(t0)
    place('drums', t0 + B / 2, hat(False, 0.45), pan=0.3)
    place('bass', t0, bass_note(D2 if n < 25 else Bb1, B * 0.9, 0.35, 380), gain=0.55)
place('fx', T['lift30'], whoosh(b(2), 400, 3800, 1.0, 'swell'), pan=0.4, gain=0.45, rev=0.3)
place('fx', T['card'] - 0.12, whoosh(0.12, 2000, 8000, 2.0, 'in'), gain=0.3)
place('fx', T['card'], tick(1400, 6, 0.6, body=0.4), rev=0.2)
t_ = tt(0.08)
place('fx', T['card'] + 0.02, np.sin(2 * np.pi * np.cumsum(1300 + 700 * t_ / 0.08) / SR) * np.exp(-t_ / 0.03) * 0.25, rev=0.3)
for k in range(2):  # paski rosną
    t0 = T['card'] + (18 + k * 4) * FR
    place('keys', t0, fm_bell(midi(74 + k * 5), 0.8, 2.0, 1.0, 0.13), pan=0.3 * (k * 2 - 1), rev=0.4)
for n in range(25, 28):
    for s in range(2):
        f = ARP[(n * 2 + s) % 8]
        place('keys', b(n) + s * B / 2, fm_bell(f, 0.9, 3.5, 1.8, 0.16), pan=(-0.3 if s else 0.3), rev=0.4)

# --- Scena 5: budowanie do logo
for n in range(28, 31):
    groove_beat(n, 0.8, clapon=True)
for k in range(24):
    tk = T['morph'] + k * (T['logo'] - T['morph']) / 24
    place('drums', tk, clap() * (0.12 + 0.5 * (k / 24) ** 2), pan=(k % 2 - 0.5) * 0.4)
place('fx', T['morph'], whoosh(0.7, 300, 5000, 1.2), pan=-0.4, gain=0.4, rev=0.3)
place('fx', T['morph'] + 0.5, whoosh(0.6, 5000, 700, 1.4), pan=0.4, gain=0.35, rev=0.3)
place('fx', T['logo'] - b(2.5), riser(b(2.5), 250, 3000), gain=0.3)
logo = T['logo']
place('drums', logo, kick(1.25, 2.0))
place('fx', logo, sub_boom(2.8, 70, 36), gain=0.85)
place('fx', logo, crash(2.6), gain=0.45, rev=0.6)
# rozwiązanie: D-dur (nowa perspektywa)
for f, g in ((midi(50), 0.5), (midi(57), 0.4), (midi(62), 0.36), (midi(66), 0.3), (midi(69), 0.26), (midi(76), 0.2), (midi(78), 0.14)):
    place('keys', logo, fm_bell(f, 3.0, 2.0, 1.5, g, 1.2), pan=rs.uniform(-0.6, 0.6), rev=0.6)
place('pad', logo, pad([midi(50), midi(57), midi(62), midi(66), midi(69), midi(73)], b(4.2), 2200, 0.05), gain=0.34, rev=0.5)
place('bass', logo, bass_note(D2, b(3.2), 0.6, 300), gain=0.6)
# zegar czasu pod plakatem
for k in range(10):
    place('fx', logo + b(0.5) + k * B / 2, tick(3000 if k % 2 else 2300, 30, 0.3), pan=(0.25 if k % 2 else -0.25), rev=0.2)

# --- Pętla: kafel odjeżdża w kropkę „?” → litery spadają na „raz”
place('fx', T['loop'] - 0.05, whoosh(DUR - T['loop'] + 0.06, 250, 6500, 1.0, 'in'), gain=0.6, rev=0.2)
place('fx', T['loop'], riser(DUR - T['loop'], 180, 2400), gain=0.25)
place('fx', DUR - 0.3, crash(0.3)[::-1], gain=0.4)

# ---------------- miks ----------------
def sidechain(x, depth=0.7):
    return x * (1 - depth * duckEnv)


outL = np.zeros(L)
outR = np.zeros(L)
gains = dict(drums=0.9, bass=0.75, keys=0.6, pad=0.55, fx=0.75)
for name, (l, r) in bus.items():
    g = gains.get(name, 0.7)
    if name in ('bass', 'pad', 'keys'):
        l, r = sidechain(l, 0.75 if name == 'bass' else 0.45), sidechain(r, 0.75 if name == 'bass' else 0.45)
    if name == 'bass':
        l, r = hp(l, 28), hp(r, 28)
    outL += l * g
    outR += r * g

# pogłos: splot z syntetyczną odpowiedzią (2,4 s, stereo, ciemniejąca)
irn = int(2.4 * SR)
ti = np.arange(irn) / SR
irL = rs.normal(0, 1, irn) * np.exp(-ti / 0.55)
irR = rs.normal(0, 1, irn) * np.exp(-ti / 0.55)
irL, irR = lp(irL, 5200), lp(irR, 5200)
irL[:int(0.012 * SR)] = 0
irR[:int(0.017 * SR)] = 0
irL /= np.sqrt(np.sum(irL ** 2))
irR /= np.sqrt(np.sum(irR ** 2))
wetL = signal.fftconvolve(hp(revL, 250), irL)[:L]
wetR = signal.fftconvolve(hp(revR, 250), irR)[:L]
outL += wetL * 0.55
outR += wetR * 0.55

# przetwarzanie całości (3 przebiegi), potem cięcie środkowego — szew pętli bez skoków
y = np.stack([outL, outR])
y = hp(y, 22)
y = np.tanh(y * 1.1) / np.tanh(1.1)
mid = slice(N, 2 * N)
y = y / np.max(np.abs(y[:, mid])) * 10 ** (-1.0 / 20)
env = signal.convolve(np.max(np.abs(y), axis=0), np.ones(int(0.004 * SR)) / int(0.004 * SR), mode='same')
thr = 0.6
g = np.where(env > thr, thr / np.maximum(env, 1e-9), 1.0)
hw = np.hanning(int(0.01 * SR)); hw /= hw.sum()
g = np.minimum(1.0, signal.convolve(g, hw, mode='same'))
yf = y * g
print('ciągłość pętli (cykl 3 vs cykl 2, pierwsze 0,5 s): max różnica', float(np.max(np.abs(yf[:, 2 * N:2 * N + SR // 2] - yf[:, N:N + SR // 2])).round(6)))
y = yf[:, mid]
y = y / np.max(np.abs(y)) * 10 ** (-1.0 / 20)

out = (y.T * 32767).astype('<i2')
import wave
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
rms = np.sqrt(np.mean(y ** 2))
print(f'zapisano {sys.argv[1]}: {N / SR:.2f} s, RMS {20 * np.log10(rms):.1f} dBFS, szczyt {20 * np.log10(np.max(np.abs(y))):.1f} dBFS')
