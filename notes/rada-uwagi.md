# Uwagi rady z 12.11.2026 — lista do przejścia po kolei

## Stan po 13.11.2026 (gałąź `marcel-rada-poprawki`, bez commita)

Marcel zdecydował 13.11.2026: „rób wszystko, co trzeba”, Big Five od 16 lat, rozmowy z Asystentem 30 dni, wpisów kryzysowych nie zapisujemy, bliskie osoby tylko na telefonie. Reszta poniżej to stan każdego punktu po tej sesji. Opis punktów niżej w pliku jest z 12.11 i zostaje jako uzasadnienie.

| Punkt | Stan | Co zrobione albo dlaczego czeka |
|---|---|---|
| 1. Podlewanie kończy się na nastroju | **zrobione i sprawdzone** | Przebieg sprawdzony w Chrome na 375×812, 320×640 i 1280×800. Przy okazji naprawione: przy nastroju 1–3 przyklejony przycisk zasłaniał „Zadzwoń: 116 111” (teraz karta wsparcia sama wjeżdża nad przycisk), na niskich telefonach zasłaniał skalę suwaka, a na komputerze ekran pytań przewijał się w bok. |
| 2. Ekran „Co dziś miało znaczenie?” | czeka na test 20.11 | Zgodnie z rekomendacją rady. Zadanie 7 testu to rozstrzyga. |
| 3. „Miłość” i „Jedzenie” | **zrobione** | Usunięte z podlewania, z katalogu pól w bazie (wyłączone, stare znaczniki kasowane) i z danych pokazowych. |
| 4. „O której do łóżka?” | czeka na test 20.11 | Pytanie dopisane do zadania 7. |
| 5. Protokół testu | **zrobione** | `notes/test-z-nastolatkami.md`: bezpieczeństwo, co powiedzieć przed testem, zadania 7–9, arkusz. Zasady bezpieczeństwa musi potwierdzić dorosły odpowiedzialny za test. |
| 6. Zgoda zasłaniała Testy | **zrobione** | Testy widać od razu, o zgodę pytamy po „Zacznij”, potem test otwiera się sam. |
| 7. Wymuszona zgoda w rejestracji | **zrobione w aplikacji** | Zgoda na dane o zdrowiu jest nieobowiązkowa; prośba wraca przy pierwszym „Podlej roślinkę” i przy „Zacznij”. Zostaje: odciski treści dokumentów (`body_sha256`) przy wersji 1.0. |
| 8. Niski wynik WHO-5 | **zrobione** | „Gotowe” nie zasłania 116 111; pole koloru bez wielkiej liczby; miernik ma końce skali i podpis; drugi niski wynik z rzędu dopisuje zdanie o dorosłym. |
| 9. Big Five 13–15 lat | **zrobione** | Dostępny od 16 lat, w aplikacji i w bazie (`age_required`). |
| 10. Nagroda za wysoki nastrój | **teksty zrobione** | Zielnik i „mały liść” czekają na test 20.11. |
| 11. Tracker za długi | **trzy zmiany zrobione**, reszta po teście 20.11 | Po drugiej radzie (13.11.2026, tylko o Trackerze) w `js/tracker.js`: przy karcie wsparcia z powodu nastroju znika wniosek „Ostatnie dwa tygodnie są trudniejsze” i dopisek „o … mniej niż tydzień wcześniej”; „Co Ci pomaga” pokazuje tylko to, co nie ma już karty w „Co zauważyliśmy”; zdanie pod wykresem wniosku jest opisem wykresu dla czytnika ekranu, nie tekstem na ekranie. Pytania o długość zostają w zadaniu 8. |
| 12. Pytanie na Domu po podlaniu | **zrobione częściowo** | Jest rząd „Co dziś było?” (stuknięcie zapisuje, drugie cofa). Nie ma osobnego pytania w trakcie eksperymentu („Był dziś ruch?”). Miejsce i wygląd rzędu do obejrzenia przez Bartka i Tymka: leży w „Dla Ciebie teraz”, nie w panelu na planecie, żeby nie łamać zasady stałej wysokości panelu. |
| 13. Wejście do „Konto i prywatność” | **zrobione** | Wiersz z ikoną osoby na końcu Domu, także na komputerze (wcześniej nie było go tam wcale). „Wycofaj zgodę” ma 44 px. |
| 14. Słowa o krzywdzie | **zrobione** | Notatka, Skrytka i Asystent pokazują kartę „To nigdy nie jest Twoja wina.” z 116 111 i 112; blog pokazuje podpowiedź. Numery 800 12 12 12 i 800 120 002 niedodane, bo niepotwierdzone. Czy wpis o krzywdzie wolno publikować na blogu: do decyzji zespołu. |
| 15. Obietnice o danych | **zrobione** | Teksty przy usuwaniu konta mówią o dowodzie zgód. Kto ma dostęp do bazy: nadal do decyzji zespołu. |
| 16. Potwierdzenie wniosku po 7 czy 7 i 14 | bez zmian | Zostaje 7, jak w rekomendacji. |
| 17. Progi i teksty wsparcia | poza kodem | Do psychologa. Doszły dwa nowe teksty do zatwierdzenia: karta przy słowach o krzywdzie (`js/moderacja.js`, `KRZYWDA`) i zdanie przy drugim niskim wyniku WHO-5 (`js/testy.js`). |
| 18. Drobiazgi | **zrobione** | Treść pod logo, SOS na stronach prawnych, toast na tytule arkusza, ornament pod strzałką, 44 px, jeden głos („my”), ikony, teksty. Nieruszone: formy „Czułem(-am)” w WHO-5 bez konta (to oficjalne brzmienie kwestionariusza; w teście 20.11 wystarczy konto pokazowe z wybraną formą). |
| 19. Czcionki Google | **zrobione** | Czcionki są w `Main_Front-End/fonts/`, żadna strona nie łączy się z zewnętrznym serwerem. |
| 20. Baza | **w większości zrobione** | Rozmowy z Asystentem 30 dni i funkcja usuwania; brak statusu „kryzys”; brak tabeli bliskich osób; odcisk e-maila z sekretem; odcisk adresu opiekuna w dowodzie zgody; decyzje moderacyjne z odwołaniem, blokada pisania na blogu, status zgłoszenia dla zgłaszającego; sprzątanie według harmonogramu. Testy: 353. Zostaje (wymaga decyzji albo serwera): okresy dla kont nieaktywnych i czekających na opiekuna, `export-data`, ekran zmiany imienia i usuwania pojedynczego podlewania, procedura sprostowania wieku, braki regulaminu (data, wymagania techniczne, adres odwołań), informacja o `localStorage`. |
| 21–23 | poza kodem | Prawnik, zespół, prawdziwy projekt Supabase. Dochodzi: sekret do odcisków przenieść do Supabase Vault i zrobić jego kopię poza bazą. |

