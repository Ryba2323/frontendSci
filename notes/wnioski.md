# Spersonalizowane wnioski (insighty) — jak to działa

Stan na 12.11.2026, **wersja 2 silnika**: po recenzji pięciu niezależnych recenzentów („rada”: psycholog, prawnik, projektantka, inżynier baz, statystyk). Co zmieniła rada, jest w rozdziale 11. To propozycja Marcela do potwierdzenia przez zespół. Wszystko, co tu opisane, jest zbudowane w prototypie i sprawdzone na danych symulowanych. **Nie było jeszcze sprawdzane na danych prawdziwych osób** i nie jest podłączone do Supabase.

Cel: aplikacja ma umieć powiedzieć konkretnej osobie „w dni, kiedy X, zwykle czujesz się lepiej” i zaproponować, co z tym zrobić. Ma to robić tak, żeby dało się temu ufać i żeby nikomu nie zaszkodzić.

## 1. Gdzie co jest

| Co | Plik |
|---|---|
| Silnik: dni podlewania → wnioski (czyste funkcje, bez ekranu) | `Main_Front-End/js/wnioski.js` |
| Katalog: co zbieramy, jakie czynniki sprawdzamy, wszystkie teksty i progi | `Main_Front-End/js/wnioski-dane.js` |
| Ekran (Tracker) | `Main_Front-End/js/tracker.js`, `css/wnioski.css` |
| Zbieranie danych (podlewanie) | `Main_Front-End/js/checkin.js` |
| Baza: zapis podlewania, znaczniki, wnioski, eksperymenty (w kodzie „proba”) | `notes/supabase-wnioski.sql`, `notes/supabase-wnioski-dane.sql` (generowany) |
| Test silnika na symulacji | `node narzedzia/sprawdz-wnioski.js` |
| Test bazy | `bash narzedzia/sprawdz-baze.sh` |

Silnik jest jeden. Dziś działa w przeglądarce, docelowo ten sam plik ma liczyć wnioski na serwerze (Edge Function `generate-insights`), żeby telefon i baza zawsze mówiły to samo.

## 2. Zasady, których nie łamiemy

1. **Podpowiedź, nie diagnoza.** Piszemy „bywa”, „zwykle”, „spróbuj i zobacz”. Nigdy „musisz”, „powinieneś”, nigdy nazw zaburzeń. Test sprawdza to automatycznie na wszystkich tekstach.
2. **Nie mówimy, co jest przyczyną.** Widzimy tylko, że dwie rzeczy chodzą razem (w lepszy dzień po prostu łatwiej się ruszyć). Dlatego tytuły opisują: „W dni z ruchem bywa Ci lepiej”, nigdy „Ruch dodaje Ci energii”. Test odrzuca tytuł ze słowami „poprawia”, „dodaje”, „pomaga”, „służy”.
3. **Radzimy tylko rzeczy, które i tak są zdrowe.** Sen, ruch, dwór, ludzie, odpoczynek, hobby. Jeśli dane pokazują odwrotność („w dni z ruchem jest gorzej”), wniosek po prostu nie powstaje. Nigdy nie poradzimy „mniej ruchu” ani „mniej ludzi”.
4. **Trudne sprawy w domu i ze znajomymi nie są wnioskiem.** Nie liczymy dla nich różnicy nastroju, nie ma liczby, wykresu ani „Pasuje / Nie pasuje”. Gdy „ciężko” powtarza się 4 razy w 14 dni, na górze Trackera pojawia się karta wsparcia z neutralnym tytułem „Trudniejsze dni”: „to nie Twoja wina”, 116 111, zaufany dorosły, a przy domu także 112. Żadnego „spróbuj” i żadnego „to mija”.
5. **Nie analizujemy miłości ani jedzenia.** Za wrażliwe na automat: przy restrykcjach „z jedzeniem dobrze” może znaczyć „udało się nie jeść”, a wniosek by to potwierdził. O ilości jedzenia, wadze i wyglądzie nie mówimy nigdy.
6. **Wsparcie ma cztery wejścia** (karta na górze Trackera; kolejność przycisków: 116 111, bliskie osoby, na końcu Asystent, bo to program):
   - 3 dni z nastrojem 3 lub niżej w ostatnim tygodniu (albo średnia z ostatnich pięciu wpisów najwyżej 3,5),
   - **przewlekle**: średnia najwyżej 4,5 i w ostatnim tygodniu, i w tygodniu przed nim (albo 6 bardzo niskich dni w dwa tygodnie); karta dodaje „To trwa już dłużej. Warto powiedzieć o tym dorosłemu, któremu ufasz…”,
   - **spadek względem siebie**: ostatni tydzień o co najmniej 1,5 punktu poniżej własnej mediany i poniżej 6,
   - „ciężko” w domu albo ze znajomymi (zasada 4).
   W cięższym czasie ekran **nie dokłada zadań**: znikają „Spróbuj”, przyciski eksperymentu i zdanie „po gorszym dniu nastrój wraca”.
