# ASSET_SOURCES — ReLeaf „To też się liczy.”

Stan na 26.10.2026. Każdy plik użyty w `out/releaf-to-tez-sie-liczy-final.mp4`: skąd jest, na jakiej licencji i czy wymaga podpisu.

**Podpis autorów: niewymagany** dla żadnego elementu (licencje Mixkit Free: „Attribution is not required”). Jeśli jest miejsce w opisie posta, Mixkit prosi o grzecznościowe „Mixkit”, ale to nieobowiązkowe.

## Materiał filmowy (Mixkit — Stock Video Free License)

Licencja każdego klipu sprawdzona na jego stronie (pole pobierania „…under the Mixkit Stock Video Free License”; klipy z „Mixkit Restricted License” — zakaz reklam — zostały odrzucone już przy wyborze). Pliki pobrane przez oficjalny przycisk pobierania Mixkit w najwyższej dostępnej rozdzielczości.

| Ujęcie w filmie | Klip Mixkit | Strona | Oryginał | Użyty fragment |
|---|---|---|---|---|
| 01 Deszcz na szybie (0:00–0:04,9) | #99834 „Raindrops on glass with blurred city lights in the background” | https://mixkit.co/free-stock-video/raindrops-on-glass-with-blurred-city-lights-in-the-background-99834/ | 3840×2160, 23,976 kl/s | od 3,8 s, 85% prędkości |
| 02 Poranne światło (0:04,6–0:07,1) | #3977 „View of a window with a curtain” | https://mixkit.co/free-stock-video/view-of-a-window-with-a-curtain-3977/ | 3840×2160, 23,976 kl/s | od 4,0 s |
| 03 Spacer w słońcu (0:07,1–0:09,5) | #1214 „Woman's silhouette walking on the beach at sunset” | https://mixkit.co/free-stock-video/womans-silhouette-walking-on-the-beach-at-sunset-1214/ | 1080×1920 (pion), 23,976 kl/s | od 3,6 s |
| 04 Śmiech (0:09,5–0:12,5) | #41236 „Two cheerful women during a girlfriends date in a cafe” | https://mixkit.co/free-stock-video/two-cheerful-women-during-a-girlfriends-date-in-a-cafe-41236/ | 1080×1920 (pion), 24 kl/s | od 7,4 s |
| 05 Chwila ciszy + napisy (0:12,5–0:18,8) | #42741 „Girl reading a book sitting near a window” | https://mixkit.co/free-stock-video/girl-reading-a-book-sitting-near-a-window-42741/ | 3840×2160, 23,976 kl/s | od 6,3 s, 93% prędkości |

Autor: strony tych klipów na Mixkit nie podają nazwiska twórcy (właścicielem licencji jest Envato/Mixkit).

## Muzyka (Mixkit — Stock Music Free License)

| Element | Źródło | Licencja | Użycie |
|---|---|---|---|
| „A Special Feeling” — Michael Ramir C. (Mixkit #1087, 99 BPM, tagi: relaxed, positive, soft, lifestyle) | https://mixkit.co/free-stock-music/discover/a-special-feeling/ (plik: https://assets.mixkit.co/music/1087/1087.mp3 — ten sam, który daje oficjalny przycisk pobierania) | Mixkit Stock Music Free License — dozwolone: „Social Media video posts”, „Online marketing ads” | 21,7–46,7 s utworu, wyciszenie ostatnich 1,5 s; zgranie do −14 LUFS |

Ograniczenia tej licencji ważne dla zespołu: nie wolno używać utworu w TV/radiu, na CD/DVD, w grach, nie wolno go remiksować jako samodzielnej muzyki ani rejestrować w systemach typu Content ID. Gdyby Instagram/YouTube zgłosił roszczenie — Mixkit prosi o kontakt na team@mixkit.co.

## Dźwięki tła (Mixkit — Sound Effects Free License)

| Element | Źródło | Licencja | Użycie |
|---|---|---|---|
| „Light rain atmosphere” (Mixkit SFX #2474, WAV 24 bit) | https://mixkit.co/free-sound-effects/discover/light-rain/ (plik: https://assets.mixkit.co/active_storage/sfx/2474/2474.wav) | Mixkit Sound Effects Free License — dozwolone m.in. „Online marketing ads”, „Social Media video posts” | Deszcz pod pierwszym ujęciem, wycisza się z wejściem światła |
| „Urban city ambience at night” (Mixkit SFX #2678, WAV 24 bit) | https://mixkit.co/free-sound-effects/discover/city-ambience/ (plik: https://assets.mixkit.co/active_storage/sfx/2678/2678.wav) | jw. | Bardzo cicho pod deszczem (0–6 s) |

## Elementy własne

| Plik | Źródło | Prawa |
|---|---|---|
| `public/marka/releaf-logo.png` | Oficjalne logo ReLeaf od zespołu (oryginał: `public/marka/releaf-logo-oryginal.png`; przycięty tylko pusty, przezroczysty margines — piksele i kanał alfa bez zmian) | Własność ReLeaf |
| `public/ui/checkin/*.png` (generowane) | Prawdziwy ekran podlewania z `Main_Front-End/aplikacja.html`, nagrany przez `scripts/nagraj-ui.cjs` (kod aplikacji bez zmian) | Własny kod zespołu |
| `public/fonts/*.woff2` | Plus Jakarta Sans 5.3.0 (`@fontsource/plus-jakarta-sans`) — krój aplikacji | SIL Open Font License 1.1 (`public/fonts/OFL-plus-jakarta-sans.txt`) |
| `public/lut/releaf-grade.cube` | Własny LUT (`scripts/lut.py`) | Własny |

## Pliki źródłowe

Surowe klipy i dźwięki leżą w `surowe/` (nie w repo — licencja Mixkit nie pozwala udostępniać samych plików, tylko gotowy film). `surowe/zrodla.txt` zapisuje adres każdego pobranego pliku. Odtworzenie: pobierz pliki z adresów powyżej pod nazwami z `ujecia.json` i uruchom `npm run ujecia && npm run final`.

## Do potwierdzenia przez zespół

- **Envato Acceptable Use Policy** (do niej odsyłają warunki Mixkit, pkt 9): strona `help.elements.envato.com` nie otworzyła się z tej sesji (ochrona przed botami), więc jej tekstu nie sprawdziłem. Warto przeczytać ją przed publikacją, szczególnie pod kątem pokazywania osób z klipów w reklamie aplikacji o dobrostanie psychicznym. W filmie nikt nie jest pokazany w złym świetle ani jako osoba z problemami: osoby się śmieją, czytają, idą w słońcu.
- **Muzyka wybrana bez odsłuchu.** Utwór dobrałem po opisie i tagach Mixkit oraz po analizie (tonacja durowa, 99 BPM, łagodny wstęp → miękki puls → rozwinięcie, bez agresywnych brzmień). Cięcia są zsynchronizowane z jego taktami. Przed publikacją ktoś z zespołu powinien posłuchać całości; alternatywy na tę samą długość: „Pop 01” (#692), „Echoes Of You” (#624).
- **Pexels i Pixabay** nie zostały użyte: oba serwisy pokazują automatom stronę „Just a moment…” (Cloudflare), a ich API wymaga klucza. Z darmowym kluczem API można dobrać alternatywne ujęcia.
