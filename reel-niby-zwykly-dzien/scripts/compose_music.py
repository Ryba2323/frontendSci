#!/usr/bin/env python3
"""
Muzyka do reelsa „Niby zwykły dzień.” — w całości syntezowana tutaj (własny utwór, bez cudzych sampli).

Ciepły indie-electronic / chill groove: 120 BPM (takt = 2 s, ćwierćnuta = 30 klatek przy 60 fps),
D-dur, elektryczne pianino (FM), okrągły bas, miękka perkusja, kalimba na melodię.

Synchronizacja z obrazem (sekundy):
  0–4    intro: same akordy, przyciemnione; 3.0 s — dzwoneczek, gdy pod „Nic” odsłania się „coś”
  4.0    wchodzi rytm i bas (pierwsza chwila)
  5.5 / 7.0 / 8.5   nuty kalimby, gdy kamera dojeżdża do kolejnej kartki i ta opada na stół
  10.0   rozwinięcie: „Może jednak coś się działo.” (szerszy akord, dzwonki)
  15.0   przejście do ekranu aplikacji
  16.5–17.25  ciche „kliknięcia” przy zaznaczaniu „Dobrze”
  18.0   finał: perkusja milknie, akord; 18.2 dzwonek, gdy otwierają się skrzydła; wybrzmienie do 20 s

Użycie:  python3 scripts/compose_music.py  →  public/audio/niby-zwykly-dzien.wav
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 20.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM            # 0.5 s
STEP = BEAT / 4            # szesnastka
BAR = BEAT * 4             # 2 s
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def nm(name):
    """'F#4' → numer MIDI."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[pitch]


def stereo():
    return np.zeros((N, 2))


def place(buf, x, t, gain=1.0, pan=0.0):
    """Wstawia mono/stereo x do bufora od czasu t (s) z panoramą -1..1."""
    i = int(round(t * SR))
    if i >= N:
        return
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], axis=1) * np.sqrt(2)
    j = min(N, i + len(x))
    buf[i:j] += x[:j - i] * gain


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=0)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=0)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=0)


# ------------------------------------------------------------------
#  Instrumenty
# ------------------------------------------------------------------
def rhodes(freq, dur, vel=1.0):
    """Elektryczne pianino FM: łagodny „dzwon” + krótki metaliczny atak młoteczka."""
    tail = 2.5
    t = np.arange(int((dur + tail) * SR)) / SR
    env = np.exp(-t / (1.6 + 220 / freq))                      # niższe nuty brzmią dłużej
    release = np.clip((dur + tail - t) / tail, 0, 1) ** 2
    env *= np.minimum(1, t / 0.004) * np.where(t < dur, 1, release)
    idx = 1.5 * np.exp(-t / 0.35) * vel + 0.45                 # jasność opada w czasie
    mod = np.sin(2 * np.pi * freq * t) * idx
    tine = np.sin(2 * np.pi * freq * 14.0 * t) * np.exp(-t / 0.03) * 0.5 * vel
    car = np.sin(2 * np.pi * freq * t + mod + tine)
    body = 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.6)
    return (car + body) * env * vel


def kalimba(freq, vel=1.0):
    t = np.arange(int(1.6 * SR)) / SR
    env = np.exp(-t / 0.42) * np.minimum(1, t / 0.002)
    x = np.sin(2 * np.pi * freq * t) + 0.28 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t / 0.05)
    x += 0.12 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t / 0.2)
    return x * env * vel


def bell(freq, vel=1.0, length=3.0):
    t = np.arange(int(length * SR)) / SR
    partials = [(1, 1.0, 1.6), (2.76, .35, .7), (5.4, .16, .35), (8.93, .07, .18)]
    x = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / d) for r, a, d in partials)
    return x * np.minimum(1, t / 0.003) * vel


def bass(freq, dur, vel=1.0):
    t = np.arange(int((dur + 0.12) * SR)) / SR
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.9)
    env *= np.clip((dur + 0.12 - t) / 0.12, 0, 1)
    x = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * freq * 2 * t) + 0.06 * np.sin(2 * np.pi * freq * 3 * t)
    return np.tanh(x * 1.3 * env) * vel


