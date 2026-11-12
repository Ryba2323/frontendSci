/*
 * Testy — DANE (pytania, skale, opisy wyników). Bez znaczników: ekran buduje js/testy.js.
 *
 * To jest jedyne źródło treści testów. Z tego pliku powstaje też zasiew bazy:
 *   node narzedzia/baza/generuj-dane-testow.js   →   notes/supabase-testy-dane.sql
 * Po każdej zmianie treści: podbij wersję (id 'who5-v2'), nie poprawiaj starej — historia ma pokazywać to,
 * co osoba zobaczyła tamtego dnia (notes/supabase-testy.sql pilnuje tego wyzwalaczem).
 *
 * Dozwolone testy (ustalenia zespołu, 9.11.2026): tylko WHO-5 i Big Five (IPIP).
 *
 * WHO-5 (Wskaźnik Dobrego Samopoczucia): 5 zdań o ostatnich dwóch tygodniach, odpowiedzi 0–5.
 *   Treść zdań i odpowiedzi: oficjalne polskie tłumaczenie (WHO / Psychiatric Centre North Zealand).
 *   Wynik: suma 0–25 × 4 = 0–100. Progi (notes/CLAUDE.md, zgodne z literaturą): poniżej 50 „ostatnio jest Ci trudniej”,
 *   28 i mniej → ZAWSZE wsparcie (116 111, Asystent, bliskie osoby). Zmiana o 10 punktów = wyraźna zmiana.
 *   Licencja: © WHO 2024, CC BY-NC-SA 3.0 IGO (niekomercyjnie, z podaniem źródła) — DO SPRAWDZENIA przy modelu biznesowym.
 *
 * Big Five: IPIP-BFM-20 (Topolewska, Skimina, Strus, Cieciuch, Rowiński, 2014; Roczniki Psychologiczne 17(2)),
 *   20 zdań z polskiej adaptacji IPIP-BFM-50 (pozycje 1, 2, 5, 8, 9, 10, 14, 16, 17, 19, 22, 23, 28, 30, 31, 37, 39, 43, 46, 50),
 *   po 4 na cechę, w tym 2 odwrócone; odpowiedzi 1–5. IPIP jest w domenie publicznej (ipip.ori.org).
 *   Badany na osobach 16–83 lata i NIE mamy norm dla młodzieży, więc nie liczymy stenów:
 *   pokazujemy położenie na skali 0–100 i opis słowny, bez „dobrze / źle”.
 *
 * Słowa wyniku to podpowiedź, nigdy diagnoza. Każda forma gramatyczna z rejestracji (m / f / n) ma swoją treść zdania.
 *
 * Opis wyniku (band): `od` to dolna granica przedziału na skali 0–100 (włącznie); przedział kończy się tam,
 * gdzie zaczyna się następny, ostatni sięga do 100.
 */
