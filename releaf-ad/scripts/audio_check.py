# Kontrola ścieżki: spektrogram + obwiednia RMS z zaznaczonymi zdarzeniami obrazu, ciągłość na szwie pętli
import sys, wave
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
w = wave.open(sys.argv[1]); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2) / 32768
m = x.mean(1)
B = 17 / 36
ev = {'01': 3, 'fold': 7, 'cap29': 9.25, 'cap30': 9.75, 'explode': 10, 'pull': 18, 'LOCK': 20, 'lift': 22.5, 'card': 24.5, 'morph': 28.25, 'LOGO': 31, 'loop': 34.5}
fig, ax = plt.subplots(2, 1, figsize=(18, 8), sharex=True)
ax[0].specgram(m, NFFT=2048, Fs=sr, noverlap=1536, cmap='magma', vmin=-120)
ax[0].set_ylim(0, 12000)
hop = sr // 100
rms = np.array([np.sqrt(np.mean(m[i:i + hop] ** 2)) for i in range(0, len(m) - hop, hop)])
ax[1].plot(np.arange(len(rms)) / 100, 20 * np.log10(rms + 1e-6))
for k, v in ev.items():
    for a in ax: a.axvline(v * B, color='cyan', lw=0.8)
    ax[1].text(v * B, -10, k, rotation=90, color='k', fontsize=8)
ax[1].set_ylim(-70, 0)
plt.tight_layout(); plt.savefig(sys.argv[2], dpi=70)
print('szew pętli: koniec', x[-3:].round(4).tolist(), 'początek', x[:3].round(4).tolist())
print('skok na szwie:', np.abs(x[0] - x[-1]).max().round(4), 'typowa zmiana próbki:', np.abs(np.diff(m)).mean().round(4))