Sprawdzone 13.11.2026, wszystko przeszło: `bash narzedzia/sprawdz-baze.sh` (353), `node narzedzia/sprawdz-wnioski.js` (208), `node narzedzia/sprawdz-moderacje.js` (63), `node narzedzia/sprawdz-podlewanie.js` (70), `sprawdz-nakladanie.js`, `sprawdz-kontrast.js`, `sprawdz-kontrast-auth.js`, `sprawdz-niebo.js` oraz przejście rejestracji bez zgody na dane o zdrowiu w Chrome (Playwright). Test kontrastu nie wchodzi w każdy nowy stan (karta przy słowach o krzywdzie, potwierdzenie w arkuszu konta, zaznaczony kafelek „Co dziś było?”); używają one kolorów już sprawdzanych kart. Nic nie było sprawdzane na prawdziwym telefonie ani na prawdziwym projekcie Supabase.

Przy okazji wyszło: zwykły `python3 -m http.server` pozwala przeglądarce mieszać stare pliki z nowymi (podlewanie przestało się otwierać, gdy nowy `checkin.js` dostał stary `moderacja.js`). Do pracy i na test 20.11 jest `python3 narzedzia/serwer.py`, który wyłącza pamięć podręczną.

---

Ten plik jest dla Marcela i dla Claude'a w lokalnej sesji. Wklej go do rozmowy i idźcie punkt po punkcie.

**Co to była za „rada”.** Pięciu niezależnych recenzentów-agentów przeczytało kod i dokumenty z zadania „Testy, zgody, strona prawna, baza” oraz „Spersonalizowane wnioski”: psycholog dzieci i młodzieży, prawnik (RODO, dzieci, DSA), projektantka z głosem nastolatka, inżynier baz danych, statystyk. Psycholog, inżynier i statystyk uruchamiali kod na własnych danych. To nie byli prawdziwi specjaliści: prawdziwy prawnik i psycholog muszą to potwierdzić przed prawdziwymi kontami.

**Jak czytać.** Każdy punkt ma stan:

- **ZROBIONE** — poprawione, w repo, sprawdzone testami. Nic do roboty, jest tu tylko po to, żebyś wiedział.
- **DECYZJA** — trzeba wybrać; pod spodem są warianty i moja rekomendacja.
- **DO ZROBIENIA** — wiadomo co, nikt tego jeszcze nie zrobił.
- **POZA KODEM** — prawnik, psycholog albo zespół.

## Stan repo

- Gałąź robocza: **`marcel-rada-check`** (odbita od `claude/laughing-goldberg-bdhyw3`, zawiera wszystko niżej). Bez pull requesta.
- Commity z poprawkami rady: „Uwagi rady, część 1: baza, testy, konto i dokumenty prawne”, „Uwagi rady, część 2: silnik wniosków w wersji 2”, „Podlewanie kończy się na nastroju” (ten ostatni **niesprawdzony w przeglądarce**, patrz punkt 1).
- Testy przechodziły na commicie „część 2”: `node narzedzia/sprawdz-wnioski.js` (208 sprawdzeń, ok. 6 minut), `bash narzedzia/sprawdz-baze.sh` (321), `node narzedzia/sprawdz-kontrast.js`, `node narzedzia/sprawdz-nakladanie.js`.
- Nic nie było sprawdzane na danych prawdziwych osób ani na prawdziwym projekcie Supabase.
- Zasady wniosków, pomiary i tabela „co zmieniła rada”: `notes/wnioski.md`, rozdziały 6, 11 i 12.

---

# Część A. Do przejścia po kolei

Kolejność: najpierw to, co dotyczy testu z nastolatkami 20.11, potem reszta.

## 1. Podlewanie kończy się na nastroju — ZROBIONE W KODZIE, DO SPRAWDZENIA

- **Kto:** projektantka (blokuje test 20.11).
- **Problem:** do deszczu było 6 stuknięć i 4 ekrany (Podlej → suwak → Dalej → Pomiń → Pomiń → Podlej roślinkę). Zadanie 2 w `notes/test-z-nastolatkami.md` wymaga 10 sekund.
- **Decyzja Marcela (12.11):** „Skróć do nastroju”.
- **Co jest w kodzie** (`js/checkin.js`, `css/app.css`):
  - na ekranie nastroju główny przycisk to „Podlej roślinkę”: zapisuje nastrój i pada deszcz (3 stuknięcia);
  - pod nim tekstowy przycisk „Dodaj więcej: sen, dzień, notatka” prowadzi do pozostałych pytań, które kończą się jak dawniej;
  - bez wybranego nastroju przycisk nie podlewa, tylko pokazuje „Przesuń łodygę, żeby podlać roślinkę.”;
  - na pierwszym ekranie nie ma licznika „1 z 4”;
  - podpowiedź pod pytaniem: „Przesuń łodygę. Im dalej, tym lepszy dzień.”;
  - `narzedzia/sprawdz-kontrast.js` przechodzi do dalszych pytań przez „Dodaj więcej”.
