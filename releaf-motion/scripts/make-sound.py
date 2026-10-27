"""Dźwięk do pętli ReLeaf — syntetyzowany od zera, bez sampli.

Wszystko liczymy na buforze kołowym o długości dokładnie jednej pętli (11 s),
więc ogony pogłosu i nut z końca zawijają się na początek: pętla nie ma szwu.

Tempo 87,27 BPM: 16 ćwierćnut = 11 s, 4 takty po 2,75 s.
  takt 1–2  rozsypane paseczki: ciepła plama + rzadkie arpeggio
  takt 3    SNAP (5,5 s, klatka 330): logo się składa → miękkie „tok”, niski oddech, dzwonek
            lądowanie paseczków: drobny deszcz kropli (jak podlewanie roślinki w aplikacji)
  takt 4    logo się unosi i rozplata: powietrze w górę, kilka wznoszących nut

Uruchom: python3 scripts/make-sound.py scripts/motion.json public/releaf-sound.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
motion = json.load(open(sys.argv[1]))
FPS = motion["fps"]
LOOP_S = motion["duration"] / FPS
N = int(round(LOOP_S * SR))
BEAT = LOOP_S / 16
BAR = BEAT * 4
rng = np.random.default_rng(23)


def sec(frame):
    return frame / FPS


def add(buf, start_s, sig, gain=1.0):
    """Dodaje sygnał do bufora kołowego (ogony zawijają się na początek)."""
    i0 = int(round(start_s * SR)) % N
    n = len(sig)
    idx = (i0 + np.arange(n)) % N
    np.add.at(buf, idx, sig * gain)


def stereo(sig, pan):
    """Panorama o stałej mocy: pan -1 (lewo) … 1 (prawo)."""
    a = (pan + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)])


def spectral(sig, shape):
    """Filtr kołowy w dziedzinie częstotliwości; shape(freq_hz) → wzmocnienie."""
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    return np.fft.irfft(spec * shape(f), len(sig))


def lowpass(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def highpass(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def env_ad(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return np.sin(a * np.pi / 2) ** 2 * np.exp(-t / decay)


def pluck(freq, dur=1.6, decay=0.45, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t)
    s += 0.32 * bright * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (decay * 0.5))
    s += 0.10 * bright * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t / (decay * 0.3))
    s += 0.05 * bright * np.sin(2 * np.pi * freq * 4.2 * t) * np.exp(-t / (decay * 0.15))  # szklany alikwot
    return s * env_ad(n, 0.004, decay)


def bell(freq, dur=4.0, decay=1.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [(1, 1.0, 1.0), (2.0, 0.28, 0.6), (2.76, 0.16, 0.45), (5.40, 0.06, 0.2), (8.93, 0.025, 0.1)]
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (decay * d)) for r, a, d in parts)
    return s * env_ad(n, 0.003, 50)


def swept_noise(length_s, fc_curve, bw_oct, amp_curve, hop=256, win=2048):
    """Szum przepuszczony przez pasmo, którego środek i głośność zmieniają się w czasie (STFT)."""
    n = int(length_s * SR)
    noise = rng.standard_normal(n + win)
    out = np.zeros(n + win)
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    for start in range(0, n, hop):
        u = start / max(n - 1, 1)
        fc = fc_curve(u)
        band = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / bw_oct) ** 2)
        seg = np.fft.irfft(np.fft.rfft(noise[start:start + win] * w) * band, win)
        out[start:start + win] += seg * w * amp_curve(u)
    return out[:n] / (win / hop / 2)


# ------------------------------------------------------------------
# Harmonia
# ------------------------------------------------------------------
def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


CHORDS = [
    # (bas, akord) — G maj9, E m9, D maj9 (rozwiązanie na SNAP), A sus2 (wraca do G)
    (43, [55, 59, 62, 66, 69]),
    (40, [52, 55, 59, 62, 66]),
    (38, [50, 57, 61, 64, 66]),
    (45, [52, 57, 59, 62, 64]),
]

pad_bus = np.zeros((2, N))
pluck_bus = np.zeros((2, N))
fx_bus = np.zeros((2, N))
dry_bus = np.zeros((2, N))

# --- Ciepła plama (pad) -------------------------------------------------
XF = 1.1  # przenikanie akordów
for b, (bass, notes) in enumerate(CHORDS):
    start = b * BAR - XF / 2
    length = BAR + XF
    n = int(length * SR)
    t = np.arange(n) / SR
    win = np.ones(n)
    ramp = int(XF * SR)
    win[:ramp] = np.sin(np.linspace(0, np.pi / 2, ramp)) ** 2
    win[-ramp:] = np.cos(np.linspace(0, np.pi / 2, ramp)) ** 2
    for side, det in ((0, -1), (1, 1)):
        sig = np.zeros(n)
        for k, m in enumerate(notes):
            f0 = hz(m)
            for d, a in ((0.0, 1.0), (0.0014 * det, 0.6), (-0.0009 * det, 0.45)):
                ph = rng.uniform(0, 2 * np.pi)
                sig += a * np.sin(2 * np.pi * f0 * (1 + d) * t + ph)
                sig += 0.12 * a * np.sin(4 * np.pi * f0 * (1 + d) * t + ph)
            sig *= 1.0
        # powolne „oddychanie” barwy
        sig *= 0.85 + 0.15 * np.sin(2 * np.pi * t / length + side)
        bass_sig = 0.9 * np.sin(2 * np.pi * hz(bass) * t) + 0.25 * np.sin(2 * np.pi * hz(bass + 12) * t)
        add(pad_bus[side], start, (sig / len(notes) * 0.55 + bass_sig * 0.35) * win)
pad_bus = np.stack([spectral(ch, lowpass(1400, 2)) for ch in pad_bus])

# --- Rzadkie arpeggio w taktach z rozsypanymi paseczkami -----------------
PATTERN = [0, 3, 6, 10, 12]  # szesnastki w takcie, rytm 3-3-4-2
for b in (0, 1, 3):
    _, notes = CHORDS[b]
    upper = [m + 12 for m in notes[1:]]
    for k, step in enumerate(PATTERN):
        if b == 3 and step < 6:
            continue  # w 4. takcie logo dopiero się rozplata — arpeggio wchodzi później
        m = upper[(k * 2 + b) % len(upper)]
        tt = b * BAR + step * BEAT / 4
        vel = 0.75 if step == 0 else 0.5
        p = pluck(hz(m), decay=0.42) * vel
        pan = -0.35 if k % 2 else 0.35
        s = stereo(p, pan)
        add(pluck_bus[0], tt, s[0], 0.13)
        add(pluck_bus[1], tt, s[1], 0.13)

# --- Powietrze: szum podąża za prędkością kamery -------------------------
fr = motion["frames"]
rotY = np.array([f["rotY"] for f in fr])
rotX = np.array([f["rotX"] for f in fr])
speed = np.hypot(np.roll(rotY, -1) - np.roll(rotY, 1), np.roll(rotX, -1) - np.roll(rotX, 1)) / 2
speed = np.convolve(np.concatenate([speed[-15:], speed, speed[:15]]), np.hanning(31) / np.hanning(31).sum(), "valid")
sp = speed / speed.max()


def per_frame(arr):
    return lambda u: float(np.interp(u * (len(arr) - 1), np.arange(len(arr)), arr))


air = swept_noise(
    LOOP_S + 0.05,
    fc_curve=lambda u: 500 + 1600 * per_frame(sp)(u % 1),
    bw_oct=0.9,
    amp_curve=lambda u: 0.02 + 0.11 * per_frame(sp)(u % 1) ** 1.4,
)[:N]
air_r = np.roll(air, 1100)
fx_bus += np.stack([air, air_r]) * 0.8

# --- Wznoszące powietrze przed SNAP --------------------------------------
snap_s = sec(motion["snap"])
rise_len = 2.4
riser = swept_noise(
    rise_len,
    fc_curve=lambda u: 300 * (14 ** u),
    bw_oct=0.5,
    amp_curve=lambda u: (u ** 2.6) * (1 - np.clip((u - 0.985) / 0.015, 0, 1)),
)
add(fx_bus[0], snap_s - rise_len, riser, 0.20)
add(fx_bus[1], snap_s - rise_len + 0.004, riser, 0.20)

# --- SNAP: tok + niski oddech + dzwonek ----------------------------------
n = int(0.25 * SR)
t = np.arange(n) / SR
tock = (np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.010) + 0.6 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.028))
click = spectral(np.concatenate([rng.standard_normal(n) * np.exp(-t / 0.004), np.zeros(N - n)]), lowpass(5000))[:n]
for ch in (0, 1):
    add(dry_bus[ch], snap_s, tock * 0.30 + click * 0.10)

n = int(1.6 * SR)
t = np.arange(n) / SR
f_inst = hz(38) * (1 + 0.25 * np.exp(-t / 0.04))
thum = np.sin(2 * np.pi * np.cumsum(f_inst) / SR) * env_ad(n, 0.006, 0.5)
for ch in (0, 1):
    add(dry_bus[ch], snap_s, thum * 0.42)

for k, (m, delay, pan) in enumerate(((74, 0.0, -0.2), (81, 0.045, 0.25), (90, 0.09, 0.0))):
    s = stereo(bell(hz(m)), pan)
    add(pluck_bus[0], snap_s + delay, s[0], 0.075)
    add(pluck_bus[1], snap_s + delay, s[1], 0.075)

# --- Lądowanie: krople (góra → dół, coraz niżej) ---------------------------
touch = motion["touch"]
RAIN = [93, 90, 88, 86, 83, 81, 78, 76, 74, 71, 69, 66, 64, 62]  # D-dur pentatonika w dół
picks = np.linspace(0, len(touch) - 1, len(RAIN)).round().astype(int)
for k, i in enumerate(picks):
    tt = sec(touch[i]["land"]) + rng.uniform(-0.008, 0.008)
    p = pluck(hz(RAIN[k]), dur=0.9, decay=0.16, bright=0.6) * (0.9 - 0.4 * k / len(RAIN))
    s = stereo(p, np.sin(k * 2.4) * 0.5)
    add(pluck_bus[0], tt, s[0], 0.06)
    add(pluck_bus[1], tt, s[1], 0.06)
    nn = int(0.05 * SR)
    tap = spectral(np.concatenate([rng.standard_normal(nn), np.zeros(N - nn)]), lambda f: highpass(1500)(f) * lowpass(7000)(f))[:nn]
    tap *= np.exp(-np.arange(nn) / SR / 0.006)
    add(dry_bus[0], tt, tap, 0.035)
    add(dry_bus[1], tt + 0.002, tap, 0.035)

# --- Oderwanie: powietrze w górę + kilka wznoszących nut -------------------
leave = sorted(x["leave"] for x in touch)
lift_s = sec(leave[0])
lift_len = sec(leave[-1]) - lift_s + 1.0
whoosh = swept_noise(lift_len, fc_curve=lambda u: 900 * (3 ** u), bw_oct=0.7, amp_curve=lambda u: np.sin(np.pi * u) ** 2)
add(fx_bus[0], lift_s - 0.2, whoosh, 0.10)
add(fx_bus[1], lift_s - 0.17, whoosh, 0.10)
for k, m in enumerate((62, 66, 69, 74)):
    tt = lift_s + k * BEAT / 2
    s = stereo(pluck(hz(m + 12), decay=0.5, bright=0.5), (-0.3, 0.3, -0.15, 0.15)[k])
    add(pluck_bus[0], tt, s[0], 0.055)
    add(pluck_bus[1], tt, s[1], 0.055)

# ------------------------------------------------------------------
# Pogłos (splot kołowy → ogon zawija się w pętli)
# ------------------------------------------------------------------
def make_ir(seed, rt=2.6, length=3.2):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    bright = r.standard_normal(n) * np.exp(-t * 6.9 / (rt * 0.45))
    dark = spectral(np.concatenate([r.standard_normal(n), np.zeros(N - n)]), lowpass(2200))[:n] * np.exp(-t * 6.9 / rt)
    ir = 0.35 * bright + dark
    ir[: int(0.012 * SR)] = 0  # predelay
    ir /= np.sqrt(np.sum(ir ** 2))
    full = np.zeros(N)
    full[:n] = ir
    return np.fft.rfft(full)


IR = [make_ir(1), make_ir(2)]


def reverb(bus, wet):
    out = np.zeros_like(bus)
    for ch in (0, 1):
        out[ch] = np.fft.irfft(np.fft.rfft(bus[ch]) * IR[ch], N)
    return bus * (1 - wet * 0.5) + out * wet


# plama oddycha razem z obrazem: cichsza w rozsypce, pełniejsza, gdy logo leży
tl = np.arange(N) / SR
pad_gain = 0.55 + 0.45 * np.exp(-0.5 * ((tl - (snap_s + 1.2)) / 1.4) ** 2)
mix = (
    reverb(pad_bus * pad_gain, 0.35) * 0.16
    + reverb(pluck_bus, 0.55)
    + reverb(fx_bus, 0.25)
    + reverb(dry_bus, 0.18)
)
mix = np.stack([spectral(ch, highpass(32, 2)) for ch in mix])

# Mastering: miękkie nasycenie, szczyt -1 dBFS
mix /= np.max(np.abs(mix))
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))

pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
rms = np.sqrt(np.mean(mix ** 2))
print(f"zapisano {sys.argv[2]}: {N / SR:.3f} s, RMS {20 * np.log10(rms):.1f} dBFS")
