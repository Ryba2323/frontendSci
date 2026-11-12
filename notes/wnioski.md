# Spersonalizowane wnioski (insighty) — jak to działa

Stan na 12.11.2026. To propozycja Marcela do potwierdzenia przez zespół. Wszystko, co tu opisane, jest zbudowane w prototypie i sprawdzone na danych symulowanych. **Nie było jeszcze sprawdzane na danych prawdziwych osób** i nie jest podłączone do Supabase.

Cel: aplikacja ma umieć powiedzieć konkretnej osobie „w dni, kiedy X, zwykle czujesz się lepiej” i zaproponować, co z tym zrobić. Ma to robić tak, żeby dało się temu ufać i żeby nikomu nie zaszkodzić.

## 1. Gdzie co jest

| Co | Plik |
|---|---|
| Silnik: dni podlewania → wnioski (czyste funkcje, bez ekranu) | `Main_Front-End/js/wnioski.js` |
| Katalog: co zbieramy, jakie czynniki sprawdzamy, wszystkie teksty i progi | `Main_Front-End/js/wnioski-dane.js` |
| Ekran (Tracker) | `Main_Front-End/js/tracker.js`, `css/wnioski.css` |
| Zbieranie danych (podlewanie) | `Main_Front-End/js/checkin.js` |
| Baza: zapis podlewania, znaczniki, wnioski, próby | `notes/supabase-wnioski.sql`, `notes/supabase-wnioski-dane.sql` (generowany) |
| Test silnika na symulacji | `node narzedzia/sprawdz-wnioski.js` |
| Test bazy | `bash narzedzia/sprawdz-baze.sh` |

Silnik jest jeden. Dziś działa w przeglądarce, docelowo ten sam plik ma liczyć wnioski na serwerze (Edge Function `generate-insights`), żeby telefon i baza zawsze mówiły to samo.

## 2. Zasady, których nie łamiemy

1. **Podpowiedź, nie diagnoza.** Piszemy „bywa”, „zwykle”, „spróbuj i zobacz”. Nigdy „musisz”, „powinieneś”, nigdy nazw zaburzeń. Test sprawdza to automatycznie na wszystkich tekstach.
2. **Nie mówimy, co jest przyczyną.** Widzimy tylko, że dwie rzeczy chodzą razem. Ekran mówi to wprost w „Jak powstają wnioski?”.
3. **Radzimy tylko rzeczy, które i tak są zdrowe.** Sen, ruch, dwór, ludzie, odpoczynek, hobby. Jeśli dane pokazują odwrotność („w dni z ruchem jest gorzej”), wniosek po prostu nie powstaje. Nigdy nie poradzimy „mniej ruchu” ani „mniej ludzi”.
4. **Trudne sprawy dostają wsparcie, nie radę.** Gdy z danych wynika, że w dni, kiedy w domu albo ze znajomymi było ciężko, nastrój spada, karta mówi „to nie Twoja wina” i pokazuje Asystenta oraz 116 111. Żadnego „spróbuj”. Baza ma na to osobne ograniczenie: wniosek-wsparcie z radą nie da się zapisać.
5. **Nie analizujemy miłości ani „z jedzeniem było ciężko”.** Za wrażliwe na automat. O jedzeniu mówimy wyłącznie „na spokojnie”, nigdy o ilości, wadze czy wyglądzie.
6. **Kilka niskich dni z rzędu to nie wniosek, tylko wsparcie.** Trzy dni z nastrojem 3 lub niżej w ostatnim tygodniu (albo średnia z ostatnich pięciu wpisów najwyżej 3,5) i na górze Trackera jest karta z Asystentem, 116 111 i bliskimi osobami.
7. **Żadnej kary.** Próba to nie zadanie do zaliczenia: mniej razy niż plan to „mniej okazji”. Brak danych to „roślinka poczeka”.
8. **Zbieramy tylko to, z czego powstaje jakiś wniosek** (RODO: minimalizacja danych). Każde pole w podlewaniu ma w katalogu czynnik, który z niego korzysta.