- **Czego NIE zrobiłem:** przebieg nie był uruchomiony w przeglądarce (przerwane). Do sprawdzenia:
  1. 375×812, 320×640 i 1280×800: czy „Podlej roślinkę” i „Dodaj więcej” mieszczą się i mają co najmniej 44 px wysokości;
  2. Dom → „Podlej roślinkę” → suwak → „Podlej roślinkę”: pada deszcz, panel pokazuje „Podlane · N/10”;
  3. stuknięcie bez ruszenia suwaka: prośba zamiast deszczu;
  4. „Zmień” → „Dodaj więcej” → sen → co dziś było → notatka → „Podlej roślinkę”: wpis ma wszystkie pola;
  5. plusy na Domu („+ Sen” itd.) dalej otwierają od razu właściwe pytanie;
  6. `node narzedzia/sprawdz-kontrast.js` i `node narzedzia/sprawdz-nakladanie.js`.
- **Potem:** poprawić opis w `CLAUDE.md` i `AGENTS.md` (jest tam „Questions: mood…; each one can be skipped”) oraz kryterium zadania 2 w `notes/test-z-nastolatkami.md`.

## 2. Krok „Co dziś miało znaczenie?” jest ścianą — DECYZJA

- **Kto:** projektantka (blokuje test 20.11, ale po punkcie 1 ten ekran jest już opcjonalny).
- **Problem:** trzy prawie identyczne nagłówki („Co dziś miało znaczenie?”, „Co dziś było?”, „Jak poszło?”), 6 kafelków i 18 przycisków, ekran ma 1128 px przy oknie 812 px. Przyciski „Ciężko / Ok / Dobrze” mają 65×38 px (poniżej 44).
- **Propozycja:** jedna lista kafelków wielokrotnego wyboru (ruch, na dworze, znajomi, hobby, odpoczynek, szczera rozmowa, coś dla kogoś, plecak na jutro) i osobny krótki rząd „Co dziś ciążyło?” (dom, znajomi, nauka). Jeden nagłówek „Co dziś było?” i podpowiedź „Stuknij, co pasuje. Nic nie musisz.”
- **Uwaga techniczna:** to zmienia dane. Dziś obszary mają −1 / 0 / 1; po zmianie byłoby „było dobrze” (kafelek) i „ciążyło” (kafelek). Silnik (`js/wnioski-dane.js`: `area('friends', 1)`, `area('family', -1)`) da się do tego dopasować, baza też (`checkin_tags` przyjmuje wartości −1..1), ale trzeba przejść `wnioski-dane.js`, generator zasiewu, `test.sql` i demo w `tracker.js`.
- **Rekomendacja:** zrobić, ale po teście 20.11 albo z Bartkiem i Tymkiem, bo to ich ekran.

## 3. Pola „Miłość” i „Jedzenie” w podlewaniu — DECYZJA

- **Kto:** psycholog, projektantka, prawnik (trzy osoby niezależnie).
- **Problem:** oba pola są zbierane codziennie, a nic z nich nie korzysta (czynnik „jedzenie” usunąłem, miłości nigdy nie analizowaliśmy). To łamie własną zasadę „zbieramy tylko to, z czego powstaje wniosek” i art. 5 ust. 1 lit. c RODO. Psycholog: codzienna ocena jedzenia podtrzymuje skupienie na nim, a przy restrykcjach „dobrze” może znaczyć „udało się nie jeść”.
- **Warianty:**
  - a) usunąć oba pola (rekomendacja moja i rady);
  - b) zostawić „Jedzenie” i dodać kartę wsparcia przy „ciężko” 5 razy w 14 dni, tekst psychologa: „Widzę, że z jedzeniem bywa ostatnio ciężko. Jeśli chcesz o tym pogadać, 116 111 jest całą dobę.”
- **Co ruszyć przy usuwaniu:** `js/checkin.js` (`AREAS`), `js/wnioski-dane.js` (`AREAS`), `node narzedzia/baza/generuj-dane-wnioskow.js`, `narzedzia/baza/test.sql` (jeśli używa kodów `food` / `love`), demo w `js/tracker.js`, symulator w `narzedzia/sprawdz-wnioski.js`, opisy w `CLAUDE.md`, `AGENTS.md`, `notes/CLAUDE.md`, `notes/wnioski.md`, tabela danych w `polityka-prywatnosci.html`.

## 4. Pytanie „O której do łóżka?” — DECYZJA

- **Kto:** projektantka („wycięłabym”).
- **Problem:** trzecia grupa w kroku o śnie, 12 przycisków na ekranie, dubluje godziny snu.
- **Co się z tym wiąże:** z tego pola korzysta czynnik `spac_wczesnie` i jedyny eksperyment o śnie („3 wieczory z pójściem do łóżka przed 23”; długość snu celowo nie jest eksperymentem). Wycięcie pola = wycięcie tego czynnika i eksperymentu.
- **Rekomendacja:** zostawić do testu 20.11 (krok jest teraz opcjonalny), zapytać testerów.

## 5. Protokół testu 20.11 — DO ZROBIENIA (`notes/test-z-nastolatkami.md`)

