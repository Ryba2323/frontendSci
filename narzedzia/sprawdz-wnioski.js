/*
 * Test silnika wniosków (Main_Front-End/js/wnioski.js) na danych symulowanych. Uruchom: node narzedzia/sprawdz-wnioski.js
 * (około 6 minut: część testów przelicza wnioski dzień po dniu przez trzy miesiące).
 *
 * Sprawdza to, od czego zależy zaufanie do wniosków:
 *   1. podłożone zależności (sen, ruch, spakowanie dzień wcześniej, trudny dzień tygodnia) są znajdowane,
 *   2. z samego szumu nic nie powstaje częściej, niż pozwalają progi — także gdy nastrój „faluje” tygodniami
 *      i także wtedy, gdy liczymy CODZIENNIE przez 90 dni („czy kiedykolwiek pokazał się fałszywy wniosek”),
 *   3. „w weekendy jest lepiej” nie udaje wpływu przyjaciół (poprawka na dzień tygodnia),
 *   3b. pułapki z recenzji statystyka: dwa czynniki chodzące w parze nie dają dwóch odkryć, dobry dzień nie robi
 *       „wniosku” o spakowaniu na jutro, dobre dni z nauką nie robią wniosku o trudnej nauce,
 *   4. bezpieczeństwo: trudne sprawy w domu i ze znajomymi to karta wsparcia bez liczb i rad, nigdy wniosek;
 *      „ruch = gorzej” nie daje niczego; „Co Ci pomaga” ma tylko rzeczy, na które ma się wpływ,
 *   5. przy małej liczbie dni nie ma wniosków; wsparcie włącza się przy kilku niskich dniach, przewlekle niskim
 *      nastroju i wyraźnym spadku, a wtedy ekran nie dokłada zadań,
 *   6. teksty: bez nakazów, winy, diagnoz i bez języka przyczyny w tytułach; każdy czynnik ma komplet zdań,
 *   7. eksperyment tygodniowy (bez wyroku po tygodniu), opinie („pasuje” / „nie pasuje”) i powtarzalność wyniku.
 * Symulacja jest powtarzalna (stałe ziarna), więc wynik testu zawsze jest ten sam.
 */
const Dane = require('../Main_Front-End/js/wnioski-dane.js');
const W = require('../Main_Front-End/js/wnioski.js');

const TODAY = new Date(2026, 10, 12, 12);
let passed = 0;
const fails = [];
const ok = (cond, name, info = '') => { if (cond) passed++; else fails.push(`${name}${info ? ' — ' + info : ''}`); };

// ---------- symulator ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const day = n => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; };

/*
 * opts: days, seed, skip (szansa dnia bez wpisu), noise (odchylenie), rho (pamięć nastroju z dnia na dzień),
 *       drift (fala tygodniowa), effects: { sleep7, bedEarly, move, prepareLag, friends, familyHard, weekend, sunday },
 *       friendsOnWeekends (przyjaciele głównie w weekendy), moodShift,
 *       bedFollowsSleep (0–1: jak często wczesna pora idzie w parze z długim snem),
 *       prepareByMood (nachylenie: w lepszy dzień częściej „spakowanie na jutro” — odwrotna przyczynowość),
 *       effects.studyGood (dobre dni z nauką podnoszą nastrój)
 */
