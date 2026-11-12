/*
 * Wnioski (spersonalizowane insighty) — DANE: co zbieramy w podlewaniu, które czynniki sprawdzamy i jak o nich mówimy.
 * Liczenie jest w js/wnioski.js, ekran w js/tracker.js. Pełny opis zasad: notes/wnioski.md.
 *
 * POLA — to, co osoba zaznacza w podlewaniu poza nastrojem i snem (kody jak w tabeli `checkin_fields`):
 *   obszary dnia  (−1 ciężko / 0 ok / 1 dobrze): food, family, friends, love, nature, study,
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
 *   tone      'pomaga'    — coś, na co osoba ma wpływ: dostaje radę i może to wypróbować przez tydzień,
 *             'zauwazone' — obserwacja z łagodną podpowiedzią, bez próby,
 *             'wsparcie'  — trudne sprawy, na które nastolatek nie ma wpływu (dom, relacje): ŻADNYCH rad,
 *                           tylko „to nie Twoja wina” i wsparcie (Asystent, 116 111).
 *   known(e)  czy we wpisie w ogóle jest odpowiedź (brak odpowiedzi ≠ „nie”)
 *   has(e)    czy czynnik wystąpił
 *   proba     ile razy w tygodniu proponujemy to wypróbować; null = nie proponujemy próby
 *   obs       końcówka zdania obserwacji: „W Twoje lepsze dni często …”
 *   ogolnie   zdanie z wiedzy ogólnej (zalecenia dla nastolatków), pokazywane ZANIM są wnioski z danych tej osoby,
 *             zawsze z dopiskiem, że to wiedza ogólna do sprawdzenia u siebie — tylko przy dobrze udokumentowanych sprawach
 *
 * Czego celowo NIE analizujemy (bezpieczeństwo):
 *   • miłość (obie strony) i „z jedzeniem było ciężko” — zbyt wrażliwe na automatyczne wnioski,
 *   • ilość jedzenia, waga, wygląd — nigdy; o jedzeniu mówimy tylko „na spokojnie”,
 *   • niczego, co prowadziłoby do rady „unikaj ludzi / szkoły / domu”.
 *
 * Język: podpowiedź, nie diagnoza. „Bywa”, „zwykle”, „spróbuj i zobacz”. Bez „musisz”, „powinieneś”, bez winy.
 * Zdania są w formie bez rodzaju gramatycznego, więc nie zależą od formy z rejestracji.
 */