- **Kto:** psycholog i projektantka.
- **Bezpieczeństwo (psycholog):**
  - przy teście ma być dorosły (dziś prowadzi go dwóch uczniów);
  - zgody opiekunów poniżej 16 lat na piśmie;
  - ustalić, co robi prowadzący, gdy tester coś ujawni;
  - testerzy nie wpisują prawdziwych danych i nie robią WHO-5 „na serio”.
- **Przed testem powiedzieć (projektantka):** „dane w Trackerze i testach są wymyślone, nie Twoje” (ekran wita „Dzień dobry, Ola!” i pokazuje „71 wpisów”); wynik testu samopoczucia nie jest prawdziwy, bo losowe odpowiedzi mogą dać ekran wsparcia.
- **Plan ma stary tytuł** („Żywa planeta”) — dziś domyślna jest „Ścieżka”.
- **Zadanie 2:** po punkcie 1 kryterium 10 sekund znów ma sens. Zapisać też, czy osoba weszła w „Dodaj więcej”.
- **Nowe zadania (dochodzi 4–5 minut; zadanie 3 „Chaos” połączyć z pytaniem końcowym):**
  - **7. Co dziś było (1 min).** Po deszczu: „Dopisz, że miałeś/miałaś dziś trening i widziałeś/widziałaś się ze znajomymi.” Zaliczone: do 30 s bez pomocy. Potem: „Co byś stąd wyrzucił(a)? Czego brakuje?”
  - **8. Karta wniosku (1,5 min).** Tracker, karta „W dni z ruchem bywa Ci lepiej”: „Powiedz swoimi słowami, co ta karta mówi. Co znaczy napis w szarej pigułce? Co byś stuknął/stuknęła?” Zaliczone: „jak się ruszam, czuję się lepiej”. Sygnał ostrzegawczy: „każe mi ćwiczyć”, „ocenia mnie”, „gada jak pedagog”. U dwóch osób to samo dla `?wnioski=start`: „Wrócił(a)byś tu jutro? Po co?”
  - **9. Zgoda i test (2 min).** „Zrób test samopoczucia.” Obserwować, czy czyta kartę zgody i czy znajduje przycisk. Po wyniku: „Na co się zgodziłeś/zgodziłaś? Co znaczy ten procent? Gdzie byś to cofnął/cofnęła?” (30 s na znalezienie „Konto i prywatność”). Zaliczone u 4 z 5: wie, że aplikacja zapisuje wpisy i wyniki oraz że da się to cofnąć.
  - **Arkusz:** kolumny „7. czas / co wyrzucić”, „8. własnymi słowami”, „9. zgoda: czytał? / rozumie? / znalazł cofnięcie?”.

## 6. Zgoda przed testami zasłania testy — DECYZJA (dotyczy testu 20.11)

- **Kto:** projektantka.
- **Problem:** bez zgody zakładka Testy zaczyna się od trzech akapitów i checkboxa, a „Zgadzam się” chowa się za krajobrazem; testy widać dopiero po przewinięciu, wyszarzone. Plan testu każe czyścić dane, więc zobaczy to każdy tester.
- **Propozycja:** najpierw karta testu, a zgoda dopiero po „Zacznij”, jako ten sam arkusz co po wycofaniu zgody (`Konto.open('zgoda')`).
- **Pliki:** `js/testy.js` (karta zgody ok. linii 149–160), `js/konto.js`.
- **Rekomendacja:** zrobić przed 20.11.

## 7. Zgoda na dane o zdrowiu w rejestracji jest wymuszona — DECYZJA

- **Kto:** prawnik (blokuje start z prawdziwymi kontami, nie test 20.11).
- **Problem:** bez zaznaczenia zgody nie da się założyć konta, a polityka mówi „zgoda jest dobrowolna, reszta aplikacji działa”. Zgoda warunkująca usługę nie jest dobrowolna (art. 7 ust. 4 RODO).
- **Propozycja:** w rejestracji zgoda opcjonalna („Nie teraz” → konto bez podlewań, prośba wraca przy pierwszym „Podlej roślinkę”). Baza już to obsługuje (`give_consent` przyjmuje dowolny podzbiór), prototyp też (po wycofaniu zgody „Podlej” pokazuje prośbę).
- **Do tego:** odcisk treści zgody w `legal_documents.body_sha256` (kolumna jest, pusta); „Zapoznałem(-am) się z polityką prywatności” zamiast „akceptuję” (polityka to informacja, nie umowa).
- **ZROBIONE z tego punktu:** treść zgody jest jedna w trzech miejscach (`js/zgody.js`, `rejestracja.html`, `polityka-prywatnosci.html`) i mówi o automatycznej analizie.

## 8. Niski wynik WHO-5 — częściowo ZROBIONE, reszta DECYZJA

- **Kto:** projektantka, psycholog.
- **ZROBIONE:** przy wyniku w paśmie wsparcia nie ma porównania „O 44 mniej niż…”; kolejność przycisków to 116 111 → bliskie osoby → Asystent; nowe teksty pasm (bez „Zadbaj o podstawy”).
- **Otwarte:**
  - przyklejone „Gotowe” zasłania „Zadzwoń: 116 111” na pierwszym ekranie wyniku;
  - przez 14 dni polem koloru zakładki jest wielkie „20 %” z opadłym słupkiem (wygląda jak ocena);
  - „60 %” nie mówi, procent czego; obok w Trackerze jest „6,9/10”; miernik nie ma punktu odniesienia;
  - brak eskalacji: dwa wyniki ≤ 28 z rzędu dają ten sam tekst. Psycholog proponuje dopisać zdanie o dorosłym, jak w Trackerze („To trwa już dłużej. Warto powiedzieć o tym dorosłemu, któremu ufasz…”).

## 9. Big Five dla 13–15 lat — DECYZJA

