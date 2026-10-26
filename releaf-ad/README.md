# ReLeaf — „30 dni. Nowa perspektywa” (reklama 17 s)

Druga reklama ReLeaf: eksperymentalny film motion design o tym, że 30 dni razem pokazuje wzory niewidoczne w jednym dniu.
Cały film jest wygenerowany kodem (Remotion + three.js), muzyka też (numpy/scipy). Aplikacja w `Main_Front-End/` nie jest
tu zmieniana — ten katalog tylko z niej czerpie.

**Gotowy plik:** `out/releaf-30-days-final.mp4` — 1080 × 1920, 60 kl./s, 1020 klatek, H.264 + AAC stereo 48 kHz.

## Skąd są materiały marki
- **Logo:** `public/brand/releaf-logo.png` — oryginalny plik od zespołu, bez zmian. Na końcu filmu widać dokładnie ten PNG.
  `src/brand/logo-paths.ts` to tylko obrys tego pliku (skrypt `scripts/trace-logo.cjs`) — służy do animacji przejścia
  karta → logo; w ostatniej klatce przejścia wektory są podmieniane na PNG w tym samym miejscu.
- **Kolory:** tokeny z `Main_Front-End/css/tokens.css` (motyw „morski” + tryb nocny: `--bg #0E181B`, `--surface #1A2B30`…)
  i próbki z logo (`src/brand/palette.ts`).
- **Font:** Plus Jakarta Sans (font aplikacji, licencja OFL) — `public/fonts/`.
- **Karta produktu:** wniosek „Sen poprawia Ci dzień” z zakładki Tracker (`Main_Front-End/js/tracker.js`), w trybie nocnym.
  Wymiary każdego elementu zmierzone w prawdziwej aplikacji (`src/overlays/geometry.ts`), wartości 5,9 / 7,2 / 1,4 to dane
  przykładowe, które aplikacja sama wylicza. Wnioski w aplikacji liczone są z ostatnich 30 wpisów (`last30`) — stąd 30 dni.
  Film nie pokazuje żadnych wymyślonych odpowiedzi AI.

## Oś czasu (127,06 BPM, 36 uderzeń = 9 taktów = 17 s)
| czas | scena | co się dzieje |
|---|---|---|
| 0–1,9 s | DZISIAJ? | litery 3D przelatują obok kamery i spadają „werblem” 1/32; kropka „?” to stos płyt dni — odrywa się, obraca, „01” na uderzenie |
| 1,9–5,7 s | czas staje się fizyczny | stos to złożona harmonijka 7 dni (zawiasy co 1/8), z niej odklejają się 3 tygodnie i zaginają w pudełko; wieczka 29 i 30; od czoła cały miesiąc chowa się za jedną płytą |
| 5,7–11 s | niemożliwe odsłonięcie | 30 płyt na głębokości 6,5–40 j., każda to nieregularny czworokąt (anamorfoza); przelot, cisza, odjazd z dolly-zoomem — z jednego punktu płyty składają się w kalendarz „ZOBACZ WIĘCEJ.” |
| 11–13,4 s | produkt | iluzja rozpada się w paralaksie, dzień 30 wylatuje, jego tył staje się prawdziwą kartą wniosku |
| 13,4–17 s | logo i pętla | paski i ikona snu → skrzydła i tułów logo, tytuł → „ReLeaf”, uderzenie; kafel z logo odjeżdża i staje się kropką „?” z pierwszej klatki |

Zdarzenia są w `src/timing.ts`; `scripts/music.py` liczy dźwięk z tych samych uderzeń.

## Jak to działa
- `src/world/World.ts` — cały świat 3D jako funkcja czasu (bez stanu): kamera, litery, 30 płyt, choreografia.
- `src/world/layout.ts` — anamorfoza: komórki siatki 5 × 6 rzutowane z punktu C* na nachylone płaszczyzny.
- `src/world/materials.ts` — shadery: kolory 1:1 z CSS, mapowanie projekcyjne plakatu z C*.
- `src/overlays/Product.tsx` — karta z aplikacji, morfing w logo (flubber), plakat; `Finish.tsx` — winieta i ziarno.
- Motion blur: kompozycja `ReLeaf30-subframes` (8 podklatek na klatkę) uśredniana w FFmpeg — migawka 180°.
- Pętla: końcówka filmu to ujemny czas sceny 1 (`loopU`), więc ostatnia i pierwsza klatka to jeden ciągły ruch.
  Muzyka jest renderowana w 3 przebiegach i cięta ze środka — pogłos przechodzi przez szew.

## Uruchamianie
```bash
npm install
npm run studio                       # podgląd w Remotion Studio
scripts/stills.sh /tmp/kl 0 85 567   # wybrane klatki + arkusz kontrolny
scripts/render-final.sh              # muzyka + render z motion blurem + ffprobe → out/releaf-30-days-final.mp4
python3 scripts/flicker.py out/releaf-30-days-final.mp4   # kontrola skoków i szwu pętli
```
W kontenerze bez GPU WebGL działa przez SwiftShader (`remotion.config.ts`); przeglądarka z `REMOTION_BROWSER`
albo z Playwrighta. Render końcowy na 4 rdzeniach trwa ok. 50 min.