## 3. Co zbieramy w podlewaniu

Podlewanie dalej ma 4 kroki i każdy można pominąć. Doszły dwie rzeczy (oznaczone „nowe”).

| Pytanie | Odpowiedź | Po co |
|---|---|---|
| Jak się dziś czujesz? | nastrój 1–10 | wynik, do którego wszystko porównujemy |
| Ile godzin snu? | mniej niż 5 h · 5–6 h · 7–8 h · 9 h i więcej | „po nocy z 7 h snu bywa lepiej” |
| **O której do łóżka?** (nowe) | przed 22 · 22–23 · 23–24 · po północy | „gdy kładziesz się przed 23…” |
| Jak się spało? | źle · tak sobie · dobrze · świetnie | jakość snu |
| **Co dziś było?** (nowe, kilka naraz) | ruch · hobby · odpoczynek · szczera rozmowa · coś dla kogoś · spakowanie na jutro | rzeczy, na które ma się wpływ |
| Jak poszło? | jedzenie, rodzina, przyjaciele, miłość, natura, nauka: ciężko / ok / dobrze | co pomaga, co ciąży |
| Chcesz coś dopisać? | notatka | nie jest analizowana |
| (samo) | dzień tygodnia, godzina wpisu | „niedzielne wieczory” |

Uwagi:

- „Spakowanie na jutro” działa na **następny** dzień, więc silnik porównuje nastrój dnia po. To jest przykład Marcela („lepiej się czujesz, jak się spakujesz wcześniej”).
- Brak odpowiedzi to nie „nie”. Dzień bez żadnego znacznika jest przy znacznikach pomijany, a nie liczony jako „nic nie było”.
- **Czego na razie nie zbieramy i dlaczego:** miejsca („gdzie”) — pokrywa się z „natura” i „przyjaciele”, a to kolejne pytanie; telefon przed snem — dobre pytanie na później, ale krok o śnie ma już trzy grupy; emocje słowami — osobna funkcja. Nowe pole to jeden wiersz w katalogu (`wnioski-dane.js`) i jeden czynnik, baza nie wymaga zmian tabel.

## 4. Co sprawdzamy (17 czynników)

Każdy czynnik to jedno pytanie: „czy w dni, kiedy X, nastrój jest inny niż w pozostałe?”.

| Ton | Czynniki | Co dostaje osoba |
|---|---|---|
| **pomaga** (ma się na to wpływ) | sen 7 h i więcej, do łóżka przed 23, ruch, wyjście na dwór, czas z przyjaciółmi, szczera rozmowa, coś dla kogoś, hobby, odpoczynek, spakowanie na jutro | wniosek + podpowiedź + „Wypróbuj przez tydzień” |
| **zauważone** | dobrze przespana noc, spokojny posiłek, dobry czas z rodziną, nauka szła dobrze, nauka była ciężka | wniosek + łagodna podpowiedź, bez próby |
| **wsparcie** | w domu było trudno, ze znajomymi było trudno | wniosek + „to nie Twoja wina” + Asystent i 116 111, bez rady |

Poza czynnikami silnik liczy jeszcze:

- **najtrudniejszy dzień tygodnia** („Niedzielne wieczory bywają trudniejsze”) razem z możliwymi powodami policzonymi z danych tej osoby (np. „w nocy przed niedzielą śpisz średnio o 1,1 h krócej”),
- **zmianę z ostatnich dwóch tygodni** (lżej / trudniej niż dwa tygodnie wcześniej),
- **powrót po trudnym dniu** („po gorszym dniu Twój nastrój zwykle wraca już następnego dnia”) — wniosek, który ma dodawać otuchy.

## 5. Jak powstaje wniosek

