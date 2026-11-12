# SCI++ — kontekst produktu

Podsumowanie planu projektu (plan realizacji v2.0, wrzesień 2026, i ustalenia zespołu), przeniesione z rozmowy na claude.ai.
„Nie ustalone” = zespół jeszcze tego nie zdecydował. Nie zgadujemy, tylko proponujemy i pytamy.

## Czym jest aplikacja
- Aplikacja wsparcia psychicznego / wellness: nastrój, dziennik, testy, społeczność, wsparcie kryzysowe. **Nie jest terapeutą** i nigdy tak nie mówi.
- Robocza nazwa: **SCI++**. Właściwa nazwa nie jest ustalona (preferowane słowa wymyślone albo brzmiące jak ukryta fraza; odrzucony przyrostek „-ify”).
- Grupa docelowa i wiek formalnie nie ustalone. W designie rejestracji przyjęliśmy nastolatków (13–19+).
- Wyróżniki z planu: jedna baza kodu na iOS, Androida i web, anonimowość (blog, czat peer), szyfrowana „Skrytka”, insighty z danych nastroju.
- Projekt powstaje w ramach szkolnych praktyk zawodowych.

## Docelowa technologia (ważne dla designu)
- **React Native + Expo Router + React Native Web** (iOS, Android i web z jednego kodu), TypeScript, **NativeWind** (Tailwind dla RN).
- Ten repo (`Main_Front-End/`) to **prototyp designu** w HTML/CSS/JS. Projektuj tak, żeby dało się go przenieść:
  - ekrany z wyraźnych komponentów, dane osobno od HTML-a,
  - kolory tylko z tokenów (łatwe do przeniesienia do konfiguracji Tailwind/NativeWind),
  - bez efektów, których RN nie ma (np. `backdrop-filter`, `:has()`) w kluczowych miejscach — najwyżej jako dodatek,
  - roślinka na canvasie → w RN do przepisania (np. react-native-skia albo SVG + Reanimated).
- Plan zakłada **dark mode** — jeszcze go nie mamy, trzeba zaprojektować.
- Backend: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions: `ai-chat`, `generate-insights`, `send-daily-quote`, `delete-account`). Region Frankfurt (RODO).

## Nawigacja i ekrany (plan Expo Router)
- **Dolne zakładki:** Dashboard (strona główna) · Skrytka (dziennik) · Tracker (nastrój) · Testy · Blog.
- Poza zakładkami: **SOS**, **Peer chat** (anonimowa rozmowa).
- Auth: logowanie, rejestracja, onboarding z **checkboxem zgody RODO**.
- Komponenty z planu: MoodSlider, MoodChart, BreathingCircle, PostCard, ChatBubble.
- Brakuje w planie (do zaprojektowania): cytat dnia, wyniki testów, ustawienia (tu zmiana koloru roślinki), kontakty zaufane, Asystent AI, usuwanie konta.

## Funkcje
**P1 (najpierw):**
- **Skrytka**: szyfrowany dziennik myśli, opcja wysłania wpisu do AI.
- **Cytat / myśl dnia**: powiadomienie push, udostępnianie, ulubione.
- **Tracker nastroju**: suwak **1–10**, wykres (np. 30 ostatnich wpisów), insighty typu „Twój nastrój spada w niedziele wieczorem”.
- **Testy**: ~~PHQ-9, GAD-7, PSS-10~~ — zmienione 9.11.2026 (ustalenia Waldka): tylko **WHO-5** i **Big Five (IPIP)**. Szczegóły w „Testy i dane o zdrowiu” niżej.
- **Blog**: jak Reddit, anonimowe posty, głosy w górę i w dół, komentarze.

**P2 (później):** Asystent Wsparcia (chatbot AI, limit 10 wiadomości dziennie), umówienie wizyty u psychologa (formularz albo link), tryb SOS (animacja oddechowa + kontakty zaufane jednym dotknięciem), czat peer (Realtime, bez zapisu, sesja wygasa po 2 h), Dashboard (zawartość nie ustalona).

## Check-in (`daily_checkins`)
- Wymagany **nastrój 1–10**. Opcjonalnie: godziny snu, jakość snu, jedzenie, rodzina, przyjaciele, miłość, natura, nauka, notatka.
- Od 12.11.2026 także (propozycja, dla spersonalizowanych wniosków): **pora pójścia spać** i **„Co dziś było?”** (ruch, hobby, odpoczynek, szczera rozmowa, coś dla kogoś, plecak na jutro). Zasada: zbieramy tylko to, z czego powstaje jakiś wniosek; **„Miłość” i „Jedzenie” jej dziś nie spełniają** (nic z nich nie korzysta, rada 12.11.2026 radzi je usunąć). Szczegóły i pytania do zespołu: `notes/wnioski.md`.
- Skale pól poza nastrojem i częstotliwość nie są ustalone (zakładamy codziennie).
- **Streak** jest liczony z danych, nie przechowywany.
- Nierozstrzygnięte: `moods` (plan) czy `daily_checkins` (rozmowa o bazie).