7. **Żadnej kary.** Eksperyment to nie zadanie do zaliczenia: mniej razy niż plan to „mniej okazji”. Brak danych to „roślinka poczeka”.
8. **Zbieramy tylko to, z czego powstaje jakiś wniosek** (RODO: minimalizacja danych). **Dziś ta zasada jest złamana w dwóch miejscach:** pola „Miłość” i „Jedzenie” są w podlewaniu, a nic z nich nie korzysta. Decyzja zespołu: usunąć je (zalecenie psychologa i projektantki z rady) albo zostawić.
9. **„Co Ci pomaga” i podpowiedź na Domu zawierają tylko rzeczy, na które ma się wpływ.** Dobry czas w domu i lżejsza nauka zostają opisem, bez rady: klimat w domu nie jest zadaniem nastolatka.

## 3. Co zbieramy w podlewaniu

Podlewanie dalej ma 4 kroki i każdy można pominąć. Doszły dwie rzeczy (oznaczone „nowe”).

| Pytanie | Odpowiedź | Po co |
|---|---|---|
| Jak się dziś czujesz? | nastrój 1–10 | wynik, do którego wszystko porównujemy |
| Ile godzin snu? | mniej niż 5 h · 5–6 h · 7–8 h · 9 h i więcej | „po nocy z 7 h snu bywa lepiej” |
| **O której do łóżka?** (nowe) | przed 22 · 22–23 · 23–24 · po północy | „gdy kładziesz się przed 23…” |
| Jak się spało? | źle · tak sobie · dobrze · świetnie | jakość snu |
| **Co dziś było?** (nowe, kilka naraz) | ruch · hobby · odpoczynek · szczera rozmowa · coś dla kogoś · plecak na jutro | rzeczy, na które ma się wpływ |
| Jak poszło? | rodzina, przyjaciele, natura, nauka: ciężko / ok / dobrze (jedzenie i miłość są jeszcze w formularzu, ale nic z nich nie korzysta) | co pomaga, co ciąży |
| Chcesz coś dopisać? | notatka | nie jest analizowana |
| (samo) | dzień tygodnia, godzina wpisu | „niedzielne wieczory” |

Uwagi:

- „Plecak na jutro” działa na **następny** dzień, więc silnik porównuje nastrój dnia po (i odejmuje to, co wynika z nastroju dnia, w którym się pakowało: dobry dzień sam sprzyja i pakowaniu, i kolejnemu dobremu dniu). To jest przykład Marcela („lepiej się czujesz, jak się spakujesz wcześniej”).
- Brak odpowiedzi to nie „nie”. Dzień bez żadnego znacznika jest przy znacznikach pomijany, a nie liczony jako „nic nie było”.
- Przy ocenach „ciężko / ok / dobrze” dni z **przeciwną** oceną nie wchodzą do porównania: „dobrze z przyjaciółmi” porównujemy z dniami „ok” i bez zaznaczenia. Inaczej same dobre dni robiły „wniosek” o trudnych (i na odwrót).
- **Czego na razie nie zbieramy i dlaczego:** miejsca („gdzie”) — pokrywa się z „natura” i „przyjaciele”, a to kolejne pytanie; telefon przed snem — dobre pytanie na później, ale krok o śnie ma już trzy grupy; emocje słowami — osobna funkcja. Nowe pole to jeden wiersz w katalogu (`wnioski-dane.js`) i jeden czynnik, baza nie wymaga zmian tabel.