(function (root) {
  'use strict';

  // zdanie w trzech formach; gdy forma nie ma znaczenia, wystarczy jeden napis
  const z = (m, f, n) => (f ? { m, f, n } : { m, f: m, n: m });

  const WHO5 = {
    id: 'who5-v1', code: 'who5', version: 1,
    title: 'Samopoczucie',
    kicker: '5 zdań · około minuty',
    lead: 'Jak Ci się żyło przez ostatnie dwa tygodnie?',
    officialName: 'WHO-5 — Wskaźnik Dobrego Samopoczucia',
    instruction: 'Pomyśl o ostatnich dwóch tygodniach. Przy każdym zdaniu wybierz odpowiedź, która najlepiej opisuje Twoje samopoczucie.',
    stem: 'W ciągu ostatnich dwóch tygodni…',
    answerMin: 0, answerMax: 5,
    // od answerMin do answerMax
    answerLabels: ['Nigdy', 'Od czasu do czasu', 'Mniej niż połowę czasu', 'Więcej niż połowę czasu', 'Prawie cały czas', 'Cały czas'],
    answerOrder: 'desc',            // na ekranie od „Cały czas” w dół, jak w oryginale
    minIntervalDays: 7,
    validatedFromAge: null,
    source: 'World Health Organization (2024). The World Health Organization-Five Well-Being Index (WHO-5). Polskie tłumaczenie: Psychiatric Centre North Zealand.',
    licence: 'CC BY-NC-SA 3.0 IGO',
    scales: [{
      code: 'total', name: 'Samopoczucie', unit: '%',
      bands: [
        { code: 'support', od: 0, wsparcie: true,
          title: 'To były ciężkie dwa tygodnie',
          body: 'Dobrze, że to sprawdzasz. Taki wynik to sygnał, żeby nie zostawać z tym w pojedynkę. Powiedz o tym dorosłemu, któremu ufasz (rodzic, pedagog albo psycholog w szkole, lekarz), albo zadzwoń pod 116 111 — bezpłatnie, o każdej porze.' },
        { code: 'lower', od: 29,
          title: 'Ostatnio jest Ci trudniej',
          body: 'Ostatnie dwa tygodnie były dla Ciebie cięższe. To się zdarza. Wielu osobom pomagają wtedy sen, ruch i chwila z kimś bliskim. Jeśli tak zostanie na dłużej, porozmawiaj z kimś zaufanym.' },
        { code: 'ok', od: 50,
          title: 'Ostatnio jest Ci całkiem dobrze',
          body: 'W ostatnich dwóch tygodniach było u Ciebie sporo dobrego samopoczucia. Warto zauważyć, co Ci w tym pomaga.' },
      ],
    }],
    questions: [
      { scale: 'total', text: z('Czułem się wesoły i w dobrym nastroju', 'Czułam się wesoła i w dobrym nastroju', 'Czułem(-am) się wesoły(-a) i w dobrym nastroju') },
      { scale: 'total', text: z('Czułem się spokojny i odprężony', 'Czułam się spokojna i odprężona', 'Czułem(-am) się spokojny(-a) i odprężony(-a)') },
      { scale: 'total', text: z('Czułem się aktywny i energiczny', 'Czułam się aktywna i energiczna', 'Czułem(-am) się aktywny(-a) i energiczny(-a)') },
      { scale: 'total', text: z('Budziłem się z uczuciem świeżości i wypoczęty', 'Budziłam się z uczuciem świeżości i wypoczęta', 'Budziłem(-am) się z uczuciem świeżości i wypoczęty(-a)') },
      { scale: 'total', text: z('Moje życie codzienne było wypełnione interesującymi mnie sprawami') },
    ],
  };

  // Trzy opisy na cechę: niżej / pośrodku / wyżej. Oba końce skali są w porządku — to opis, nie ocena.
  const trait = (code, name, low, high, opisy) => ({
    code, name, lowLabel: low, highLabel: high,
    bands: [
      { code: 'low', od: 0, title: opisy[0][0], body: opisy[0][1] },
      { code: 'mid', od: 34, title: opisy[1][0], body: opisy[1][1] },
      { code: 'high', od: 67, title: opisy[2][0], body: opisy[2][1] },
    ],
  });
  // pytanie IPIP: cecha, numer pozycji w IPIP-BFM-50, czy odwrócone, treść
  const q = (scale, item, reversed, text) => ({ scale, sourceItem: String(item), reversed, text });

  const IPIP20 = {
    id: 'ipip20-v1', code: 'ipip20', version: 1,
    title: 'Osobowość',
    kicker: '20 zdań · około 3 minut',
    lead: 'Pięć cech, które opisują, jak zwykle działasz.',
    officialName: 'IPIP-BFM-20 — krótki kwestionariusz Wielkiej Piątki',
    instruction: 'Przy każdym zdaniu zaznacz, jak trafnie Cię opisuje. Opisuj siebie tak, jak zwykle jest, a nie tak, jak chcesz, żeby było. Nie ma dobrych ani złych odpowiedzi.',
    stem: 'Jak trafnie to zdanie Cię opisuje?',
    answerMin: 1, answerMax: 5,
    answerLabels: ['Całkowicie nietrafnie', 'Raczej nietrafnie', 'Trochę trafnie, trochę nietrafnie', 'Raczej trafnie', 'Całkowicie trafnie'],
    answerOrder: 'asc',
    minIntervalDays: 30,
    validatedFromAge: 16,
    source: 'Topolewska, Skimina, Strus, Cieciuch, Rowiński (2014). Krótki kwestionariusz do pomiaru Wielkiej Piątki IPIP-BFM-20. Roczniki Psychologiczne, 17(2), 367–384.',
    licence: 'domena publiczna (International Personality Item Pool, ipip.ori.org)',
    scales: [
      trait('extraversion', 'Ekstrawersja', 'cisza i małe grono', 'ludzie i rozmowy', [
        ['Bliżej Ci do ciszy', 'Ładujesz baterie w spokoju i w małym gronie. Lubisz mieć czas tylko dla siebie.'],
        ['Trochę tak, trochę tak', 'Lubisz ludzi, ale potrzebujesz też chwili dla siebie. Dużo zależy od dnia i towarzystwa.'],
        ['Ciągnie Cię do ludzi', 'Rozmowy i towarzystwo dodają Ci energii. Łatwo nawiązujesz kontakt.'],
      ]),
      trait('agreeableness', 'Ugodowość', 'własne zdanie', 'troska o innych', [
        ['Mówisz, jak jest', 'Kierujesz się swoim zdaniem i potrafisz go bronić. Cudze sprawy rzadziej Cię pochłaniają.'],
        ['Między sobą a innymi', 'Potrafisz pomóc i wysłuchać, ale pamiętasz też o własnych potrzebach.'],
        ['Masz dużo ciepła dla innych', 'Zauważasz, co czują inni, i znajdujesz dla nich czas.'],
      ]),
      trait('conscientiousness', 'Sumienność', 'spontanicznie', 'według planu', [
        ['Działasz spontanicznie', 'Plan i porządek nie są dla Ciebie najważniejsze. Lubisz swobodę i decyzje na bieżąco.'],
        ['Plan, ale bez przesady', 'Umiesz się zorganizować, gdy trzeba, i odpuścić, gdy można.'],
        ['Lubisz mieć poukładane', 'Plan, porządek i sprawy załatwione na czas dają Ci spokój.'],
      ]),
      // Nazwy na ekranie są opisowe („Emocje”, „Wyobraźnia”), bo „Stabilność emocjonalna” i „Intelekt” z kropką po lewej
      // czyta się jak „jestem niestabilna” / „mam niski intelekt” (uwaga rady, 12.11.2026). Nazwa skali z narzędzia jest w komentarzu.
      trait('stability', 'Emocje', 'mocne emocje', 'spokój', [          // skala: Stabilność emocjonalna
        ['Mocno przeżywasz', 'Emocje bywają u Ciebie silne i potrafią się zmieniać. Jeśli ostatnio jest Ci z tym ciężko, zajrzyj do testu samopoczucia albo pogadaj z kimś zaufanym.'],
        ['Raz spokojnie, raz burzliwie', 'Zwykle trzymasz równowagę, choć trudniejsze chwile potrafią Cię poruszyć.'],
        ['Trudno wytrącić Cię z równowagi', 'Zwykle zachowujesz spokój, a zmartwienia nie zostają z Tobą na długo.'],
      ]),
      trait('intellect', 'Wyobraźnia', 'konkret', 'wyobraźnia', [       // skala: Intelekt
        ['Stawiasz na konkret', 'Wolisz to, co praktyczne i sprawdzone, od abstrakcyjnych rozważań.'],
        ['Trochę praktyki, trochę wyobraźni', 'Lubisz nowe pomysły, ale cenisz też to, co znane i konkretne.'],
        ['Masz głowę pełną pomysłów', 'Ciekawią Cię nowe idee. Lubisz myśleć, wyobrażać sobie i szukać słów.'],
      ]),
    ],
    // kolejność jak w oryginale (rosnąco po numerze pozycji), cechy się przeplatają
    questions: [
      q('extraversion', 1, false, z('Jestem duszą towarzystwa')),
      q('agreeableness', 2, true, z('Niezbyt obchodzą mnie inni ludzie')),
      q('intellect', 5, false, z('Mam bogate słownictwo')),
      q('conscientiousness', 8, true, z('Zostawiam moje rzeczy, gdzie popadnie')),
      q('stability', 9, false, z('Zwykle jestem zrelaksowany', 'Zwykle jestem zrelaksowana', 'Zwykle jestem zrelaksowany(-a)')),
      q('intellect', 10, true, z('Mam trudności ze zrozumieniem abstrakcyjnych pojęć')),
      q('stability', 14, true, z('Często martwię się czymś')),
      q('extraversion', 16, true, z('Trzymam się z boku')),
      q('agreeableness', 17, false, z('Jestem wyrozumiały dla uczuć innych ludzi', 'Jestem wyrozumiała dla uczuć innych ludzi', 'Jestem wyrozumiały(-a) dla uczuć innych ludzi')),
      q('stability', 19, false, z('Rzadko czuję się przygnębiony', 'Rzadko czuję się przygnębiona', 'Rzadko czuję się przygnębiony(-a)')),
      q('agreeableness', 22, true, z('Nie interesują mnie problemy innych ludzi')),
      q('conscientiousness', 23, false, z('Bez zwłoki wypełniam codzienne obowiązki')),
      q('conscientiousness', 28, true, z('Często zapominam odkładać rzeczy na miejsce')),
      q('intellect', 30, true, z('Nie mam zbyt bogatej wyobraźni')),
      q('extraversion', 31, false, z('Rozmawiam z wieloma różnymi ludźmi na przyjęciach')),
      q('agreeableness', 37, false, z('Znajduję czas dla innych')),
      q('stability', 39, true, z('Często miewam huśtawki nastrojów')),
      q('conscientiousness', 43, false, z('Postępuję zgodnie z harmonogramem')),
      q('extraversion', 46, true, z('Wśród nieznajomych jestem małomówny', 'Wśród nieznajomych jestem małomówna', 'Wśród nieznajomych jestem małomówny(-a)')),
      q('intellect', 50, false, z('Mam głowę pełną pomysłów')),
    ],
  };

  const TESTY = [WHO5, IPIP20];

  // ================================================================
  //  Liczenie wyniku — to samo robi serwer w submit_test() (notes/supabase-testy.sql).
  //  W prototypie liczymy tutaj; po podłączeniu backendu ekran pokazuje to, co zwróci serwer.
  // ================================================================
  // answers: odpowiedzi w kolejności pytań, w skali testu, bez odwracania
  function score(test, answers) {
    if (!Array.isArray(answers) || answers.length !== test.questions.length ||
        answers.some(v => !Number.isInteger(v) || v < test.answerMin || v > test.answerMax)) {
      throw new Error('invalid_answers');
    }
    return test.scales.map(s => {
      let raw = 0, n = 0;
      test.questions.forEach((qq, i) => {
        if (qq.scale !== s.code) return;
        raw += qq.reversed ? test.answerMin + test.answerMax - answers[i] : answers[i];
        n++;
      });
      const scaled = Math.round((raw - n * test.answerMin) / (n * (test.answerMax - test.answerMin)) * 10000) / 100;
      return { scale: s.code, raw, scaled, band: bandFor(s, scaled).code };
    });
  }
  // przedział, do którego trafia wynik: ostatni z `od` nie większym niż wynik
  function bandFor(scale, scaled) {
    let hit = scale.bands[0];
    scale.bands.forEach(b => { if (scaled >= b.od) hit = b; });
    return hit;
  }
  const byId = id => TESTY.find(t => t.id === id) || null;
  const byCode = code => TESTY.find(t => t.code === code) || null;
  const scaleOf = (test, code) => test.scales.find(s => s.code === code) || null;
  const bandOf = (test, scaleCode, bandCode) => {
    const s = scaleOf(test, scaleCode);
    return s ? s.bands.find(b => b.code === bandCode) || null : null;
  };

  const api = { TESTY, score, bandFor, byId, byCode, scaleOf, bandOf };
  root.TestyDane = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
