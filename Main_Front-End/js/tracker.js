/*
 * Tracker nastroju (zakładka „Tracker”) — wnioski zamiast wykresu.
 *
 *  1. Twój tydzień w skrócie: 7 małych słupków + 3 zdania (średnia vs poprzedni tydzień, najlepszy dzień i co wtedy pomogło,
 *     jedna rzecz na kolejny tydzień).
 *  2. Co zauważyliśmy: spersonalizowane wnioski z danych podlewań, każdy z dowodem (mały wykres), możliwymi przyczynami
 *     („może to wynikać z…” — też policzone z danych) i jedną propozycją. Ton: podpowiedź, nie diagnoza.
 *       • najtrudniejszy dzień tygodnia (i pora, jeśli wpisy są wieczorem),
 *       • sen a nastrój.
 *  3. Co Ci pomaga: 3 odpowiedzi z podlewania, przy których nastrój był najwyżej ponad średnią.
 *  4. Zielnik: za każdy tydzień z co najmniej 3 podlaniami roślinka zostawia zasuszony kwiat (bez kar za przerwę —
 *     tydzień bez kwiatu po prostu się nie pokazuje). Bieżący tydzień: ile podlań już jest.
 * DANE PRZYKŁADOWE (stałe), w kształcie `daily_checkins` + godzina wpisu. Docelowo: Edge Function `generate-insights`.
 */
