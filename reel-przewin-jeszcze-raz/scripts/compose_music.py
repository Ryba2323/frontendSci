#!/usr/bin/env python3
"""
Muzyka i efekty do „Przewiń jeszcze raz.” — w całości syntezowane tutaj (własny utwór, bez cudzych nagrań).

Ciepły indie-electronic, 100 BPM (ćwierćnuta = 0.6 s = 36 klatek), F-dur:
gitara nylonowa (Karplus-Strong), elektryczne pianino FM, okrągły bas, miękka perkusja, dzwonki.

Plan (sekundy) — zgrany z src/timeline.ts:
  0.0   groove: gitara, bas, miękka perkusja; 1.8 kubek stuka o stół, plusk
  2.4   FREEZE: taśma zwalnia i staje (tape stop), zostaje zawieszony akord
  3.3   przewijanie: odwrócone dźwięki narastają do 4.8
  4.8   „cofający się” groove: odwrócone werble wpadają w uderzenia, bas, Rhodes
  7.2   plama światła staje się oknem tramwaju (otwarcie, połysk)
  9.6   dzwonek tramwaju, tramwaj odjeżdża; spotkanie przed kawiarnią
  12.0  kamera cofa się przez okno — perkusja milknie, chwila ciszy i ciepłej harmonii
  15.0  aplikacja: groove wraca lżej; stukanie pisania; 17.5 kropla („Podlej roślinkę”)
  18.0  logo: akord rozwiązania, dzwonek, delikatny trzepot skrzydeł, wybrzmienie do 20 s

Użycie:  python3 scripts/compose_music.py  →  public/audio/przewin-jeszcze-raz.wav
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 20.0
N = int(SR * DUR)
BEAT = 0.6
STEP = BEAT / 4
BAR = BEAT * 4
rng = np.random.default_rng(11)

NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def nm(name):
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[pitch.replace('b', '')] - (1 if 'b' in pitch[1:] else 0)


def hz(name):
    return 440.0 * 2 ** ((nm(name) - 69) / 12)


def buf():
    return np.zeros((N, 2))


def place(b, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= len(b) or i + len(x) <= 0:
        return
    if x.ndim == 1:
        x = np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], axis=1) * np.sqrt(2)
    if i < 0:
        x = x[-i:]
        i = 0
    j = min(len(b), i + len(x))
    b[i:j] += x[: j - i] * gain


def lp(x, fc, order=2):
    bb, aa = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(bb, aa, x, axis=0)


def hp(x, fc, order=2):
    bb, aa = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(bb, aa, x, axis=0)


def bp(x, lo, hi, order=2):
    bb, aa = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(bb, aa, x, axis=0)


def env_t(n):
    return np.arange(n) / SR


# ------------------------------------------------------------------
#  Instrumenty
# ------------------------------------------------------------------
def guitar(freq, dur=1.6, vel=1.0, bright=0.55):
    """Struna nylonowa: Karplus-Strong (filtr grzebieniowy z uśrednianiem), miękkie szarpnięcie."""
    n = int(dur * SR)
    L = max(2, int(round(SR / freq)))
    exc = np.zeros(n)
    burst = rng.standard_normal(L)
    burst = lp(burst, 1200 + 5000 * bright)
    exc[:L] = burst * np.hanning(L)
    g = 0.996 - 0.0006 * (freq / 440)
    a = np.zeros(L + 2)
    a[0] = 1
    a[L] = -g / 2
    a[L + 1] = -g / 2
    y = signal.lfilter([1.0], a, exc)
    y = lp(y, 5200)
    t = env_t(n)
    y *= np.clip((dur - t) / 0.08, 0, 1)
    return y / (np.max(np.abs(y)) + 1e-9) * vel


def rhodes(freq, dur, vel=1.0):
    tail = 1.8
    t = env_t(int((dur + tail) * SR))
    e = np.exp(-t / (1.5 + 200 / freq)) * np.minimum(1, t / 0.004) * np.where(t < dur, 1, np.clip((dur + tail - t) / tail, 0, 1) ** 2)
    idx = 1.3 * np.exp(-t / 0.3) * vel + 0.4
    y = np.sin(2 * np.pi * freq * t + idx * np.sin(2 * np.pi * freq * t) + 0.45 * vel * np.exp(-t / 0.03) * np.sin(2 * np.pi * freq * 14 * t))
    y += 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.5)
    return y * e * vel


def pad(freqs, dur, vel=1.0, bright=900):
    t = env_t(int(dur * SR))
    y = np.zeros(len(t))
    for k_, f0 in enumerate(freqs):
        for det in (-0.12, 0.0, 0.11):
            y += np.sin(2 * np.pi * f0 * (1 + det / 100) * t + k_) + 0.25 * np.sin(4 * np.pi * f0 * (1 + det / 100) * t)
    y = lp(y, bright)
    e = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8)
    return y * np.clip(e, 0, 1) * vel / (len(freqs) * 3)


def bell(freq, vel=1.0, length=3.0):
    t = env_t(int(length * SR))
    y = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / d) for r, a, d in [(1, 1, 1.6), (2.76, 0.32, 0.6), (5.4, 0.14, 0.3), (8.93, 0.06, 0.15)])
    return y * np.minimum(1, t / 0.003) * vel


def bass(freq, dur, vel=1.0):
    t = env_t(int((dur + 0.1) * SR))
    e = np.minimum(1, t / 0.008) * np.exp(-t / 0.8) * np.clip((dur + 0.1 - t) / 0.1, 0, 1)
    y = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(4 * np.pi * freq * t) + 0.08 * np.sin(6 * np.pi * freq * t)
    # odrobina „szarpnięcia” na początku — bas grany palcami
    y += 0.25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t / 0.04)
    return np.tanh(1.2 * y * e) * vel


def kick(vel=1.0):
    t = env_t(int(0.4 * SR))
    f = 48 + 60 * np.exp(-t / 0.03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14)
    y += lp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.004) * 0.12
    return np.tanh(1.5 * y) * vel


def snare(vel=1.0, length=0.32):
    """miękki werbel szczotką: szum + krótki ton"""
    t = env_t(int(length * SR))
    noise = bp(rng.standard_normal(len(t)), 900, 7000) * np.exp(-t / 0.09)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.5
    return (noise + tone) * vel


def rim(vel=1.0):
    t = env_t(int(0.18 * SR))
    return (np.sin(2 * np.pi * 760 * t) * np.exp(-t / 0.016) * 0.6 + bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.03)) * vel


def shaker(vel=1.0):
    t = env_t(int(0.11 * SR))
    return hp(rng.standard_normal(len(t)), 6000) * np.minimum(1, t / 0.01) * np.exp(-t / 0.028) * vel


def air(length, lo=300, hi=3000, vel=1.0, shape='swell'):
    n = int(length * SR)
    t = env_t(n)
    x = bp(rng.standard_normal(n), lo, hi)
    u = t / length
    e = {'swell': u ** 2.2, 'fall': (1 - u) ** 2.2, 'hump': np.sin(np.pi * u) ** 2}[shape]
    return x * e * vel


def ceramic(vel=1.0):
    """kubek dotyka drewnianego stołu: głuche „tok” + krótki dźwięk ceramiki"""
    t = env_t(int(0.6 * SR))
    thud = np.sin(2 * np.pi * 150 * t) * np.exp(-t / 0.03) + lp(rng.standard_normal(len(t)), 700) * np.exp(-t / 0.015) * 0.6
    ring = sum(a * np.sin(2 * np.pi * f0 * t) * np.exp(-t / d) for f0, a, d in [(1870, 0.22, 0.09), (3120, 0.14, 0.06), (4630, 0.08, 0.04)])
    return (thud + ring) * vel


def plink(vel=1.0, up=True):
    """kropla: krótki ton z rosnącą wysokością"""
    t = env_t(int(0.12 * SR))
    f = (700 + 1300 * (t / 0.12) ** 0.6) if up else (2000 - 1300 * (t / 0.12) ** 0.6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * vel


def rim_hum(length, vel=1.0):
    """palec przesuwa się po brzegu kubka — cichy, szklisty ton"""
    t = env_t(int(length * SR))
    f = 880 * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)
    return y * np.sin(np.pi * t / length) ** 2 * vel


def tick(vel=1.0, f0=2600):
    t = env_t(int(0.04 * SR))
    return (np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.006) + bp(rng.standard_normal(len(t)), 2500, 8000) * np.exp(-t / 0.004) * 0.4) * vel


def drop(vel=1.0):
    """„Podlej roślinkę”: kropla wody (pęcherzyk — szybki wzrost wysokości)"""
    t = env_t(int(0.25 * SR))
    f = 380 * np.exp(t / 0.07)
    f = np.minimum(f, 2400)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * vel


def paper(length, vel=1.0):
    n = int(length * SR)
    t = env_t(n)
    x = bp(rng.standard_normal(n), 1500, 9000)
    flutter = 0.6 + 0.4 * np.sin(2 * np.pi * 22 * t) ** 2
    return x * flutter * np.sin(np.pi * t / length) ** 2 * vel


# ------------------------------------------------------------------
#  Harmonia (F-dur)
# ------------------------------------------------------------------
CH = {
    'Fmaj9': ('F2', ['A3', 'C4', 'E4', 'G4']),
    'Dm9': ('D2', ['F3', 'A3', 'C4', 'E4']),
    'Bbmaj9': ('A#1', ['A3', 'C4', 'D4', 'F4']),
    'C9sus': ('C2', ['A#3', 'D4', 'F4', 'G4']),
    'Am7': ('A1', ['G3', 'C4', 'E4', 'G4']),
    'Gm9': ('G1', ['A#3', 'D4', 'F4', 'A4']),
    'Fwide': ('F1', ['C4', 'E4', 'G4', 'A4', 'C5']),
}
ARP = {  # arpeggio gitary (dźwięki akordu w górę i w dół)
    'Fmaj9': ['F3', 'C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'C4'],
    'Dm9': ['D3', 'A3', 'C4', 'E4', 'F4', 'E4', 'C4', 'A3'],
    'Bbmaj9': ['A#2', 'F3', 'A3', 'C4', 'D4', 'C4', 'A3', 'F3'],
    'C9sus': ['C3', 'G3', 'A#3', 'D4', 'F4', 'D4', 'A#3', 'G3'],
    'Am7': ['A2', 'E3', 'G3', 'C4', 'E4', 'C4', 'G3', 'E3'],
    'Gm9': ['G2', 'D3', 'F3', 'A#3', 'A3', 'A#3', 'F3', 'D3'],
}

keys, gtr, bas, drm, lead, fx, padb = buf(), buf(), buf(), buf(), buf(), buf(), buf()
kick_times = []


def groove(t0, bars, chords, drums=True, light=False, reverse_snare=False, arp=True):
    """bars taktów od t0; chords — lista akordów po pół taktu"""
    for h, name in enumerate(chords):
        th = t0 + h * BAR / 2
        root, voicing = CH[name]
        for kk, n_ in enumerate(voicing):
            place(keys, rhodes(hz(n_), BAR / 2 - 0.05, 0.55 if not light else 0.42), th + kk * 0.01, 0.2, pan=-0.3 + 0.6 * kk / 3)
        # bas: raz na pół taktu + synkopa
        place(bas, bass(hz(root), 0.75, 0.85), th, 0.26)
        place(bas, bass(hz(root) * 2, 0.22, 0.5), th + 3 * STEP + BEAT, 0.22)
        if arp:
            notes = ARP[name]
            for s_, n_ in enumerate(notes[:4]):
                place(gtr, guitar(hz(n_), 1.4, 0.75 if s_ % 2 == 0 else 0.55), th + s_ * (BEAT / 2) + (0.012 if s_ % 2 else 0), 0.22, pan=0.25 - 0.1 * s_)
    if not drums:
        return
    for b_ in range(bars):
        tb = t0 + b_ * BAR
        for s_ in range(16):
            t = tb + s_ * STEP + (0.016 if s_ % 2 else 0)
            if s_ in (0, 10) or (s_ == 7 and b_ % 2 == 1):
                kv = 0.9 if s_ == 0 else 0.62
                place(drm, kick(kv * (0.75 if light else 1)), t, 0.38)
                kick_times.append(t)
            if s_ in (4, 12):
                if reverse_snare:
                    rs = snare(0.9, 0.42)[::-1]
                    place(drm, rs, t - len(rs) / SR + 0.02, 0.2, pan=0.05)
                    place(drm, rim(0.5), t, 0.18)
                else:
                    place(drm, snare(0.7 if not light else 0.5), t, 0.2, pan=0.05)
            accent = 1.0 if s_ % 4 == 2 else (0.55 if s_ % 2 == 0 else 0.32)
            place(drm, shaker(accent * (0.7 if light else 1)), t, 0.15, pan=0.35)


# ---- 0.0–2.4: zwykła chwila (osobny ślad, bo przy 2.4 s „taśma” zwalnia)
intro = buf()
_saved = (keys, gtr, bas, drm)
keys, gtr, bas, drm = buf(), buf(), buf(), buf()
groove(0.0, 2, ['Fmaj9', 'Fmaj9', 'Dm9', 'Dm9'], drums=True, light=True)
intro = keys * 1.0 + gtr * 1.45 + hp(lp(bas, 450), 38) * 0.8 + drm * 0.9
keys, gtr, bas, drm = _saved
kick_times = []

# tape stop: od 2.4 s odtwarzanie zwalnia do zera w 0.42 s
out_intro = np.zeros((N, 2))
i_fr = int(2.4 * SR)
out_intro[:i_fr] = intro[:i_fr]
L = int(0.42 * SR)
tau = np.arange(L) / SR
rate = (1 - tau / 0.42) ** 1.6
pos = 2.4 * SR + np.cumsum(rate)
for c in range(2):
    out_intro[i_fr:i_fr + L, c] = np.interp(pos, np.arange(N), intro[:, c]) * np.linspace(1, 0.2, L)
out_intro[i_fr:i_fr + L] = lp(out_intro[i_fr:i_fr + L], 2500)

# ---- 2.4–3.3: zawieszenie — cichy, „zamrożony” akord i wysoki, szklisty ton
place(padb, pad([hz('F3'), hz('A3'), hz('C4'), hz('E4')], 1.6, 0.9, bright=1600), 2.42, 0.2)
t_ = env_t(int(1.2 * SR))
place(fx, np.sin(2 * np.pi * 2093 * t_) * np.sin(np.pi * t_ / 1.2) ** 2 * 0.25, 2.5, 0.1, pan=0.2)

# ---- 3.3–4.8: przewijanie — odwrócone struny i oddech narastają do 4.8
for kk, n_ in enumerate(['F3', 'A3', 'C4', 'E4', 'G4', 'C5']):
    g_ = guitar(hz(n_), 1.4, 0.7)[::-1]
    place(gtr, g_, 4.8 - len(g_) / SR + kk * 0.012, 0.2, pan=-0.3 + 0.12 * kk)
rv = rhodes(hz('A4'), 1.2, 0.7)[::-1]
place(lead, rv, 4.8 - len(rv) / SR, 0.12, pan=0.3)
place(fx, air(1.5, 400, 5000, 1.0, 'swell'), 3.3, 0.08)
place(fx, plink(0.9, up=False)[::-1], 3.72, 0.05, pan=-0.1)  # kropla wraca do herbaty

# ---- 4.8–12.0: „cofający się” groove (3 takty)
groove(4.8, 3, ['Dm9', 'Bbmaj9', 'Bbmaj9', 'C9sus', 'Fmaj9', 'Am7'], drums=True, reverse_snare=True)
# melodia: kalimba-dzwonek nad groove'em, w tramwaju „piosenka pasażera”
MEL = [(4.8, 'A5', .7), (5.4, 'C6', .5), (5.7, 'A5', .4), (6.0, 'G5', .5), (6.6, 'F5', .45),
       (7.2, 'E5', .7), (7.5, 'G5', .5), (7.8, 'A5', .5), (8.4, 'C6', .45),
       (8.7, 'A5', .6), (9.0, 'G5', .5), (9.3, 'E5', .45), (9.6, 'F5', .7), (10.2, 'A5', .5), (10.8, 'G5', .5), (11.1, 'E5', .4), (11.4, 'C5', .45)]
for t, n_, v in MEL:
    place(lead, bell(hz(n_), v, 1.6), t, 0.07, pan=0.2)
    place(lead, guitar(hz(n_), 1.2, v * 0.8, 0.7), t + 0.004, 0.1, pan=-0.15)

# ---- 12.0–15.0: chwila ciszy — perkusja milknie, ciepła harmonia
place(padb, pad([hz('A#2'), hz('D3'), hz('F3'), hz('A3'), hz('C4')], 1.6, 1.0, bright=1800), 12.0, 0.28)
place(padb, pad([hz('F2'), hz('A3'), hz('C4'), hz('E4'), hz('G4')], 1.9, 1.0, bright=1800), 13.3, 0.28)
for kk, n_ in enumerate(['A#3', 'D4', 'F4', 'A4']):
    place(keys, rhodes(hz(n_), 1.2, 0.5), 12.0 + kk * 0.03, 0.18)
for kk, n_ in enumerate(['A3', 'C4', 'E4', 'G4']):
    place(keys, rhodes(hz(n_), 1.5, 0.5), 13.32 + kk * 0.03, 0.18)
place(bas, bass(hz('A#1'), 1.2, 0.7), 12.0, 0.2)
place(bas, bass(hz('F1'), 1.6, 0.7), 13.32, 0.2)
for t, n_, v in [(12.6, 'D6', .35), (13.43, 'A5', .5), (13.73, 'C6', .35), (14.3, 'G5', .3)]:
    place(lead, bell(hz(n_), v, 2.4), t, 0.08, pan=0.15)

# ---- 15.0–17.4: aplikacja — groove wraca lżej (1 takt), potem przedtakt 17.4–18.0
groove(15.0, 1, ['Dm9', 'C9sus'], drums=True, light=True)
place(drm, kick(0.6), 17.4, 0.45)
place(drm, rim(0.6), 17.7, 0.16)
place(drm, rim(0.5), 17.85, 0.14)
place(fx, air(0.6, 600, 6000, 1.0, 'swell'), 17.4, 0.05)

# ---- 18.0–20.0: logo — rozwiązanie
root, voicing = CH['Fwide']
for kk, n_ in enumerate(voicing):
    place(keys, rhodes(hz(n_), 1.8, 0.62), 18.0 + kk * 0.018, 0.2, pan=-0.3 + 0.15 * kk)
place(bas, bass(hz(root), 1.8, 0.8), 18.0, 0.24)
place(drm, kick(0.7), 18.0, 0.45)
for kk, n_ in enumerate(['F3', 'C4', 'A4', 'C5', 'F5']):
    place(gtr, guitar(hz(n_), 2.0, 0.6), 18.0 + kk * 0.05, 0.2, pan=-0.2 + 0.1 * kk)
for t, n_, v in [(18.8, 'C6', .5), (18.86, 'F6', .4), (19.0, 'A5', .35)]:
    place(lead, bell(hz(n_), v, 2.2), t, 0.08, pan=-0.2 + 0.2 * (t - 18.8) * 5)
place(padb, pad([hz('F2'), hz('C3'), hz('A3'), hz('E4')], 2.0, 1.0, bright=1600), 18.0, 0.32)

# ------------------------------------------------------------------
#  Efekty (ciche, dotykowe)
# ------------------------------------------------------------------
place(fx, ceramic(1.0), 1.80, 0.32, pan=-0.15)      # kubek dotyka stołu
place(fx, plink(0.8), 1.84, 0.06, pan=-0.1)          # podskakuje kropla
place(fx, rim_hum(0.7, 1.0), 4.27, 0.035, pan=-0.1)  # łuk zsuwa się po brzegu kubka
place(fx, air(0.7, 300, 2500, 1.0, 'hump'), 5.4, 0.05)   # kabel odrywa się od stołu
place(fx, air(0.6, 1200, 7000, 1.0, 'hump'), 6.62, 0.04)  # nić owija się wokół plamy
place(fx, tick(0.7, 1800), 7.2, 0.06)                 # rama się domyka
place(fx, air(1.2, 400, 6000, 1.0, 'hump'), 7.2, 0.06)   # przez światło do tramwaju
for kk, n_ in enumerate(['E6', 'C6']):                # dzwonek tramwaju
    place(fx, bell(hz(n_), 0.8, 1.2), 9.8 + kk * 0.22, 0.05, pan=-0.3)
place(fx, air(1.6, 150, 1200, 1.0, 'fall'), 9.75, 0.07, pan=-0.4)   # tramwaj odjeżdża
place(fx, air(1.6, 300, 3000, 1.0, 'hump'), 12.0, 0.05)  # kamera cofa się przez okno
place(fx, paper(0.5, 1.0), 15.6, 0.05)                 # strona notesu
for kk in range(20):                                   # pisanie na ekranie
    place(fx, tick(0.5, 2200 + (kk % 3) * 300), 16.5 + kk * 0.048 + (0.01 if kk % 2 else 0), 0.03, pan=0.1)
place(fx, drop(1.0), 17.52, 0.1)                       # „Podlej roślinkę”
place(fx, air(0.4, 500, 4000, 1.0, 'hump'), 18.1, 0.035)  # skrzydła
place(fx, air(0.4, 500, 4000, 1.0, 'hump'), 18.7, 0.03)

# ------------------------------------------------------------------
#  Miks
# ------------------------------------------------------------------
duck = np.ones(N)
tt = env_t(int(0.3 * SR))
shape = 1 - 0.25 * np.exp(-tt / 0.08)
for t in kick_times:
    i = int(t * SR)
    j = min(N, i + len(shape))
    duck[i:j] = np.minimum(duck[i:j], shape[: j - i])
keys *= duck[:, None]
bas = hp(lp(bas * (0.6 + 0.4 * duck)[:, None], 450), 38)
drm = hp(drm, 35)
t_all = env_t(N)
# po freeze: muzyka (oprócz zawieszenia) nie gra między 2.4 a 3.3 — zadbał o to układ; tu tylko bezpiecznik
mute = np.ones(N)
mute[(t_all > 2.82) & (t_all < 3.3)] = 0
for b_ in (keys, gtr, bas, drm):
    b_ *= mute[:, None]


def reverb_ir(seconds=2.3, predelay=0.02):
    n = int(seconds * SR)
    t = env_t(n)
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 6.9))[:, None]
    ir = lp(ir, 5500)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2, axis=0))


IR = reverb_ir()
music = out_intro + keys + gtr * 1.45 + bas + drm * 0.9 + lead * 1.2 + padb
send = (out_intro * 0.25 + keys * 0.35 + gtr * 0.3 + lead * 0.7 + padb * 0.5 + fx * 0.4 + drm * 0.06)
wet = np.stack([signal.fftconvolve(send[:, c], IR[:, c])[:N] for c in range(2)], axis=1)
mix_ = music + fx + wet * 0.5
mix_ += lp(rng.standard_normal((N, 2)), 3500) * 0.002  # leciutki szum taśmy
mix_ = hp(mix_, 28)
mix_ += hp(mix_, 2800) * 0.45  # odrobina powietrza
fade = np.clip((DUR - t_all) / 1.3, 0, 1) ** 1.4 * np.clip(t_all / 0.05, 0, 1)
mix_ *= fade[:, None]
mix_ = np.tanh(mix_ * 1.3) / 1.3
rms = np.sqrt(np.mean(mix_[int(4.8 * SR):int(12 * SR)] ** 2))
mix_ *= 0.175 / rms
peak = np.max(np.abs(mix_))
if peak > 0.89:
    mix_ *= 0.89 / peak

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'przewin-jeszcze-raz.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, (mix_ * 32767).astype(np.int16))
print('zapisano', os.path.abspath(out), 'peak', round(float(np.max(np.abs(mix_))), 3))