## Bezpieczeństwo — twarde zasady dla designu
- ~~PHQ-9, pytanie 9~~: PHQ-9 wypadł z aplikacji (9.11.2026). Zasada zostaje w duchu: **niski wynik WHO-5 → zawsze pokaż wsparcie (116 111, Asystent, bliskie osoby)**, bez diagnozy.
- SOS ma być łatwo dostępny (propozycja: stały przycisk na każdym ekranie).
- Numery pomocowe nie są jeszcze ustalone. W designie używamy **116 111** (telefon zaufania dla dzieci i młodzieży), do potwierdzenia przez zespół.
- **RODO Art. 9** (dane o zdrowiu): osobna, jawna zgoda przy rejestracji, możliwość usunięcia konta, polityka prywatności.
- Zgody rodziców i ograniczenia wiekowe nie są ustalone. W designie rejestracji: zgoda opiekuna poniżej 16 lat.

## Testy i dane o zdrowiu (ustalenia Waldka, 9.11.2026)
- **Dozwolone testy: tylko WHO-5 i Big Five (IPIP).** PHQ-9, GAD-7 i PSS-10 wypadają.
- **Osobna, wyraźna zgoda** przed pierwszym testem / zapisem danych o samopoczuciu, np.: „Wyrażam zgodę na przetwarzanie moich danych dotyczących zdrowia/samopoczucia w celu generowania historii i wykresów w aplikacji”. Zgodę można wycofać.
- **Prosta i wyraźna opcja usunięcia historii testów**, i prawdopodobnie całego konta (Waldek nie był pewien; plan i tak zakłada Edge Function `delete-account`, więc robimy oba).
- **Dane muszą być szyfrowane.**
- **Co wolno przechowywać** (i nic więcej):
  1. surowe odpowiedzi na pytania (np. pytanie 1: wartość 3),
  2. wynik obliczony (np. WHO-5: 40%, Big Five: Sumienność = sten 7),
  3. wynik interpretacyjny — komunikat, który użytkownik zobaczył danego dnia,
  4. znacznik czasu wykonania testu (do wykresów historii),
  5. metadane zgody RODO: ID zgody, wersja regulaminu/polityki, czas udzielenia, IP (rozliczalność, art. 5 ust. 2 RODO).
- **Schemat bazy** (przepisany 12.11.2026, zastępuje prototyp Waldka): `notes/supabase-schema.sql` (konto, zgody, dane aplikacji) → `notes/supabase-testy.sql` (testy) → `notes/supabase-testy-dane.sql` (pytania; generowany z `Main_Front-End/js/testy-dane.js`). Sprawdzony na lokalnym Postgresie: `bash narzedzia/sprawdz-baze.sh` (około 320 sprawdzeń). **Jeszcze nie uruchomiony na prawdziwym projekcie Supabase.** Najważniejsze zasady:
  - wynik testu liczy serwer (`submit_test`), telefon wysyła tylko odpowiedzi i może czytać wyłącznie swoje wiersze;
  - zgody są dziennikiem, który zapisuje serwer (`give_consent`, `withdraw_consent`): nie da się ich skasować ani wpisać sobie zgody opiekuna; adres IP ustawia serwer;
  - bez aktywnej zgody na dane o samopoczuciu (poniżej 16 lat także zgody opiekuna) nie zapisze się ani test, ani podlewanie;
  - wycofanie zgody od razu usuwa testy, podlewania i wnioski; usuwanie jest prawdziwe (bez `deleted_at`), a w `privacy_events` zostaje tylko ślad bez treści;
  - zmiana pytań albo opisów wyniku to nowa wersja kwestionariusza (`who5-v2`), więc historia pokazuje to, co osoba widziała tamtego dnia;
  - niezalogowany (`anon`) nie ma dostępu do niczego.