## 4. Co sprawdzamy (14 czynników)

Każdy czynnik to jedno pytanie: „czy w dni, kiedy X, nastrój jest inny niż w pozostałe?”.

| Ton | Czynniki | Co dostaje osoba |
|---|---|---|
| **pomaga** (ma się na to wpływ) | sen 7 h i więcej, do łóżka przed 23, ruch, wyjście na dwór, czas z przyjaciółmi, szczera rozmowa, coś dla kogoś, hobby, odpoczynek, plecak spakowany wieczorem | wniosek + podpowiedź + miejsce w „Co Ci pomaga” + „Wypróbuj przez tydzień” (poza długością snu: to wynik, nie zachowanie, więc eksperymentem jest pora pójścia spać) |
| **zauważone** | dobrze przespana noc, dobry czas z rodziną (bez rady), nauka szła dobrze, nauka była ciężka | wniosek z opisem; nie trafia do „Co Ci pomaga” |
| **wsparcie** (nie jest wnioskiem) | w domu było trudno, ze znajomymi było trudno | tylko karta wsparcia po 4 takich dniach w dwa tygodnie (zasada 4) |

Poza czynnikami silnik liczy jeszcze:

- **najtrudniejszy dzień tygodnia** („Niedzielne wieczory bywają trudniejsze”) razem z możliwymi powodami policzonymi z danych tej osoby (np. „w nocy przed niedzielą śpisz średnio o 1,1 h krócej”). Powód jest pokazywany tylko wtedy, gdy sam przechodzi test: czynnik idzie u tej osoby w parze z nastrojem (p ≤ 0,05), a w ten dzień jest wyraźnie rzadszy niż w pozostałe (ponad 2 błędy standardowe). Wcześniej połowa kart dostawała powód z przypadku,
- **zmianę z ostatnich dwóch tygodni** (lżej / trudniej niż dwa tygodnie wcześniej): co najmniej 1 punkt i ponad 2 błędy standardowe. Trudniejszy okres zawsze dostaje jedno z trzech miejsc,
- **zdanie otuchy o powrocie po trudnym dniu** („Po gorszym dniu Twój nastrój zwykle wraca w dzień albo dwa”). To nie jest wniosek: tak wychodzi u prawie każdego, także z czystego przypadku, więc nie ma słowa pewności ani karty, tylko jedno zdanie pod listą. Nie pokazujemy go w cięższym czasie.

## 5. Jak powstaje wniosek

1. Bierzemy ostatnie **90 dni**.
2. Od 28 podlań odejmujemy od nastroju typowy poziom danego dnia tygodnia. Dzięki temu „w weekendy jest lepiej” nie udaje wpływu przyjaciół, z którymi widuje się głównie w weekendy.
3. Liczymy różnicę średniego nastroju w dni „z” i „bez”. Musi być co najmniej **0,6 punktu** i iść w oczekiwaną stronę. Każda grupa musi mieć co najmniej 5 dni.
4. Sprawdzamy, czy taka różnica mogła wyjść przypadkiem: test permutacyjny, w którym mieszamy etykiety tylko wewnątrz **tygodni kalendarzowych**. Lepsze i gorsze okresy same z siebie nie tworzą wtedy „zależności”. Bloki są przypięte do kalendarza, a losowanie do czynnika, więc jutro te same dni dają ten sam podział i wniosek nie „miga”.
5. Pytamy o 14 rzeczy naraz, więc pojedynczy traf nie wystarcza: stosujemy poprawkę Benjaminiego–Hochberga.
6. Kierunek musi być ten sam w starszej i w nowszej połowie okresu.
7. **Potwierdzenie po tygodniu.** Wniosek jest pokazywany dopiero wtedy, gdy wychodził też 7 dni wcześniej (`PROGI.potwierdzenie`). Wnioski liczą się codziennie, a traf z przypadku trwa zwykle dzień albo dwa.
8. **Dwa wnioski muszą się bronić osobno.** Długi sen i wczesna pora chodzą w parze. Każdy z pary sprawdzamy przy stałym drugim; zostaje ten, który się broni (gdy żaden, mocniejszy).