def kick(vel=1.0):
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 70 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.16)
    click = lowpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.15
    return np.tanh((x + click) * 1.6) * vel


def rim(vel=1.0):
    """Miękki „snap”: krótki ton drewna + szum — zamiast ostrego werbla."""
    t = np.arange(int(0.25 * SR)) / SR
    tone = np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.018) * 0.6
    noise = bandpass(rng.standard_normal(len(t)), 1200, 6000) * np.exp(-t / 0.045)
    return (tone + noise * 0.9) * vel


def shaker(vel=1.0):
    t = np.arange(int(0.12 * SR)) / SR
    env = np.minimum(1, t / 0.008) * np.exp(-t / 0.03)
    return highpass(rng.standard_normal(len(t)), 6500) * env * vel


def swoosh(length, vel=1.0, lo=300, hi=3000, rise=True):
    """Szelest papieru / powietrza: filtrowany szum z łagodną obwiednią."""
    n = int(length * SR)
    t = np.arange(n) / SR
    x = bandpass(rng.standard_normal(n), lo, hi)
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    if rise:
        env *= (t / length) ** 0.7
    return x * env * vel


def paper_tap(vel=1.0):
    t = np.arange(int(0.18 * SR)) / SR
    x = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.02)
    x += np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.03) * 0.5
    return x * vel


def tick(vel=1.0):
    t = np.arange(int(0.05 * SR)) / SR
    x = np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.006) + bandpass(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.004) * 0.4
    return x * vel


# ------------------------------------------------------------------
#  Harmonia (takty po 2 s)
# ------------------------------------------------------------------
CHORDS = {
    'Gmaj9': ('G2', ['B3', 'D4', 'F#4', 'A4']),
    'A9sus': ('A2', ['G3', 'B3', 'D4', 'E4']),
    'Dmaj9': ('D2', ['F#3', 'A3', 'C#4', 'E4']),
    'Bm9': ('B1', ['A3', 'C#4', 'D4', 'F#4']),
    'F#m7': ('F#2', ['A3', 'C#4', 'E4', 'F#4']),
    'Em9': ('E2', ['G3', 'B3', 'D4', 'F#4']),
    'Dmaj9wide': ('D2', ['A3', 'C#4', 'E4', 'F#4', 'A4']),
}
# (początek w taktach, długość w taktach, akord)
PROG = [
    (0, 1, 'Gmaj9'), (1, 1, 'A9sus'),
    (2, 1, 'Dmaj9'), (3, 1, 'Bm9'), (4, .5, 'Gmaj9'), (4.5, .5, 'A9sus'),
    (5, 1, 'Dmaj9wide'), (6, 1, 'F#m7'), (7, 1, 'Em9'), (8, 1, 'A9sus'),
    (9, 1, 'Dmaj9wide'),
]

keys, bass_bus, drums, lead, fx = stereo(), stereo(), stereo(), stereo(), stereo()

for start, length, name in PROG:
    root, voicing = CHORDS[name]
    t0 = start * BAR
    intro = start < 2
    final = start >= 9
    dur = length * BAR - 0.05 if not final else 2.0
    vel = 0.8 if intro else (0.62 if not final else 0.7)
    # akord lekko „rozsypany” (strum), jak przy graniu ręką
    for k, n in enumerate(voicing):
        place(keys, rhodes(midi(nm(n)), dur, vel), t0 + k * 0.012, 0.27, pan=-0.35 + 0.7 * k / max(1, len(voicing) - 1))
    # w groove'ie drugie, cichsze uderzenie akordu na „i” trzeciej miary — daje kołysanie
    if not intro and not final and length == 1:
        for k, n in enumerate(voicing[1:]):
            place(keys, rhodes(midi(nm(n)), 0.4, 0.33), t0 + 2.5 * BEAT + k * 0.01, 0.16, pan=0.2 - 0.2 * k)
    # bas: od 1.5 s (pod „Nic szczególnego.”) długie nuty, od 4 s synkopowany
    rf = midi(nm(root))
    if start == 1:
        place(bass_bus, bass(rf, 1.0, 0.55), t0, 0.32)
    elif final:
        place(bass_bus, bass(rf, 1.9, 0.75), t0, 0.32)
    elif not intro:
        pattern = [(0, 1.2), (6, 0.35), (10, 0.7)] if length == 1 else [(0, 0.85)]
        for step, d in pattern:
            f = rf * (2 if step == 6 else 1)              # oktawowy „podskok” w środku taktu
            place(bass_bus, bass(f, d, 0.8 if step == 0 else 0.55), t0 + step * STEP, 0.32)