- **Kto:** psycholog.
- **Problem:** test był badany na osobach 16–83 lata; progi 34/67 są arbitralne; cztery pytania mierzą też aktualny stan, a wynik wraca jako „cecha”.
- **ZROBIONE:** nazwy „Emocje” i „Wyobraźnia” (zamiast „Stabilność emocjonalna” i „Intelekt”), czytnik ekranu nie czyta liczby, zdanie „To obraz z dziś, nie etykieta”, złagodzony opis silnych emocji, dopisek „od 16 lat” także wtedy, gdy nie ma konta.
- **Do wyboru:** a) zostawić jak jest (dopisek dla młodszych); b) test dostępny od 16 lat.
- **Rekomendacja:** b) jest bezpieczniejsze; a) jest do obrony, jeśli psycholog zespołu się zgodzi.

## 10. Nagroda za wysoki nastrój — DECYZJA

- **Kto:** psycholog.
- **Problem:** cała detekcja opiera się na szczerej liczbie, a aplikacja nagradza wysoką: „Super! Roślinka zakwita.”, „Wspaniale! Pełny rozkwit.” (`js/checkin.js` i `js/nastroj.js`, teksty pod suwakiem dla 8–10), kwiat w Zielniku „im lepszy tydzień, tym pełniejszy” (`js/tracker.js`, `herbarium`).
- **Propozycja tekstów:** 8 „Dobrze to słyszeć.”, 9 „Fajnie. Zapamiętaj, co dziś pomogło.”, 10 „Cieszę się razem z Tobą.” Kwiat w Zielniku jednakowy, bo nagrodą jest samo podlanie.
- **Powiązane, już w `notes/CLAUDE.md` jako otwarte:** „mały liść = gorszy dzień” (zadanie 4 testu).
- **Rekomendacja:** teksty zmienić od razu (drobne); Zielnik i liść zostawić do wyniku testu 20.11.

## 11. Tracker jest za długi i mówi to samo dwa razy — DECYZJA

- **Kto:** projektantka.
- **Problem:** pełny Tracker to ok. 4,5 ekranu; ruch, przyjaciele i sen są najpierw kartami w „Co zauważyliśmy”, potem paskami w „Co Ci pomaga”. Karta wniosku ma siedem elementów; zrozumiałe są tytuł, wykres i zdanie.
- **Propozycje:**
  - „Co Ci pomaga” tylko jako przypięte („Pasuje do mnie”) albo wcale;
  - jedna główna akcja na karcie;
  - „wiedza ogólna” („Wielu osobom pomaga…”) do wycięcia albo jedna pozycja po 7 podlaniach — brzmi jak ulotka;
  - na starcie licznik jako 7 pąków („4 z 7”) zamiast zdania;
  - słowa pewności: „Na razie tak to wygląda · 14 wpisów” i „Widać to wyraźnie · 71 wpisów” zamiast trzech stopni. Statystyk potwierdza z innej strony: trzy stopnie słabo rozróżniają (wniosek, który przeszedł, zwykle od razu jest „Dość wyraźnie”).
- **ZROBIONE:** „N wpisów” zamiast „z N dni”; „Cofnij” po „Nie pasuje”; krótsze teksty czekania; tytuły opisowe.
- **Rekomendacja:** zapytać o to w zadaniu 8 testu i zdecydować po 20.11.

## 12. Eksperyment: pytanie na Domu po podlaniu — DO ZROBIENIA (propozycja)

- **Kto:** projektantka.
- **Problem:** podlewanie nie przypomina o trwającym eksperymencie; po punkcie 1 większość osób nie wejdzie w „Co dziś było?”, więc eksperyment i wnioski dostaną mniej danych.
- **Propozycja:** po deszczu, na Domu pod „Podlane”, jeden rząd kafelków „Co dziś było?” (stuknięcie zapisuje, bez nowego ekranu). W trakcie eksperymentu ten rząd zadaje jedno pytanie: „Był dziś ruch? Tak / Nie dziś”.
- **Dlaczego ważne po punkcie 1:** skrócone podlewanie daje sam nastrój. Bez tego rzędu silnik wniosków będzie miał mało znaczników. To najważniejszy skutek uboczny decyzji z punktu 1.
- **Pliki:** `js/dom-uklad.js` (`buildD`, panel `done`), `window.Podlewanie.save({ acts })`.
- **ZROBIONE:** słowo „eksperyment” zamiast „próba”; karta mówi, z którego pytania liczymy; po starcie strona przewija się do karty; wynik po tygodniu jest opisem bez liczby.

## 13. Wejście do „Konto i prywatność” jest schowane — DECYZJA

- **Kto:** projektantka.
- **Problem:** mały link na samym końcu Domu; brak ikony profilu albo ustawień, a tam nastolatek szuka „usuń konto”. „Wycofaj zgodę” to podkreślony tekst 101×40 px.
- **ZROBIONE:** jedna nazwa wszędzie („Konto i prywatność”).
- **Propozycja:** wejście z górnego paska Domu albo z arkusza „Twoja roślinka”. Uwaga na zasadę „spokojna scena”: górny pasek ma dziś tylko logo, Asystenta i SOS.

## 14. Słowa o krzywdzie w notatce i w Skrytce — DO ZROBIENIA

- **Kto:** psycholog (krytyczne).
- **Problem:** `js/moderacja.js` łapie tylko samobójstwo i samookaleczenie. Notatka „tata mnie bije” przechodzi bez reakcji.
- **Propozycja:** kategoria „krzywda” (bicie, strach przed domem, dotyk) z tą samą kartą wsparcia co przy trudnym domu (tekst w `js/wnioski-dane.js`, czynnik `rodzina_ciezko`, pole `wsparcie`): 116 111, „to nigdy nie jest Twoja wina”, 112.
- **Do rozważenia przez zespół:** numery 800 12 12 12 i 800 120 002 (Niebieska Linia). Nie są z plików projektu, trzeba je potwierdzić.

