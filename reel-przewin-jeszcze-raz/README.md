# ReLeaf — „Przewiń jeszcze raz.” (reels 20 s)

Animowany film 1080 × 1920, 60 fps, 20 s (1200 klatek), H.264 (yuv420p) + AAC stereo.
Gotowy plik: `out/releaf-przewin-jeszcze-raz-final.mp4`.

Pliki aplikacji (`../Main_Front-End/`) nie są zmieniane. Ekran z aplikacji jest odtworzony 1:1
w `src/ui/NoteScreen.tsx` (pozycje zmierzone z prawdziwego ekranu „Chcesz coś dopisać?”, kolory z `tokens.css`).
Logo to oryginalny plik z przezroczystym tłem (`public/logo/releaf-logo.png`) — bez żadnej białej podkładki.

## Jeden świat, jedna kamera

Film to jeden świat 2.5D z prawdziwą perspektywą (`src/world/camera.ts`): stół (z = 1000) → ściana z oknem (1400)
→ tramwaj (2300) → kamienica z kawiarnią (2900) → dachy (4500) → niebo. Kamera przelatuje przez te warstwy,
więc paralaksa wynika z ruchu, a nie z ręcznie dobranych współczynników.

| Czas | Co się dzieje | Gdzie |
|---|---|---|
| 0–3 s | Stół w słońcu. Kubek staje, kropla podskakuje… czas staje. „Czekaj.” | `world/Table.tsx`, `world/time.ts`, `Texts.tsx` |
| 3–9 s | Przewijanie: kropla wraca do herbaty, łuk brzegu kubka zsuwa się i staje kablem słuchawek, kabel unosi się jako fala, płynie na ścianę za cofającą się plamą słońca i owija się wokół niej jak sznurek — ta rama staje się oknem tramwaju | `world/Thread.tsx`, `world/portal.ts`, `world/Wall.tsx` |
| 9–15 s | Pasażer ze słuchawkami (kamera jedzie z tramwajem), tramwaj odjeżdża, przy drzwiach kawiarni spotykają się dwie osoby. Kamera cofa się przez okno pokoju: to wszystko działo się za oknem tego samego pokoju. „Czasem warto spojrzeć jeszcze raz.” | `world/Outside.tsx`, `world/People.tsx` |
| 15–18 s | Kamera do notesu na stole; jego strona staje się polem notatki prawdziwego ekranu aplikacji, notatka pisze się na żywo | `ui/Finale.tsx`, `ui/NoteScreen.tsx` |
| 18–20 s | „Podlej roślinkę” — ekran rozchyla się jak notes: połowy stają się skrzydłami, szew tułowiem. Kształty kończą na konturach wyciętych z logo, potem zostaje sam oryginalny PNG | `ui/Finale.tsx`, `logo/logoShapes.json` |

Klatki kluczowe: `src/timeline.ts` (rytm muzyki 100 BPM — ćwierćnuta = 36 klatek).

## Logo i przezroczystość

- `src/logo/logoShapes.json` — kontury skrzydeł i tułowia wyznaczone z kanału alfa oryginalnego PNG
  (zgodność z maską logo: IoU 0,993 — różnią się tylko piksele wygładzonej krawędzi).
- Morfing kończy dokładnie na tych konturach, a potem płynnie przechodzi w oryginalny plik PNG
  (znak i napis to ten sam plik, odsłaniany dwiema maskami `clip-path`).
- Kompozycja kontrolna `LogoTest` renderuje finał na jaskrawym fioletowym tle — sprawdzenie, że wokół logo
  nie ma żadnego prostokąta: `npx remotion still LogoTest out/logo-test.png --frame=1199`.

## Muzyka

`scripts/compose_music.py` syntezuje cały utwór i efekty (własny materiał — bez problemu z licencją):
ciepły indie-electronic 100 BPM w F-dur — gitara nylonowa (Karplus-Strong), elektryczne pianino FM, bas,
miękka perkusja, dzwonki. Przy zatrzymaniu czasu taśma zwalnia i staje, przy przewijaniu wchodzą odwrócone
struny i werble, przy odsłonie (12 s) perkusja milknie, a przy logo (18 s) akord rozwiązania.
Efekty: stuknięcie kubka, kropla, ton brzegu kubka, szelest, dzwonek tramwaju, strona notesu, pisanie, kropla wody.

```bash
pip install numpy scipy
python3 scripts/compose_music.py      # → public/audio/przewin-jeszcze-raz.wav
```

## Uruchomienie

```bash
npm i
npx remotion studio                    # podgląd (PrzewinPodglad = bez dźwięku, szybciej)
npx remotion render PrzewinJeszczeRaz out/releaf-przewin-jeszcze-raz-final.mp4 \
  --codec=h264 --crf=16 --x264-preset=slow --audio-codec=aac --audio-bitrate=320k
```

`remotion.config.ts`: klatki PNG i `yuv420p` (standardowy zakres kolorów — zgodność z Instagramem);
lokalny Chrome Headless Shell, jeśli jest pod ścieżką z `REMOTION_BROWSER` (albo domyślną w środowisku chmurowym).