1. Bierzemy ostatnie **90 dni**.
2. Od 28 podlań odejmujemy od nastroju typowy poziom danego dnia tygodnia. Dzięki temu „w weekendy jest lepiej” nie udaje wpływu przyjaciół, z którymi widuje się głównie w weekendy.
3. Liczymy różnicę średniego nastroju w dni „z” i „bez”. Musi być co najmniej **0,6 punktu** i iść w oczekiwaną stronę. Każda grupa musi mieć co najmniej 5 dni.
4. Sprawdzamy, czy taka różnica mogła wyjść przypadkiem: test permutacyjny, w którym mieszamy etykiety tylko wewnątrz dwutygodniowych bloków. Lepsze i gorsze okresy same z siebie nie tworzą wtedy „zależności”.
5. Pytamy o 17 rzeczy naraz, więc pojedynczy traf nie wystarcza: stosujemy poprawkę Benjaminiego–Hochberga.
6. Kierunek musi być ten sam w starszej i w nowszej połowie okresu.

Wniosek dostaje słowo pewności, widoczne na karcie razem z liczbą dni:

| Pewność | Wymagania |
|---|---|
| **Wstępnie** | od 14 podlań, po 5 dni w grupie, poprawka z progiem 10% |
| **Dość wyraźnie** | od 21 podlań, po 7 dni, próg 5%, zgodne połówki, różnica wyraźnie większa od niepewności |
| **Wyraźnie** | od 40 podlań, po 10 dni, bardzo mały błąd, różnica co najmniej 0,8 |

Poniżej progu wniosku nie ma wcale. Wszystkie liczby są w jednym miejscu: `PROGI` w `wnioski-dane.js`.

Wynik jest powtarzalny: te same dane zawsze dają te same wnioski.

## 6. Ile danych trzeba — uczciwie

To jest najważniejsza rzecz, którą pokazała symulacja (`narzedzia/sprawdz-wnioski.js`, 80 symulowanych osób na komórkę, nastrój waha się z dnia na dzień o ok. 1,4 punktu, 15% dni bez wpisu). Tabela pokazuje, jak często silnik znajduje **prawdziwą** zależność snu:

| Prawdziwa różnica | 21 dni | 35 dni | 60 dni | 90 dni |
|---|---|---|---|---|
| 0,8 punktu | 3% | 9% | 26% | 39% |
| 1,2 punktu | 13% | 20% | 49% | 71% |
| 2,0 punktu | 38% | 78% | 96% | 100% |

A to, jak często powstaje wniosek **z samego szumu** (300 osób bez żadnych zależności, 70 dni):

| | zwykły szum | szum z dobrymi i gorszymi tygodniami |
|---|---|---|
| jakikolwiek wniosek o czynniku | 9,7% | 9,0% |
| wniosek „dość wyraźnie” lub mocniejszy | 4,7% | 5,0% |
| „trudny dzień tygodnia” | 7,7% | 6,7% |

Co z tego wynika:

- Duże zależności (2 punkty) widać po miesiącu. Typowe (około 1 punktu) potrzebują 2–3 miesięcy i nawet wtedy nie zawsze wyjdą. **Tego nie da się obejść sprytniejszym wzorem** — to kwestia liczby dni.
- Próbowałem poluzować próg dla „wstępnie”. Fałszywe wnioski z szumu wzrosły z 10% do 21%, a znajdowanie prawdziwych poprawiło się o kilka punktów procentowych. Zostały ostrzejsze progi.
- Mniej więcej jedna osoba na dziesięć zobaczy kiedyś wniosek „wstępnie”, którego naprawdę nie ma. Dlatego (a) wstępne wnioski są tak podpisane, (b) radzimy tylko zdrowe rzeczy, więc pomyłka nie szkodzi, (c) każdy wniosek da się sprawdzić w tygodniowej próbie i odrzucić przyciskiem „Nie pasuje”.

## 7. Żeby aplikacja nie milczała przez pierwsze tygodnie