## 15. Obietnice o danych w tekstach aplikacji — DO ZROBIENIA

- **Kto:** prawnik, psycholog.
- `js/konto.js:101` „Twoje dane znikną na zawsze” i `:173` „Twoje dane zniknęły”: po usunięciu konta zostaje dowód zgód (data, wersja, IP, skrót e-maila). Dopisać „poza zapisem, że i kiedy były zgody (szczegóły w polityce)”.
- **ZROBIONE:** „Inni użytkownicy nie widzą wyniku” zamiast „Widzisz to tylko Ty”; ostrzeżenie przy „Pobierz moje dane”; regulamin i polityka mówią uczciwie o dowodzie zgód i o skrócie e-maila.
- **Do decyzji zespołu:** kto ma techniczny dostęp do bazy (polityka ma w tym miejscu `[do uzupełnienia]`). Zespół to uczniowie, być może ze szkoły użytkowników.

## 16. Potwierdzenie wniosku: po 7 dniach czy po 7 i 14 — DECYZJA

- **Kto:** statystyk.
- **Liczby (moje pomiary, 120 i 80 symulowanych osób):**

| | po 7 dniach (jest teraz) | po 7 i 14 dniach |
|---|---|---|
| fałszywy wniosek kiedykolwiek w 3 miesiące | 22% | 12% |
| prawdziwa zależność (sen +1,2) widoczna w dniu 90 | 66% | 54% |
| połowa osób widzi ją po raz pierwszy | ok. 50. dnia | ok. 57. dnia |

- **Zmiana:** jedna linia, `PROGI.potwierdzenie` w `js/wnioski-dane.js` (`[7]` → `[7, 14]`), potem `node narzedzia/sprawdz-wnioski.js`.
- **Rekomendacja:** zostawić 7. Radzimy tylko zdrowe rzeczy, więc fałszywy wniosek mało szkodzi, a brak wniosków przez dwa miesiące szkodzi produktowi.

## 17. Progi i teksty wsparcia — POZA KODEM (psycholog), drobne DO ZROBIENIA

- **Do zatwierdzenia przez prawdziwego psychologa albo pedagoga przed prawdziwymi kontami:**
  - teksty wsparcia w `js/wnioski.js` (`supportRule`) i `js/wnioski-dane.js` (pole `wsparcie` przy `rodzina_ciezko` i `przyjaciele_ciezko`);
  - teksty w `js/checkin.js` (pod suwakiem, karta „Ciężki dzień?”, karta przy słowach kryzysowych);
  - opisy pasm WHO-5 i pięciu cech w `js/testy-dane.js`; arkusz SOS.
- **Progi do potwierdzenia** (`PROGI` w `js/wnioski-dane.js`), z pomiarem na symulacji:
  - 3 dni z nastrojem ≤ 3 w tygodniu;
  - dwa tygodnie ze średnią ≤ 4,5 → „Od dłuższego czasu jest Ci ciężko”; u osoby ze zwykłym nastrojem ok. 4,8 karta jest na ok. 15% dni;
  - ostatni tydzień o 1,5 poniżej własnej mediany → „Ostatnio jest Ci trudniej niż zwykle”; pojawia się choć raz w 3 miesiące u co trzeciej osoby ze zwykłymi wahaniami, na ok. 1% dni;
  - „ciężko” w domu albo ze znajomymi 4 razy w 14 dni.
- **Propozycje psychologa, niezbudowane:** znacznik „chory/a dziś” (żeby choroba nie udawała efektu braku ruchu); blokada albo dyskretny tryb ekranu (rodzic może zobaczyć kartę na telefonie dziecka); kilkudniowy okres na cofnięcie usunięcia konta (impuls w kryzysie; pytanie do prawnika).

## 18. Drobiazgi wizualne i językowe — DO ZROBIENIA

- **Kto:** projektantka (zrzuty 375×812, 360×640, 320×640).
- Treść przebija pod logo w górnym pasku (Tracker z rozwiniętą kartą, historia testów).
- SOS na stronach prawnych zasłania nagłówki (`polityka-prywatnosci.html`).
- Toast po wycofaniu zgody zakrywa tytuł arkusza „Konto i prywatność”.
- Ornament karty wchodzi na strzałkę wiersza „Usuń historię testów”.
- „Skąd to może się brać?” ma 34 px wysokości (cel: 44).
- Bez konta (czyli w teście 20.11) zdania WHO-5 mają formę „Czułem(-am) się wesoły(-a)”.
- „Co zauważyliśmy” (my) obok „Zbieram / Sprawdzam / Porównuję” (ja): wybrać jedno.
- Ikona „Odpoczynek” wygląda jak dzwonek; „Coś dla kogoś” to to samo serce co „Miłość” i SOS.
- Teksty z tabeli projektantki, których nie ruszałem: „Jak minęła noc?” podpowiedź → „Na oko wystarczy.”; `js/testy.js` „Rozmowa naprawdę może pomóc…” → „Wybierz, co Ci teraz pasuje.”; „Pytania dotyczą dwóch tygodni, więc warto dać im czas.” → „Test pyta o dwa tygodnie, więc częściej nic nowego nie pokaże.”; `js/konto.js` „możliwość ponownej zgody — kiedy zechcesz” → „zgodę możesz włączyć z powrotem, kiedy chcesz”. Sprawdzić, które są jeszcze aktualne.
- **ZROBIONE:** karta wsparcia w Trackerze ma zaokrąglenia jak inne karty.