(function (root) {
  'use strict';

  const PL = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

  // ================================================================
  //  Pola podlewania
  // ================================================================
  const AREAS = [
    { code: 'food', name: 'Jedzenie' },
    { code: 'family', name: 'Rodzina' },
    { code: 'friends', name: 'Przyjaciele' },
    { code: 'love', name: 'Miłość' },
    { code: 'nature', name: 'Natura' },
    { code: 'study', name: 'Nauka' },
  ];
  // „Co dziś było?” — rzeczy, na które ma się wpływ. Krótka lista: każda pozycja musi służyć jakiemuś wnioskowi.
  const ACTS = [
    { code: 'move', name: 'Ruch', icon: '<circle cx="13" cy="4.5" r="2"/><path d="M7 21l3-6 3 2v4M10 15l1.5-6 4 2 2.5 3M11.5 9L8 10.5 6.5 14"/>' },
    { code: 'hobby', name: 'Hobby', icon: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
    { code: 'rest', name: 'Odpoczynek', icon: '<path d="M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 4v2"/>' },
    { code: 'talk', name: 'Szczera rozmowa', icon: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>' },
    { code: 'kindness', name: 'Coś dla kogoś', icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
    { code: 'prepare', name: 'Spakowanie na jutro', icon: '<path d="M6 8h12v12H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6"/>' },
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

  const CZYNNIKI = [
    // ---------- sen ----------
    {
      code: 'sen_dlugi', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'pomaga',
      known: e => e.sleepHours != null, has: e => e.sleepHours >= 7,
      nazwa: 'Sen 7 h i więcej', tag: 'Sen',
      obs: 'była za Tobą noc z co najmniej 7 h snu',
tytul: 'Sen poprawia Ci dzień',
      zdanie: x => `Po nocy z co najmniej 7 h snu Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: '7 h i więcej', nie: 'mniej niż 7 h',
      ogolnie: 'Większości osób w Twoim wieku służy 8–10 godzin snu.',
      dlaczego: 'Wyspany mózg łatwiej radzi sobie ze stresem i emocjami.',
      sprobuj: 'położyć się dziś pół godziny wcześniej',
      proba: { ile: 4, co: 'noce z co najmniej 7 h snu' },
      wDniu: { tekst: 'częściej śpisz krócej niż 7 h', rada: 'położyć się dzień wcześniej trochę szybciej' },
    },
    {
      code: 'spac_wczesnie', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'pomaga',
      known: e => e.bedtime != null, has: e => e.bedtime <= 2,
      nazwa: 'Do łóżka przed 23', tag: 'Sen',
      obs: 'była za Tobą noc zaczęta przed 23',
      tytul: 'Wcześniejsza pora snu Ci służy',
      zdanie: x => `Gdy kładziesz się przed 23, następny dzień bywa o <b>${x}</b> lepszy.`,
      tak: 'przed 23', nie: 'po 23',
      dlaczego: 'Stała, wcześniejsza pora snu ułatwia zasypianie i poranne wstawanie.',
      sprobuj: 'odłożyć telefon i położyć się dziś przed 23',
      proba: { ile: 3, co: 'wieczory z pójściem do łóżka przed 23' },
      wDniu: { tekst: 'częściej kładziesz się po 23', rada: 'położyć się dzień wcześniej przed 23' },
    },
    {
      code: 'sen_dobry', group: 'sen', cat: '--cat-sleep', lag: 0, dir: 1, tone: 'zauwazone',
      known: e => e.sleepQuality != null, has: e => e.sleepQuality >= 3,
      nazwa: 'Dobrze przespana noc', tag: 'Sen',
      tytul: 'Jakość snu widać w Twoim dniu',
      zdanie: x => `Po dobrze przespanej nocy Twój nastrój bywa o <b>${x}</b> wyższy.`,
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
      obs: 'był ruch',
      tytul: 'Ruch dodaje Ci energii',
      zdanie: x => `W dni z ruchem Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'z ruchem', nie: 'bez ruchu',
      ogolnie: 'Regularny ruch poprawia nastrój u większości ludzi.',
      dlaczego: 'Nawet krótki ruch rozładowuje napięcie i poprawia sen.',
      sprobuj: 'ruszyć się dziś choćby na 15 minut: spacer, rower, taniec w pokoju',
      proba: { ile: 3, co: 'dni z ruchem, choćby 15 minut' },
      wDniu: { tekst: 'rzadziej jest ruch', rada: 'zaplanować krótki spacer' },
    },
    {
      code: 'natura', group: 'cialo', cat: '--cat-nature', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: area('nature', 1),
      nazwa: 'Wyjście na dwór', tag: 'Na dworze',
      obs: 'było wyjście na dwór',
      tytul: 'Świeże powietrze robi Ci dobrze',
      zdanie: x => `W dni z dobrym czasem na dworze Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'na dworze', nie: 'bez wyjścia',
      ogolnie: 'Wielu osobom pomaga choćby 20 minut na dworze w ciągu dnia.',
      dlaczego: 'Światło dzienne i zmiana otoczenia pomagają głowie odpocząć.',
      sprobuj: 'wyjść na 20 minut na świeże powietrze',
      proba: { ile: 3, co: 'wyjścia na dwór' },
      wDniu: { tekst: 'rzadziej wychodzisz na dwór', rada: 'wyjść na 20 minut na świeże powietrze' },
    },
    {
      code: 'jedzenie', group: 'cialo', cat: '--cat-food', lag: 0, dir: 1, tone: 'zauwazone',
      known: anyTag, has: area('food', 1),
      nazwa: 'Spokojny posiłek', tag: 'Jedzenie',
      tytul: 'Spokojny posiłek pomaga Ci w dniu',
      zdanie: x => `W dni, kiedy z jedzeniem było dobrze, Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'było dobrze', nie: 'pozostałe dni',
      dlaczego: 'Posiłek bez pośpiechu to chwila przerwy dla głowy.',
      sprobuj: 'zjeść dziś jeden posiłek na spokojnie, bez pośpiechu i telefonu',
      proba: null,
      wDniu: null,
    },
    // ---------- ludzie ----------
    {
      code: 'przyjaciele', group: 'ludzie', cat: '--cat-friends', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: area('friends', 1),
      nazwa: 'Czas z przyjaciółmi', tag: 'Przyjaciele',
      obs: 'był dobry czas z przyjaciółmi',
      tytul: 'Ludzie dodają Ci sił',
      zdanie: x => `W dni z dobrym czasem z przyjaciółmi Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'z przyjaciółmi', nie: 'pozostałe dni',
      ogolnie: 'Kontakt z ludźmi, przy których można być sobą, pomaga większości z nas.',
      dlaczego: 'Bliskość z ludźmi, przy których można być sobą, zmniejsza napięcie.',
      sprobuj: 'napisać do kogoś i umówić się choćby na krótki spacer',
      proba: { ile: 2, co: 'spotkania albo rozmowy z kimś bliskim' },
      wDniu: { tekst: 'rzadziej spotykasz się z przyjaciółmi', rada: 'umówić się z kimś choćby na krótki spacer' },
    },
    {
      code: 'rodzina', group: 'ludzie', cat: '--cat-family', lag: 0, dir: 1, tone: 'zauwazone',
      known: anyTag, has: area('family', 1),
      nazwa: 'Dobry czas z rodziną', tag: 'Rodzina',
      tytul: 'Bliscy w domu mają znaczenie',
      zdanie: x => `W dni z dobrym czasem z rodziną Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'dobry czas', nie: 'pozostałe dni',
      dlaczego: 'Spokojna chwila z kimś z domu daje poczucie oparcia.',
      sprobuj: 'zagadać dziś do kogoś z domu o czymś drobnym',
      proba: null,
      wDniu: null,
    },
    {
      code: 'rozmowa', group: 'ludzie', cat: '--cat-friends', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('talk'),
      nazwa: 'Szczera rozmowa', tag: 'Rozmowa',
      obs: 'była szczera rozmowa',
      tytul: 'Rozmowa Ci pomaga',
      zdanie: x => `W dni ze szczerą rozmową Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'z rozmową', nie: 'bez rozmowy',
      dlaczego: 'Wypowiedziane na głos sprawy ważą mniej.',
      sprobuj: 'powiedzieć dziś komuś zaufanemu, co u Ciebie',
      proba: { ile: 2, co: 'szczere rozmowy z kimś zaufanym' },
      wDniu: null,
    },
    {
      code: 'dla_kogos', group: 'ludzie', cat: '--cat-family', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('kindness'),
      nazwa: 'Coś dla kogoś', tag: 'Dla innych',
      obs: 'było coś zrobione dla kogoś',
      tytul: 'Dobre gesty wracają',
      zdanie: x => `W dni, kiedy robisz coś dla kogoś, Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'coś dla kogoś', nie: 'pozostałe dni',
      dlaczego: 'Pomaganie daje poczucie, że ma się na coś wpływ.',
      sprobuj: 'zrobić dziś jedną drobną rzecz dla kogoś',
      proba: { ile: 2, co: 'drobne rzeczy zrobione dla kogoś' },
      wDniu: null,
    },
    // ---------- głowa ----------
    {
      code: 'hobby', group: 'glowa', cat: '--cat-study', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('hobby'),
      nazwa: 'Hobby', tag: 'Hobby',
      obs: 'był czas na hobby',
      tytul: 'Coś dla siebie robi różnicę',
      zdanie: x => `W dni z czasem na hobby Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'z hobby', nie: 'bez hobby',
      dlaczego: 'To, co lubisz, przypomina, że dzień to nie tylko obowiązki.',
      sprobuj: 'znaleźć dziś 20 minut na coś, co lubisz',
      proba: { ile: 3, co: 'dni z czasem na hobby' },
      wDniu: null,
    },
    {
      code: 'odpoczynek', group: 'glowa', cat: '--cat-family', lag: 0, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('rest'),
      nazwa: 'Odpoczynek', tag: 'Odpoczynek',
      obs: 'była chwila odpoczynku',
      tytul: 'Odpoczynek to nie strata czasu',
      zdanie: x => `W dni z chwilą odpoczynku Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'z odpoczynkiem', nie: 'bez',
      dlaczego: 'Głowa potrzebuje przerw tak samo jak ciało.',
      sprobuj: 'zaplanować dziś kwadrans bez niczego',
      proba: { ile: 3, co: 'dni z chwilą prawdziwego odpoczynku' },
      wDniu: null,
    },
    {
      code: 'przygotowanie', group: 'glowa', cat: '--cat-study', lag: 1, dir: 1, tone: 'pomaga',
      known: anyTag, has: act('prepare'),
      nazwa: 'Spakowanie na jutro', tag: 'Wieczór wcześniej',
      obs: 'wieczór wcześniej było spakowanie na jutro',
      tytul: 'Spakowany wieczór, lżejszy dzień',
      zdanie: x => `Dzień po wieczorze, w którym pakujesz się na jutro, bywa o <b>${x}</b> lepszy.`,
      tak: 'po spakowaniu', nie: 'bez',
      dlaczego: 'Mniej rzeczy do ogarnięcia rano to spokojniejszy start.',
      sprobuj: 'spakować się dziś wieczorem na jutro',
      proba: { ile: 3, co: 'wieczory ze spakowaniem się na jutro' },
      wDniu: { tekst: 'wieczór wcześniej rzadziej pakujesz się na jutro', rada: 'spakować się wieczór wcześniej, żeby rano mieć spokój' },
    },
    {
      code: 'nauka_dobrze', group: 'nauka', cat: '--cat-study', lag: 0, dir: 1, tone: 'zauwazone',
      known: anyTag, has: area('study', 1),
      nazwa: 'Gdy nauka idzie dobrze', tag: 'Nauka',
      tytul: 'Ogarnięta nauka zdejmuje ciężar',
      zdanie: x => `W dni, kiedy nauka szła dobrze, Twój nastrój bywa o <b>${x}</b> wyższy.`,
      tak: 'szła dobrze', nie: 'pozostałe dni',
      dlaczego: 'Zamknięte zadanie przestaje krążyć po głowie.',
      sprobuj: 'podzielić naukę na krótkie kawałki z przerwami',
      proba: null,
      wDniu: null,
    },
    {
      code: 'nauka_ciezko', group: 'nauka', cat: '--cat-study', lag: 0, dir: -1, tone: 'zauwazone',
      known: anyTag, has: area('study', -1),
      nazwa: 'Trudna nauka', tag: 'Nauka',
      tytul: 'Trudna nauka odbija się na dniu',
      zdanie: x => `W dni, kiedy nauka była ciężka, Twój nastrój bywa o <b>${x}</b> niższy.`,
      tak: 'ciężka nauka', nie: 'pozostałe dni',
      dlaczego: 'Zaległości i trudny materiał zabierają dużo siły.',
      sprobuj: 'zacząć od najmniejszego zadania, a przy najtrudniejszym poprosić kogoś o pomoc',
      proba: null,
      wDniu: { tekst: 'częściej zaznaczasz, że nauka była trudna', rada: 'przejrzeć plan wcześniej i zacząć od najmniejszego zadania' },
    },
    // ---------- trudne sprawy: tylko wsparcie, bez rad ----------
    {
      code: 'rodzina_ciezko', group: 'ludzie_trudne', cat: '--cat-family', lag: 0, dir: -1, tone: 'wsparcie',
      known: anyTag, has: area('family', -1),
      nazwa: 'Trudniej w domu', tag: 'Rodzina',
      tytul: 'Gdy w domu jest ciężko, to czuć',
      zdanie: x => `W dni, kiedy z rodziną było trudno, Twój nastrój bywa o <b>${x}</b> niższy.`,
      tak: 'było trudno', nie: 'pozostałe dni',
      wsparcie: 'To nie Twoja wina i nie musisz dźwigać tego w pojedynkę. Dobrze mieć kogoś, komu można o tym powiedzieć.',
      proba: null,
      wDniu: null,
    },
    {
      code: 'przyjaciele_ciezko', group: 'ludzie_trudne', cat: '--cat-friends', lag: 0, dir: -1, tone: 'wsparcie',
      known: anyTag, has: area('friends', -1),
      nazwa: 'Trudniej ze znajomymi', tag: 'Przyjaciele',
      tytul: 'Trudne chwile ze znajomymi bolą',
      zdanie: x => `W dni, kiedy z przyjaciółmi było trudno, Twój nastrój bywa o <b>${x}</b> niższy.`,
      tak: 'było trudno', nie: 'pozostałe dni',
      wsparcie: 'Takie dni zdarzają się każdemu i mijają. Jeśli chcesz, opowiedz o tym komuś zaufanemu.',
      proba: null,
      wDniu: null,
    },
  ];

  // ================================================================
  //  Progi (wszystkie w jednym miejscu; uzasadnienie w notes/wnioski.md)
  // ================================================================
  const PROGI = {
    okno: 90,                 // z ilu ostatnich dni liczymy
    doPodsumowania: 7,        // tyle podlań z nastrojem: podsumowanie tygodnia
    doWnioskow: 14,           // tyle podlań: pierwsze wnioski o czynnikach
    doDniTygodnia: 28,        // tyle podlań: wzór dni tygodnia i poprawka na dzień tygodnia
    minGrupa: 5,              // najmniej dni „z” i „bez”, żeby w ogóle porównywać
    minRoznica: 0.6,          // najmniejsza różnica nastroju (w punktach 1–10), o której warto mówić
    permutacje: 2000,
    // pewność 1 „wstępnie”, 2 „dość wyraźnie”, 3 „wyraźnie”
    q: [0.10, 0.05, 0.05],    // próg kontroli fałszywych odkryć (Benjamini–Hochberg) dla poziomu 1, 2, 3
    blok: 14,                 // długość bloku w teście permutacyjnym czynników (dni)
    minGrupaPoziom: [5, 7, 10],
    minDniPoziom: [14, 21, 40],
    minDolna: [0, 0.25, 0.4], // dolna granica różnicy po odjęciu niepewności
    // obserwacje (opis, nie wniosek): co często było w lepsze dni
    obsMinLepszych: 3,        // tyle „lepszych dni” z odpowiedzią i tyle wystąpień czynnika, żeby cokolwiek powiedzieć
    obsUdzial: 0.6,           // czynnik był w co najmniej 60% lepszych dni…
    obsRoznica: 0.25,         // …i o 25 punktów procentowych częściej niż w pozostałe
    maxObserwacji: 2,
    maxWnioskow: 3,           // tyle kart naraz w „Co zauważyliśmy”
    maxPomaga: 3,
    ukryjNaDni: 60,           // „To nie pasuje” chowa wniosek na tyle dni
    // wsparcie: niski nastrój w ostatnich dniach
    niskiNastroj: 3,
    wsparcieIle: 3,           // tyle dni z nastrojem ≤ 3 w ostatnich 7 → karta wsparcia
    probaDni: 7,
  };

  const SLOWA_PEWNOSCI = ['', 'Wstępnie', 'Dość wyraźnie', 'Wyraźnie'];
  const DNI = {
    nazwa: ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'],
    przym: ['niedzielne', 'poniedziałkowe', 'wtorkowe', 'środowe', 'czwartkowe', 'piątkowe', 'sobotnie'],
    w: ['w niedziele', 'w poniedziałki', 'we wtorki', 'w środy', 'w czwartki', 'w piątki', 'w soboty'],
    przed: ['niedzielą', 'poniedziałkiem', 'wtorkiem', 'środą', 'czwartkiem', 'piątkiem', 'sobotą'],
    litera: ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'],
  };

  const api = { WERSJA: 1, AREAS, ACTS, BEDTIME, CZYNNIKI, PROGI, SLOWA_PEWNOSCI, DNI, PL };
  root.WnioskiDane = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
