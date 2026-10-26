# ReLeaf — „To też się liczy.”

Reklama na Instagram: 25 s, 1080×1920, 60 kl/s, H.264 + AAC stereo. Montaż, kompozycja i render w Remotion. Osobny projekt; kod aplikacji (`../Main_Front-End`) jest tylko czytany.

## Scenariusz (rytm w `src/timeline.ts`)

| Czas | Scena | Co widać |
|---|---|---|
| 0:00–0:05 | 1 Chwila | Deszcz na szybie, rozmyte miasto. Bez tekstu. |
| 0:05–0:13 | 2 Małe chwile | Poranne światło (wejście przez prześwietlenie — match cut na świetle) → spacer → śmiech. Proste cięcia, ruch kamery w jedną stronę. |
| 0:13–0:18 | 3 Przesłanie | Jedno spokojne ujęcie. „Nie każdy dzień / musi być wyjątkowy.” … „Żeby był ważny.” — odsłanianie spod maski. |
| 0:18–0:22 | 4 ReLeaf | Ujęcie rozświetla się i przechodzi w prawdziwy ekran podlewania. Łodyga dochodzi do 5, aplikacja sama mówi: „Zwyczajny dzień też się liczy.” Bez makiety telefonu. |
| 0:22–0:25 | 5 Marka | Ekran rozpływa się w jasne tło z palety aplikacji; oficjalne logo z przezroczystością + „Poznaj swój dzień. Poznaj siebie.” |

## Uruchomienie

```bash
npm i
npm run nagraj-ui     # nagrywa ekran aplikacji klatka po klatce → public/ui/checkin (ok. 3 min, Playwright)
npm run dev           # Remotion Studio
npm run podglad       # animatik z planszami w miejscu brakujących ujęć → out/podglad-animatik.mp4
```

Materiał i muzyka (patrz `ASSET_SOURCES.md`):

```bash
# surowe/01-okno-deszcz.mp4 … surowe/05-cisza.mp4, surowe/audio/muzyka.wav (+ opcjonalnie deszcz/miasto/smiech)
npm run ujecia        # kadr 9:16 wokół ogniskowej, 60 kl/s, wspólny LUT + ziarno → public/footage, src/dostepne.json
npm run final         # render → out/releaf-to-tez-sie-liczy-final.mp4 + kontrola (ffprobe, czarne klatki, logo)
```

Punkt wejścia w surowym pliku (`wejscie`), kadr (`ogniskowa`) i korekty (`ekspozycja`, `temperatura`, `nasycenie`) ustawiasz w `ujecia.json`, potem znowu `npm run ujecia`.

## Struktura

| Plik | Rola |
|---|---|
| `src/timeline.ts` | Wszystkie cięcia i wejścia napisów (klatki) |
| `src/sceny/Chwile.tsx` | Sceny 1–2 |
| `src/sceny/Przeslanie.tsx` | Scena 3 + jasne przejście |
| `src/sceny/Aplikacja.tsx` | Scena 4: klatki nagranego ekranu + delikatny ślad dotyku (`src/dotyk.json`) |
| `src/sceny/Marka.tsx` | Scena 5: logo i hasło |
| `src/components/Ujecie.tsx` | Ujęcie z materiału albo plansza „brak ujęcia” |
| `src/components/Linia.tsx` | Linia tekstu odsłaniana spod maski |
| `src/Dzwiek.tsx` | Muzyka i tła z krzywymi głośności |
| `scripts/nagraj-ui.cjs` | Nagranie aplikacji na wirtualnym zegarze (performance.now, rAF, timery, animacje CSS) |
| `scripts/przygotuj.py` | Przygotowanie materiału (ffmpeg) |
| `scripts/lut.py` | Wspólny grading (LUT 33³) |
| `scripts/sprawdz.py` | Kontrola gotowego pliku |

## Decyzje

- **Interakcja w aplikacji:** suwak nastroju na 5, bo przy tej wartości aplikacja pokazuje „Zwyczajny dzień też się liczy.” — przesłanie filmu jej własnymi słowami. Ujęcie zaczyna się w trakcie ruchu (na „4”), bo przy przechodzeniu przez 1–3 aplikacja na chwilę pokazuje wsparcie („Ciężki dzień?”, 116 111) — to celowa funkcja bezpieczeństwa, więc nie zmieniamy aplikacji, tylko miejsce cięcia.
- **Bez makiety telefonu:** pionowy kadr sam staje się ekranem. Gdy będzie dobre ujęcie dłoni z telefonem (green screen), można dodać kompozycję w perspektywie.
- **Logo:** oryginalny PNG z alfą, bez karty i cienia; znak słowny „ReLeaf” jest w logo, więc nie powtarzamy go tekstem. `scripts/sprawdz.py` liczy skok tła na granicy obrazka (prostokąt dałby ~23/255, czysty kadr < 1.5/255).
- **Bezpieczne strefy Instagrama:** napisy od y = 1060 z marginesem 96 px z lewej i 150 px z prawej.
- **Przeglądarka:** gdy Remotion nie może pobrać własnej, `remotion.config.ts` używa zainstalowanego Chromium (`REMOTION_CHROME` albo Playwright).
