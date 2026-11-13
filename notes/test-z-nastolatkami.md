# Test „Ścieżki” z 5 nastolatkami

Termin z werdyktu Rady: **20 listopada 2026**. Czas: około 15 minut na osobę, razem około 75 minut.
Testujemy domyślny wygląd „Ścieżka” (`aplikacja.html` bez parametrów). Plan powstał dla „Żywej planety” i został uzupełniony 13.11.2026 po uwagach rady z 12.11.2026 (`notes/rada-uwagi.md`, punkt 5).

## Bezpieczeństwo (najpierw to)

To aplikacja o samopoczuciu, a testerami są niepełnoletni. Te zasady są propozycją i **musi je potwierdzić dorosły odpowiedzialny za test** (opiekun praktyk, pedagog albo psycholog szkolny) przed 20.11.

- **Przy teście jest dorosły.** Dwie osoby z zespołu prowadzą i notują, ale w sali jest dorosły, który wie, co robić, gdy ktoś poczuje się gorzej. Bez dorosłego testu nie zaczynamy.
- **Zgody na piśmie.** Osoby poniżej 16 lat biorą udział tylko z pisemną zgodą opiekuna. Każdy tester słyszy na początku, że może przerwać w dowolnej chwili i nie musi podawać powodu.
- **Żadnych prawdziwych danych.** Testerzy nie wpisują prawdziwego imienia, e-maila ani prawdziwych notatek. Przy nastroju stukają dowolną liczbę. Testu samopoczucia (WHO-5) **nie robią „na serio”**: odpowiedzi mają być przypadkowe.
- **Gdy tester coś ujawni** (że jest mu bardzo ciężko, że ktoś go krzywdzi, że myśli o zrobieniu sobie krzywdy):
  1. prowadzący spokojnie przerywa test i dziękuje, że to powiedział(a);
  2. nie obiecuje tajemnicy i nie dopytuje o szczegóły;
  3. rozmowę przejmuje dorosły;
  4. podajemy numer 116 111 (całą dobę, bezpłatnie), a przy zagrożeniu życia 112;
  5. w arkuszu nie zapisujemy treści tego, co tester powiedział, tylko „test przerwany”.
- **Gdyby ktoś po prostu poczuł się gorzej:** przerwij, porozmawiaj spokojnie i podaj numer 116 111. Numer zespół ma jeszcze potwierdzić.

## Przed testem

- **To test aplikacji, nie człowieka.** Powiedz to na głos. Nie pytaj o prawdziwe samopoczucie i nie zapisuj nazwisk.
- **Powiedz też wprost:**
  - „Dane w Trackerze i w testach są wymyślone, nie Twoje.” Ekran wita „Cześć, Ola!” i pokazuje na przykład „71 wpisów”, więc bez tego zdania tester uzna je za swoje.
  - „Wynik testu samopoczucia nie jest prawdziwy.” Przypadkowe odpowiedzi mogą pokazać ekran wsparcia z numerem 116 111. Uprzedź o tym, żeby nikogo nie przestraszył.
- **Telefon:** prawdziwy, w tym co najmniej jeden tani albo starszy. Mac i telefon w tej samej sieci Wi-Fi, adres: `http://<adres-maca>:5510/aplikacja.html`.
- **Serwer na Macu:** `python3 narzedzia/serwer.py` (nie `python3 -m http.server`). Ten serwer zabrania przeglądarce trzymania plików w pamięci, więc telefon zawsze dostaje aktualną wersję. Przy zwykłym serwerze telefon potrafi zmieszać stare pliki z nowymi i wtedy np. podlewanie się nie otwiera.
- **Wyczyść dane przed każdą osobą** (nowa karta prywatna) i wycisz powiadomienia.
- **Dwie osoby z zespołu:** jedna daje polecenia, druga mierzy czas stoperem i notuje. **Nikt nie podpowiada.** Na pytania odpowiadamy: „A jak myślisz?”.

## Zadania

Numery zostają takie jak w poprzedniej wersji planu, żeby notatki rady dalej do nich pasowały. Kolejność przy testerze: 1, 2, 7, 4, 8, 9, 5, 6. Dawne zadanie 3 („Chaos”) jest teraz częścią pytania końcowego.

1. **5 sekund.** Pokaż ekran na 5 sekund, zabierz telefon. Zapytaj: „Co tu jest najważniejsze? Co można tu zrobić?”.
   Zaliczone, jeśli osoba wskaże roślinkę albo podlewanie.
2. **Podlewanie.** Oddaj telefon: „Ta roślinka jest Twoja. Zadbaj dziś o nią”. Włącz stoper. Zatrzymaj, gdy zacznie padać deszcz.
   Zaliczone: do 10 sekund, bez pomocy. Od 12.11.2026 podlewanie kończy się na nastroju (trzy stuknięcia: „Podlej roślinkę” → suwak → „Podlej roślinkę”).
   Zapisz też, czy osoba weszła w „Dodaj więcej: sen, dzień, notatka”. Jeśli weszła, czas liczymy do deszczu, ale przy wyniku dopisz „przez Dodaj więcej”.
7. **Co dziś było (1 minuta).** Po deszczu: „Dopisz, że miałeś/miałaś dziś trening i widziałeś/widziałaś się ze znajomymi.”
   Zaliczone: do 30 sekund, bez pomocy (przez „+ Co było ważne” na Domu albo „Zmień” → „Dodaj więcej”).
   Potem zapytaj: „Co byś stąd wyrzucił(a)? Czego brakuje?” Zapytaj też o pytanie „O której do łóżka?” na ekranie o śnie: czy jest potrzebne.