Pokazywana liczba to różnica **po** poprawce na dzień tygodnia, ściągnięta w stronę zera i podana jako „około”. Pokazujemy tylko to, co przeszło próg, więc surowa różnica byłaby zawyżona (przy prawdziwym 0,8 wychodziło średnio 1,2). Wykres na karcie pokazuje tę samą liczbę.

Wniosek dostaje słowo pewności, widoczne na karcie razem z liczbą wpisów:

| Pewność | Wymagania |
|---|---|
| **Wstępnie** | od 14 podlań, po 5 dni w grupie, poprawka z progiem 10% |
| **Dość wyraźnie** | od 21 podlań, po 7 dni, próg 5%, zgodne połówki, różnica wyraźnie większa od niepewności |
| **Wyraźnie** | od 40 podlań, po 10 dni, p ≤ 0,001, różnica co najmniej 0,8 |

Uczciwie: słowa pewności słabo rozróżniają. Przy 14 pytaniach naraz wniosek, który w ogóle przeszedł, zwykle od razu spełnia też warunki „Dość wyraźnie”. Do sprawdzenia w teście z nastolatkami, czy trzy stopnie w ogóle coś im mówią.

Poniżej progu wniosku nie ma wcale. Wszystkie liczby są w jednym miejscu: `PROGI` w `wnioski-dane.js`.

Wynik jest powtarzalny: te same dane zawsze dają te same wnioski.

## 6. Ile danych trzeba — uczciwie

Symulacja (`narzedzia/sprawdz-wnioski.js` i pomiary rady; nastrój waha się z dnia na dzień o ok. 1,4 punktu, 15% dni bez wpisu). Tabela pokazuje, jak często silnik pokazuje **prawdziwą** zależność snu (150 osób na komórkę):

| Prawdziwa różnica | 21 dni | 35 dni | 60 dni | 90 dni |
|---|---|---|---|---|
| 0,8 punktu | 0% | 5% | 14% | 31% |
| 1,2 punktu | 0% | 13% | 41% | 65% |
| 2,0 punktu | 0% | 52% | 91% | 99% |

Pierwszy wniosek może się pojawić najwcześniej po około trzech tygodniach (14 podlań + tydzień na potwierdzenie). Przy zależności 1,2 punktu połowa osób widzi go po raz pierwszy około 50. dnia.

A to, jak często powstaje wniosek **z samego szumu** (osoby bez żadnych zależności):

| | zwykły szum | szum z dobrymi i gorszymi tygodniami |
|---|---|---|
| **w danym dniu** (70 dni, 300 osób): jakikolwiek wniosek o czynniku | 4,7% | 4,3% |
| w danym dniu: „dość wyraźnie” lub mocniejszy | 3,0% | 2,7% |
| w danym dniu: „trudny dzień tygodnia” | 7,0% | 5,0% |
| **kiedykolwiek w 3 miesiące**, liczone codziennie (120 osób): wniosek o czynniku | 21,7% | — |
| kiedykolwiek: „dość wyraźnie” lub mocniejszy | 14,2% | — |
| kiedykolwiek: „trudny dzień tygodnia” | 21,7% | — |

Co z tego wynika:

