# ReLeaf — „Niby zwykły dzień.” (reels 20 s)

Film reklamowy 1080 × 1920, 60 fps, 20 s, H.264 + AAC. Gotowy plik: `out/releaf-niby-zwykly-dzien.mp4`.

Pliki aplikacji (`../Main_Front-End/`) nie są zmieniane — ekran z aplikacji jest odtworzony 1:1
w `src/components/CheckinAreasScreen.tsx` (pozycje zmierzone z prawdziwego ekranu, kolory z `tokens.css`).

## Scenariusz

| Czas | Co się dzieje | Plik |
|---|---|---|
| 0–4 s | „Dzisiaj?” → „Nic szczególnego.” Słowo „Nic” rozchyla się jak szczelina, w środku stoi „coś” (przez chwilę: „coś szczególnego.”), szczelina rośnie w pierwszą kartkę | `src/scenes/Hook.tsx`, `hookGeometry.ts` |
| 4–10 s | Kamera czyta stronę zygzakiem: cztery chwile spadają na stół jak kartki (rozmowa, chwila dla siebie, coś nowego, poprawiony humor), każda ma jeden mały ruch | `src/scenes/Story.tsx`, `src/components/MomentCard.tsx` |
| 10–15 s | Kamera się cofa: to była jedna strona dnia — „Może jednak coś się działo.” Luźne kartki wskakują w porządek strony | `Story.tsx` |
| 15–18 s | Kartki zamieniają się w wiersze prawdziwego pytania z aplikacji „Co dziś miało znaczenie?”, odpowiedzi zaznaczają się na „Dobrze” | `Story.tsx`, `CheckinAreasScreen.tsx` |
| 18–20 s | Ekran zwęża się w pionową wstęgę (echo szczeliny z początku) → tułów motyla, skrzydła otwierają się raz. „Poznaj swój dzień. Poznaj siebie.” | `src/scenes/Brand.tsx` |

Wszystkie klatki kluczowe są w `src/timeline.ts` (rytm muzyki: 120 BPM, ćwierćnuta = 30 klatek).

## Muzyka

`scripts/compose_music.py` syntezuje cały utwór (własny, bez cudzych sampli — brak problemu z licencją):
ciepły indie-electronic, D-dur, elektryczne pianino FM, bas, miękka perkusja, kalimba.
Akcenty stoją pod obrazem (dzwoneczek przy „coś”, wejście rytmu w 4 s, nuty przy kartkach, rozwinięcie w 10 s,
kliknięcia przy „Dobrze”, dzwonek przy otwarciu skrzydeł). Wynik: `public/audio/niby-zwykly-dzien.wav`.

```bash
pip install numpy scipy
python3 scripts/compose_music.py
```

## Zasoby

- `public/logo/` — oficjalne logo ReLeaf (`releaf-logo.png`) i jego warstwy (skrzydła, tułów, napis) wycięte z tego samego pliku bez zmian kształtu i koloru.
- `public/fonts/` — Plus Jakarta Sans (krój aplikacji) i Instrument Serif Italic (jedyny akcent: słowo „coś” i stopka); oba na licencji SIL OFL.
- `public/texture/` — wygenerowana faktura papieru.

## Uruchomienie

```bash
npm i
npx remotion studio                 # podgląd
npx remotion render NibyZwyklyDzien out/releaf-niby-zwykly-dzien.mp4 \
  --codec=h264 --crf=16 --x264-preset=slow --audio-codec=aac --audio-bitrate=320k
```

`remotion.config.ts` używa lokalnego Chrome Headless Shell, jeśli jest pod ścieżką z `REMOTION_BROWSER`
(albo domyślną ścieżką w środowisku chmurowym); w innym wypadku Remotion pobierze przeglądarkę sam.