function simulate(opts) {
  const o = Object.assign({ days: 70, seed: 1, skip: 0.15, noise: 1.4, rho: 0, drift: 0, effects: {}, friendsOnWeekends: false, moodShift: 0, bedFollowsSleep: 0, prepareByMood: 0 }, opts);
  const r = rng(o.seed), fx = o.effects;
  const out = [];
  let ar = 0, prevPrepare = 0;
  const phase = r() * 6.28;
  for (let n = o.days - 1; n >= 0; n--) {
    const date = day(n), dow = date.getDay(), weekend = dow === 0 || dow === 6;
    const sleepHours = [4, 5.5, 7.5, 9][Math.min(3, Math.floor(r() * 4))];
    let bedtime = 1 + Math.floor(r() * 4);
    if (o.bedFollowsSleep && r() < o.bedFollowsSleep) bedtime = sleepHours >= 7 ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 2);
    const sleepQuality = 1 + Math.floor(r() * 4);
    const pick = (pos, neg) => { const x = r(); return x < neg ? -1 : x < neg + pos ? 1 : x < neg + pos + 0.2 ? 0 : null; };
    const areas = {};
    const put = (k, v) => { if (v != null) areas[k] = v; };
    put('friends', o.friendsOnWeekends ? pick(weekend ? 0.75 : 0.08, 0.05) : pick(0.3, 0.1));
    put('family', pick(0.25, 0.2));
    put('nature', pick(0.3, 0.08));
    put('food', pick(0.3, 0.08));
    put('study', pick(0.2, 0.25));
    put('love', pick(0.1, 0.05));
    const acts = {};
    ['move', 'hobby', 'rest', 'talk', 'kindness', 'prepare'].forEach(k => { if (r() < 0.38) acts[k] = 1; });
    ar = o.rho * ar + gauss(r) * o.noise * Math.sqrt(1 - o.rho * o.rho);
    let mood = 5.8 + o.moodShift + ar + o.drift * Math.sin(phase + (o.days - n) / 9);
    if (fx.sleep7 && sleepHours >= 7) mood += fx.sleep7;
    if (fx.bedEarly && bedtime <= 2) mood += fx.bedEarly;
    if (fx.move && acts.move) mood += fx.move;
    if (fx.prepareLag && prevPrepare) mood += fx.prepareLag;
    if (fx.friends && areas.friends === 1) mood += fx.friends;
    if (fx.familyHard && areas.family === -1) mood += fx.familyHard;
    if (fx.studyGood && areas.study === 1) mood += fx.studyGood;
    if (fx.weekend && weekend) mood += fx.weekend;
    if (fx.sunday && dow === 0) mood += fx.sunday;
    if (o.prepareByMood) { if (r() < 1 / (1 + Math.exp(-(-0.5 + o.prepareByMood * (mood - 5.8))))) acts.prepare = 1; else delete acts.prepare; }
    prevPrepare = acts.prepare ? 1 : 0;                     // także w dni bez wpisu „wczoraj” jest policzone po stronie symulacji…
    const skipped = n > 0 && r() < o.skip;
    if (skipped) { prevPrepare = 0; continue; }             // …ale silnik go nie zobaczy, więc dla uczciwości zerujemy
    out.push({ date, mood: Math.round(Math.min(10, Math.max(1, mood))), sleepHours, sleepQuality, bedtime, areas, acts, hour: 18 + Math.floor(r() * 4) });
  }
  return out;
}
const run = (opts, extra) => W.analyze(simulate(opts), Object.assign({ today: TODAY }, extra));
const find = (res, key) => res.wszystkie.find(w => w.key === key);
const rate = (n, f) => { let c = 0; for (let s = 1; s <= n; s++) if (f(s)) c++; return c / n; };
const pct = v => `${(v * 100).toFixed(1)}%`;
// bez „ciężko” w domu i ze znajomymi (do testów, w których reguła częstości nie ma przeszkadzać)
const calm = days => days.map(d => { const a = Object.assign({}, d.areas); if (a.family === -1) delete a.family; if (a.friends === -1) delete a.friends; return Object.assign({}, d, { areas: a }); });

// ---------- 1. podłożone zależności ----------
{
  const N = 60;
  const fx = { sleep7: 1.2, move: 1.0, prepareLag: 0.9 };
  const hit = code => rate(N, s => { const w = find(run({ days: 80, seed: s, effects: fx }), `czynnik:${code}`); return !!w && w.efekt > 0; });
  const a = hit('sen_dlugi'), b = hit('ruch'), c = hit('przygotowanie');
  ok(a >= 0.55, 'sen 7 h (+1,2) znajdowany w 80 dniach w większości przypadków', pct(a));
  ok(b >= 0.3, 'ruch (+1,0) znajdowany w 80 dniach w co najmniej 30% przypadków', pct(b));
  ok(c >= 0.2, 'spakowanie dzień wcześniej (+0,9) znajdowane w 80 dniach w co najmniej 20% przypadków', pct(c));
  const strong = rate(N, s => { const w = find(run({ days: 80, seed: s, effects: fx }), 'czynnik:sen_dlugi'); return !!w && w.pewnosc >= 2; });
  ok(strong >= 0.5, 'zależność +1,2 dostaje w połowie przypadków pewność co najmniej „dość wyraźnie”', pct(strong));
  const big = rate(N, s => { const w = find(run({ days: 80, seed: s, effects: { sleep7: 2 } }), 'czynnik:sen_dlugi'); return !!w && w.pewnosc >= 2; });
  ok(big >= 0.95, 'duża zależność (+2,0) jest znajdowana prawie zawsze i z pewnością ≥ 2', pct(big));
  // w tych samych danych czynniki BEZ podłożonej zależności prawie nigdy nie wychodzą jako pewne
  const stray = rate(N, s => run({ days: 80, seed: s, effects: fx }).wszystkie.some(w => w.typ === 'czynnik' && !['sen_dlugi', 'ruch', 'przygotowanie'].includes(w.czynnik) && w.pewnosc >= 2));
  ok(stray <= 0.07, 'przy prawdziwych zależnościach fałszywe „dość wyraźnie” są rzadkie', pct(stray));
  // pokazywana różnica nie jest zawyżona: średnio blisko podłożonej (surowa różnica tych, co przeszli próg, byłaby wyższa)
  const shown = [];
  for (let s = 1; s <= N; s++) { const w = find(run({ days: 80, seed: s, effects: fx }), 'czynnik:sen_dlugi'); if (w) shown.push(w.efekt); }
  const avgShown = shown.reduce((x, y) => x + y, 0) / (shown.length || 1);
  ok(shown.length > 10 && avgShown > 0.9 && avgShown < 1.45, 'pokazywana różnica jest blisko prawdziwej (+1,2), nie zawyżona', avgShown.toFixed(2));
  console.log(`  moc (80 dni): sen ${pct(a)}, ruch ${pct(b)}, spakowanie ${pct(c)}; pewność ≥2 dla snu ${pct(strong)}; obce wnioski ≥2: ${pct(stray)}`);
  // słabsza zależność i mniej dni — informacyjnie
  const weak = rate(N, s => !!find(run({ days: 45, seed: s, effects: { move: 0.8 } }), 'czynnik:ruch'));
  console.log(`  moc (45 dni, ruch +0,8): ${pct(weak)} — mniejsze zależności potrzebują więcej dni`);
}

