# ASSET_SOURCES — ReLeaf „To też się liczy.”

Stan na 26.10.2026. Każdy plik, który trafia do filmu, ma tu wpis: skąd jest, na jakiej licencji i czy wymaga podpisu autora.

## Status

| Element | Status |
|---|---|
| Logo, krój, ekran aplikacji, grading | ✅ gotowe (poniżej) |
| Materiał filmowy (5 ujęć) | ⛔ **brak** — w sesji, w której powstał projekt, polityka sieci blokowała pobieranie (patrz niżej) |
| Muzyka | ⛔ **brak** — z tego samego powodu |
| Dźwięki tła (deszcz, miasto, śmiech) | ⛔ brak (opcjonalne) |

Render finalny (`npm run final`) jest zablokowany, dopóki brakuje ujęć albo muzyki. Animatik (`npm run podglad`) pokazuje w ich miejscu wyraźne plansze „PODGLĄD · BRAK UJĘCIA”, a nie zastępcze ilustracje.

### Dlaczego nie ma materiału

Środowisko chmurowe, w którym zbudowano projekt, odrzucało połączenia (HTTP 403 na CONNECT, odmowa polityki sieci) do:
`www.pexels.com`, `api.pexels.com`, `videos.pexels.com`, `pixabay.com`, `cdn.pixabay.com`, `mixkit.co`, `assets.mixkit.co`, `www.videvo.net`, `commons.wikimedia.org`, `upload.wikimedia.org`, `freemusicarchive.org`, `archive.org`, `incompetech.com`, `www.youtube.com`, `huggingface.co`.

Żeby dokończyć: dopuścić te domeny (co najmniej Pexels + Pixabay + Mixkit z CDN-ami) w ustawieniach sieci środowiska albo pobrać pliki lokalnie i wrzucić je do `surowe/`.

## Gotowe elementy

| Plik | Źródło | Licencja / prawa | Podpis |
|---|---|---|---|
| `public/marka/releaf-logo.png` | Oficjalne logo ReLeaf dostarczone przez zespół (oryginał bez zmian: `public/marka/releaf-logo-oryginal.png`; w filmie tylko przycięty pusty, przezroczysty margines — piksele i kanał alfa nietknięte) | Własność ReLeaf | Nie |
| `public/ui/checkin/*.png` (generowane) | Prawdziwy ekran podlewania z `Main_Front-End/aplikacja.html`, nagrany przez `scripts/nagraj-ui.cjs` (kod aplikacji bez zmian) | Własny kod zespołu | Nie |
| `public/fonts/*.woff2` | Plus Jakarta Sans 5.3.0 z `@fontsource/plus-jakarta-sans` (npm) — ten sam krój co w aplikacji | SIL Open Font License 1.1 (`public/fonts/OFL-plus-jakarta-sans.txt`) | Nie |
| `public/lut/releaf-grade.cube` | Własny LUT, generowany przez `scripts/lut.py` | Własny | Nie |

## Do pozyskania — ujęcia

Pełne opisy i frazy wyszukiwania: `ujecia.json`. Wymagania wspólne: prawdziwi ludzie i miejsca, naturalne światło, bez patrzenia w kamerę i bez reklamowego uśmiechu, bez znaków wodnych, najlepiej 4K lub pion ≥ 1080×1920, 25/30/50/60 kl/s (24 kl/s da szarpanie przy 60 kl/s). `npm run ujecia` ostrzeże przy powiększaniu i 24 kl/s.

| Slot | Plik w `surowe/` | Treść | Źródło (URL) | Licencja | Autor / podpis |
|---|---|---|---|---|---|
| 01 | `01-okno-deszcz.mp4` | Krople na szybie tramwaju/okna, rozmyte miasto | — | — | — |
| 02 | `02-poranne-swiatlo.mp4` | Poranne słońce na pościeli / ścianie, firanka | — | — | — |
| 03 | `03-spacer.mp4` | Młoda osoba idzie w naturalnym świetle | — | — | — |
| 04 | `04-smiech.mp4` | Dwie osoby spontanicznie się śmieją | — | — | — |
| 05 | `05-cisza.mp4` | Spokojna chwila przy oknie / dłonie z kubkiem; miejsce na napisy w dolnej połowie | — | — | — |

## Do pozyskania — dźwięk

| Slot | Plik w `surowe/audio/` | Treść | Źródło (URL) | Licencja | Autor / podpis |
|---|---|---|---|---|---|
| muzyka (wymagana) | `muzyka.wav` | Ciepły indie-electronic, miękka perkusja, ciepły bas, ~90–105 BPM, ≥ 25 s | — | — | — |
| deszcz | `deszcz.wav` | Deszcz o szybę (wnętrze) | — | — | — |
| miasto | `miasto.wav` | Dalekie miasto / tramwaj | — | — | — |
| smiech | `smiech.wav` | Ciche naturalne śmiechy | — | — | — |

## Sprawdzenie licencji przy pobieraniu (dla każdego pliku)

Tekstu licencji nie dało się zweryfikować z tej sesji (strony zablokowane), więc przy pobieraniu:

1. Otwórz stronę licencji serwisu (Pexels: `pexels.com/license`, Pixabay: `pixabay.com/service/license-summary`, Mixkit: licencja podana przy danym pliku — inna dla wideo, inna dla muzyki) i potwierdź, że pozwala na **reklamę w mediach społecznościowych** (użycie komercyjne, modyfikacje, bez podpisu albo z podpisem).
2. **Osoby rozpoznawalne:** licencje stockowe zwykle zabraniają przedstawiania ludzi w złym świetle i sugerowania, że popierają produkt. To reklama aplikacji o zdrowiu psychicznym, więc wybierz ujęcia, w których osoby nie wyglądają, jakby same miały problemy psychiczne. Najbezpieczniej: plecy, sylwetki, dłonie, nieostre twarze. Sprawdź też, czy autor ma zgodę modela (model release).
3. Brak znaku wodnego; pobierz oryginał w najwyższej rozdzielczości.
4. Muzyka: sprawdź, czy utwór nie jest zgłoszony do Content ID / systemów Instagrama (wtedy reklama może dostać blokadę albo wyciszenie).
5. Wpisz URL strony pliku, nazwę licencji, autora i datę pobrania w tabeli wyżej oraz w polach `zrodlo` / `licencja` / `autor` w `ujecia.json`.