- Duże zależności (2 punkty) widać po miesiącu–dwóch. Typowe (około 1 punktu) potrzebują 2–3 miesięcy i nawet wtedy wyjdą u około dwóch trzecich osób. **Tego nie da się obejść sprytniejszym wzorem** — to kwestia liczby dni.
- **Mniej więcej jedna osoba na pięć zobaczy w ciągu trzech miesięcy wniosek, którego naprawdę nie ma.** Wcześniejsze „jedna na dziesięć” dotyczyło jednego dnia, a wnioski liczą się codziennie; bez potwierdzenia po tygodniu fałszywy wniosek zobaczyłaby kiedyś ponad połowa osób (pomiar statystyka z rady: 58%). Dlatego: (a) radzimy tylko zdrowe rzeczy, więc pomyłka nie szkodzi, (b) ekran mówi wprost, że wniosek może być mylny, (c) każdy wniosek da się schować przyciskiem „Nie pasuje”.
- Ostrzejszy wariant jest gotowy: `potwierdzenie: [7, 14]` obniża „kiedykolwiek” z 22% do około 12%, ale prawdziwy wniosek (sen +1,2) jest w dniu 90 widoczny u 54% osób zamiast 66% i pojawia się tydzień później (mediana: dzień 57 zamiast 50). Pomiar: 120 i 80 symulowanych osób. Decyzja zespołu.
- Test w `sprawdz-wnioski.js` liczy „kiedykolwiek” na 40 osobach (wychodzi 30%, przy tak małej grupie to ten sam wynik co 22% ze 120) i pilnuje, żeby nie wróciło ponad 40%.
- **Czego statystyka nie naprawi:** odwrotnej przyczynowości w tym samym dniu. Jeśli w lepszy dzień ktoś częściej się rusza, „W dni z ruchem bywa Ci lepiej” wyjdzie także bez żadnego wpływu ruchu (w symulacji statystyka u połowy osób). Zdanie jest wtedy nadal prawdziwe jako opis, dlatego tytuły tylko opisują, a ekran mówi, że to nie przyczyna.
- Przy 4 mocnych prawdziwych zależnościach co piąta osoba dostaje do nich jeden wniosek „obcy”. To cena poprawki Benjaminiego–Hochberga (kontroluje odsetek pomyłek wśród wniosków, nie szansę na jakąkolwiek pomyłkę).

## 7. Żeby aplikacja nie milczała przez pierwsze tygodnie

| Kiedy | Co widać w Trackerze |
|---|---|
| 0–6 podlań | „Zbieram pierwsze dni. Jeszcze N podlań i pokażę, co było w Twoich dniach. Bez pośpiechu.” |
| od 7 podlań | podsumowanie tygodnia + **opis ostatnich dwóch tygodni**: „Ruch · 4 z 9 dni”. Sam opis, bez wiązania z nastrojem, tylko dla rzeczy z tonu „pomaga”. |
| od 14 podlań | liczymy wnioski; pokazują się po potwierdzeniu, czyli realnie po około trzech tygodniach. Gdy nie ma: „Na razie nic się wyraźnie nie powtarza. Sprawdzam dalej.” |
| zawsze, gdy lista „Co Ci pomaga” ma mniej niż 3 pozycje | **wiedza ogólna**: „Wielu osobom w Twoim wieku pomaga 8 h snu albo więcej. Sprawdź, jak jest u Ciebie.” Tylko cztery dobrze udokumentowane sprawy: sen, ruch, dwór, kontakt z ludźmi. |

Wcześniejsze „obserwacje” („W Twoje lepsze dni często był ruch (4 z 5)”) zostały usunięte. Pomiar statystyka: z czystego szumu miało je 36–76% osób, a przy prawdziwym wpływie ruchu obserwacja o ruchu wychodziła rzadziej niż o czymś bez wpływu. Żadne progi tego nie naprawiały, więc został sam opis.

## 8. Jak mówimy ludziom, co robić