// ---------- 2. sam szum ----------
{
  const N = 300;
  const any = o => rate(N, s => run(Object.assign({ seed: s }, o)).wszystkie.some(w => w.typ === 'czynnik'));
  const lvl2 = o => rate(N, s => run(Object.assign({ seed: s }, o)).wszystkie.some(w => w.typ === 'czynnik' && w.pewnosc >= 2));
  const wd = o => rate(N, s => run(Object.assign({ seed: s }, o)).wszystkie.some(w => w.typ === 'dzien_tygodnia'));
  const plain = { days: 70 }, wavy = { days: 70, rho: 0.5, drift: 1.0 };
  const a1 = any(plain), a2 = lvl2(plain), b1 = any(wavy), b2 = lvl2(wavy), c1 = wd(plain), c2 = wd(wavy);
  ok(a1 <= 0.08, 'szum: w danym dniu wniosek o czynniku widzi najwyżej ok. 1 osoba na 15', pct(a1));
  ok(a2 <= 0.05, 'szum: wniosek „dość wyraźnie” najwyżej w 5% przypadków', pct(a2));
  ok(b1 <= 0.09, 'szum z falami nastroju: jakikolwiek wniosek o czynniku rzadko', pct(b1));
  ok(b2 <= 0.05, 'szum z falami nastroju: „dość wyraźnie” rzadko', pct(b2));
  ok(c1 <= 0.10 && c2 <= 0.10, 'szum: „trudny dzień tygodnia” rzadko', `${pct(c1)} / ${pct(c2)}`);
  console.log(`  fałszywe wnioski z szumu (70 dni, ${N} osób): czynnik ${pct(a1)}, pewność ≥2 ${pct(a2)}; z falami: ${pct(b1)} / ${pct(b2)}; dzień tygodnia ${pct(c1)} / ${pct(c2)}`);
}

// ---------- 2b. codzienne przeliczanie: „czy kiedykolwiek” ----------
// Wnioski liczą się codziennie, więc liczy się nie tylko „ile osób ma fałszywy wniosek dziś”, ale ile zobaczy go kiedykolwiek.
// Bez potwierdzenia po tygodniu było to ponad 50% osób (recenzja statystyka). Większy pomiar: notes/wnioski.md, rozdział 9.
{
  const N = 40;
  let ever = 0, ever2 = 0;
  for (let s = 1; s <= N; s++) {
    const days = simulate({ days: 90, seed: 2000 + s });
    let any = false, any2 = false;
    for (let t = 14; t <= 90 && !any2; t++) {
      const today = day(90 - t);
      const f = W.analyze(days.filter(d => d.date <= today), { today }).wszystkie.filter(w => w.typ === 'czynnik');
      if (f.length) any = true;
      if (f.some(w => w.pewnosc >= 2)) any2 = true;
    }
    ever += any; ever2 += any2;
  }
  ok(ever / N <= 0.4, 'szum, liczone codziennie przez 90 dni: fałszywy wniosek kiedykolwiek widzi wyraźna mniejszość', pct(ever / N));
  ok(ever2 / N <= 0.25, 'szum, liczone codziennie: fałszywe „dość wyraźnie” kiedykolwiek jest rzadkie', pct(ever2 / N));
  console.log(`  szum liczony codziennie (dni 14–90, ${N} osób): wniosek kiedykolwiek ${pct(ever / N)}, z pewnością ≥2 ${pct(ever2 / N)}`);
  // wniosek nie pojawia się, zanim miał szansę się potwierdzić
  const young = W.analyze(simulate({ days: 18, skip: 0, seed: 3, effects: { sleep7: 4 } }), { today: TODAY });
  ok(young.etap === 'wnioski' && young.wszystkie.every(w => w.typ !== 'czynnik'), '18 podlań: nawet bardzo mocna zależność czeka na potwierdzenie po tygodniu');
  const older = W.analyze(simulate({ days: 30, skip: 0, seed: 3, effects: { sleep7: 4 } }), { today: TODAY });
  ok(!!find(older, 'czynnik:sen_dlugi'), '30 podlań: mocna zależność, która wychodziła też tydzień wcześniej, jest pokazana');
}