Skoro pewne wnioski potrzebują czasu, są trzy wcześniejsze, wyraźnie oznaczone poziomy:

| Kiedy | Co widać w Trackerze |
|---|---|
| 0–6 podlań | „Zbieram pierwsze obserwacje. Jeszcze N podlań do pierwszego podsumowania. Nie ma pośpiechu.” |
| od 7 podlań | podsumowanie tygodnia + **obserwacje**: „W Twoje lepsze dni często był ruch (4 z 5)”. To opis tego, co było, podpisany „to na razie obserwacje, jeszcze nie wnioski”. Tylko dla rzeczy z tonu „pomaga”. |
| od 14 podlań | pierwsze wnioski (jeśli są); jeśli nie ma: „Na razie nic pewnego — to też informacja” |
| zawsze, gdy lista „Co Ci pomaga” ma mniej niż 3 pozycje | **wiedza ogólna**: „Większości osób w Twoim wieku służy 8–10 godzin snu. Wiedza ogólna — sprawdź u siebie.” z przyciskiem próby. Tylko cztery dobrze udokumentowane sprawy: sen, ruch, dwór, kontakt z ludźmi. |

## 8. Jak mówimy ludziom, co robić

- **Najwyżej 3 karty naraz** w „Co zauważyliśmy”, z różnych grup (nie dwie o śnie). Kolejność: najmocniejsze „pomaga”, potem obserwacja o dniu tygodnia albo trudnej sprawie, potem reszta.
- Karta pokazuje tytuł, mały wykres i **jedno zdanie** z liczbą („o 1,3 wyższy”). Powody i podpowiedź są zwinięte pod „Skąd to może się brać?”, żeby ekran był spokojny.
- **„Wypróbuj przez tydzień”**: osoba zaczyna próbę („3 dni z ruchem”), zaznacza to w podlewaniu, Tracker pokazuje „2 z 3”. Po 7 dniach wynik: „W dni z tym było u Ciebie o 1,2 lepiej” / „Tym razem bez wyraźnej różnicy. To też wiedza” / „Tym razem było mało okazji. Nic się nie stało”. Jedna próba naraz.
- **„Pasuje do mnie” / „Nie pasuje”**: „pasuje” przypina wniosek na górze listy „Co Ci pomaga”, „nie pasuje” chowa go na 60 dni. Opinia przeżywa kolejne przeliczenia, bo wniosek ma stały klucz (np. `czynnik:ruch`).
- **Strona główna korzysta z wniosków**: w dzień „pół na pół” (nastrój 4–6) zamiast ogólnego „Minuta oddechu” podpowiada to, co tej osobie zwykle pomaga („Zwykle pomaga Ci: ruch”).
- Teksty są **gotowymi, sprawdzonymi szablonami**, nie pisze ich model AI. W aplikacji dla nastolatków każde zdanie o samopoczuciu powinno dać się przeczytać i zatwierdzić przed publikacją.

## 9. Baza

Plik `notes/supabase-wnioski.sql` (część 3 schematu). Najważniejsze decyzje:

- **Jedna droga zapisu podlewania:** `save_checkin(dzień, nastrój, sen, jakość, pora snu, znaczniki, notatka)`. Sprawdza zgodę na dane o samopoczuciu, dzień (dziś albo do 6 dni wstecz) i znaczniki. Bezpośredniego zapisu do tabel nie ma.
- **Znaczniki w osobnej tabeli** (`checkin_tags`) z katalogiem (`checkin_fields`), zamiast sześciu kolumn w `daily_checkins`. Nowe pole to nowy wiersz, nie zmiana tabeli. Katalog jest generowany z `wnioski-dane.js`.
- **Wnioski zapisuje tylko serwer** (`replace_insights`, rola `service_role`). Telefon może je czytać (`my_insights`), ocenić (`set_insight_feedback`) i zacząć próbę (`start_experiment`, `finish_experiment`).
- Wniosek ma **stały klucz**. Przy kolejnym liczeniu jest aktualizowany, a opinia i data pierwszego pojawienia zostają. Wniosek, który się nie potwierdził, dostaje status `expired` (nie znika, żeby nie migał).
- `insight_runs` to kolejka: `save_checkin` oznacza osobę „do przeliczenia”, a funkcja serwera liczy tylko tych, którzy mają nowe dane.
- To **dane o zdrowiu**: bez zgody nic się nie liczy, a wycofanie zgody usuwa wnioski, próby i podlewania od razu.
- Baza nie zna statystyki ani tekstów. Pilnuje, kto co widzi, tożsamości wniosku i tego, że wniosek-wsparcie nie ma rady.