4. **Liść.** Pokaż mały liść w gałązce tygodnia: „Jak myślisz, co on oznacza? Co byś poczuł(a), widząc taki przez kilka dni?”.
   Sygnał ostrzegawczy: odpowiedź w stylu „że coś zrobiłem źle”, „że roślinka mnie ocenia”.
8. **Karta wniosku (1,5 minuty).** Zakładka Tracker, karta „W dni z ruchem bywa Ci lepiej”: „Powiedz swoimi słowami, co ta karta mówi. Co znaczy napis w szarej pigułce? Co byś stuknął/stuknęła?”
   Zaliczone: odpowiedź w stylu „jak się ruszam, czuję się lepiej”.
   Sygnał ostrzegawczy: „każe mi ćwiczyć”, „ocenia mnie”, „gada jak pedagog”.
   U dwóch osób pokaż zamiast tego Tracker na starcie (`aplikacja.html?wnioski=start#/tracker`) i zapytaj: „Wrócił(a)byś tu jutro? Po co?”
   Zapytaj też, czy Tracker nie jest za długi i czy „Co Ci pomaga” mówi coś nowego po kartach wyżej.
9. **Zgoda i test (2 minuty).** „Zrób test samopoczucia.” Przypomnij, że odpowiedzi mają być przypadkowe. Obserwuj, czy osoba czyta prośbę o zgodę i czy znajduje przycisk.
   Po wyniku zapytaj: „Na co się zgodziłeś/zgodziłaś? Co znaczy ten procent? Gdzie byś to cofnął/cofnęła?” Daj 30 sekund na znalezienie „Konto i prywatność”.
   Zaliczone: osoba wie, że aplikacja zapisuje wpisy i wyniki, oraz że da się to cofnąć.
5. **Pomoc.** „Wyobraź sobie, że ktoś ma bardzo zły dzień. Gdzie tu znajdzie pomoc?” Zapisz, czy osoba bez podpowiedzi znajdzie SOS albo wsparcie po stuknięciu 1–3.
6. **Na koniec.** „Czy w tej aplikacji dzieje się za dużo, w sam raz, czy za mało?” Zapisz odpowiedź dosłownie. Potem: „Z czym kojarzy Ci się ta aplikacja? Co było najgorsze?”.

## Arkusz

| Osoba | 1. Najważniejsze | Zal.? | 2. Czas (s) | Zal.? | Weszła w „Dodaj więcej”? | 7. Czas (s) / co wyrzucić | 4. Liść | 8. Własnymi słowami | 9. Zgoda: czytał(a)? / rozumie? / znalazł(a) cofnięcie? | 5. Pomoc | 6. Za dużo / w sam raz / za mało | Telefon | Uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | | |

## Co z wynikami

- **Wersja zostaje,** jeśli co najmniej 4 z 5 zaliczy zadanie 1 **i** co najmniej 4 z 5 zaliczy zadanie 2.
- **Jeśli zadanie 2 nie przejdzie:** wracają liczby od razu na ekranie, pod tą samą planetą.
- **Jeśli przejdzie tylko zadanie 2:** tniemy pierwszy ekran dalej, zadanie 1 powtarzamy na nowych osobach.
- **Zadanie 7 poniżej 4 z 5:** przebudowujemy ekran „Co dziś było?” (propozycja rady: jedna lista kafelków i osobny rząd „Co dziś ciążyło?”, `notes/rada-uwagi.md`, punkt 2). Odpowiedzi „co wyrzucić” rozstrzygają też los pól „Miłość”, „Jedzenie” i pytania „O której do łóżka?” (punkty 3 i 4).
- **Choć 1 z 5 mówi, że liść ocenia:** zespół zmienia zasadę „mały liść = gorszy dzień”.
- **Zadanie 8:** choć jedna odpowiedź „każe mi” albo „ocenia mnie” oznacza poprawkę tekstów karty. Odpowiedzi o długości Trackera rozstrzygają punkt 11 z `notes/rada-uwagi.md`.
- **Zadanie 9 poniżej 4 z 5:** poprawiamy prośbę o zgodę i wejście do „Konto i prywatność”, zanim powstaną prawdziwe konta.
- **Widoczne zacinanie na tanim telefonie:** wyłączamy rozmycie paska zakładek i tło w zwiniętym pasku.
- **Zadanie 5 nieudane choć raz:** poprawiamy to przed czymkolwiek innym, bo to bezpieczeństwo.

Pięć osób wyłapie największe problemy, ale niczego nie udowodni statystycznie. Wynik traktujcie jak mocny sygnał.

## Czego ten plan nie obejmuje

- **Rejestracji.** Rada z 11.11.2026 ustaliła osobne kryterium dla nowej kolejności rejestracji (co najmniej 4 z 5 osób kończy ją bez pomocy, `CLAUDE.md`). Ten plan zaczyna się już w aplikacji, więc rejestrację trzeba sprawdzić osobnym zadaniem albo w innym terminie. Do decyzji zespołu.
- **Prawdziwych kont.** Test działa na prototypie: dane zostają w przeglądarce telefonu i znikają z kartą prywatną. Nie zakładamy kont w Supabase.
