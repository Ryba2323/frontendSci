# ReLeaf — Hidden Logo Loop

Krótka (11 s), zapętlona animacja marki ReLeaf w Remotion. 1080 × 1920, 60 kl./s, H.264 + AAC.

Gotowy plik: `out/releaf-hidden-logo-loop.mp4`

## Pomysł

Oficjalne logo (przezroczysty PNG) jest pocięte na 95 cienkich, poziomych paseczków zawieszonych
w przestrzeni na różnych głębokościach — parzyste i nieparzyste na dwóch lustrzanych falach,
jak dwie splecione łodygi. Każdy paseczek jest przeskalowany tak, że **z jednego jedynego kąta**
jego rzut trafia dokładnie w swoje miejsce w logo (anamorfoza).

1. **Rozsypka** — kamera krąży wokół rzeźby; widać tylko rytm turkusowych, brzoskwiniowych
   i grafitowych kresek.
2. **Zaskoczenie (5,5 s)** — kamera dojeżdża sprężyście do tego jednego kąta i kreski „klikają”
   w motyla. Logo jest kompletne, ale cień jeszcze się rozpada — paseczki wciąż wiszą w powietrzu.
3. **Rozpoznanie** — paseczki od góry do dołu opadają na powierzchnię (w dźwięku: krople, jak
   przy podlewaniu roślinki w aplikacji), cień zbiega się w miękki cień kontaktowy, a paseczki
   podmienia ten sam PNG w jednym kawałku — bez żadnego tła ani karty.
4. **Pętla** — napis unosi się pierwszy, kamera odpływa w górę i wraca do rozsypki z pierwszej
   klatki. Kamera, głębokości i dźwięk są funkcjami okresowymi, więc szwu nie ma.

## Pliki

| Plik | Co robi |
|---|---|
| `src/motion.ts` | cała choreografia: czasy, kamera (splajn + sprężyna), głębokości paseczków |
| `src/HiddenLogoLoop.tsx` | scena CSS 3D: tło, paseczki, cienie, głębia ostrości, pełne logo |
| `public/releaf-logo.png` | oficjalne logo (tylko wyzerowane pojedyncze, niewidoczne piksele szumu) |
| `public/releaf-sound.wav` | dźwięk, generowany skryptem |
| `scripts/prepare-logo.py` | kopiuje logo do `public/` |
| `scripts/export-motion.ts` | zapisuje ruch klatka po klatce (`scripts/motion.json`) dla dźwięku |
| `scripts/make-sound.py` | syntetyzuje muzykę i efekty na buforze kołowym (numpy) |

## Komendy

```console
npm i
npm run dev                      # podgląd w Remotion Studio

# po zmianie choreografii odśwież dźwięk:
node --experimental-strip-types scripts/export-motion.ts > scripts/motion.json
python3 scripts/make-sound.py scripts/motion.json public/releaf-sound.wav

# render finalny
npx remotion render ReLeafHiddenLogoLoop out/releaf-hidden-logo-loop.mp4 \
  --codec=h264 --crf=14 --image-format=png --x264-preset=slow \
  --audio-codec=aac --audio-bitrate=256k
```

Kolory tła i cienia pochodzą z `Main_Front-End/css/tokens.css` (motyw „morski”).