## 19. Czcionki Google — DO ZROBIENIA

- **Kto:** prawnik.
- **Problem:** każda strona, także polityka prywatności, pobiera czcionki z serwerów Google, więc adres IP nastolatka trafia do Google przed jakąkolwiek informacją. Nie ma tego w „Komu przekazujemy”.
- **Zmiana:** hostować Bricolage Grotesque i Figtree lokalnie w `Main_Front-End/` (jest w 11 plikach HTML). Sprawdzić licencję (obie są na SIL OFL, więc wolno).

## 20. Baza: co jeszcze zostało — DO ZROBIENIA / DECYZJA

Najpierw kontekst: inżynier nie znalazł sposobu, żeby jedno konto przeczytało albo zmieniło cudze dane o zdrowiu. Znalazł 14 mniejszych spraw; poprawione są wszystkie poza poniższymi.

- **Rozmowy z Asystentem:** są usuwane przy wycofaniu zgody (zrobione), ale nie mają okresu przechowywania ani przycisku „usuń rozmowy”. Decyzja: np. 30 dni albo nie zapisywać historii.
- **Wpisy na blog ze statusem „kryzys”:** niepublikowany tekst o myślach samobójczych zostaje na serwerze przy autorze. Prawnik: nie zapisywać wcale (werdykt wraca, treść zostaje na telefonie). W polityce jest `[do decyzji]`.
- **Bliskie osoby:** „umowa” nie może być podstawą dla danych osoby trzeciej. Najprościej trzymać kontakty tylko na telefonie i usunąć tabelę `trusted_contacts`.
- **DSA (blog to hosting):** brak tabeli decyzji moderacyjnych (powód, czy automat, odwołanie), zgłaszający nie widzi statusu swojego zgłoszenia, brak mechaniki blokady konta zapowiedzianej w regulaminie.
- **Dowód zgody opiekuna:** wiersz `guardian` nie ma żadnego identyfikatora opiekuna, a `guardian_requests` znika z kontem. Dodać `guardian_request_id` albo skrót e-maila opiekuna.
- **Retencja:** brak zasad dla kont nieaktywnych, kont czekających bez końca na opiekuna, e-maili opiekunów po wygaśnięciu 14 dni; `purge_orphaned_records` nie jest zaplanowane (`pg_cron`).
- **Skrót e-maila** w dowodzie zgód to sha256 bez soli (da się sprawdzić słownikiem); lepszy HMAC z sekretem.
- **Eksport danych:** dziś to zrzut `localStorage`; funkcji `export-data` na serwerze nie ma, zdarzenia `data_exported` nic nie zapisuje.
- **Polityka obiecuje, czego UI nie ma:** „imię zmienisz w aplikacji” (nie ma takiego ekranu), usuwanie pojedynczego podlewania (baza ma `delete_checkin`, UI nie), sprostowanie wieku (rok urodzenia jest niezmienialny, potrzebna procedura).
- **Regulamin:** pusta data obowiązywania (`data-od=""`), brak wymagań technicznych i wyraźnego zakazu treści bezprawnych, pusty adres do odwołań.
- **Informacja o `localStorage`** w wersji web (prawnik nie był pewien, czy jest obowiązkowa).

---

# Część B. Poza kodem

## 21. Prawnik — przed pierwszym prawdziwym kontem

Test 20.11 na samym prototypie (dane tylko w przeglądarce) tych blokad nie dotyczy, o ile nie powstają konta w Supabase.

1. **Kto jest administratorem danych.** Nie może nim być grupa uczniów; potrzebna osoba prawna (szkoła, fundacja, spółka). Czy wyznaczyć inspektora ochrony danych. Kto pełnoletni ma dostęp do bazy i kto moderuje blog.
2. **DPIA** (ocena skutków, art. 35 RODO, obowiązkowa: dane o zdrowiu, dzieci, profilowanie) i rejestr czynności.
3. **Osoby 13–17 lat:** czy darmowe konto mieści się w „drobnych bieżących sprawach” (art. 20 KC); czy zgoda opiekuna obejmuje konto, czy tylko dane o zdrowiu; co działa przed potwierdzeniem; czy 16–17-latek sam ważnie zgadza się na dane o zdrowiu.
4. **Weryfikacja opiekuna.** Dziś wystarczy drugi własny adres e-mail. Minimum według prawnika: imię i nazwisko opiekuna, oświadczenie, że jest przedstawicielem ustawowym, potwierdzenie z opcją cofnięcia. Informacja dla opiekuna (art. 14), treść e-maila i dokumentu `guardian`. Czy rodzic może żądać dostępu do danych dziecka.
5. **Zakres zgody:** czy wnioski mają osobny przełącznik („dziennik bez analizy”); podstawa dla treści o zdrowiu na blogu i w Skrytce.
6. **Kalibracja progów na prawdziwych danych:** osobna zgoda albo anonimizacja.
7. **Dowód zgód:** 3 lata czy inaczej; czy IP i rodzaj przeglądarki są potrzebne; podstawa prawna po usunięciu konta.
8. **Dostawcy:** Supabase (spółka amerykańska; „Frankfurt” nie zamyka tematu transferu), model AI (umowa powierzenia, brak trenowania na danych, czy regulamin dopuszcza osoby poniżej 18 lat), poczta, powiadomienia.
9. **Klucz Skrytki.** Logowanie kodem z e-maila nie daje sekretu, z którego powstałby klucz. Albo klucz jest tylko na urządzeniu (nowy telefon = utrata Skrytki, trzeba to napisać), albo obietnica „nie możemy jej przeczytać” jest nieprawdziwa. W polityce jest teraz czas przyszły i `[do uzupełnienia]`.
10. **Zawiadamianie służb** (DSA art. 18, art. 240 KK) i zgodne z tym brzmienie obietnicy „nikogo nie zawiadamiamy”. W dokumentach jest już wyjątek z dopiskiem `[do potwierdzenia przez prawnika]`. Czy zespół podlega standardom ochrony małoletnich.
11. **Wyrób medyczny i AI Act:** trzymać się słów „samopoczucie, podpowiedź”; bez „monitoruje”, „wykrywa”, „depresja”. Opis zabezpieczeń Asystenta dla małoletnich.
12. **Licencja WHO-5** (CC BY-NC-SA 3.0 IGO: tylko niekomercyjnie). Przy jakimkolwiek modelu płatnym potrzebna zgoda WHO albo inne narzędzie.
13. **Retencja:** kopie zapasowe (liczba dni), konta nieaktywne, rozmowy z Asystentem.

