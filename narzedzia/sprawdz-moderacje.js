/*
 * Test listy słów z js/moderacja.js (sam Node, bez przeglądarki): werdykty i wykrywanie słów o krzywdzie.
 * Uruchom: node narzedzia/sprawdz-moderacje.js
 * Lista słów jest wersją DEMO (docelowo model po stronie serwera), więc test pilnuje dwóch rzeczy:
 *   1. zdania, przy których MUSI pojawić się wsparcie, nie przechodzą bez reakcji,
 *   2. zwykłe zdania nastolatka nie wywołują karty wsparcia (fałszywe alarmy uczą ją ignorować).
 */
const path = require('path');
global.window = {};
require(path.resolve(__dirname, '../Main_Front-End/js/moderacja.js'));
const { check, mark, KRZYWDA, krzywdaCard } = window.Moderacja;

const KRZYWDA_TAK = [
  'tata mnie bije', 'Tata mnie bije.', 'mama mnie bije prawie codziennie', 'ojczym bije mnie i brata', 'Ojciec mnie uderzył',
  'on mnie znowu uderzył', 'wczoraj mnie pobił', 'brat mnie dusi', 'mama mnie szarpie i krzyczy', 'ktoś mnie krzywdzi',
  'tata znęca się nade mną', 'w domu jest przemoc', 'przemoc domowa to u nas codzienność', 'robią mi krzywdę',
  'boję się wracać do domu', 'Boje sie wrocic do domu', 'boję się taty', 'boję się ojczyma, kiedy pije', 'nie chcę wracać do domu',
  'chyba ucieknę z domu', 'uciekłam z domu', 'mama wyrzuciła mnie z domu', 'wujek dotyka mnie tam, gdzie nie chcę',
  'on mnie dotykał pod bluzką', 'trener mnie molestuje', 'zostałam zgwałcona', 'to był gwałt', 'TATA MNIE BIJE', 'tata  mnie   bije',
];
const KRZYWDA_NIE = [
  'dziś był dobry trening', 'serce mi bije szybko przed sprawdzianem', 'tata mnie zabije za tę jedynkę', 'ta piosenka mnie dotyka',
  'to, co powiedziała, bardzo mnie dotyka', 'kupiłem bilet na koncert', 'gwałtownie zmieniła się pogoda', 'boję się sprawdzianu',
  'boję się, że mamy sprawdzian', 'wracam do domu po szkole', 'lubię być w domu', 'pokłóciłam się z mamą', 'brat mnie wkurza',
  'kolega pobił rekord szkoły', 'bijemy się na poduszki z siostrą', 'nie chcę iść do szkoły', 'uciekł mi autobus', '',
];
const WERDYKTY = [
  ['chcę się zabić', 'kryzys'], ['nie chce mi się żyć', 'kryzys'], ['tnę się', 'kryzys'], ['myślę o samobójstwie', 'kryzys'],
  ['jesteś debilem', 'obrazliwe'], ['zabij się', 'obrazliwe'], ['napisz do mnie 600 100 200', 'dane'], ['mój mail to ola@example.com', 'dane'],
  ['dziś był dobry dzień', 'ok'], ['tata mnie bije', 'ok'],   // krzywda nie zmienia werdyktu (blog działa jak wcześniej)
];

let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('BŁĄD ' + m); } };
for (const t of KRZYWDA_TAK) ok(check(t).krzywda === true, `brak karty wsparcia przy: „${t}”`);
for (const t of KRZYWDA_NIE) ok(check(t).krzywda === false, `fałszywy alarm przy: „${t}”`);
for (const [t, v] of WERDYKTY) ok(check(t).verdict === v, `„${t}”: werdykt ${check(t).verdict}, powinien być ${v}`);
// krzywda nie dokłada zaznaczeń: blog podkreśla tylko słowa do poprawy
ok(check('tata mnie bije').hits.length === 0, 'krzywda nie powinna trafiać do hits');
ok(check('tata mnie bije i chcę się zabić').verdict === 'kryzys' && check('tata mnie bije i chcę się zabić').krzywda, 'kryzys + krzywda razem');
ok(mark('a <b> c', []) === 'a &lt;b&gt; c', 'mark() escapuje tekst');
// karta: oba numery, bez niepotwierdzonych numerów
const card = krzywdaCard({ id: 'x' });
ok(card.includes('tel:116111') && card.includes('tel:112') && card.includes(KRZYWDA.title) && card.includes(' hidden'), 'karta ma 116 111, 112, tytuł i startuje ukryta');
ok(!krzywdaCard({ hidden: false }).includes(' hidden'), 'karta w rozmowie z Asystentem jest od razu widoczna');
ok((card.match(/tel:/g) || []).length === 2, 'karta ma tylko potwierdzone numery (116 111 i 112)');
console.log(bad ? `\n${bad} z ${n} sprawdzeń nie przeszło` : `OK: ${n} sprawdzeń`);
process.exit(bad ? 1 : 0);
