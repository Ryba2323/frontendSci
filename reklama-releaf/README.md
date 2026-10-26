# ReLeaf — „To też się liczy.”

Reklama na Instagram: 25 s, 1080×1920, 60 kl/s, H.264 + AAC stereo. Montaż, kompozycja i render w Remotion. Osobny projekt; kod aplikacji (`../Main_Front-End`) jest tylko czytany.

## Scenariusz (rytm w `src/timeline.ts`)

| Czas | Scena | Ujęcie (Mixkit, szczegóły w `ASSET_SOURCES.md`) |
|---|---|---|
| 0:00–0:04,9 | 1 Chwila | Krople na szybie, za nimi powoli przepływają światła miasta (85% prędkości). Deszcz i daleki szum miasta. |
| 0:04,6–0:07,1 | 2 Małe chwile | Krótkie prześwietlenie (okrągłe światła → okrągły blask słońca) i poranne słońce za falującą zasłoną. |
| 0:07,1–0:09,5 | | Cięcie dokładnie na pierwsze uderzenie perkusji: sylwetka idzie pod słońce. |
| 0:09,5–0:12,5 | | Na „raz” taktu: przyjaciółka śmieje się naprawdę, z ręką przy twarzy. |
| 0:12,5–0:18,8 | 3 Przesłanie | Dziewczyna czyta przy oknie. „Nie każdy dzień / musi być wyjątkowy.” (13,3 s) … „Żeby był ważny.” (15,9 s); muzyka otwiera się w 16,7 s, a ona podnosi wzrok do okna. |
| 0:18,2–0:22,4 | 4 ReLeaf | Ujęcie rozświetla się w prawdziwy ekran podlewania: łodyga dochodzi do 5, aplikacja mówi „Zwyczajny dzień też się liczy.” |
| 0:21,8–0:25 | 5 Marka | Jasne tło z palety aplikacji, oficjalne logo z alfą + „Poznaj swój dzień. Poznaj siebie.”; muzyka łagodnie gaśnie. |

Muzyka: „A Special Feeling” (Michael Ramir C., Mixkit), od 21,7 s utworu — 99,4 BPM, takt 2,41 s. Dźwięk zgrany do −14 LUFS (norma Instagrama), true peak −3,4 dBTP.

## Uruchomienie

```bash
npm i
npm run nagraj-ui     # nagrywa ekran aplikacji klatka po klatce → public/ui/checkin (ok. 3 min, Playwright)
npm run dev           # Remotion Studio
npm run podglad       # animatik z planszami w miejscu brakujących ujęć → out/podglad-animatik.mp4
```

Materiał i muzyka (pliki z Mixkit, adresy w `ASSET_SOURCES.md` i `surowe/zrodla.txt`; `surowe/` nie jest w repo):

```bash
# surowe/01-okno-deszcz.mp4 … surowe/05-cisza.mp4, surowe/audio/muzyka.mp3, deszcz.wav, miasto.wav
npm run ujecia        # kadr 9:16 wokół ogniskowej, 60 kl/s, wspólny LUT + ziarno → public/footage, src/dostepne.json
npm run final         # render → out/releaf-to-tez-sie-liczy-final.mp4, mastering −14 LUFS, kontrola (ffprobe, LUFS, czarne klatki, logo)
```

Punkt wejścia w surowym pliku (`wejscie`), kadr (`ogniskowa`), prędkość (`tempo`) i korekty (`balans`, `ekspozycja`, `temperatura`, `nasycenie`) ustawiasz w `ujecia.json`, potem znowu `npm run ujecia`.

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
- **Klatkaż:** materiał to 24p. Bez interpolacji klatek (artefakty na kroplach i włosach) — w pliku 60 kl/s klatki mają kadencję 3:2, dokładnie tak, jak każdy ekran 60 Hz pokazuje film. Prawdziwa prędkość ruchu; tylko deszcz (85%) i czytanie (93%) są lekko zwolnione.
- **Montaż pod muzykę:** cięcia na spacer, śmiech i ciszę leżą na uderzeniach utworu (7,10 / 9,53 / 12,51 s), drugie zdanie wybrzmiewa tuż przed rozwinięciem muzyki (16,71 s). Pozostałe przejścia są celowo poza rytmem — nie tniemy pod każde uderzenie.
- **Grading:** wspólny LUT + korekta bieli per ujęcie (`balans` w `ujecia.json`): nocny deszcz zostaje chłodniejszy, dalej ciepłe, naturalne światło; bez teal-orange.
- **Przeglądarka:** gdy Remotion nie może pobrać własnej, `remotion.config.ts` używa zainstalowanego Chromium (`REMOTION_CHROME` albo Playwright).
