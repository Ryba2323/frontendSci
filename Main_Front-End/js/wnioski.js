/*
 * Wnioski — SILNIK spersonalizowanych insightów. Czyste funkcje, bez DOM: dni podlewania → wnioski.
 * Dane czynników i teksty: js/wnioski-dane.js. Ekran: js/tracker.js. Opis zasad i progów: notes/wnioski.md.
 * Ten sam plik ma liczyć wnioski na serwerze (Edge Function `generate-insights`), żeby telefon i baza mówiły to samo.
 * Testy: node narzedzia/sprawdz-wnioski.js (podłożone zależności są znajdowane, a z samego szumu nic nie powstaje).
 *
 * Wejście: tablica wpisów w kształcie `daily_checkins` + znaczniki:
 *   { date: 'RRRR-MM-DD' | Date, mood: 1–10 | null, sleepHours, sleepQuality (1–4), bedtime (1–4),
 *     areas: { friends: 1, study: -1, … }, acts: { move: 1, … }, hour: 0–23 }
 *
 * Jak powstaje wniosek o czynniku („czy w dni z X jest inaczej?”):
 *   1. Bierzemy ostatnie 90 dni. Dzień bez odpowiedzi na dane pytanie jest pomijany (brak odpowiedzi to nie „nie”).
 *   2. Od 28 podlań odejmujemy od nastroju typowy poziom danego dnia tygodnia, żeby „w weekendy jest lepiej”
 *      nie udawało wpływu np. spotkań z przyjaciółmi.
 *   3. Różnica średnich „z” i „bez”. Musi iść w oczekiwaną stronę i mieć co najmniej 0,6 punktu.
 *   4. Test permutacyjny W OBRĘBIE DWUTYGODNIOWYCH BLOKÓW (mieszamy etykiety tylko wewnątrz bloku), więc lepsze
 *      i gorsze okresy same z siebie nie tworzą „zależności”.
 *   5. Zgodność połówek: w starszej i nowszej połowie okresu kierunek musi być ten sam.
 *   6. Poprawka na wiele pytań naraz (Benjamini–Hochberg): pytamy o kilkanaście rzeczy, więc pojedynczy traf nie wystarcza.
 *   Wynik ma pewność 1 „wstępnie”, 2 „dość wyraźnie” albo 3 „wyraźnie”. Poniżej progu wniosku nie ma wcale.
 *   Sprawdzone w symulacji (narzedzia/sprawdz-wnioski.js): luźniejszy próg dla „wstępnie” podwajał fałszywe wnioski,
 *   a prawie nie pomagał znajdować prawdziwych, dlatego każdy poziom wymaga kroku 6.
 *
 * Zanim danych wystarczy na wniosek, są dwa słabsze, wyraźnie oznaczone poziomy:
 *   • OBSERWACJA (od 7 podlań): „w Twoje lepsze dni często był ruch (4 z 5)” — opis tego, co było, bez uogólniania;
 *     tylko dla rzeczy, które i tak są zdrowe, więc nietrafiona obserwacja nikomu nie szkodzi;
 *   • WIEDZA OGÓLNA: zalecenia dla nastolatków (sen, ruch, dwór, ludzie) z dopiskiem „sprawdź u siebie” i tygodniową próbą.
 *
 * Poza czynnikami: najtrudniejszy dzień tygodnia (z możliwymi powodami), zmiana z ostatnich dwóch tygodni,
 * powrót po trudnym dniu i reguła wsparcia (kilka niskich dni z rzędu → zawsze 116 111, Asystent, bliskie osoby).
 *
 * Wszystko jest deterministyczne (stałe ziarno losowania), więc te same dane zawsze dają te same wnioski.
 *
 * window.Wnioski:
 *   analyze(days, { today, feedback })   → { etap, dni, doPodsumowania, doWnioskow, tydzien, wsparcie, wnioski, pomaga, obserwacje, ogolne, wszystkie }
 *   proba(days, proba, { today })        → stan tygodniowej próby („3 razy ruch”): { status, zrobione, cel, zostaloDni, wynik }
 *   key(date)                            → 'RRRR-MM-DD' w czasie lokalnym
 */