- **Najwyżej 3 karty naraz** w „Co zauważyliśmy”, z różnych grup (nie dwie o śnie). Kolejność: trudniejsze dwa tygodnie (jeśli są), najmocniejsze „pomaga”, dzień tygodnia, potem reszta.
- Karta pokazuje tytuł, mały wykres i **jedno zdanie** z liczbą („o około 1,1 wyższy”). Powody i podpowiedź są zwinięte pod „Skąd to może się brać?”, żeby ekran był spokojny.
- **„Wypróbuj przez tydzień”** zaczyna **eksperyment** (słowo „próba” w aplikacji o zdrowiu psychicznym źle się kojarzy; w kodzie i w bazie zostało `proba`). Karta mówi, z którego pytania podlewania liczymy („Liczę to z pytania o sen”), i pokazuje „2 z 3”. Po 7 dniach jest **opis tygodnia, nie wyrok**: „W tym tygodniu dni z tym były u Ciebie trochę lepsze. Jeden tydzień niczego nie rozstrzyga. Ważniejsze, jak Ci z tym było.” Bez liczby i bez „to Ci służy”: z czystego przypadku „lepiej” wychodziło w co trzecim eksperymencie. O tym, czy rzecz zostaje w „moich sposobach”, decyduje osoba. Jeden eksperyment naraz; w cięższym czasie nie proponujemy nowych.
- **„Pasuje do mnie” / „Nie pasuje”**: „pasuje” przypina wniosek na górze listy „Co Ci pomaga”, „nie pasuje” chowa go na 60 dni (z „Cofnij”). Opinia przeżywa kolejne przeliczenia, bo wniosek ma stały klucz (np. `czynnik:ruch`).
- **Strona główna korzysta z wniosków**: w dzień „pół na pół” (nastrój 4–6) zamiast ogólnego „Minuta oddechu” podpowiada to, co tej osobie zwykle pomaga („Zwykle pomaga Ci: ruch”). Tylko rzeczy z tonu „pomaga”.
- Teksty są **gotowymi, sprawdzonymi szablonami**, nie pisze ich model AI. W aplikacji dla nastolatków każde zdanie o samopoczuciu powinno dać się przeczytać i zatwierdzić przed publikacją. **Teksty wsparcia napisał recenzent w roli psychologa; przed prawdziwymi kontami musi je zatwierdzić prawdziwy psycholog albo pedagog.**

## 9. Baza

Plik `notes/supabase-wnioski.sql` (część 3 schematu). Najważniejsze decyzje:

- **Jedna droga zapisu podlewania:** `save_checkin(dzień, nastrój, sen, jakość, pora snu, znaczniki, notatka)`. Sprawdza zgodę na dane o samopoczuciu, dzień (dziś albo do 6 dni wstecz) i znaczniki. Bezpośredniego zapisu do tabel nie ma.
- **Znaczniki w osobnej tabeli** (`checkin_tags`) z katalogiem (`checkin_fields`), zamiast sześciu kolumn w `daily_checkins`. Nowe pole to nowy wiersz, nie zmiana tabeli. Katalog jest generowany z `wnioski-dane.js`.
- **Wnioski zapisuje tylko serwer** (`replace_insights`, rola `service_role`). Telefon może je czytać (`my_insights`), ocenić (`set_insight_feedback`) i zacząć próbę (`start_experiment`, `finish_experiment`).
- Wniosek ma **stały klucz**. Przy kolejnym liczeniu jest aktualizowany, a opinia i data pierwszego pojawienia zostają. Wniosek, który się nie potwierdził, dostaje status `expired` (nie znika, żeby nie migał).
- `insight_runs` to kolejka: `save_checkin` oznacza osobę „do przeliczenia”, a funkcja serwera liczy tylko tych, którzy mają nowe dane.
- To **dane o zdrowiu**: bez zgody nic się nie liczy, a wycofanie zgody usuwa wnioski, próby i podlewania od razu.
- Baza nie zna statystyki ani tekstów. Pilnuje, kto co widzi, tożsamości wniosku i tego, że wniosek-wsparcie nie ma rady.
- Od wersji 2 silnik **nie zapisuje** wniosków o tonie `wsparcie` ani rodzaju `powrot`: karta wsparcia liczy się z dni na telefonie i nie zostawia w bazie wiersza „u tej osoby w domu jest ciężko”. Ograniczenia w tabeli zostają jako bezpiecznik. Czynniki `rodzina_ciezko` i `przyjaciele_ciezko` są w katalogu `insight_factors` z tonem `wsparcie`, żeby nie dało się z nich zrobić eksperymentu.

Sprawdzone lokalnie: `bash narzedzia/sprawdz-baze.sh` (321 sprawdzeń razem z testami i zgodami).

**Do zrobienia przy podłączaniu backendu:**