- Proponowane progi WHO-5 (standardowe w literaturze, do potwierdzenia): wynik surowy 0–25 × 4 = 0–100%. Poniżej 50% → „ostatnio jest Ci trudniej” + łagodna podpowiedź; 28% i mniej → zawsze wsparcie (116 111, Asystent, bliskie osoby). Słowa: podpowiedź, nigdy diagnoza.
- **Zbudowane 12.11.2026 (propozycja do potwierdzenia przez zespół; opis w CLAUDE.md, „Tests, consents and legal pages”):** zakładka Testy (WHO-5 i Big Five jako IPIP-BFM-20: przebieg, wynik, historia), zgoda na dane o samopoczuciu i jej wycofanie, ekran „Konto i prywatność” (pobranie danych, usunięcie historii testów i konta), `regulamin.html` i `polityka-prywatnosci.html` w wersji roboczej 0.1.
- **Decyzje przyjęte przy budowie, do potwierdzenia:**
  - Big Five w wersji krótkiej, **20 zdań** (IPIP-BFM-20), nie 50: na telefonie to około 3 minut. Baza przyjmie też wersję 50, jeśli zespół ją wybierze.
  - **Bez stenów.** IPIP-BFM-20 był badany na osobach 16–83 lata i nie mamy norm dla młodzieży, więc pokazujemy położenie na skali 0–100 i opis słowny. Poniżej 16 lat przy wyniku jest dopisek, że test powstał dla osób od 16 lat.
  - Odstępy: WHO-5 co 7 dni (jak w planie „najwyżej raz w tygodniu”), Big Five co 30 dni.
  - Dowód zgód po usunięciu konta zostaje 3 lata bez powiązania z kontem (skrót e-maila).
  - Kolumn w bazie dodatkowo nie szyfrujemy (szyfrowanie dysku i połączenia w Supabase + RLS); Skrytka dalej szyfrowana na telefonie.
- **Do załatwienia przed prawdziwymi kontami:**
  - **Kto jest administratorem danych?** Regulamin i polityka mają puste miejsce na nazwę podmiotu, adres i e-mail. Zespół to uczniowie, więc trzeba ustalić, kto formalnie prowadzi aplikację (szkoła, fundacja, firma, opiekun praktyk).
  - Prawnik sprawdza oba dokumenty, treść zgody i sposób potwierdzania zgody opiekuna.
  - **Licencja WHO-5:** CC BY-NC-SA 3.0 IGO, czyli użycie niekomercyjne z podaniem źródła. Przy modelu biznesowym Piotrka trzeba sprawdzić, czy aplikacja się w tym mieści. IPIP jest w domenie publicznej.
  - Dostawca modelu AI (moderacja, Asystent) i poczty z kodami: nazwa i kraj do polityki prywatności.

## Plan dalszej pracy (Marcel, 9.11.2026)
1. **Animacja pokazowa** nowego wyglądu ReLeaf (telefon i komputer).
2. **Konto i prawo:** nowa rejestracja i logowanie (w stylu „Żywej planety”), zgody RODO (art. 9), konto, usuwanie historii i konta, regulamin, polityka prywatności.
3. **Model biznesowy** (przygotował Piotrek; Marcel go przyśle).
4. **Testy WHO-5 i Big Five** (zakładka Testy), równolegle **podłączenie backendu (Supabase)**.
5. **Przejście na React Native + Expo** (od razu jako aplikacja), **model Asystenta**.
6. Z backendem: **zbieranie i interpretacja danych**, żeby aplikacja mówiła, co robisz w dni, kiedy czujesz się gorzej, i dawała spersonalizowane insighty. **Projekt i silnik są gotowe (12.11.2026, wersja 2 po recenzji rady): `notes/wnioski.md`.** Zostają decyzje zespołu z rozdziału 12 tego pliku, zatwierdzenie tekstów wsparcia przez psychologa, podłączenie do bazy i sprawdzenie progów na prawdziwych danych.
- Test z nastolatkami: 20.11.2026 (`notes/test-z-nastolatkami.md`).

## Zespół
- **Marcel**: założyciel, koordynacja, backend, baza, Supabase.
- **Waldek**: backend, baza, Supabase.
- **Bartek**: design (Figma) i frontend.
- **Tymek**: frontend.