// ---------- 3. weekend nie udaje przyjaciół ----------
{
  const N = 120;
  const o = { days: 84, friendsOnWeekends: true, effects: { weekend: 1.6 } };
  const fake = rate(N, s => { const w = find(run(Object.assign({ seed: s }, o)), 'czynnik:przyjaciele'); return !!w && w.pewnosc >= 2; });
  ok(fake <= 0.1, 'lepsze weekendy nie dają pewnego wniosku o przyjaciołach', pct(fake));
  const real = rate(N, s => !!find(run({ days: 84, seed: s, friendsOnWeekends: true, effects: { weekend: 1.6, friends: 1.2 } }), 'czynnik:przyjaciele'));
  ok(real >= 0.3, 'prawdziwy wpływ przyjaciół nadal jest widoczny mimo poprawki', pct(real));
  // pokazywana liczba jest po odjęciu „weekendu”, a nie surowa (surowa wychodziła ok. 2,4 przy prawdziwym 1,2)
  const sh = [];
  for (let s = 1; s <= N; s++) { const w = find(run({ days: 84, seed: s, friendsOnWeekends: true, effects: { weekend: 1.6, friends: 1.2 } }), 'czynnik:przyjaciele'); if (w) sh.push(w.efekt); }
  const avg = sh.reduce((x, y) => x + y, 0) / (sh.length || 1);
  ok(sh.length > 10 && avg < 1.7, 'przyjaciele w lepsze weekendy: pokazywana różnica nie zawiera „weekendu”', avg.toFixed(2));
  console.log(`  przyjaciele tylko w weekendy: fałszywie pewne ${pct(fake)}, prawdziwy wpływ znajdowany ${pct(real)}`);
}

// ---------- 3b. pułapki z recenzji statystyka ----------
{
  const N = 80;
  // sen i pora snu chodzą w parze (85%), wpływ ma tylko długość snu: nie robimy z tego dwóch odkryć
  const o = { days: 84, bedFollowsSleep: 0.85, effects: { sleep7: 2 } };
  const both = rate(N, s => { const r = run(Object.assign({ seed: s }, o)); return !!find(r, 'czynnik:sen_dlugi') && !!find(r, 'czynnik:spac_wczesnie'); });
  const sleep = rate(N, s => !!find(run(Object.assign({ seed: s }, o)), 'czynnik:sen_dlugi'));
  ok(both <= 0.25, 'sen i pora snu w parze: rzadko dwa wnioski z jednego wpływu', pct(both));
  ok(sleep >= 0.7, 'sen i pora snu w parze: prawdziwy czynnik (sen) zostaje', pct(sleep));
  // w lepszy dzień łatwiej się spakować, a nastrój ma pamięć: to nie jest wpływ spakowania na jutro
  const lagFake = rate(N, s => !!find(run({ days: 84, seed: s, rho: 0.6, prepareByMood: 0.6 }), 'czynnik:przygotowanie'));
  ok(lagFake <= 0.05, 'dobry dzień → spakowanie → dobry kolejny dzień nie udaje wpływu spakowania', pct(lagFake));
  // dobre dni z nauką podnoszą nastrój: dni „ciężko” nie mogą przez to wyjść jako „gorsze” (porównanie bez dni z przeciwną oceną)
  const hardFake = rate(N, s => !!find(run({ days: 84, seed: s, effects: { studyGood: 1.8 } }), 'czynnik:nauka_ciezko'));
  ok(hardFake <= 0.05, 'dobre dni z nauką nie robią wniosku o trudnej nauce', pct(hardFake));
  console.log(`  pułapki: dwa wnioski z jednego wpływu ${pct(both)} (sen zostaje: ${pct(sleep)}); fałszywe „spakowanie” ${pct(lagFake)}; fałszywa „trudna nauka” ${pct(hardFake)}`);
}