1. Edge Function `generate-insights`: dla osób z `insight_runs.needs_run` pobiera 90 dni z `checkin_days`, uruchamia `Wnioski.analyze()` i woła `replace_insights`. Uruchamiana raz na dobę (cron) i po zapisie podlewania.
2. Tracker czyta `checkin_days` i `my_insights` zamiast danych przykładowych; opinie i próba idą przez RPC (miejsca oznaczone `TODO backend` w `tracker.js`).
3. Wynik eksperymentu liczy `Wnioski.proba()` (telefon albo ta sama funkcja serwera) i zapisuje `finish_experiment`.

## 10. Co trzeba sprawdzić na prawdziwych danych

Symulacja mówi, że metoda jest uczciwa. Nie mówi, czy **progi pasują do prawdziwych nastolatków**. Po pierwszych 20–30 osobach z co najmniej 6 tygodniami danych:

1. Jak bardzo naprawdę waha się nastrój z dnia na dzień (w symulacji 1,4 punktu). Jeśli bardziej, wniosków będzie mniej.
2. Ile osób w ogóle zaznacza „Co dziś było?” i porę snu. Jeśli mało, trzeba uprościć pytania, a nie luzować progi.
3. Czy wnioski się utrzymują: ile z nich jest nadal po 4 tygodniach.
4. Co ludzie klikają: „Pasuje” / „Nie pasuje” to najlepsza miara trafności, jaką mamy.
5. Jak często włącza się karta wsparcia. W symulacji „spadek względem siebie” pojawia się choć raz w 3 miesiące u co trzeciej osoby ze zwykłymi wahaniami (na około 1% dni), a u osoby ze średnim nastrojem 4,8 karta „od dłuższego czasu” jest na około 15% dni. Czy to dobrze, ocenia psycholog, nie statystyka.
6. Czy 0,6 punktu to dobry próg „warto mówić”.

Do tego potrzebna jest zgoda osób na taką analizę i ktoś dorosły, kto to nadzoruje (to samo pytanie co administrator danych w polityce prywatności).

## 11. Co zmieniła rada (12.11.2026)

Pięciu niezależnych recenzentów przeczytało kod i dokumenty; statystyk i psycholog uruchamiali silnik na własnych danych. Najważniejsze ustalenia i co z nimi zrobiono:

| Ustalenie | Zmiana |
|---|---|
| Liczone codziennie, fałszywy wniosek widziało kiedyś 58% osób z czystego szumu (a nie „1 na 10”) | bloki testu przypięte do kalendarza, stałe ziarno, potwierdzenie po tygodniu → około 22% |
| „Obserwacje” były w większości szumem | zastąpione zwykłym opisem ostatnich dwóch tygodni |
| Wynik tygodniowej próby („to Ci służy”) był bliski rzutowi monetą | opis tygodnia bez liczby i bez wyroku; próg 1 punkt |
| Dni „ciężko” porównywane z dniami „dobrze” dawały kartę wsparcia o czymś, czego nie było (15% osób) | dni z przeciwną oceną nie wchodzą do porównania |
| Pokazywana liczba była zawyżona (surowa różnica, „klątwa zwycięzcy”) | różnica po poprawkach, ściągnięta, „około” |
| Dwa czynniki chodzące w parze wychodziły jako dwa odkrycia (do 89%) | test warunkowy → około 9% |
| Powody „Skąd to może się brać?” przy dniu tygodnia powstawały z szumu (53% kart) | powód musi sam przejść test → około 4% |
| „Spakowanie na jutro”: dobry dzień udawał wpływ spakowania (9%) | odejmujemy wpływ wczorajszego nastroju → około 1% |
| Trend i „powrót po trudnym dniu” nie miały testu | ostrzejszy próg trendu; „powrót” to zdanie otuchy poza wnioskami |
| „Wyraźnie” dostawał prawie każdy wniosek z poziomu 2 | wymaga p ≤ 0,001 |
| Trudny dom jako karta z liczbą, wykresem i „Nie pasuje”; „to mija” przy przemocy rówieśniczej | karta wsparcia po 4 trudnych dniach w dwa tygodnie, nowe teksty, 112 przy domu |
| Wsparcie nie reagowało na przewlekle niski nastrój ani na spadek; obok karty wsparcia stało „po gorszym dniu wracasz do siebie” | dwie nowe reguły; w cięższym czasie ekran nie dokłada zadań |
| „Co Ci pomaga” zawierało dom, jedzenie i naukę; rada „zagadaj do kogoś z domu” | tylko ton „pomaga”; bez rady o domu; czynnik „jedzenie” usunięty |
| Tytuły mówiły o przyczynie („Ruch dodaje Ci energii”) | tytuły opisowe, test to sprawdza |
| Cel „4 noce z 7 h snu” rodzi presję przy bezsenności | eksperymentem jest pora pójścia spać, nie długość snu |
| Asystent (program) jako pierwszy przycisk wsparcia | kolejność: 116 111, bliskie osoby, Asystent |