## Decyzje podjęte w tym repo (poza planem)
- **Roślinka** jest motywem przewodnim aplikacji (decyzja Marcela). Rośnie z każdym krokiem użytkownika i kwitnie na końcu. W planie jej nie ma, więc mechanika w codziennym użyciu (za co rośnie, czy więdnie, nagrody) jest do ustalenia.
- **Motywy kolorystyczne**: użytkownik wybiera kolor roślinki, a za nim idzie cała paleta. Tylko spokojne kolory: morski (domyślny), zielony, niebieski, lawenda, różowy, morelowy. Kolor da się zmienić na stronie głównej (kółko obok SOS).
- **Zasady roślinki na stronie głównej (propozycja do potwierdzenia z zespołem):**
  - 7 odnóg = ostatnie 7 dni (okno przesuwa się codziennie o północy; nie ma resetu „tygodnia”).
  - Dzień z podlaniem (wpisem) → liść; wielkość i żywość koloru z samopoczucia tego dnia.
  - Dzień bez podlania → mały, uśpiony pąk. Roślinka nie więdnie, nie traci liści i nie „umiera” — nie karzemy za przerwę (to aplikacja o zdrowiu psychicznym, poczucie winy szkodzi).
  - Dziś → pąk w przerywanym kółku, rozwija się po podlaniu.
  - Kwiat otwarty przy co najmniej 3 podlaniach w ostatnich 7 dniach; inaczej zamyka się w pąk i otwiera przy następnym podlaniu.
  - Najstarszy liść codziennie opada (widać to przy wejściu na stronę); dłuższą historię pokaże zakładka Tracker.
  - Bilans tygodnia = średnia tylko z dni z wpisem.
- Mobile-first: telefon to główny cel.
- **Strona główna: układ A „Dziś jednym dotknięciem”** (wybór zespołu, 4.11.2026): nastrój 1–10 jako przyciski na samej stronie, jedno stuknięcie = podlanie; sen, „co było ważne” i notatka opcjonalnie („+”); jedna podpowiedź dopasowana do nastroju; dzień bez wpisu nazywamy „odpoczynkiem”. To realizuje punkt 1 propozycji strony głównej niżej (suwak/nastrój widoczny od razu). Na tym układzie budujemy pozostałe ekrany (zasady w CLAUDE.md).

- **Propozycja „Żywa planeta”** (6.11.2026, do potwierdzenia przez zespół i testu z nastolatkami; opis w CLAUDE.md): treść leży na planecie zamiast na białej karcie, roślinka nie znika przy przewijaniu, wraca przycisk „Podlej roślinkę” (przycisk + liczba = dwa stuknięcia, bez nakładki). Układ A zostaje pod `?uklad=a`.

## Do rozstrzygnięcia (ważne dla ekranów)
- Czy „mały liść = gorszy dzień” nie brzmi jak kara? Rada przy redesignie (6.11.2026) zgłosiła to jako ryzyko; na razie zasada bez zmian. Do sprawdzenia w teście z nastolatkami.
- Nazwa aplikacji; grupa wiekowa; zgody rodziców.
- Mechanika roślinki w codziennym użyciu.
- Zawartość strony głównej, ton komunikacji, dark mode.
- Konkretne numery pomocowe i treści kryzysowe.
- Skale pól check-inu (poza nastrojem). Propozycja w `aplikacja.html`: sen w przedziałach (<5, 5–6, 7–8, 9+ h), jakość snu 1–4, obszary dnia −1 / 0 / 1 („ciężko / ok / dobrze”).
- Nastrój jest w bazie wymagany, a design pytań pozwala go pominąć — czy wpis bez nastroju się zapisuje?
- Moderacja bloga: w prototypie lista słów (`js/moderacja.js`); docelowo AI po stronie serwera. Co robimy z historiami wyjścia z kryzysu (np. „kiedyś myślałem o samobójstwie, dziś jest lepiej”) — publikować po sprawdzeniu przez człowieka?
- Rejestracja: pytania o tematy (Nastrój, Energia, Stres, Sen…) i przypomnienia nie wynikają z planu — sprawdzić z zespołem, co z nimi robimy (np. powiązać z polami check-inu i pushami).
- ~~Rejestracja: brakuje osobnej zgody RODO na przetwarzanie danych o zdrowiu (Art. 9).~~ Jest od 11.11.2026; od 12.11.2026 trafia do dziennika zgód i da się ją wycofać w „Konto i prywatność”.

## Propozycja strony głównej (z podsumowania, nieustalona)
1. Główna akcja: check-in nastroju, suwak 1–10 widoczny od razu, bez przewijania.
2. Stały, widoczny przycisk SOS.
3. Cytat / myśl dnia z udostępnianiem.
4. Mini-wykres nastroju z ostatnich dni + streak.
5. Jeden personalizowany insight (jeśli są dane).
6. Skróty: nowy wpis w Skrytce, test do zrobienia w tym tygodniu.
7. Roślinka (u nas: tak).
8. Dolna nawigacja: Dashboard / Skrytka / Tracker / Testy / Blog.