# ------------------------------------------------------------------
#  Perkusja: 4 s → 18 s, miękka, z lekkim swingiem
# ------------------------------------------------------------------
SWING = 0.18 * STEP
kick_times = []
for bar in range(2, 9):
    t0 = bar * BAR
    for step in range(16):
        t = t0 + step * STEP + (SWING if step % 2 else 0)
        last_beat_of_lift = bar == 4 and step >= 12          # oddech przed rozwinięciem w 10 s
        if step in (0, 10) and not last_beat_of_lift:
            place(drums, kick(0.9 if step == 0 else 0.7), t, 0.42)
            kick_times.append(t)
        if step == 7 and bar in (3, 6, 8):
            place(drums, kick(0.45), t, 0.4)
            kick_times.append(t)
        if step in (4, 12) and not last_beat_of_lift:
            place(drums, rim(0.8), t, 0.3, pan=0.1)
        if step == 15 and bar in (3, 7):
            place(drums, rim(0.3), t, 0.16, pan=-0.2)
        if not last_beat_of_lift or step % 4 == 0:
            accent = 1.0 if step % 4 == 2 else (0.55 if step % 2 == 0 else 0.35)
            place(drums, shaker(accent), t, 0.17, pan=0.35)
place(drums, kick(0.9), 5 * BAR, 0.45)   # mocne „raz” w 10 s
kick_times.append(5 * BAR)

# ------------------------------------------------------------------
#  Melodia i akcenty pod obraz
# ------------------------------------------------------------------
# kalimba: krótkie frazy, nuty na lądowanie kartek (5.5 / 7.0 / 8.5 s)
MELODY = [
    (4.0, 'F#5', .8), (4.75, 'E5', .5), (5.0, 'D5', .6),
    (5.5, 'A5', .9), (5.75, 'F#5', .5), (6.25, 'E5', .45),
    (7.0, 'D5', .85), (7.25, 'E5', .5), (7.5, 'F#5', .55), (8.0, 'B4', .45),
    (8.5, 'E5', .9), (8.75, 'F#5', .55), (9.0, 'A5', .6), (9.5, 'B5', .5), (9.75, 'A5', .4),
    (10.0, 'F#5', .9), (10.5, 'A5', .55), (11.0, 'D6', .6), (11.75, 'C#6', .4), (12.0, 'A5', .5),
    (13.0, 'F#5', .5), (13.5, 'E5', .45), (14.0, 'D5', .55), (14.5, 'E5', .4),
    (15.0, 'A5', .7), (15.5, 'F#5', .45), (16.0, 'E5', .5),
]
for t, n, v in MELODY:
    place(lead, kalimba(midi(nm(n)), v), t, 0.26, pan=0.25 if nm(n) > 76 else -0.15)

# dzwoneczki: „coś” w 3.0 s, rozwinięcie w 10 s, finał pod logo w 18 s
for t, notes, g in [(3.0, ['D6', 'A6'], .16), (10.0, ['A5', 'D6', 'F#6'], .13), (18.22, ['D6', 'A6', 'F#6'], .15)]:
    for k, n in enumerate(notes):
        place(lead, bell(midi(nm(n)), 0.8), t + k * 0.06, g, pan=-0.3 + 0.3 * k)

# efekty: cicho, tylko tam, gdzie obraz coś robi
place(fx, swoosh(0.9, 1.0, 400, 2600), 3.25, 0.05)               # szczelina w „Nic” rozwiera się w kartkę
for t in (5.18, 6.68, 8.18):                                         # kartki wsuwają się na stos
    place(fx, swoosh(0.35, 1.0, 500, 4000), t, 0.05, pan=0.2)
    place(fx, paper_tap(0.9), t + 0.32, 0.12)
