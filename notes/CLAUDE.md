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
- **Testy**: PHQ-9 (depresja), GAD-7 (lęk), PSS-10 (stres); każdy test najwyżej raz w tygodniu.
- **Blog**: jak Reddit, anonimowe posty, głosy w górę i w dół, komentarze.

**P2 (później):** Asystent Wsparcia (chatbot AI, limit 10 wiadomości dziennie), umówienie wizyty u psychologa (formularz albo link), tryb SOS (animacja oddechowa + kontakty zaufane jednym dotknięciem), czat peer (Realtime, bez zapisu, sesja wygasa po 2 h), Dashboard (zawartość nie ustalona).

## Check-in (`daily_checkins`)
- Wymagany **nastrój 1–10**. Opcjonalnie: godziny snu, jakość snu, jedzenie, rodzina, przyjaciele, miłość, natura, nauka, notatka.
- Skale pól poza nastrojem i częstotliwość nie są ustalone (zakładamy codziennie).
- **Streak** jest liczony z danych, nie przechowywany.
- Nierozstrzygnięte: `moods` (plan) czy `daily_checkins` (rozmowa o bazie).

## Bezpieczeństwo — twarde zasady dla designu
- **PHQ-9, pytanie 9** (myśli o śmierci lub samookaleczeniu): odpowiedź > 0 → ZAWSZE pokaż linię kryzysową i kontakty pomocowe.
- SOS ma być łatwo dostępny (propozycja: stały przycisk na każdym ekranie).
- Numery pomocowe nie są jeszcze ustalone. W designie używamy **116 111** (telefon zaufania dla dzieci i młodzieży), do potwierdzenia przez zespół.
- **RODO Art. 9** (dane o zdrowiu): osobna, jawna zgoda przy rejestracji, możliwość usunięcia konta, polityka prywatności.
- Zgody rodziców i ograniczenia wiekowe nie są ustalone. W designie rejestracji: zgoda opiekuna poniżej 16 lat.

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

## Do rozstrzygnięcia (ważne dla ekranów)
- Nazwa aplikacji; grupa wiekowa; zgody rodziców.
- Mechanika roślinki w codziennym użyciu.
- Zawartość strony głównej, ton komunikacji, dark mode.
- Konkretne numery pomocowe i treści kryzysowe.
- Skale pól check-inu (poza nastrojem).
- Rejestracja: pytania o tematy (Nastrój, Energia, Stres, Sen…) i przypomnienia nie wynikają z planu — sprawdzić z zespołem, co z nimi robimy (np. powiązać z polami check-inu i pushami).
- Rejestracja: brakuje osobnej zgody RODO na przetwarzanie danych o zdrowiu (Art. 9).

## Propozycja strony głównej (z podsumowania, nieustalona)
1. Główna akcja: check-in nastroju, suwak 1–10 widoczny od razu, bez przewijania.
2. Stały, widoczny przycisk SOS.
3. Cytat / myśl dnia z udostępnianiem.
4. Mini-wykres nastroju z ostatnich dni + streak.
5. Jeden personalizowany insight (jeśli są dane).
6. Skróty: nowy wpis w Skrytce, test do zrobienia w tym tygodniu.
7. Roślinka (u nas: tak).
8. Dolna nawigacja: Dashboard / Skrytka / Tracker / Testy / Blog.