// ---------- 4. bezpieczeństwo ----------
{
  const N = 60;
  // trudne sprawy NIGDY nie są wnioskiem (żadnej liczby, wykresu, opinii), nawet gdy mocno obniżają nastrój
  const asInsight = rate(N, s => run({ days: 84, seed: s, effects: { familyHard: -1.6 } }).wszystkie.some(w => w.ton === 'wsparcie' || /_ciezko$/.test(w.czynnik || '') && w.czynnik !== 'nauka_ciezko'));
  ok(asInsight === 0, 'trudne dni w domu i ze znajomymi nigdy nie są wnioskiem z liczbą', pct(asInsight));
  // …za to „ciężko” kilka razy w dwa tygodnie daje kartę wsparcia
  const mkDay = (n, mood, areas) => ({ date: day(n), mood, areas, acts: {} });
  const home = W.analyze([9, 7, 5, 3, 1].map(n => mkDay(n, 6, { family: -1 })).concat([8, 6, 4, 2, 0].map(n => mkDay(n, 6, { study: 0 }))), { today: TODAY }).wsparcie;
  ok(!!home && home.trudne.includes('rodzina_ciezko') && home.alarm === true && !home.cisza && home.tytul === 'Trudniejsze dni', 'ciężko w domu 5 razy w 10 dni: karta wsparcia z 112, neutralny tytuł', JSON.stringify(home));
  ok(!!home && /116 111/.test(home.akapity.join(' ')) && /nie jest Twoja wina/.test(home.akapity.join(' ')) && !/\d,\d|średnio|niższy/.test(home.akapity.join(' ')), 'karta o domu: 116 111, „to nie Twoja wina”, bez liczb');
  const peers = W.analyze([9, 7, 5, 3].map(n => mkDay(n, 6, { friends: -1 })).concat([8, 6, 4, 2, 1, 0].map(n => mkDay(n, 6, { study: 0 }))), { today: TODAY }).wsparcie;
  ok(!!peers && peers.trudne.includes('przyjaciele_ciezko') && !peers.alarm && /dorosłemu/.test(peers.akapity.join(' ')) && !/mijaj/.test(peers.akapity.join(' ')), 'ciężko ze znajomymi 4 razy: wsparcie wskazuje dorosłego i nie mówi „to mija”');
  const rare = W.analyze([9, 5].map(n => mkDay(n, 6, { family: -1 })).concat([8, 7, 6, 4, 3, 2, 1, 0].map(n => mkDay(n, 6, { study: 0 }))), { today: TODAY }).wsparcie;
  ok(!rare, 'dwa trudne dni w domu: jeszcze bez karty');
  const neg = rate(N, s => run({ days: 84, seed: s, effects: { move: -1.4 } }).wszystkie.some(w => w.czynnik === 'ruch'));
  ok(neg === 0, 'zależność w „złą” stronę (ruch = gorzej) nigdy nie staje się wnioskiem', pct(neg));
  const love = rate(N, s => run({ days: 84, seed: s }).wszystkie.some(w => /mi[łl]o/i.test(w.key + w.tytul)));
  ok(love === 0, 'miłość nie jest analizowana');
  const all = run({ days: 84, seed: 3, effects: { sleep7: 1.2, move: 1, familyHard: -1.6, sunday: -1.8 } });
  ok(all.wnioski.length <= Dane.PROGI.maxWnioskow, 'najwyżej 3 karty naraz');
  ok(new Set(all.wnioski.map(w => w.grupa)).size === all.wnioski.length, 'karty są z różnych grup');
  ok(all.pomaga.every(w => w.efekt > 0 && w.typ === 'czynnik'), '„Co Ci pomaga” zawiera tylko to, co podnosi nastrój');
  // dobry czas w domu i lżejsza nauka zostają opisem: nie trafiają do „Co Ci pomaga” ani na Dom
  const famGood = rate(N, s => { const days = simulate({ days: 84, seed: s }); days.forEach(d => { if (d.areas.family === 1) d.mood = Math.min(10, d.mood + 3); }); return W.analyze(days, { today: TODAY }).pomaga.some(w => w.ton !== 'pomaga'); });
  ok(famGood === 0, '„Co Ci pomaga” ma tylko rzeczy, na które ma się wpływ (bez domu i nauki)', pct(famGood));
  ok(Dane.CZYNNIKI.every(f => f.code !== 'jedzenie' && !/food|love/.test(String(f.has) + String(f.known))), 'jedzenie i miłość nie są analizowane');
}

