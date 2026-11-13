/*
 * Wnioski (spersonalizowane insighty) — DANE: co zbieramy w podlewaniu, które czynniki sprawdzamy i jak o nich mówimy.
 * Liczenie jest w js/wnioski.js, ekran w js/tracker.js. Pełny opis zasad: notes/wnioski.md.
 *
 * POLA — to, co osoba zaznacza w podlewaniu poza nastrojem i snem (kody jak w tabeli `checkin_fields`):
 *   obszary dnia  (−1 ciężko / 0 ok / 1 dobrze): family, friends, nature, study,
 *   co dziś było  (zaznaczone = 1):               move, hobby, rest, talk, kindness, prepare.
 * Z tego pliku powstaje zasiew bazy: node narzedzia/baza/generuj-dane-wnioskow.js → notes/supabase-wnioski-dane.sql.
 *
 * CZYNNIKI — pytania, które silnik zadaje danym: „czy w dni, kiedy X, nastrój jest inny niż w pozostałe?”.
 *   code      stały identyfikator (trafia do klucza wniosku, np. `czynnik:ruch`)
 *   group     wnioski z tej samej grupy nie pokazują się obok siebie (np. dwa o śnie)
 *   cat       kolor kategorii w wykresie (tylko Tracker)
 *   lag       0 = ten sam wpis co nastrój; 1 = czynnik z poprzedniego dnia (np. spakowanie się wieczorem)
 *   dir       oczekiwany kierunek: +1 „wtedy bywa lepiej”, −1 „wtedy bywa trudniej”. Wynik w przeciwną stronę NIE jest pokazywany
 *             (nigdy nie radzimy „mniej ruchu” ani „mniej ludzi”).
 *   tone      'pomaga'    — coś, na co osoba ma wpływ: dostaje radę, trafia do „Co Ci pomaga” i może być eksperymentem,
 *             'zauwazone' — opis z łagodną podpowiedzią; nie trafia do „Co Ci pomaga” ani na Dom (dom, nauka: nie wszystko
 *                           zależy od nastolatka),
 *             'wsparcie'  — trudne sprawy, na które nastolatek nie ma wpływu (dom, relacje). NIE SĄ WNIOSKIEM: nie liczymy
 *                           dla nich różnicy nastroju, nie ma liczby, wykresu ani opinii. Gdy „ciężko” powtarza się kilka
 *                           razy w dwa tygodnie (PROGI.trudneIle), na górze Trackera pojawia się karta wsparcia z tekstem
 *                           `wsparcie` (uwaga psychologa z rady, 12.11.2026). ŻADNYCH rad.
 *   known(e)  czy we wpisie w ogóle jest odpowiedź (brak odpowiedzi ≠ „nie”). Przy ocenach „ciężko / ok / dobrze” dni
 *             z PRZECIWNĄ oceną nie wchodzą do porównania: „dobrze z przyjaciółmi” porównujemy z dniami „ok” i bez
 *             zaznaczenia, a nie z dniami „ciężko” (inaczej trudne dni same robiły „wniosek” o dobrych i na odwrót).
 *   has(e)    czy czynnik wystąpił
 *   proba     ile razy w tygodniu proponujemy to sprawdzić; null = nie proponujemy. Tylko ZACHOWANIA, nie wyniki
 *             (dlatego eksperymentem jest „do łóżka przed 23”, a nie „7 h snu”, na które przy kłopotach ze snem nie ma się wpływu).
 *   gdzie     zdanie na karcie eksperymentu: z którego pytania podlewania to liczymy
 *   ogolnie   zdanie z wiedzy ogólnej (zalecenia dla nastolatków), pokazywane ZANIM są wnioski z danych tej osoby,
 *             zawsze z dopiskiem, że to wiedza ogólna do sprawdzenia u siebie — tylko przy dobrze udokumentowanych sprawach
 *
 * Czego celowo NIE analizujemy (bezpieczeństwo):
 *   • miłość i jedzenie — zbyt wrażliwe na automatyczne wnioski (przy restrykcjach „z jedzeniem dobrze” może znaczyć
 *     „udało się nie jeść”, a wniosek by to potwierdził). Pola są jeszcze w podlewaniu; decyzja zespołu, czy zostają,
 *   • ilość jedzenia, waga, wygląd — nigdy,
 *   • niczego, co prowadziłoby do rady „unikaj ludzi / szkoły / domu”.
 *
 * Język: opis, nie przyczyna i nie diagnoza. Tytuły mówią „w dni z X bywa Ci lepiej”, nigdy „X poprawia / dodaje / pomaga”,
 * bo z samych wpisów nie wiadomo, co jest przyczyną (w lepszy dzień łatwiej się ruszyć). Bez „musisz”, „powinieneś”, bez winy.
 * Zdania są w formie bez rodzaju gramatycznego, więc nie zależą od formy z rejestracji.
 */
