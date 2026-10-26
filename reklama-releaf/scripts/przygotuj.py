"""
Przygotowanie materiału do montażu (`npm run ujecia`).

Dla każdego ujęcia z ujecia.json szuka surowego pliku surowe/<id>.(mp4|mov|webm|mkv) i robi z niego
public/footage/<id>.mp4:
  - wycina od `wejscie` (s) 8 sekund (zapas na montaż),
  - kadruje do 1080×1920 wokół `ogniskowa` (bez rozciągania; ostrzega, gdy trzeba powiększać),
  - ujednolica do 60 kl/s (ostrzega przy 23.976/24 kl/s — wtedy lepiej poszukać wersji 25/30/50/60),
  - opcjonalne korekty z ujecia.json: "ekspozycja" (−1…1), "temperatura" (K, np. 5600 → cieplej), "nasycenie",
  - wspólny grading: public/lut/releaf-grade.cube (scripts/lut.py) i bardzo delikatne ziarno,
  - H.264 wysokiej jakości, krótki GOP (szybkie przewijanie w Remotion), bez dźwięku.
Dźwięki z surowe/audio/<id>.(wav|mp3|flac|ogg|m4a) → public/audio/<id>.wav (48 kHz, stereo).
Na koniec zapisuje src/dostepne.json (co jest gotowe).

Użycie: python3 scripts/przygotuj.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SUROWE = os.path.join(ROOT, 'surowe')
W, H, FPS, ZAPAS = 1080, 1920, 60, 8.0
LUT = os.path.join(ROOT, 'public', 'lut', 'releaf-grade.cube')
VIDEO_EXT = ('.mp4', '.mov', '.webm', '.mkv', '.m4v')
AUDIO_EXT = ('.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac')


def znajdz(folder, id_, exts):
    for e in exts:
        p = os.path.join(folder, id_ + e)
        if os.path.exists(p):
            return p
    return None


def sonda(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height,r_frame_rate:format=duration', '-of', 'json', path],
                         capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    s = d['streams'][0]
    num, den = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(num) / float(den), float(d['format']['duration'])


def ujecie(u):
    src = znajdz(SUROWE, u['id'], VIDEO_EXT)
    if not src:
        print(f'  – {u["id"]}: brak surowe/{u["id"]}.mp4')
        return False
    w, h, fps, dur = sonda(src)
    start = float(u.get('wejscie', 0))
    dl = min(ZAPAS, dur - start)
    skala = max(W / w, H / h)
    sw, sh = round(w * skala / 2) * 2, round(h * skala / 2) * 2
    fx, fy = u.get('ogniskowa', [0.5, 0.5])
    x = int(min(max(sw * fx - W / 2, 0), sw - W))
    y = int(min(max(sh * fy - H / 2, 0), sh - H))
    uwagi = []
    if skala > 1.0:
        uwagi.append(f'POWIĘKSZENIE ×{skala:.2f} — szukaj wyższej rozdzielczości' if skala > 1.15 else f'lekkie powiększenie ×{skala:.2f}')
    if abs(fps - 24) < 0.2 or abs(fps - 23.976) < 0.05:
        uwagi.append('24 kl/s → 60 kl/s da szarpanie; lepiej materiał 25/30/50/60')
    if dl < 5:
        uwagi.append(f'tylko {dl:.1f} s materiału od punktu wejścia')

    korekty = []
    if u.get('ekspozycja'):
        korekty.append(f"eq=brightness={0.08 * float(u['ekspozycja']):.3f}")
    if u.get('nasycenie'):
        korekty.append(f"eq=saturation={float(u['nasycenie']):.3f}")
    if u.get('temperatura'):
        korekty.append(f"colortemperature=temperature={int(u['temperatura'])}:mix=0.5")

    vf = ','.join([
        f'scale={sw}:{sh}:flags=lanczos',
        f'crop={W}:{H}:{x}:{y}',
        f'fps={FPS}',
        *korekty,
        f"lut3d='{LUT}'",
        'noise=c0s=4:c0f=t',          # ziarno tylko w luminancji, ledwo widoczne
        'format=yuv420p',
    ])
    dst = os.path.join(ROOT, 'public', 'footage', u['id'] + '.mp4')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-t', f'{dl:.3f}', '-i', src, '-vf', vf, '-an',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '11', '-g', '30', '-bf', '0',
                    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-movflags', '+faststart', dst], check=True)
    print(f'  ✓ {u["id"]}: {w}×{h} @ {fps:.2f} → {W}×{H} @ {FPS}, {dl:.1f} s' + (' | ' + '; '.join(uwagi) if uwagi else ''))
    return True


def dzwiek(a):
    src = znajdz(os.path.join(SUROWE, 'audio'), a['id'], AUDIO_EXT)
    if not src:
        print(f'  – {a["id"]}: brak surowe/audio/{a["id"]}.wav' + (' (WYMAGANE)' if a.get('wymagane') else ''))
        return False
    dst = os.path.join(ROOT, 'public', 'audio', a['id'] + '.wav')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(a.get('wejscie', 0)), '-t', '30', '-i', src,
                    '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', dst], check=True)
    print(f'  ✓ {a["id"]}')
    return True


def main():
    cfg = json.load(open(os.path.join(ROOT, 'ujecia.json'), encoding='utf-8'))
    if not os.path.exists(LUT):
        subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'lut.py'), LUT], check=True)
    print('Ujęcia:')
    u = {x['id']: ujecie(x) for x in cfg['ujecia']}
    print('Dźwięk:')
    a = {x['id']: dzwiek(x) for x in cfg['audio']}
    dost = {
        '_opis': 'Generowane przez `npm run ujecia` — które ujęcia i dźwięki są już przygotowane w public/. Nie edytuj ręcznie.',
        'ujecia': u,
        'audio': a,
    }
    with open(os.path.join(ROOT, 'src', 'dostepne.json'), 'w', encoding='utf-8') as f:
        json.dump(dost, f, ensure_ascii=False, indent=2)
        f.write('\n')
    brak = [k for k, v in u.items() if not v] + [x['id'] for x in cfg['audio'] if x.get('wymagane') and not a[x['id']]]
    print('Gotowe do renderu finalnego.' if not brak else f'Brakuje jeszcze: {", ".join(brak)}')


if __name__ == '__main__':
    main()