// ---------- 5. etapy, wsparcie, dzień tygodnia ----------
{
  const few = W.analyze(simulate({ days: 5, skip: 0 }), { today: TODAY });
  ok(few.etap === 'start' && few.doPodsumowania === 2 && few.wszystkie.length === 0, '5 podlań: etap „start”, bez wniosków');
  const week = W.analyze(simulate({ days: 10, skip: 0, effects: { sleep7: 3 } }), { today: TODAY });
  ok(week.etap === 'tydzien' && week.wszystkie.length === 0 && week.doWnioskow === 4, '10 podlań: podsumowanie, jeszcze bez wniosków');
  ok(week.tydzien.srednia != null && week.tydzien.najlepszy, 'podsumowanie tygodnia ma średnią i najlepszy dzień');
  const empty = W.analyze([], { today: TODAY });
  ok(empty.etap === 'start' && empty.tydzien.srednia === null && !empty.wsparcie, 'brak danych nie wywraca silnika');
  const lowDays = simulate({ days: 30, skip: 0, seed: 4 });
  lowDays.slice(-4).forEach(d => { d.mood = 2; });
  const low = W.analyze(lowDays, { today: TODAY });
  ok(!!low.wsparcie && low.wsparcie.cisza && low.wsparcie.powod === 'niskie', '4 niskie dni w ostatnim tygodniu włączają wsparcie');
  ok(low.powrot === null, 'w cięższym czasie nie ma zdania „po gorszym dniu nastrój wraca”');
  ok(!W.analyze(calm(simulate({ days: 60, seed: 5, moodShift: 1.5 })), { today: TODAY }).wsparcie, 'zwykłe dni nie włączają wsparcia');
  // przewlekle: miesiąc z nastrojem 4 (wcześniej zero reakcji)
  const flat4 = W.analyze(calm(simulate({ days: 30, skip: 0, seed: 6 })).map(d => Object.assign({}, d, { mood: 4 })), { today: TODAY }).wsparcie;
  ok(!!flat4 && flat4.powod === 'dlugo' && flat4.cisza && /dorosłemu/.test(flat4.akapity.join(' ')), '30 dni z nastrojem 4: wsparcie i zdanie o zaufanym dorosłym', JSON.stringify(flat4 && flat4.powod));
  // spadek względem siebie: z ok. 7 na ok. 5,5 w ostatnim tygodniu
  const drop = calm(simulate({ days: 50, skip: 0, seed: 7 })).map((d, i, l) => Object.assign({}, d, { mood: i >= l.length - 7 ? 5 + (i % 2) : 7 + (i % 2) }));
  const dr = W.analyze(drop, { today: TODAY }).wsparcie;
  ok(!!dr && dr.powod === 'spadek' && dr.cisza && !/źle robisz/.test(dr.akapity.join(' ')), 'tydzień wyraźnie poniżej własnej normy: wsparcie', JSON.stringify(dr && dr.powod));
  const sevenish = calm(simulate({ days: 50, skip: 0, seed: 7 })).map((d, i, l) => Object.assign({}, d, { mood: i >= l.length - 7 ? 7 : 9 }));
  ok(!W.analyze(sevenish, { today: TODAY }).wsparcie, 'tydzień „7 zamiast 9” to nie powód do karty wsparcia');
  const N = 60;
  const sun = rate(N, s => { const r = run({ days: 84, seed: s, effects: { sunday: -1.8 } }); return r.wszystkie.some(w => w.key === 'dzien:0'); });
  ok(sun >= 0.8, 'trudne niedziele (−1,8) są znajdowane', pct(sun));
  const wrong = rate(N, s => run({ days: 84, seed: s, effects: { sunday: -1.8 } }).wszystkie.some(w => w.typ === 'dzien_tygodnia' && w.dzien !== 0));
  ok(wrong <= 0.05, 'wskazany jest właściwy dzień', pct(wrong));
  console.log(`  trudne niedziele znajdowane w ${pct(sun)} przypadków`);
}

// ---------- 5b. opis ostatnich dni i wiedza ogólna ----------
{
  const early = W.analyze(simulate({ days: 13, skip: 0, seed: 2, effects: { move: 3 } }), { today: TODAY });
  ok(early.wszystkie.length === 0 && early.obserwacje.length > 0 && early.obserwacje.length <= Dane.PROGI.maxObserwacji, '13 podlań: jest opis ostatnich dni, ale jeszcze nie wniosek', JSON.stringify(early.obserwacje.map(o => o.key)));
  ok(early.obserwacje.every(o => /\d+ z \d+ dni/.test(o.tekst) && !/lepsz|nastr|często|pomaga/i.test(o.tekst) && o.ile >= Dane.PROGI.opisMin && o.z >= Dane.PROGI.opisMinDni), 'opis podaje tylko liczbę dni, bez wiązania z nastrojem');
  ok(early.ogolne.length > 0 && early.ogolne.every(g => g.tekst && !early.obserwacje.some(o => o.czynnik === g.czynnik)), 'wiedza ogólna uzupełnia listę i nie dubluje opisu');
  ok(W.analyze(simulate({ days: 5, skip: 0 }), { today: TODAY }).obserwacje.length === 0, '5 podlań: bez opisu');
  const neg = W.analyze(simulate({ days: 20, skip: 0, seed: 2, effects: { familyHard: 3 } }), { today: TODAY });
  ok(neg.obserwacje.every(o => Dane.CZYNNIKI.find(f => f.code === o.czynnik).tone === 'pomaga'), 'opis dotyczy tylko rzeczy, na które ma się wpływ');
  const rich = run({ days: 84, seed: 3, effects: { sleep7: 2, move: 2, friends: 2 } });
  ok(rich.ogolne.length + rich.pomaga.length <= Dane.PROGI.maxPomaga && rich.ogolne.every(g => !rich.wszystkie.some(w => w.czynnik === g.czynnik)), 'gdy są wnioski z danych, wiedza ogólna ustępuje');
}