(function (root) {
  'use strict';

  const PL = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

  // ================================================================
  //  Pola podlewania
  // ================================================================
  // „Jedzenie” i „Miłość” usunięte 13.11.2026 (rada: psycholog, prawnik i projektantka niezależnie). Nic z nich nie
  // korzystało, więc łamały zasadę „zbieramy tylko to, z czego powstaje wniosek” (RODO art. 5 ust. 1 lit. c),
  // a codzienna ocena jedzenia podtrzymuje skupienie na nim. W bazie pola zostają wyłączone (is_active = false).
  const AREAS = [
    { code: 'family', name: 'Rodzina' },
    { code: 'friends', name: 'Przyjaciele' },
    { code: 'nature', name: 'Natura' },
    { code: 'study', name: 'Nauka' },
  ];
  // „Co dziś było?” — rzeczy, na które ma się wpływ. Krótka lista: każda pozycja musi służyć jakiemuś wnioskowi.
  const ACTS = [
    { code: 'move', name: 'Ruch', icon: '<circle cx="13" cy="4.5" r="2"/><path d="M7 21l3-6 3 2v4M10 15l1.5-6 4 2 2.5 3M11.5 9L8 10.5 6.5 14"/>' },
    { code: 'hobby', name: 'Hobby', icon: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
    { code: 'rest', name: 'Odpoczynek', icon: '<path d="M7 11V8a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 17 8v3"/><path d="M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4.500H3V13a2 2 0 0 1 2-2z"/><path d="M6 17.500V20M18 17.500V20"/>' },   // fotel (dawna ikona wyglądała jak dzwonek)
    { code: 'talk', name: 'Szczera rozmowa', icon: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>' },
    { code: 'kindness', name: 'Coś dla kogoś', icon: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7C10.500 3.500 6.500 4 7.500 7M12 7c1.500-3.500 5.500-3 4.500 0"/>' },   // prezent (serce jest już w „Miłość” i SOS)
    { code: 'prepare', name: 'Plecak na jutro', icon: '<path d="M6 8h12v12H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6"/>' },
  ];
  // „O której do łóżka?” — o zeszłej nocy, tak jak pytanie o godziny snu
  const BEDTIME = [
    { v: 1, label: 'przed 22' },
    { v: 2, label: '22–23' },
    { v: 3, label: '23–24' },
    { v: 4, label: 'po północy' },
  ];

  // ================================================================
  //  Czynniki
  // ================================================================
  const anyTag = e => Object.keys(e.areas || {}).length + Object.keys(e.acts || {}).length > 0;
  const area = (code, v) => e => (e.areas || {})[code] === v;
  const act = code => e => (e.acts || {})[code] === 1;
  // odpowiedź jest, ale nie z przeciwną oceną (patrz `known` w nagłówku)
  const bez = (code, v) => e => anyTag(e) && (e.areas || {})[code] !== v;
  const GDZIE = {
    sen: 'Liczymy to z pytania o sen w podlewaniu.',
    act: 'Liczymy to z „Co dziś było?” w podlewaniu.',
    area: n => `Liczymy dni, w których przy „${n}” w podlewaniu jest „Dobrze”.`,
  };

  const CZYNNIKI = [
    // ---------- sen ----------
    {
      code: 'sen_dlugi', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'pomaga',
      known: e => e.sleepHours != null, has: e => e.sleepHours >= 7,
      nazwa: 'Sen 7 h i więcej', tag: 'Sen',
      tytul: 'W dni po dłuższym śnie bywa Ci lepiej',
      zdanie: x => `Po nocy z co najmniej 7 h snu Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: '7 h i więcej', nie: 'mniej niż 7 h',
      ogolnie: 'Wielu osobom w Twoim wieku pomaga 8 h snu albo więcej.',
      dlaczego: 'Po dobrej nocy łatwiej o spokój i mniej rzeczy wytrąca z równowagi.',
      sprobuj: 'położyć się dziś pół godziny wcześniej',
      proba: null,                                   // długość snu to wynik, nie zachowanie: eksperymentem jest pora pójścia spać
      wDniu: { tekst: 'częściej śpisz krócej niż 7 h', rada: 'położyć się dzień wcześniej trochę szybciej' },
    },
    {
      code: 'spac_wczesnie', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'pomaga',
      known: e => e.bedtime != null, has: e => e.bedtime <= 2,
      nazwa: 'Do łóżka przed 23', tag: 'Sen',
      tytul: 'Po wcześniejszym pójściu spać dzień bywa lepszy',
      zdanie: x => `Gdy kładziesz się przed 23, następny dzień bywa o około <b>${x}</b> lepszy.`,
      tak: 'przed 23', nie: 'po 23',
      dlaczego: 'Stała, wcześniejsza pora snu ułatwia zasypianie i poranne wstawanie.',
      sprobuj: 'położyć się dziś przed 23',
      proba: { ile: 3, co: 'wieczory z pójściem do łóżka przed 23' }, gdzie: GDZIE.sen,
      wDniu: { tekst: 'częściej kładziesz się po 23', rada: 'położyć się dzień wcześniej przed 23' },
    },
    {
      code: 'sen_dobry', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'zauwazone',
      known: e => e.sleepQuality != null, has: e => e.sleepQuality >= 3,
      nazwa: 'Dobrze przespana noc', tag: 'Sen',
      tytul: 'Po dobrze przespanej nocy dzień bywa lepszy',
      zdanie: x => `Po dobrze przespanej nocy Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'dobra noc', nie: 'gorsza noc',
      dlaczego: 'Liczy się nie tylko to, ile śpisz, ale też jak.',
      sprobuj: 'wyciszyć się kwadrans przed snem: bez ekranu, przy muzyce albo książce',
      proba: null,
      wDniu: { tekst: 'częściej gorzej śpisz', rada: 'wyciszyć się kwadrans przed snem' },
    },
    // ---------- ciało ----------
    {
      code: 'ruch', group: 'cialo', cat: '--cat-nature', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('move'),
      nazwa: 'Ruch', tag: 'Ruch',
      tytul: 'W dni z ruchem bywa Ci lepiej',
      zdanie: x => `W dni z ruchem Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'z ruchem', nie: 'bez ruchu',
      ogolnie: 'Regularny ruch poprawia nastrój u większości ludzi.',
      dlaczego: 'Nawet krótki ruch rozładowuje napięcie i poprawia sen.',
      sprobuj: 'ruszyć się dziś choćby na 15 minut: spacer, rower, taniec w pokoju',
      proba: { ile: 3, co: 'dni z ruchem, choćby 15 minut' }, gdzie: GDZIE.act,
      wDniu: { tekst: 'rzadziej jest ruch', rada: 'zaplanować krótki spacer' },
    },
    {
      code: 'natura', group: 'cialo', cat: '--cat-nature', lag: 0, dir: 1, tone: 'pomaga',
      known: bez('nature', -1), has: area('nature', 1),
      nazwa: 'Wyjście na dwór', tag: 'Na dworze',
      tytul: 'W dni z wyjściem na dwór bywa Ci lepiej',
      zdanie: x => `W dni z dobrym czasem na dworze Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'na dworze', nie: 'pozostałe dni',
      ogolnie: 'Wielu osobom pomaga choćby 20 minut na dworze w ciągu dnia.',
      dlaczego: 'Światło dzienne i zmiana otoczenia pomagają głowie odpocząć.',
      sprobuj: 'wyjść na 20 minut na świeże powietrze',
      proba: { ile: 3, co: 'wyjścia na dwór' }, gdzie: GDZIE.area('Natura'),
      wDniu: { tekst: 'rzadziej wychodzisz na dwór', rada: 'wyjść na 20 minut na świeże powietrze' },
    },
    // ---------- ludzie ----------
    {
      code: 'przyjaciele', group: 'ludzie', cat: '--cat-friends', lag: 0, dir: 1, tone: 'pomaga',
      known: bez('friends', -1), has: area('friends', 1),
      nazwa: 'Czas z przyjaciółmi', tag: 'Przyjaciele',
      tytul: 'W dni z przyjaciółmi bywa Ci lepiej',
      zdanie: x => `W dni z dobrym czasem z przyjaciółmi Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'z przyjaciółmi', nie: 'pozostałe dni',
      ogolnie: 'Kontakt z ludźmi, przy których można być sobą, pomaga większości z nas.',
      dlaczego: 'Bliskość z ludźmi, przy których można być sobą, zmniejsza napięcie.',
      sprobuj: 'napisać do kogoś i umówić się choćby na krótki spacer',
      proba: { ile: 2, co: 'spotkania albo rozmowy z kimś bliskim' }, gdzie: GDZIE.area('Przyjaciele'),
      wDniu: { tekst: 'rzadziej spotykasz się z przyjaciółmi', rada: 'umówić się z kimś choćby na krótki spacer' },
    },
    {
      code: 'rodzina', group: 'ludzie', cat: '--cat-family', lag: 0, dir: 1, tone: 'zauwazone',
      known: bez('family', -1), has: area('family', 1),
      nazwa: 'Dobry czas z rodziną', tag: 'Rodzina',
      tytul: 'W dni z dobrym czasem w domu bywa Ci lepiej',
      zdanie: x => `W dni z dobrym czasem z rodziną Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'dobry czas', nie: 'pozostałe dni',
      dlaczego: 'Spokojna chwila z kimś z domu daje poczucie oparcia.',
      sprobuj: null,                                 // bez rady: klimat w domu nie jest zadaniem nastolatka
      proba: null,
      wDniu: null,
    },
    {
      code: 'rozmowa', group: 'ludzie', cat: '--cat-friends', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('talk'),
      nazwa: 'Szczera rozmowa', tag: 'Rozmowa',
      tytul: 'W dni ze szczerą rozmową bywa Ci lżej',
      zdanie: x => `W dni ze szczerą rozmową Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'z rozmową', nie: 'bez rozmowy',
      dlaczego: 'Wypowiedziane na głos sprawy ważą mniej.',
      sprobuj: 'powiedzieć dziś komuś zaufanemu, co u Ciebie',
      proba: { ile: 2, co: 'szczere rozmowy z kimś zaufanym' }, gdzie: GDZIE.act,
      wDniu: null,
    },
    {
      code: 'dla_kogos', group: 'ludzie', cat: '--cat-family', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('kindness'),
      nazwa: 'Coś dla kogoś', tag: 'Dla innych',
      tytul: 'Gdy robisz coś dla kogoś, dzień bywa lepszy',
      zdanie: x => `W dni, kiedy robisz coś dla kogoś, Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'coś dla kogoś', nie: 'pozostałe dni',
      dlaczego: 'Pomaganie daje poczucie, że ma się na coś wpływ.',
      sprobuj: 'zrobić dziś jedną drobną rzecz dla kogoś',
      proba: { ile: 2, co: 'drobne rzeczy zrobione dla kogoś' }, gdzie: GDZIE.act,
      wDniu: null,
    },
    // ---------- głowa ----------
    {
      code: 'hobby', group: 'glowa', cat: '--cat-study', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('hobby'),
      nazwa: 'Hobby', tag: 'Hobby',
      tytul: 'W dni z czasem na hobby bywa Ci lepiej',
      zdanie: x => `W dni z czasem na hobby Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'z hobby', nie: 'bez hobby',
      dlaczego: 'To, co lubisz, przypomina, że dzień to nie tylko obowiązki.',
      sprobuj: 'znaleźć dziś 20 minut na coś, co lubisz',
      proba: { ile: 3, co: 'dni z czasem na hobby' }, gdzie: GDZIE.act,
      wDniu: null,
    },
    {
      code: 'odpoczynek', group: 'glowa', cat: '--cat-family', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('rest'),
      nazwa: 'Odpoczynek', tag: 'Odpoczynek',
      tytul: 'W dni z odpoczynkiem bywa Ci lżej',
      zdanie: x => `W dni z chwilą odpoczynku Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'z odpoczynkiem', nie: 'bez',
      dlaczego: 'Głowa potrzebuje przerw tak samo jak ciało.',
      sprobuj: 'dać sobie dziś 15 minut na nic',
      proba: { ile: 3, co: 'dni z chwilą prawdziwego odpoczynku' }, gdzie: GDZIE.act,
      wDniu: null,
    },
    {
      code: 'przygotowanie', group: 'glowa', cat: '--cat-study', lag: 1, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('prepare'),
      nazwa: 'Plecak spakowany wieczorem', tag: 'Wieczór wcześniej',
      tytul: 'Po spakowaniu się wieczorem dzień bywa lżejszy',
      zdanie: x => `Gdy pakujesz się wieczorem, następny dzień bywa o około <b>${x}</b> lepszy.`,
      tak: 'po spakowaniu', nie: 'bez',
      dlaczego: 'Mniej rzeczy do ogarnięcia rano to spokojniejszy start.',
      sprobuj: 'spakować się dziś wieczorem na jutro',
      proba: { ile: 3, co: 'wieczory ze spakowaniem się na jutro' }, gdzie: GDZIE.act,
      wDniu: { tekst: 'wieczór wcześniej rzadziej pakujesz się na jutro', rada: 'spakować się wieczór wcześniej, żeby rano mieć spokój' },
    },
    {
      code: 'nauka_dobrze', group: 'nauka', cat: '--cat-study', lag: 0, dir: 1, tone: 'zauwazone',
      known: bez('study', -1), has: area('study', 1),
      nazwa: 'Gdy nauka idzie dobrze', tag: 'Nauka',
      tytul: 'Gdy nauka idzie lżej, dzień też bywa lżejszy',
      zdanie: x => `W dni, kiedy nauka szła dobrze, Twój nastrój bywa o około <b>${x}</b> wyższy.`,
      tak: 'szła dobrze', nie: 'pozostałe dni',
      dlaczego: 'Zamknięte zadanie przestaje krążyć po głowie.',
      sprobuj: 'uczyć się po 20 minut i robić przerwy',
      proba: null,
      wDniu: null,
    },
    {
      code: 'nauka_ciezko', group: 'nauka', cat: '--cat-study', lag: 0, dir: -1, tone: 'zauwazone',
      known: bez('study', 1), has: area('study', -1),
      nazwa: 'Trudna nauka', tag: 'Nauka',
      tytul: 'W dni z trudną nauką bywa Ci ciężej',
      zdanie: x => `W dni, kiedy nauka była ciężka, Twój nastrój bywa o około <b>${x}</b> niższy.`,
      tak: 'ciężka nauka', nie: 'pozostałe dni',
      dlaczego: 'Zaległości i trudny materiał zabierają dużo siły.',
      sprobuj: 'zacząć od najmniejszego zadania, a przy najtrudniejszym poprosić kogoś o pomoc',
      proba: null,
      wDniu: { tekst: 'częściej zaznaczasz, że nauka była trudna', rada: 'przejrzeć plan wcześniej i zacząć od najmniejszego zadania' },
    },
    // ---------- trudne sprawy: NIE wniosek, tylko karta wsparcia po kilku takich dniach; bez rad ----------
    // Teksty od psychologa z rady (12.11.2026). Do zatwierdzenia przez psychologa zespołu przed prawdziwymi kontami.
    {
      code: 'rodzina_ciezko', group: 'ludzie_trudne', cat: '--cat-family', lag: 0, dir: -1, tone: 'wsparcie',
      known: anyTag, has: area('family', -1),
      nazwa: 'Trudniej w domu', tag: 'Rodzina',
      wsparcie: 'Trudne dni w domu bardzo ciążą i nie musisz dźwigać tego w pojedynkę. Jeśli ktoś w domu Cię krzywdzi, straszy albo boisz się wracać, to nigdy nie jest Twoja wina. Pod 116 111 możesz o tym powiedzieć anonimowo. Gdy coś Ci grozi teraz, dzwoń pod 112.',
      alarm: true,                                   // na karcie jest też przycisk 112
      proba: null, wDniu: null,
    },
    {
      code: 'przyjaciele_ciezko', group: 'ludzie_trudne', cat: '--cat-friends', lag: 0, dir: -1, tone: 'wsparcie',
      known: anyTag, has: area('friends', -1),
      nazwa: 'Trudniej ze znajomymi', tag: 'Przyjaciele',
      wsparcie: 'Trudne chwile ze znajomymi potrafią mocno boleć. Jeśli ktoś Ci dokucza, wyklucza Cię albo robi Ci krzywdę, także w sieci, to nie Twoja wina. Powiedz o tym dorosłemu, któremu ufasz, albo zadzwoń pod 116 111.',
      alarm: false,
      proba: null, wDniu: null,
    },
  ];

  // ================================================================
  //  Progi (wszystkie w jednym miejscu; uzasadnienie w notes/wnioski.md)
  // ================================================================
  const PROGI = {
    okno: 90,                 // z ilu ostatnich dni liczymy
    doPodsumowania: 7,        // tyle podlań z nastrojem: podsumowanie tygodnia
    doWnioskow: 14,           // tyle podlań: najwcześniej wtedy liczymy wnioski o czynnikach
    doDniTygodnia: 28,        // tyle podlań: wzór dni tygodnia i poprawka na dzień tygodnia
    minGrupa: 5,              // najmniej dni „z” i „bez”, żeby w ogóle porównywać
    minRoznica: 0.6,          // najmniejsza różnica nastroju (w punktach 1–10), o której warto mówić
    permutacje: 2000,
    // pewność 1 „wstępnie”, 2 „dość wyraźnie”, 3 „wyraźnie”
    q: [0.10, 0.05, 0.05],    // próg kontroli fałszywych odkryć (Benjamini–Hochberg) dla poziomu 1, 2, 3
    blok: 7,                  // długość bloku w teście permutacyjnym (dni); bloki są przypięte do kalendarza
    minGrupaPoziom: [5, 7, 10],
    minDniPoziom: [14, 21, 40],
    minDolna: [0, 0.25, 0.4], // dolna granica różnicy po odjęciu niepewności
    pWyraznie: 0.001,         // „wyraźnie” wymaga też tak małego p (0,005 dawało „wyraźnie” prawie każdemu wnioskowi z poziomu 2)
    // wniosek pokazujemy dopiero, gdy wychodził też tyle dni wcześniej (lista: np. [7] albo [7, 14]).
    // Liczone codziennie, pojedyncze trafy z szumu trwają zwykle 1–2 dni; bez tego fałszywy wniosek zobaczyłaby
    // kiedyś ponad połowa osób. Z [7]: ok. jedna czwarta. Z [7, 14]: ok. jedna ósma, ale prawdziwe wnioski później.
    potwierdzenie: [7],
    // dwa wnioski naraz: każdy musi się bronić przy stałym drugim (np. długi sen i wczesna pora chodzą w parze)
    blokWarunkowy: 14,
    warunkowaRoznica: 0.4,
    warunkoweP: 0.10,
    warunkowePermutacje: 1000,
    // zmiana z ostatnich dwóch tygodni: co najmniej 1 punkt i wyraźnie ponad niepewność
    trendMin: 1.0,
    trendSE: 2.0,
    // opis ostatnich dwóch tygodni (zanim są wnioski): „Ruch · 4 z 9 dni”. Bez wiązania z nastrojem.
    opisDni: 14,
    opisMinDni: 5,            // tyle dni z odpowiedzią, żeby cokolwiek policzyć
    opisMin: 2,               // tyle wystąpień, żeby pokazać
    maxObserwacji: 2,
    maxWnioskow: 3,           // tyle kart naraz w „Co zauważyliśmy”
    maxPomaga: 3,
    ukryjNaDni: 60,           // „To nie pasuje” chowa wniosek na tyle dni
    // wsparcie
    niskiNastroj: 3,
    wsparcieIle: 3,           // tyle dni z nastrojem ≤ 3 w ostatnich 7 → karta wsparcia
    wsparcieDlugoDni: 3,      // przewlekle: w ostatnim tygodniu ORAZ w tygodniu przed nim co najmniej tyle wpisów…
    wsparcieDlugoSrednia: 4.5, // …i średnia każdego z nich nie wyższa niż tyle
    wsparcieDlugoNiskie: 6,   // albo tyle dni z nastrojem ≤ 3 w ostatnich 14, z czego co najmniej 2 w starszym tygodniu
    wsparcieSpadekMinDni: 5,  // spadek liczymy z co najmniej tylu wpisów w ostatnim tygodniu
    wsparcieSpadek: 1.5,      // ostatni tydzień o tyle niżej niż własna mediana sprzed dwóch tygodni…
    wsparcieSpadekPonizej: 6, // …i sam poniżej tego poziomu (tydzień „7 zamiast 8,5” to nie powód do alarmu)
    trudneIle: 4,             // tyle razy „ciężko” (dom / znajomi) w ostatnich `trudneDni` dniach → karta wsparcia
    trudneDni: 14,
    // eksperyment
    probaDni: 7,
    probaMinRoznica: 1.0,     // od takiej różnicy mówimy „dni z tym były trochę lepsze” (to opis tygodnia, nie wyrok)
  };

  const SLOWA_PEWNOSCI = ['', 'Wstępnie', 'Dość wyraźnie', 'Wyraźnie'];
  const DNI = {
    nazwa: ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'],
    przym: ['niedzielne', 'poniedziałkowe', 'wtorkowe', 'środowe', 'czwartkowe', 'piątkowe', 'sobotnie'],
    w: ['w niedziele', 'w poniedziałki', 'we wtorki', 'w środy', 'w czwartki', 'w piątki', 'w soboty'],
    przed: ['niedzielą', 'poniedziałkiem', 'wtorkiem', 'środą', 'czwartkiem', 'piątkiem', 'sobotą'],
    litera: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'],
  };

  const api = { WERSJA: 2, AREAS, ACTS, BEDTIME, CZYNNIKI, PROGI, SLOWA_PEWNOSCI, DNI, PL };
  root.WnioskiDane = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