## 22. Zespół

- Kto jest dorosłym odpowiedzialnym za bezpieczeństwo, gdy nastolatek ujawni krzywdę? Czy aplikacja z zasady nikogo nie powiadamia?
- Czy członkowie zespołu mają wgląd w dane rówieśników w bazie?
- Które numery pomocowe są potwierdzone (116 111, 112; do rozważenia 800 12 12 12 i Niebieska Linia 800 120 002)?
- Co dokładnie widzi opiekun w e-mailu o zgodzie? Co z dzieckiem, które nie może poprosić rodzica?
- Kto zatwierdza teksty wniosków i wsparcia?

## 23. Do sprawdzenia dopiero na prawdziwym projekcie Supabase

- Czy rola `postgres` może usuwać z `auth.users` z funkcji `security definer` i założyć tam wyzwalacz.
- Które nagłówki z adresem IP naprawdę przychodzą (`cf-connecting-ip`, kształt `x-forwarded-for`), także z Edge Function.
- Czy `btree_gist` nie jest już w innym schemacie; która rola tworzy rozszerzenia. Po każdym nowym rozszerzeniu potrzebne jest jawne `grant execute … to public` (schemat odbiera to domyślnie).
- Domyślne uprawnienia obiektów tworzonych z panelu (`supabase_admin`) kontra z migracji (`postgres`).
- Czy schemat `private` nie trafia do „Exposed schemas” ani do GraphQL.
- Prawdziwe wywołania RPC przez `supabase-js` (lokalnie była tylko emulacja).
- Logowanie anonimowe i telefoniczne musi być wyłączone (taki użytkownik ma rolę `authenticated` i nie ma e-maila).
- Token po `delete_my_account` żyje do wygaśnięcia (lokalnie kończy się błędem, bez szkody).
- `pg_cron` dla `purge_orphaned_records`, retencja kopii zapasowych, ostrzeżenie lintera o widokach `blog_posts` / `blog_comments`.

---

# Część C. Co rada kazała zmienić i co już jest zrobione (do wiadomości)

**Baza (inżynier, prawnik):**
- 16-latek był blokowany jak osoba bez zgody opiekuna → wiek liczony od daty założenia konta.
- Wycofanie zgody mogło się ścigać z zapisem testu albo podlewania → blokada wierszy zgody na czas zapisu.
- Odpowiedzi mogły być policzone kluczem innej wersji testu → `submit_test` dostaje wersję i odrzuca niezgodną.
- Widoczne kolumny z IP, skrótem tokenu i werdyktem moderacji → uprawnienia na kolumny.
- Cofnięcie zgody przez opiekuna nic nie usuwało → `withdraw_guardian_consent`, te same wyzwalacze usuwania; usuwane są też rozmowy z Asystentem.
- IP w dowodzie zgody dało się podrobić → bierzemy ostatni adres z nagłówka.
- Bezpośrednie kasowanie omijało resztę mechanizmu, klient mógł zapisać dowolnie duże dane, „dziś” zależało od strefy ustawionej przez użytkownika → zamknięte.
- Dziury w głosach, zgłoszeniach i tokenach powiadomień → zamknięte.
- Ślad po usunięciu danych nie zawiera już liczb podlewań ani nazwy testu.
- Testy bazy: usunięte pseudo-sprawdzenia, test uprawnień całego katalogu funkcji; razem 321.

**Testy i konto (psycholog, projektantka):** punkty 8, 9, 13 i 15 wyżej.

**Dokumenty prawne (prawnik):** nowy rozdział o wnioskach jako automatycznej analizie (profilowaniu); pełna lista zbieranych danych; rozmowy z Asystentem pod zgodą; uczciwy opis dowodu zgód, kopii zapasowych i Skrytki; wyjątek od „nikogo nie zawiadamiamy”; regulamin nie mówi już, że treści „nie są dopasowane do Ciebie”.

**Silnik wniosków (statystyk, psycholog):** pełna tabela w `notes/wnioski.md`, rozdział 11. W skrócie: potwierdzenie po tygodniu, bloki przypięte do kalendarza, test warunkowy dla czynników chodzących w parze, pokazywana różnica po poprawkach, opis zamiast „obserwacji”, eksperyment bez wyroku, trudny dom i znajomi jako karta wsparcia zamiast wniosku, dwie nowe reguły wsparcia, tytuły opisowe, „Co Ci pomaga” tylko z rzeczy, na które ma się wpływ.

**Co statystyka nie naprawi (uczciwie):** jeśli w lepszy dzień ktoś częściej się rusza, „W dni z ruchem bywa Ci lepiej” wyjdzie także bez żadnego wpływu ruchu. Dlatego tytuły tylko opisują. Jedyny sposób, żeby to rozdzielić, to eksperyment, w którym dni losuje aplikacja („dziś spróbuj / dziś bez”); niezbudowane.