place(fx, swoosh(1.6, 1.0, 250, 2200), 8.4, 0.07)                   # narastanie przed rozwinięciem
place(fx, swoosh(1.2, 1.0, 300, 3000, rise=False), 10.0, 0.04)     # kartki rozkładają się na stronę
place(fx, swoosh(0.8, 1.0, 400, 3200), 14.6, 0.04)                 # strona układa się w ekran aplikacji
for t in (16.5, 16.75, 17.0, 17.25):                                # „Dobrze”, „Dobrze”…
    place(fx, tick(0.8), t, 0.07, pan=0.15)
place(fx, swoosh(0.7, 1.0, 600, 5000), 17.6, 0.045)                # ekran składa się w oś motyla
place(fx, swoosh(0.9, 1.0, 300, 2500, rise=False), 18.2, 0.04)     # skrzydła się otwierają

# ------------------------------------------------------------------
#  Miks
# ------------------------------------------------------------------
# łagodny sidechain od stopy (oddech groove'u), tylko na klawiszach i basie
duck = np.ones(N)
t_env = np.arange(int(0.32 * SR)) / SR
shape = 1 - 0.28 * np.exp(-t_env / 0.09)
for t in kick_times:
    i = int(t * SR)
    j = min(N, i + len(shape))
    duck[i:j] = np.minimum(duck[i:j], shape[:j - i])
keys *= duck[:, None]
bass_bus *= (0.6 + 0.4 * duck)[:, None]
bass_bus = lowpass(bass_bus, 420)   # bas okrągły, bez „brzęczenia”

# intro przyciemnione filtrem, który otwiera się do 4 s
t_all = np.arange(N) / SR
intro_mix = np.clip(t_all / 4.0, 0, 1)
keys_dark = lowpass(keys, 1700)
keys = keys_dark * (1 - intro_mix[:, None]) + keys * intro_mix[:, None]
# na ekranie aplikacji (16–18 s) perkusja nieco ciszej i ciemniej — więcej powietrza
drum_dim = 1 - 0.3 * np.clip((t_all - 16) / 0.5, 0, 1) * np.clip((18.2 - t_all) / 0.2, 0, 1)
drums *= drum_dim[:, None]
drums = highpass(drums, 35)


def reverb_ir(seconds=2.4, predelay=0.025):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 6.9))[:, None]
    ir = lowpass(ir, 5200)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2, axis=0))


IR = reverb_ir()
send = keys * 0.35 + lead * 0.7 + drums * 0.08 + fx * 0.5
wet = np.stack([signal.fftconvolve(send[:, c], IR[:, c])[:N] for c in range(2)], axis=1)

mix = keys + bass_bus + drums * 0.9 + lead + fx + wet * 0.55

# delikatny szum taśmy — „faktura”, ledwo słyszalny
tape = lowpass(rng.standard_normal((N, 2)), 3500) * 0.0025
mix += tape

mix = highpass(mix, 28)
# odrobina „powietrza” na górze (równoległy high-shelf), żeby miks nie był zamglony
mix += highpass(mix, 2500) * 0.6
# wyciszenie na końcu: utwór kończy się razem z obrazem
fade = np.clip((DUR - t_all) / 1.4, 0, 1) ** 1.5
fade_in = np.clip(t_all / 0.08, 0, 1)
mix *= (fade * fade_in)[:, None]

# miękkie nasycenie + normalizacja
mix = np.tanh(mix * 1.4) / 1.4
rms = np.sqrt(np.mean(mix[int(4 * SR):int(18 * SR)] ** 2))
mix *= 0.17 / rms               # ok. −14 LUFS (głośność typowa dla Instagrama)
peak = np.max(np.abs(mix))
if peak > 0.89:
    mix *= 0.89 / peak

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'niby-zwykly-dzien.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('zapisano', os.path.abspath(out), 'peak', round(float(np.max(np.abs(mix))), 3), 'rms', round(float(np.sqrt(np.mean(mix ** 2))), 4))