(function (root) {
  'use strict';

  const Dane = root.WnioskiDane || (typeof require === 'function' ? require('./wnioski-dane.js') : null);
  const { CZYNNIKI, PROGI, SLOWA_PEWNOSCI, DNI, PL } = Dane;
  const DAY = 864e5;

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const mean = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
  const variance = l => { if (l.length < 2) return 0; const m = mean(l); return l.reduce((a, b) => a + (b - m) * (b - m), 0) / (l.length - 1); };
  const median = l => { const s = l.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  const fmt = v => (Math.round(Math.abs(v) * 10) / 10).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const toDate = d => { if (d instanceof Date) { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; } const [y, m, day] = String(d).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, day, 12); };
  const key = d => { const x = toDate(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const addDays = (d, n) => { const x = toDate(d); x.setDate(x.getDate() + n); return x; };
  // mały, powtarzalny generator liczb losowych (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ================================================================
  //  Przygotowanie: okno kalendarzowe i nastrój po odjęciu dnia tygodnia
  // ================================================================
  function prepare(days, today) {
    const map = new Map();
    days.forEach(d => { if (d && d.date != null) map.set(key(d.date), d); });
    const rows = [];
    for (let i = 0; i < PROGI.okno; i++) {
      const date = addDays(today, i - (PROGI.okno - 1));
      const e = map.get(key(date)) || null;
      rows.push({ i, date, key: key(date), dow: date.getDay(), e, mood: e && e.mood != null ? e.mood : null, y: null });
    }
    const rec = rows.filter(r => r.mood != null);
    const all = mean(rec.map(r => r.mood));
    const adjusted = rec.length >= PROGI.doDniTygodnia;
    // typowe odchylenie dnia tygodnia, ściągnięte do zera przy małej liczbie dni (n / (n + 3))
    const off = Array(7).fill(0);
    if (adjusted) for (let k = 0; k < 7; k++) { const l = rec.filter(r => r.dow === k).map(r => r.mood); off[k] = l.length ? (l.length / (l.length + 3)) * (mean(l) - all) : 0; }
    rec.forEach(r => { r.y = r.mood - off[r.dow]; });
    return { rows, rec, all, adjusted };
  }

  // ================================================================
  //  Czynnik: różnica, test permutacyjny w tygodniach, zgodność połówek
  // ================================================================
  function testFactor(f, P) {
    const pairs = [];
    P.rec.forEach(r => {
      const src = f.lag ? P.rows[r.i - f.lag] : r;
      if (!src || !src.e || !f.known(src.e)) return;
      pairs.push({ x: f.has(src.e) ? 1 : 0, y: r.y, mood: r.mood, block: Math.floor(r.i / PROGI.blok), i: r.i });
    });
    const g1 = pairs.filter(p => p.x), g0 = pairs.filter(p => !p.x);
    if (g1.length < PROGI.minGrupa || g0.length < PROGI.minGrupa) return null;

    const diffOf = (a, b, k) => mean(a.map(p => p[k])) - mean(b.map(p => p[k]));
    const raw = diffOf(g1, g0, 'mood'), adj = diffOf(g1, g0, 'y');
    const se = Math.sqrt(variance(g1.map(p => p.y)) / g1.length + variance(g0.map(p => p.y)) / g0.length);
    const lower = Math.abs(adj) - 1.3 * se;

    // permutacje w obrębie bloków (PROGI.blok dni); test jednostronny w oczekiwaną stronę
    const blocks = new Map();
    pairs.forEach(p => { if (!blocks.has(p.block)) blocks.set(p.block, []); blocks.get(p.block).push(p); });
    const groups = [...blocks.values()];
    const ys = groups.map(g => g.map(p => p.y)), xs = groups.map(g => g.map(p => p.x));
    const n1 = g1.length, n0 = g0.length;
    const sumAll = pairs.reduce((a, p) => a + p.y, 0);
    const stat = sum1 => (sum1 / n1 - (sumAll - sum1) / n0) * f.dir;
    const observed = adj * f.dir;
    const rand = rng(hash(f.code) ^ pairs.length);
    let hits = 0;
    for (let it = 0; it < PROGI.permutacje; it++) {
      let s1 = 0;
      for (let b = 0; b < groups.length; b++) {
        const x = xs[b].slice();
        for (let j = x.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); const t = x[j]; x[j] = x[k]; x[k] = t; }
        for (let j = 0; j < x.length; j++) if (x[j]) s1 += ys[b][j];
      }
      if (stat(s1) >= observed - 1e-9) hits++;
    }
    const p = (hits + 1) / (PROGI.permutacje + 1);

    // zgodność połówek okresu
    const mid = median(pairs.map(q => q.i));
    const half = l => { const a = l.filter(q => q.x), b = l.filter(q => !q.x); return a.length >= 2 && b.length >= 2 ? diffOf(a, b, 'y') : null; };
    const h1 = half(pairs.filter(q => q.i <= mid)), h2 = half(pairs.filter(q => q.i > mid));
    const consistent = h1 == null || h2 == null ? null : h1 * f.dir > 0 && h2 * f.dir > 0;

    return { f, raw, adj, se, lower, p, n1, n0, consistent, mean1: mean(g1.map(q => q.mood)), mean0: mean(g0.map(q => q.mood)) };
  }

  // Benjamini–Hochberg: największe k, dla którego p(k) ≤ k/m · q; zwraca zbiór przepuszczonych testów
  function bh(tests, q) {
    const s = tests.slice().sort((a, b) => a.p - b.p);
    let cut = -1;
    s.forEach((t, k) => { if (t.p <= ((k + 1) / s.length) * q) cut = k; });
    return new Set(s.slice(0, cut + 1));
  }

  function factorInsights(P) {
    const tests = CZYNNIKI.map(f => testFactor(f, P)).filter(Boolean);
    if (!tests.length) return { list: [], tests };
    const pass = PROGI.q.map(q => bh(tests, q));
    const out = [];
    tests.forEach(t => {
      const okDir = t.raw * t.f.dir > 0 && t.adj * t.f.dir > 0;
      if (!okDir || Math.abs(t.raw) < PROGI.minRoznica || Math.abs(t.adj) < PROGI.minRoznica - 0.1) return;
      const nMin = Math.min(t.n1, t.n0);
      let level = 0;
      for (let L = 1; L <= 3; L++) {
        const i = L - 1;
        const ok = pass[i].has(t) && nMin >= PROGI.minGrupaPoziom[i] && P.rec.length >= PROGI.minDniPoziom[i] && t.lower >= PROGI.minDolna[i]
          && (L === 1 || t.consistent === true) && (L < 3 || (t.p <= 0.005 && Math.abs(t.raw) >= 0.8));
        if (ok) level = L; else if (L > 1) break;
      }
      if (!level) return;
      const f = t.f;
      out.push({
        key: `czynnik:${f.code}`, typ: 'czynnik', ton: f.tone, czynnik: f.code, grupa: f.group, kat: f.cat,
        tag: f.tag, nazwa: f.nazwa, tytul: f.tytul, zdanie: f.zdanie(fmt(t.raw)),
        wykres: { typ: 'porownanie', wiersze: [{ label: f.nie, v: t.mean0, n: t.n0 }, { label: f.tak, v: t.mean1, n: t.n1, hl: true }] },
        pewnosc: level, efekt: t.raw, n: t.n1 + t.n0, n1: t.n1, n0: t.n0, p: t.p,
        powody: f.dlaczego ? [f.dlaczego] : [], sprobuj: f.sprobuj || null, wsparcie: f.wsparcie || null,
        proba: f.proba ? { czynnik: f.code, ile: f.proba.ile, co: f.proba.co } : null,
        wynik: level * 10 + Math.max(0, t.lower),
      });
    });
    return { list: out, tests };
  }

  // ================================================================
  //  Dzień tygodnia: najtrudniejszy dzień i możliwe powody
  // ================================================================
  function weekdayInsight(P, tests) {
    if (P.rec.length < PROGI.doDniTygodnia) return null;
    const by = k => P.rec.filter(r => r.dow === k);
    const diffs = [];
    for (let k = 0; k < 7; k++) {
      const a = by(k), b = P.rec.filter(r => r.dow !== k);
      if (a.length >= 4) diffs.push({ k, n: a.length, d: mean(a.map(r => r.mood)) - mean(b.map(r => r.mood)) });
    }
    if (diffs.length < 5) return null;
    const worst = diffs.slice().sort((a, b) => a.d - b.d)[0];
    if (worst.d > -0.8) return null;

    // test: mieszamy dni w obrębie tygodni i patrzymy na NAJNIŻSZY dzień (to od razu uwzględnia, że dni jest siedem)
    const weeks = new Map();
    P.rec.forEach(r => { const b = Math.floor(r.i / 7); if (!weeks.has(b)) weeks.set(b, []); weeks.get(b).push(r); });
    const groups = [...weeks.values()];
    const total = P.rec.reduce((a, r) => a + r.mood, 0), N = P.rec.length;
    const rand = rng(977 + N);
    let hits = 0;
    for (let it = 0; it < PROGI.permutacje; it++) {
      const sum = Array(7).fill(0), cnt = Array(7).fill(0);
      groups.forEach(g => {
        const m = g.map(r => r.mood);
        for (let j = m.length - 1; j > 0; j--) { const q = Math.floor(rand() * (j + 1)); const t = m[j]; m[j] = m[q]; m[q] = t; }
        g.forEach((r, j) => { sum[r.dow] += m[j]; cnt[r.dow]++; });
      });
      let min = Infinity;
      for (let k = 0; k < 7; k++) if (cnt[k] >= 4) min = Math.min(min, sum[k] / cnt[k] - (total - sum[k]) / (N - cnt[k]));
      if (min <= worst.d + 1e-9) hits++;
    }
    const p = (hits + 1) / (PROGI.permutacje + 1);
    const level = p <= 0.01 && worst.n >= 8 ? 3 : p <= 0.05 && worst.n >= 5 ? 2 : p <= 0.10 ? 1 : 0;
    if (!level) return null;

    const hard = by(worst.k), rest = P.rec.filter(r => r.dow !== worst.k);
    const evening = hard.filter(r => r.e.hour != null).length >= 3 && hard.filter(r => r.e.hour >= 18).length / hard.filter(r => r.e.hour != null).length >= 0.6;
    // powody: co w ten dzień jest rzadsze (dobre rzeczy) albo częstsze (trudne) niż w pozostałe dni
    const reasons = [];
    const srcOf = (r, f) => (f.lag ? P.rows[r.i - f.lag] : r);
    const share = (l, f) => { const k = l.map(r => srcOf(r, f)).filter(s => s && s.e && f.known(s.e)); return k.length >= 3 ? k.filter(s => f.has(s.e)).length / k.length : null; };
    CZYNNIKI.forEach(f => {
      if (!f.wDniu) return;
      const t = tests.find(x => x.f === f);
      if (!t || t.raw * f.dir < 0.3) return;                        // powód musi mieć oparcie w danych tej osoby
      const a = share(hard, f), b = share(rest, f);
      if (a == null || b == null) return;
      const gap = (b - a) * f.dir;
      if (gap >= 0.15) reasons.push({ w: gap * Math.abs(t.raw), tekst: `${DNI.w[worst.k]} ${f.wDniu.tekst}`, rada: f.wDniu.rada });
    });
    const sleepOf = l => l.map(r => r.e.sleepHours).filter(v => v != null);
    const sh = sleepOf(hard), sr = sleepOf(rest);
    if (sh.length >= 3 && sr.length >= 3 && mean(sr) - mean(sh) >= 0.5) {
      const gap = mean(sr) - mean(sh);
      // zastępuje ogólniejsze „częściej śpisz krócej”
      for (let j = reasons.length - 1; j >= 0; j--) if (/śpisz krócej/.test(reasons[j].tekst)) reasons.splice(j, 1);
      reasons.push({ w: gap * 0.6, tekst: `w nocy przed ${DNI.przed[worst.k]} śpisz średnio o ${fmt(gap)} h krócej`, rada: 'położyć się dzień wcześniej trochę szybciej' });
    }
    reasons.sort((x, y) => y.w - x.w);
    const top = reasons.slice(0, 2);

    const dowAvg = [];
    for (let k = 0; k < 7; k++) { const l = by(k); dowAvg[k] = l.length ? mean(l.map(r => r.mood)) : null; }
    const cap = s => s[0].toUpperCase() + s.slice(1);
    return {
      key: `dzien:${worst.k}`, typ: 'dzien_tygodnia', ton: 'zauwazone', grupa: 'dzien', kat: '--primary',
      tag: 'Nastrój w tygodniu', nazwa: DNI.nazwa[worst.k],
      tytul: `${cap(DNI.przym[worst.k])} ${evening ? 'wieczory' : 'dni'} bywają trudniejsze`,
      zdanie: `Średnio o <b>${fmt(worst.d)}</b> niżej niż w inne dni.`,
      wykres: { typ: 'tydzien', slupki: [1, 2, 3, 4, 5, 6, 0].map(k => ({ label: DNI.litera[k], v: dowAvg[k], hl: k === worst.k })) },
      pewnosc: level, efekt: worst.d, n: P.rec.length, n1: worst.n, n0: P.rec.length - worst.n, p,
      powody: top.map(r => cap(r.tekst) + '.'),
      sprobuj: top[0] ? top[0].rada : 'zaplanować na ten dzień coś przyjemnego',
      wsparcie: null, proba: null, dzien: worst.k,
      wynik: level * 10 + Math.abs(worst.d) - 0.5,
    };
  }

  // ================================================================
  //  Zmiana z ostatnich dwóch tygodni i powrót po trudnym dniu
  // ================================================================
  function trendInsight(P) {
    const last = PROGI.okno - 1;
    const a = P.rec.filter(r => r.i > last - 14).map(r => r.mood), b = P.rec.filter(r => r.i <= last - 14 && r.i > last - 28).map(r => r.mood);
    if (a.length < 5 || b.length < 5) return null;
    const d = mean(a) - mean(b);
    const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
    if (Math.abs(d) < 0.8 || Math.abs(d) - 1.3 * se < 0.2) return null;
    const up = d > 0;
    return {
      key: `trend:${up ? 'gora' : 'dol'}`, typ: 'trend', ton: 'zauwazone', grupa: 'trend', kat: '--primary',
      tag: 'Ostatnie tygodnie', nazwa: 'Ostatnie dwa tygodnie',
      tytul: up ? 'Ostatnie dwa tygodnie są lżejsze' : 'Ostatnie dwa tygodnie są trudniejsze',
      zdanie: `Średnio o <b>${fmt(d)}</b> ${up ? 'wyżej' : 'niżej'} niż dwa tygodnie wcześniej.`,
      wykres: { typ: 'porownanie', wiersze: [{ label: 'wcześniej', v: mean(b), n: b.length }, { label: 'ostatnio', v: mean(a), n: a.length, hl: true }] },
      pewnosc: 1, efekt: d, n: a.length + b.length, n1: a.length, n0: b.length, p: null,
      powody: [up ? 'Warto zauważyć, co się zmieniło: to może być coś, co Ci służy.' : 'Gorsze okresy się zdarzają i mijają. To nie znaczy, że robisz coś źle.'],
      sprobuj: up ? 'zapisać w słoiku jedną rzecz, która ostatnio Ci pomogła' : 'wybrać jedną rzecz z listy „Co Ci pomaga” i zrobić ją dziś w małej wersji',
      wsparcie: null, proba: null,
      wynik: 8 + Math.abs(d) / 2,
    };
  }

  function recoveryInsight(P) {
    if (P.rec.length < 21) return null;
    const med = median(P.rec.map(r => r.mood));
    const low = Math.min(5, med - 2), back = med - 0.5;
    const gaps = [];
    let lastLow = -99;
    P.rec.forEach((r, idx) => {
      if (r.mood > low || r.i - lastLow < 3) return;                // kolejne niskie dni to ten sam trudny okres
      lastLow = r.i;
      const next = P.rec.slice(idx + 1).find(q => q.i - r.i <= 5 && q.mood >= back);
      const seen = P.rec.slice(idx + 1).some(q => q.i - r.i <= 5);
      if (seen) gaps.push(next ? next.i - r.i : 6);
    });
    if (gaps.length < 4) return null;
    const m = median(gaps);
    if (m > 2) return null;
    const days = Math.round(m);
    return {
      key: 'powrot', typ: 'powrot', ton: 'zauwazone', grupa: 'powrot', kat: '--primary',
      tag: 'Po trudnym dniu', nazwa: 'Powrót po trudnym dniu',
      tytul: 'Po trudnym dniu wracasz do siebie',
      zdanie: days <= 1 ? 'Po gorszym dniu Twój nastrój zwykle wraca <b>już następnego dnia</b>.' : `Po gorszym dniu Twój nastrój zwykle wraca w ciągu <b>${days} dni</b>.`,
      wykres: null,
      pewnosc: 1, efekt: m, n: gaps.length, n1: gaps.length, n0: 0, p: null,
      powody: [`Tak było w ${gaps.filter(g => g <= 2).length} z ${gaps.length} takich sytuacji.`],
      sprobuj: 'przypomnieć sobie o tym, kiedy przyjdzie gorszy dzień',
      wsparcie: null, proba: null,
      wynik: 7,
    };
  }

  // ================================================================
  //  Wsparcie: kilka niskich dni w ostatnim tygodniu
  // ================================================================
  function supportRule(P) {
    const last = PROGI.okno - 1;
    const week = P.rec.filter(r => r.i > last - 7);
    const lowDays = week.filter(r => r.mood <= PROGI.niskiNastroj).length;
    const recent = P.rec.filter(r => r.i > last - 10).slice(-5).map(r => r.mood);
    if (lowDays >= PROGI.wsparcieIle || (recent.length >= 4 && mean(recent) <= 3.5)) return { powod: 'niskie', dni: lowDays };
    return null;
  }

  // ================================================================
  //  Obserwacje: co często było w lepsze dni (opis, nie wniosek)
  // ================================================================
  function observations(P, skipCodes) {
    if (P.rec.length < PROGI.doPodsumowania) return [];
    const sorted = P.rec.map(r => r.mood).sort((a, b) => a - b);
    const cut = sorted[Math.floor(sorted.length * 0.7)];                 // „lepszy dzień” = górne 30% nastrojów tej osoby
    const best = P.rec.filter(r => r.mood >= cut && r.mood > P.all), rest = P.rec.filter(r => !best.includes(r));
    const out = [];
    CZYNNIKI.forEach(f => {
      if (f.dir < 0 || f.tone !== 'pomaga' || skipCodes.has(f.code)) return;
      const srcOf = r => (f.lag ? P.rows[r.i - f.lag] : r);
      const known = l => l.map(srcOf).filter(x => x && x.e && f.known(x.e));
      const kb = known(best), kr = known(rest);
      if (kb.length < PROGI.obsMinLepszych || kr.length < 3) return;
      const hb = kb.filter(x => f.has(x.e)).length, sb = hb / kb.length, sr = kr.filter(x => f.has(x.e)).length / kr.length;
      if (hb < PROGI.obsMinLepszych || sb < PROGI.obsUdzial || sb - sr < PROGI.obsRoznica) return;
      out.push({
        key: `obserwacja:${f.code}`, czynnik: f.code, kat: f.cat, nazwa: f.nazwa, w: sb - sr,
        tekst: `W Twoje lepsze dni często ${f.obs} <b>(${hb} z ${kb.length})</b>.`,
        proba: f.proba ? { czynnik: f.code, ile: f.proba.ile, co: f.proba.co } : null,
      });
    });
    return out.sort((a, b) => b.w - a.w).slice(0, PROGI.maxObserwacji);
  }

  // Wiedza ogólna do sprawdzenia u siebie — uzupełnia „Co Ci pomaga”, dopóki nie ma tam wniosków z danych tej osoby
  function general(skipCodes, hiddenKeys) {
    return CZYNNIKI.filter(f => f.ogolnie && !skipCodes.has(f.code) && !hiddenKeys.has(`ogolne:${f.code}`)).map(f => ({
      key: `ogolne:${f.code}`, czynnik: f.code, kat: f.cat, nazwa: f.nazwa, tekst: f.ogolnie, sprobuj: f.sprobuj,
      proba: f.proba ? { czynnik: f.code, ile: f.proba.ile, co: f.proba.co } : null,
    }));
  }

  // ================================================================
  //  Tydzień w skrócie
  // ================================================================
  function weekSummary(P, helpsByCode) {
    const last = PROGI.okno - 1;
    const week = P.rows.slice(-7), prev = P.rows.slice(-14, -7);
    const w = week.filter(r => r.mood != null), pv = prev.filter(r => r.mood != null);
    const best = w.slice().sort((a, b) => b.mood - a.mood || b.i - a.i)[0] || null;
    let helped = null;
    if (best) {
      // co w najlepszy dzień było z rzeczy, które tej osobie zwykle pomagają (albo po prostu zaznaczone „dobrze”)
      const cands = CZYNNIKI.filter(f => f.dir > 0 && (() => { const s = f.lag ? P.rows[best.i - f.lag] : best; return s && s.e && f.known(s.e) && f.has(s.e); })());
      cands.sort((a, b) => (helpsByCode.get(b.code) || 0) - (helpsByCode.get(a.code) || 0));
      helped = cands[0] ? cands[0].nazwa : null;
    }
    return {
      dni: week.map(r => ({ date: r.date, dow: r.dow, mood: r.mood, today: r.i === last })),
      srednia: w.length ? mean(w.map(r => r.mood)) : null,
      poprzednia: pv.length ? mean(pv.map(r => r.mood)) : null,
      roznica: w.length && pv.length ? mean(w.map(r => r.mood)) - mean(pv.map(r => r.mood)) : null,
      najlepszy: best ? { date: best.date, dow: best.dow, mood: best.mood, today: best.i === last, pomoglo: helped } : null,
    };
  }

  // ================================================================
  //  Całość
  // ================================================================
  // feedback: { [key]: { v: 'pasuje' | 'nie', at: ISO } } — „To do mnie pasuje” przypina wniosek, „Nie pasuje” chowa go na 60 dni
  function analyze(days, opts = {}) {
    const today = toDate(opts.today || new Date());
    const feedback = opts.feedback || {};
    const P = prepare(days || [], today);
    const n = P.rec.length;
    const etap = n < PROGI.doPodsumowania ? 'start' : n < PROGI.doWnioskow ? 'tydzien' : 'wnioski';

    let all = [], tests = [];
    if (etap === 'wnioski') {
      const fi = factorInsights(P);
      tests = fi.tests;
      all = fi.list;
      const extra = [weekdayInsight(P, tests), trendInsight(P), recoveryInsight(P)].filter(Boolean);
      all = all.concat(extra);
    }
    all.forEach(w => { w.slowo = SLOWA_PEWNOSCI[w.pewnosc]; w.opinia = feedback[w.key] ? feedback[w.key].v : null; });

    const hidden = w => { const fb = feedback[w.key]; return !!fb && fb.v === 'nie' && (today - new Date(fb.at)) / DAY < PROGI.ukryjNaDni; };
    const visible = all.filter(w => !hidden(w)).sort((a, b) => b.wynik - a.wynik);

    // „Co Ci pomaga”: czynniki, na które ma się wpływ, od największej różnicy; przypięte zawsze na liście
    const helpsAll = visible.filter(w => w.typ === 'czynnik' && w.efekt > 0);
    const pomaga = helpsAll.slice().sort((a, b) => (b.opinia === 'pasuje') - (a.opinia === 'pasuje') || b.efekt - a.efekt).slice(0, PROGI.maxPomaga);

    // „Co zauważyliśmy”: najwyżej 3 karty, różne grupy; najpierw najmocniejsze „pomaga”, potem obserwacja (dzień / trudne sprawy)
    const picked = [];
    const take = w => { if (w && picked.length < PROGI.maxWnioskow && !picked.includes(w) && !picked.some(x => x.grupa === w.grupa)) picked.push(w); };
    take(visible.find(w => w.ton === 'pomaga'));
    take(visible.find(w => w.typ === 'dzien_tygodnia') || visible.find(w => w.ton !== 'pomaga'));
    visible.forEach(take);

    const helpsByCode = new Map(helpsAll.map(w => [w.czynnik, w.efekt]));
    const known = new Set(all.filter(w => w.typ === 'czynnik').map(w => w.czynnik));
    const hiddenKeys = new Set(Object.keys(feedback).filter(k => feedback[k].v === 'nie' && (today - new Date(feedback[k].at)) / DAY < PROGI.ukryjNaDni));
    const obserwacje = observations(P, known).filter(o => !hiddenKeys.has(o.key));
    // wiedza ogólna tylko tyle, ile brakuje do pełnej listy „Co Ci pomaga”
    const ogolne = general(new Set([...known, ...obserwacje.map(o => o.czynnik)]), hiddenKeys).slice(0, Math.max(0, PROGI.maxPomaga - pomaga.length));
    return {
      wersja: Dane.WERSJA, etap, dni: n,
      doPodsumowania: Math.max(0, PROGI.doPodsumowania - n), doWnioskow: Math.max(0, PROGI.doWnioskow - n),
      tydzien: weekSummary(P, helpsByCode),
      wsparcie: supportRule(P),
      wnioski: picked, pomaga, obserwacje, ogolne, wszystkie: all,
      sprawdzone: tests.length, poprawkaNaDzien: P.adjusted,
      okres: P.rec.length ? { od: P.rec[0].key, do: P.rec[P.rec.length - 1].key } : null,
    };
  }

  // ================================================================
  //  Tygodniowa próba: „spróbuj 3 razy i zobacz”
  // ================================================================
  // proba: { key, czynnik, ile, start: 'RRRR-MM-DD' }. Nigdy nie ocenia osoby: mniej prób niż plan to „mniej okazji”, nie porażka.
  function proba(days, pr, opts = {}) {
    const today = toDate(opts.today || new Date());
    const f = CZYNNIKI.find(x => x.code === pr.czynnik);
    if (!f) return null;
    const map = new Map();
    (days || []).forEach(d => { if (d && d.date != null) map.set(key(d.date), d); });
    const start = toDate(pr.start);
    const passed = Math.round((today - start) / DAY);
    const win = [];
    for (let i = 0; i < PROGI.probaDni; i++) {
      const date = addDays(start, i);
      if (date > today) break;
      // czynnik „z dnia wcześniej” (lag 1) liczymy w dniu, w którym został zrobiony; nastrój bierzemy z dnia, na który działa
      const e = map.get(key(date)) || null;
      const moodDay = map.get(key(addDays(date, f.lag))) || null;
      win.push({ did: !!(e && f.known(e) && f.has(e)), known: !!(e && f.known(e)), mood: moodDay && moodDay.mood != null ? moodDay.mood : null });
    }
    const done = win.filter(w => w.did).length;
    const ended = passed >= PROGI.probaDni;
    const out = { status: ended ? 'koniec' : 'trwa', zrobione: done, cel: pr.ile, zostaloDni: Math.max(0, PROGI.probaDni - passed), nazwa: f.nazwa, co: f.proba ? f.proba.co : f.nazwa, wynik: null };
    if (ended) {
      const a = win.filter(w => w.did && w.mood != null).map(w => w.mood), b = win.filter(w => w.known && !w.did && w.mood != null).map(w => w.mood);
      if (a.length < 2) out.wynik = { typ: 'za_malo', tekst: 'Tym razem było mało okazji. Nic się nie stało — możesz spróbować innym razem.' };
      else if (b.length < 2) out.wynik = { typ: 'bez_porownania', tekst: `Udało się ${done} ${PL(done, 'raz', 'razy', 'razy')}. Za mało dni „bez”, żeby porównać, ale to dobry tydzień prób.` };
      else {
        const d = mean(a) - mean(b);
        out.wynik = d >= 0.5
          ? { typ: 'pomoglo', roznica: d, tekst: `W dni z tym było u Ciebie o ${fmt(d)} lepiej. Wygląda na to, że to Ci służy.` }
          : { typ: 'bez_roznicy', roznica: d, tekst: 'Tym razem bez wyraźnej różnicy. To też wiedza: może pomaga Ci coś innego.' };
      }
    }
    return out;
  }

  const api = { analyze, proba, key, fmt, _test: { prepare, testFactor, bh, rng } };
  root.Wnioski = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