Liczby „przed” pochodzą z pomiarów statystyka na jego własnym generatorze danych (inny niż symulator projektu). Liczby „po” dla potwierdzenia, testu warunkowego, spakowania i mocy są powtórzone w `narzedzia/sprawdz-wnioski.js`; „po” dla powodów dnia tygodnia (4%) to jego pomiar poprawki, którą przeniosłem bez zmian.

Czego rada **nie** rozstrzygnęła i co zostaje zespołowi: rozdział 12.

## 12. Pytania do zespołu

- **Pola „Miłość” i „Jedzenie” w podlewaniu**: nic z nich nie korzysta (zasada 8). Psycholog i projektantka radzą je usunąć. Jeśli „Jedzenie” zostaje, psycholog proponuje kartę wsparcia przy „ciężko” 5 razy w 14 dni.
- **Podlewanie a test 20.11**: najkrótsza droga do deszczu to 6 stuknięć i 4 ekrany. Projektantka: zadanie „10 sekund do deszczu” tego nie przejdzie. Propozycja: na kroku nastroju główny przycisk „Podlej roślinkę” kończy i pada deszcz, pod nim „Dodaj więcej”; macierz „Jak poszło?” 6×3 zamienić na kafelki. To zmienia projekt Bartka i Tymka, więc decyzja zespołu.
- **Pora snu**: trzecia grupa w kroku o śnie, 12 przycisków na ekranie. Zostawić?
- **Wiedza ogólna i lista „Co Ci pomaga”**: projektantka uważa, że powtarzają karty wyżej i brzmią jak ulotka. Zostawić, skrócić do jednej pozycji, wyciąć?
- **Progi wsparcia** (zasada 6) i treść kart: do zatwierdzenia przez psychologa albo pedagoga. Numery 116 111 i 112 dalej czekają na potwierdzenie zespołu; psycholog z rady wskazał też 800 12 12 12 i Niebieską Linię (800 120 002) do rozważenia.
- **Słowa krzywdy w notatce** („tata mnie bije”): `moderacja.js` łapie dziś tylko samobójstwo i samookaleczenie. Propozycja psychologa: kategoria „krzywda” z tą samą kartą wsparcia co przy trudnym domu. Niezbudowane.
- **Potwierdzenie po 7 czy po 7 i 14 dniach** (rozdział 6).
- **Znacznik „chory/a dziś”**, żeby choroba nie udawała efektu braku ruchu. Propozycja psychologa, niezbudowane.
- Lista „Co dziś było?” (6 pozycji) — czy to te rzeczy? Czego brakuje nastolatkom (np. granie, muzyka, zwierzak)?
- Kto zatwierdza teksty wniosków?

## 13. Co dalej (kolejność)

1. Decyzje z rozdziału 12 i zatwierdzenie tekstów wsparcia przez psychologa.
2. Podłączyć zapis podlewania do bazy, żeby w ogóle zbierały się prawdziwe dane.
3. `generate-insights` na serwerze.
4. Po 6 tygodniach danych: przegląd z rozdziału 10 i korekta progów.
5. Później: eksperyment z dniami losowanymi przez aplikację („dziś spróbuj / dziś bez”; statystyk: tylko to usuwa odwrotną przyczynowość), telefon przed snem jako pole, przypomnienie o eksperymencie po podlaniu, podsumowanie miesiąca.