(function () {
  'use strict';

  const root = document.getElementById('tracker-root');
  if (!root) return;

  // ================================================================
  //  Dane przykładowe: 8 tygodni
  // ================================================================
  let seed = 90210;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const AREAS = [
    { id: 'friends', name: 'Czas z przyjaciółmi', w: 1.1 },
    { id: 'nature', name: 'Wyjście na dwór', w: .8 },
    { id: 'family', name: 'Rodzina', w: .4 },
    { id: 'food', name: 'Dobre jedzenie', w: .3 },
    { id: 'study', name: 'Nauka', w: .7 },
  ];
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const DAYS = 56;
  const data = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(today); date.setDate(date.getDate() - (DAYS - 1 - i));
    const dow = date.getDay();
    const sun = dow === 0;
    const skip = i < DAYS - 1 && rnd() < .18;
    // w nocy z soboty na niedzielę krócej, w niedziele częściej stres z nauką i mniej wyjść
    const sleep = Math.max(4.5, 5.5 + Math.round(rnd() * 6) / 2 - (sun ? 1.2 : 0));
    const pick = (pos, neg) => { const r = rnd(); return r < neg ? -1 : r < neg + pos ? 1 : r < neg + pos + .15 ? 0 : null; };
    const areas = {
      friends: pick(sun ? .15 : .3, .1),
      nature: pick(sun ? .1 : .3, .08),
      family: pick(.25, .12),
      food: pick(.3, .08),
      study: pick(.15, sun ? .55 : .2),
    };
    let mood = 5.6 + (sleep >= 7 ? .8 : -.4) + (rnd() - .5) * 1.6;
    AREAS.forEach(a => { if (areas[a.id] != null) mood += areas[a.id] * a.w; });
    const hour = sun || rnd() < .6 ? 19 + Math.floor(rnd() * 3) : 13 + Math.floor(rnd() * 5);
    return { date, dow, sleep, areas, hour, mood: skip ? null : Math.round(Math.min(10, Math.max(1, mood))) };
  });

  // ---------- Pomocnicze ----------
  const avg = l => l.reduce((a, b) => a + b, 0) / (l.length || 1);
  const fmt = v => v.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rec = data.filter(d => d.mood != null);
  const last30 = rec.slice(-30);
  const base = avg(last30.map(d => d.mood));
  const DOW_NAME = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const DOW_PL = ['niedziele', 'poniedziałki', 'wtorki', 'środy', 'czwartki', 'piątki', 'soboty'];
  const DOW_ADJ = ['niedzielne', 'poniedziałkowe', 'wtorkowe', 'środowe', 'czwartkowe', 'piątkowe', 'sobotnie'];
  const DOW_ON = ['w niedziele', 'w poniedziałki', 'we wtorki', 'w środy', 'w czwartki', 'w piątki', 'w soboty'];
  const LETTER = ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'];
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const share = (list, f) => list.length ? list.filter(f).length / list.length : 0;

  // ================================================================
  //  1. Tydzień w skrócie
  // ================================================================
  const week = data.slice(-7), prevWeek = data.slice(-14, -7);
  const wVals = week.filter(d => d.mood != null), wAvg = avg(wVals.map(d => d.mood)), pAvg = avg(prevWeek.filter(d => d.mood != null).map(d => d.mood));
  const best = wVals.slice().sort((a, b) => b.mood - a.mood)[0];
  const bestHelp = best ? AREAS.filter(a => best.areas[a.id] === 1).sort((a, b) => b.w - a.w)[0] : null;
  const diff = wAvg - pAvg;

  // ================================================================
  //  2. Wnioski
  // ================================================================
  // a) najtrudniejszy dzień tygodnia
  const byDow = Array.from({ length: 7 }, (_, k) => last30.filter(d => d.dow === k));
  const dowAvg = byDow.map(l => (l.length ? avg(l.map(d => d.mood)) : null));
  const worst = dowAvg.map((v, k) => ({ k, v })).filter(x => x.v != null && byDow[x.k].length >= 2).sort((a, b) => a.v - b.v)[0];
  const wDays = byDow[worst.k], others = last30.filter(d => d.dow !== worst.k);
  const othersAvg = avg(others.map(d => d.mood));
  const evening = share(wDays, d => d.hour >= 18) >= .6;
  // możliwe przyczyny — porównanie tego dnia z resztą (sen z poprzedniej nocy i odpowiedzi z podlewania)
  const reasons = [];
  const sleepGap = avg(others.map(d => d.sleep)) - avg(wDays.map(d => d.sleep));
  const DOW_BEFORE = ['niedzielą', 'poniedziałkiem', 'wtorkiem', 'środą', 'czwartkiem', 'piątkiem', 'sobotą'];
  const DOW_AT = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  if (sleepGap >= .5) reasons.push({ w: sleepGap, text: `w nocy przed ${DOW_BEFORE[worst.k]} śpisz średnio o ${fmt(sleepGap)} h krócej`, tip: `położyć się ${DOW_AT[(worst.k + 6) % 7]} trochę wcześniej` });
  const studyGap = share(wDays, d => d.areas.study === -1) - share(others, d => d.areas.study === -1);
  if (studyGap >= .15) reasons.push({ w: studyGap * 3, text: `${DOW_ON[worst.k]} częściej zaznaczasz, że nauka była trudna — może wracają myśli o nadchodzącym tygodniu i szkole`, tip: 'spakować plecak i przejrzeć plan lekcji wcześniej, żeby wieczór był wolny' });
  for (const a of [{ id: 'friends', text: 'rzadziej spotykasz się z przyjaciółmi', tip: 'umówić się z kimś choćby na krótki spacer' }, { id: 'nature', text: 'rzadziej wychodzisz na dwór', tip: 'wyjść na 20 minut na świeże powietrze' }]) {
    const g = share(others, d => d.areas[a.id] === 1) - share(wDays, d => d.areas[a.id] === 1);
    if (g >= .12) reasons.push({ w: g * 3, text: `${DOW_ON[worst.k]} ${a.text}`, tip: a.tip });
  }
  reasons.sort((a, b) => b.w - a.w);
  const why = reasons.slice(0, 2);

  // b) sen
  const goodSleep = last30.filter(d => d.sleep >= 7), badSleep = last30.filter(d => d.sleep < 7);
  const gs = avg(goodSleep.map(d => d.mood)), bs = avg(badSleep.map(d => d.mood));

  // ================================================================
  //  3. Co pomaga
  // ================================================================
  const helps = AREAS.map(a => { const l = last30.filter(d => d.areas[a.id] === 1).map(d => d.mood); return { name: a.name, n: l.length, diff: avg(l) - base }; })
    .filter(h => h.n >= 3 && h.diff > .2).sort((a, b) => b.diff - a.diff).slice(0, 3);
  const maxDiff = Math.max(...helps.map(h => h.diff), 1);

  // ================================================================
  //  4. Zielnik: tygodnie od poniedziałku
  // ================================================================
  const monday = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toDateString(); };
  const weeks = [];
  data.forEach(d => { const key = monday(d.date); let w = weeks.find(x => x.key === key); if (!w) weeks.push(w = { key, days: [] }); w.days.push(d); });
  const thisWeek = weeks[weeks.length - 1];
  const pressed = weeks.slice(0, -1).filter(w => w.days.filter(d => d.mood != null).length >= 3).reverse();
  const range = w => {
    const a = w.days[0].date, b = new Date(a); b.setDate(b.getDate() + 6);
    const m = x => x.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '');
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
  };
  // zasuszony kwiat: liczba płatków i kolor zależą od tygodnia (im lepszy, tym pełniejszy)
  const FILLS = ['var(--plant-flower)', 'var(--accent-light)', 'var(--plant-leaf-2)', 'var(--plant-core)'];
  function flower(w, i) {
    const m = avg(w.days.filter(d => d.mood != null).map(d => d.mood));
    const n = m >= 7 ? 7 : m >= 5.5 ? 6 : 5, r = 9 + m * .9, fill = FILLS[i % FILLS.length], rot = (i * 37) % 60 - 30;
    const petals = Array.from({ length: n }, (_, k) => `<ellipse cx="40" cy="${38 - r * .55}" rx="${(r * .42).toFixed(1)}" ry="${(r * .62).toFixed(1)}" transform="rotate(${(k * 360 / n).toFixed(1)} 40 38)"/>`).join('');
    return `<svg viewBox="0 0 80 100" aria-hidden="true" style="transform: rotate(${rot}deg)">
      <path class="pf-stem" d="M40 96C38 80 43 62 40 44"/>
      <path class="pf-leaf" d="M40 74c-8-2-13-8-14-14 7 0 13 5 14 14zM41 64c7-3 11-8 12-13-6 1-11 5-12 13z"/>
      <g class="pf-petals" style="fill:${fill}">${petals}</g>
      <circle class="pf-core" cx="40" cy="38" r="${(r * .32).toFixed(1)}"/>
    </svg>`;
  }

  // ================================================================
  //  Widok
  // ================================================================
  const maxBar = 10;
  const strip = week.map(d => `<span class="sum-day${d === data[DAYS - 1] ? ' is-today' : ''}${d.mood == null ? ' is-rest' : ''}" style="--v:${d.mood == null ? .12 : d.mood / maxBar}"><i></i><small>${d === data[DAYS - 1] ? 'dziś' : LETTER[d.dow]}</small></span>`).join('');
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowBars = dowOrder.map(k => `<span class="mb${k === worst.k ? ' is-hl' : ''}" style="--v:${dowAvg[k] == null ? 0 : dowAvg[k] / 10}"><b>${dowAvg[k] == null ? '–' : fmt(dowAvg[k])}</b><i></i><small>${LETTER[k]}</small></span>`).join('');
  const thisCount = thisWeek.days.filter(d => d.mood != null).length;

  root.innerHTML = `
    <section class="card week-sum">
      <p class="kicker">Twój tydzień w skrócie</p>
      <div class="sum-strip" aria-hidden="true">${strip}</div>
      <p class="sum-head"><b>${fmt(wAvg)}</b><span>/10 · ${Math.abs(diff) < .2 ? 'podobnie jak tydzień wcześniej' : `o ${fmt(Math.abs(diff))} ${diff > 0 ? 'lepiej' : 'mniej'} niż tydzień wcześniej`}</span></p>
      ${best ? `<p class="sum-sub">Najlepszy dzień: ${best === data[DAYS - 1] ? 'dziś' : DOW_NAME[best.dow]}${bestHelp ? ` · pomogło: ${bestHelp.name.toLowerCase()}` : ''}</p>` : ''}
    </section>

    <h2 class="sub-title">Co zauważyliśmy</h2>
    <article class="card insight-card" style="--i:1">
      <p class="insight-tag">${svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>')}Dzień tygodnia</p>
      <h3>${cap(DOW_ADJ[worst.k])} ${evening ? 'wieczory' : 'dni'} bywają trudniejsze</h3>
      <div class="mini-bars" aria-hidden="true">${dowBars}</div>
      <p>Średnio o <b>${fmt(othersAvg - worst.v)}</b> niżej niż w inne dni.</p>
      <details class="insight-more">
        <summary>Skąd to może się brać?</summary>
        <div class="insight-body">
          ${why.length ? `<ul class="why-list">${why.map(r => `<li>${cap(r.text)}.</li>`).join('')}</ul>` : ''}
          <p class="try"><b>Spróbuj:</b> ${why[0] ? why[0].tip : 'zaplanować na ten dzień coś przyjemnego'}.</p>
        </div>
      </details>
    </article>

    <article class="card insight-card" style="--i:2">
      <p class="insight-tag">${svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>')}Sen</p>
      <h3>Sen poprawia Ci dzień</h3>
      <div class="compare" aria-hidden="true">
        <span style="--v:${bs / 10}"><small>mniej niż 7 h</small><i></i><b>${fmt(bs)}</b></span>
        <span class="is-hl" style="--v:${gs / 10}"><small>7 h i więcej</small><i></i><b>${fmt(gs)}</b></span>
      </div>
      <p>Po 7 h snu i więcej średnio o <b>${fmt(gs - bs)}</b> lepiej.</p>
      <details class="insight-more">
        <summary>Skąd to może się brać?</summary>
        <div class="insight-body">
          <ul class="why-list"><li>Wyspany mózg łatwiej radzi sobie ze stresem i emocjami.</li>${badSleep.length ? `<li>Krótko śpisz najczęściej ${DOW_ON[[0, 1, 2, 3, 4, 5, 6].map(k => ({ k, n: badSleep.filter(d => d.dow === k).length })).sort((a, b) => b.n - a.n)[0].k]}.</li>` : ''}</ul>
          <p class="try"><b>Spróbuj:</b> odłożyć telefon pół godziny przed snem.</p>
        </div>
      </details>
    </article>

    <h2 class="sub-title">Co Ci pomaga</h2>
    <p class="helps-note herb-note">O tyle lepszy bywa Twój nastrój w takie dni.</p>
    <ul class="helps">${helps.map((h, i) => `
      <li class="help" style="--i:${i + 1};--w:${(h.diff / maxDiff * 100).toFixed(0)}%">
        <span class="help-name">${h.name}</span>
        <span class="help-val">+${fmt(h.diff)}</span>
        <span class="help-bar" aria-hidden="true"><i></i></span>
      </li>`).join('')}
    </ul>

    <h2 class="sub-title">Zielnik</h2>
    <p class="helps-note herb-note">Kwiat za każdy tydzień z 3 podlaniami.</p>
    <ul class="herbarium">
      <li class="herb is-now"><span class="herb-seed">${Array.from({ length: 3 }, (_, k) => `<i class="${k < thisCount ? 'on' : ''}"></i>`).join('')}</span><small>Ten tydzień</small><b>${thisCount >= 3 ? 'kwiat w niedzielę' : `${thisCount} z 3 podlań`}</b></li>
      ${pressed.map((w, i) => `<li class="herb" style="--i:${i + 1}">${flower(w, i)}<small>${range(w)}</small></li>`).join('')}
    </ul>
    <p class="demo-note">Dane przykładowe. Wnioski to podpowiedzi, nie diagnoza.</p>`;
})();