Sprawdzone lokalnie: `bash narzedzia/sprawdz-baze.sh` (269 sprawdzeń razem z testami i zgodami).

**Do zrobienia przy podłączaniu backendu:**

1. Edge Function `generate-insights`: dla osób z `insight_runs.needs_run` pobiera 90 dni z `checkin_days`, uruchamia `Wnioski.analyze()` i woła `replace_insights`. Uruchamiana raz na dobę (cron) i po zapisie podlewania.
2. Tracker czyta `checkin_days` i `my_insights` zamiast danych przykładowych; opinie i próba idą przez RPC (miejsca oznaczone `TODO backend` w `tracker.js`).
3. Wynik próby liczy `Wnioski.proba()` (telefon albo ta sama funkcja serwera) i zapisuje `finish_experiment`.

## 10. Co trzeba sprawdzić na prawdziwych danych

Symulacja mówi, że metoda jest uczciwa. Nie mówi, czy **progi pasują do prawdziwych nastolatków**. Po pierwszych 20–30 osobach z co najmniej 6 tygodniami danych:

1. Jak bardzo naprawdę waha się nastrój z dnia na dzień (w symulacji 1,4 punktu). Jeśli bardziej, wniosków będzie mniej.
2. Ile osób w ogóle zaznacza „Co dziś było?” i porę snu. Jeśli mało, trzeba uprościć pytania, a nie luzować progi.
3. Czy wnioski się utrzymują: ile z nich jest nadal po 4 tygodniach.
4. Co ludzie klikają: „Pasuje” / „Nie pasuje” to najlepsza miara trafności, jaką mamy.
5. Ile prób kończy się wynikiem „pomogło”.
6. Czy 0,6 punktu to dobry próg „warto mówić”.

Do tego potrzebna jest zgoda osób na taką analizę i ktoś dorosły, kto to nadzoruje (to samo pytanie co administrator danych w polityce prywatności).

## 11. Pytania do zespołu

- Lista „Co dziś było?” (6 pozycji) — czy to te rzeczy? Czego brakuje nastolatkom (np. granie, muzyka, zwierzak)?
- Czy pytanie o porę snu nie jest za dużo w kroku o śnie (trzy grupy odpowiedzi)?
- Próg wsparcia: 3 dni z nastrojem 3 lub niżej w tygodniu. Za ostro, za łagodnie?
- Czy wnioski-wsparcie („gdy w domu jest ciężko”) pokazywać w ogóle, czy tylko reagować kartą wsparcia? Tu przydałaby się opinia psychologa.
- Kto zatwierdza teksty wniosków? Dobrze, żeby przeczytał je psycholog albo pedagog szkolny.

## 12. Co dalej (kolejność)

1. Podłączyć zapis podlewania do bazy, żeby w ogóle zbierały się prawdziwe dane.
2. `generate-insights` na serwerze.
3. Po 6 tygodniach danych: przegląd z punktu 10 i korekta progów.
4. Później: telefon przed snem jako pole, wnioski łączone („sen + ruch”), przypomnienie o próbie w powiadomieniu, podsumowanie miesiąca.