// ---------- 6. teksty ----------
{
  const BANNED = /(?<!nie )musisz|powinien|powinna|powinno|trzeba|(?<!nie |nie jest )twoja wina|diagnoz|depresj|zaburzen|chorob|leczen|schudn|kalori|waga|unikaj|przestań/i;
  // tytuł opisuje („w dni z X bywa lepiej”), nie mówi o przyczynie
  const CAUSAL = /poprawia|dodaje|pomaga|sprawia|powoduje|dzięki|służy|robi ci|zdejmuje|odbija/i;
  const codes = new Set();
  const fieldCodes = new Set([...Dane.AREAS, ...Dane.ACTS].map(f => f.code));
  Dane.CZYNNIKI.forEach(f => {
    ok(!codes.has(f.code), `kod czynnika jest unikalny: ${f.code}`);
    codes.add(f.code);
    const texts = [f.nazwa, f.tag, f.tytul, f.zdanie && f.zdanie('1,0'), f.tak, f.nie, f.dlaczego, f.ogolnie, f.sprobuj, f.wsparcie, f.gdzie, f.proba && f.proba.co, f.wDniu && f.wDniu.tekst, f.wDniu && f.wDniu.rada].filter(Boolean);
    ok(texts.every(t => !BANNED.test(t)), `${f.code}: bez nakazów, winy i języka diagnozy`, texts.find(t => BANNED.test(t)));
    ok([0, 1].includes(f.lag) && [1, -1].includes(f.dir), `${f.code}: lag i kierunek`);
    if (f.tone === 'wsparcie') {
      // trudne sprawy: sama karta wsparcia — bez tytułu-wniosku, zdania z liczbą, rady i eksperymentu
      ok(!f.tytul && !f.zdanie && !f.sprobuj && !f.proba && !f.dlaczego && !!f.wsparcie, `${f.code}: tylko tekst wsparcia`);
      ok(/116 111/.test(f.wsparcie) && /nie (jest )?Twoja wina/.test(f.wsparcie) && !/mijaj|zdarza się każdemu/.test(f.wsparcie), `${f.code}: wsparcie podaje 116 111, zdejmuje winę i nie bagatelizuje`);
      ok(f.alarm ? /112/.test(f.wsparcie) : true, `${f.code}: przy 112 na karcie numer jest też w tekście`);
      return;
    }
    ok(!!(f.nazwa && f.tytul && f.tak && f.nie && f.tag && f.cat && f.group), `${f.code}: komplet podpisów`);
    ok(/bywa|zwykle/.test(f.zdanie('1,0')) && /około/.test(f.zdanie('1,0')), `${f.code}: zdanie mówi „bywa” i „około”, nie „jest”`);
    ok(/bywa/.test(f.tytul) && !CAUSAL.test(f.tytul), `${f.code}: tytuł opisuje, nie mówi o przyczynie`, f.tytul);
    ok(f.tone === 'pomaga' ? !!f.sprobuj : true, `${f.code}: to, na co ma się wpływ, ma podpowiedź`);
    ok(f.proba ? f.tone === 'pomaga' && f.dir > 0 && !!f.gdzie : true, `${f.code}: eksperyment tylko dla rzeczy, na które ma się wpływ, i z informacją, skąd jest liczony`);
    ok(f.sprobuj ? /^[a-ząćęłńóśźż]/.test(f.sprobuj) : true, `${f.code}: podpowiedź zaczyna się małą literą (po „Spróbuj:”)`);
  });
  ok(!Dane.CZYNNIKI.find(f => f.code === 'sen_dlugi').proba && !Dane.CZYNNIKI.find(f => f.code === 'rodzina').sprobuj, 'bez celu „X godzin snu” i bez rady o domu');
  // pola użyte w czynnikach istnieją w katalogu pól
  const src = require('fs').readFileSync(require('path').join(__dirname, '../Main_Front-End/js/wnioski-dane.js'), 'utf8');
  const used = [...src.matchAll(/(?:area|act)\('([a-z_]+)'/g)].map(m => m[1]);
  ok(used.length > 8 && used.every(c => fieldCodes.has(c)), 'czynniki korzystają tylko z pól z katalogu', used.filter(c => !fieldCodes.has(c)).join(','));
  const sample = run({ days: 84, seed: 3, effects: { sleep7: 1.2, move: 1, familyHard: -1.6, sunday: -1.8 } });
  ok(sample.wszystkie.every(w => !BANNED.test([w.tytul, w.zdanie, w.sprobuj, ...(w.powody || [])].filter(Boolean).join(' '))), 'gotowe wnioski bez zakazanych słów');
  ok(sample.wszystkie.every(w => w.typ !== 'powrot'), '„powrót po trudnym dniu” nie jest wnioskiem (zdanie otuchy poza listą)');
  ok(sample.wszystkie.every(w => w.slowo && w.pewnosc >= 1 && w.pewnosc <= 3 && w.key && w.tytul && w.zdanie), 'każdy wniosek ma klucz, pewność i teksty');
}

// ---------- 7. opinie, próba, powtarzalność ----------
{
  const data = simulate({ days: 84, seed: 11, moodShift: -1.2, effects: { sleep7: 2, move: 1.8, sunday: -1.8 } });   // mocne zależności: ten test dotyczy opinii, nie mocy
  const a = W.analyze(data, { today: TODAY }), b = W.analyze(data, { today: TODAY });
  ok(JSON.stringify(a) === JSON.stringify(b), 'te same dane dają te same wnioski');
  const top = a.wnioski[0];
  const hid = W.analyze(data, { today: TODAY, feedback: { [top.key]: { v: 'nie', at: new Date(TODAY - 5 * 864e5).toISOString() } } });
  ok(!hid.wnioski.some(w => w.key === top.key) && !hid.pomaga.some(w => w.key === top.key), '„Nie pasuje” chowa wniosek');
  const back = W.analyze(data, { today: TODAY, feedback: { [top.key]: { v: 'nie', at: new Date(TODAY - 70 * 864e5).toISOString() } } });
  ok(back.wnioski.some(w => w.key === top.key), 'po 60 dniach wniosek może wrócić');
  ok(a.pomaga.length >= 2, 'przy mocnych zależnościach „Co Ci pomaga” ma co najmniej 2 pozycje', String(a.pomaga.length));
  const help = a.pomaga[a.pomaga.length - 1];
  const pin = W.analyze(data, { today: TODAY, feedback: { [help.key]: { v: 'pasuje', at: TODAY.toISOString() } } });
  ok(pin.pomaga[0].key === help.key && pin.pomaga[0].opinia === 'pasuje', '„Pasuje” przypina na górze listy');

  const mk = (n, mood, acts) => ({ date: day(n), mood, areas: {}, acts });
  const start = W.key(day(3));
  const during = [mk(3, 7, { move: 1 }), mk(2, 5, { hobby: 1 }), mk(1, 8, { move: 1 }), mk(0, 6, { rest: 1 })];
  const p1 = W.proba(during, { czynnik: 'ruch', ile: 3, start }, { today: TODAY });
  ok(p1.status === 'trwa' && p1.zrobione === 2 && p1.cel === 3 && p1.zostaloDni === 4 && /Co dziś było/.test(p1.gdzie), 'eksperyment w trakcie liczy zrobione dni i mówi, skąd je bierze', JSON.stringify(p1));
  ok(/pytania o sen/.test(W.proba(during, { czynnik: 'spac_wczesnie', ile: 3, start }, { today: TODAY }).gdzie) && /Natura/.test(W.proba(during, { czynnik: 'natura', ile: 3, start }, { today: TODAY }).gdzie), 'eksperyment snu i wyjścia na dwór wskazuje właściwe pytanie podlewania');
  const s8 = W.key(day(8));
  const done = [mk(8, 8, { move: 1 }), mk(7, 5, { hobby: 1 }), mk(6, 8, { move: 1 }), mk(5, 5, { rest: 1 }), mk(4, 7, { move: 1 }), mk(3, 6, { talk: 1 })];
  const p2 = W.proba(done, { czynnik: 'ruch', ile: 3, start: s8 }, { today: TODAY });
  ok(p2.status === 'koniec' && p2.wynik.typ === 'lepsze_dni' && p2.zrobione === 3, 'zakończony eksperyment: dni z tym były lepsze', JSON.stringify(p2.wynik));
  ok(!/\d|służy|pomaga|działa/.test(p2.wynik.tekst) && /niczego nie rozstrzyga/.test(p2.wynik.tekst), 'wynik po tygodniu jest opisem: bez liczby i bez wyroku', p2.wynik.tekst);
  const flat = done.map(d => Object.assign({}, d, { mood: 6 }));
  ok(W.proba(flat, { czynnik: 'ruch', ile: 3, start: s8 }, { today: TODAY }).wynik.typ === 'bez_roznicy', 'zakończony eksperyment: bez różnicy');
  const little = W.proba([mk(8, 8, { move: 1 }), mk(7, 5, { hobby: 1 })], { czynnik: 'ruch', ile: 3, start: s8 }, { today: TODAY });
  ok(little.wynik.typ === 'za_malo' && !/nie udało|porażk|za mało się starasz/i.test(little.wynik.tekst), 'mało prób: bez oceniania osoby');
  // czynnik „z dnia wcześniej”: nastrój bierzemy z następnego dnia
  const lag = [mk(8, 4, { prepare: 1 }), mk(7, 9, { hobby: 1 }), mk(6, 4, { prepare: 1 }), mk(5, 9, { hobby: 1 }), mk(4, 5, { rest: 1 }), mk(3, 5, { rest: 1 }), mk(2, 5, { rest: 1 })];
  const p3 = W.proba(lag, { czynnik: 'przygotowanie', ile: 3, start: s8 }, { today: TODAY });
  ok(p3.wynik.typ === 'lepsze_dni', 'eksperyment spakowania liczy nastrój z następnego dnia', JSON.stringify(p3.wynik));
}

if (fails.length) { console.log(`\n✗ ${fails.length} nie przeszło:`); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log(`\nOK — ${passed} sprawdzeń silnika wniosków przeszło`);
