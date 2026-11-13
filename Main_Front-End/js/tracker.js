/*
 * Tracker nastroju (zakładka „Tracker”) — wnioski zamiast wykresu.
 * Liczy je silnik js/wnioski.js (zasady i progi: notes/wnioski.md, teksty: js/wnioski-dane.js); ten plik tylko je pokazuje.
 *
 *  0. Wsparcie — zawsze na górze, gdy: w ostatnim tygodniu było kilka dni z bardzo niskim nastrojem, nastrój jest
 *     niski od dwóch tygodni, ostatni tydzień jest wyraźnie poniżej własnej normy albo kilka razy w dwa tygodnie było
 *     „ciężko” w domu / ze znajomymi. Kolejność: 116 111, (112), bliskie osoby, na końcu Asystent (to program).
 *     Trudne sprawy w domu i ze znajomymi są TYLKO tą kartą: bez liczby, wykresu, opinii i rad.
 *     W cięższym czasie (`wsparcie.cisza`) ekran nie dokłada zadań: znikają „Spróbuj” i przyciski eksperymentu.
 *  1. Twój tydzień w skrócie (pole koloru): średnia, 7 słupków, najlepszy dzień i co wtedy było.
 *  2. Twój eksperyment — „spróbuj 3 razy w tygodniu i zobacz”: postęp, a po tygodniu opis tygodnia (bez wyroku: tydzień
 *     niczego nie rozstrzyga). Bez kar: mniej razy niż plan to „mniej okazji”. W kodzie i w bazie nazywa się to „proba”.
 *  3. Co zauważyliśmy — najwyżej 3 wnioski naraz, każdy z tytułem, wykresem i słowem pewności
 *     („Wstępnie” / „Dość wyraźnie” / „Wyraźnie” + z ilu wpisów). Zdanie z liczbą jest opisem wykresu dla czytnika ekranu
 *     (pod wykresem powtarzało tytuł). Gdy karta wsparcia jest z powodu nastroju, nie ma wniosku „Ostatnie dwa tygodnie
 *     są trudniejsze” ani „o … mniej niż tydzień wcześniej”: ta sama wiadomość nie pada trzy razy. Powody i podpowiedź są zwinięte pod „Skąd to może się brać?”.
 *     Pod każdym: „Pasuje do mnie” / „Nie pasuje” (chowa wniosek na 60 dni, z „Cofnij”) i „Wypróbuj przez tydzień”.
 *     Zanim danych wystarczy: ile podlań brakuje (bez poganiania) i opis ostatnich dwóch tygodni („Ruch · 4 z 9 dni”).
 *  4. Co Ci pomaga — do 3 rzeczy z danych tej osoby, tylko takie, na które ma się wpływ, i tylko te, które nie mają
 *     już karty wyżej (bez powtórzeń; gdy nic nie zostaje, sekcji nie ma); puste miejsca uzupełnia
 *     wiedza ogólna z dopiskiem „sprawdź u siebie”.
 *  5. Zielnik — kwiat za każdy tydzień z co najmniej 3 podlaniami (bez kar za przerwę).
 *
 * Język: opis, nie przyczyna i nie diagnoza. Kolory kategorii (--cat-*) tylko tutaj: kropka przy nazwie i wyróżniony słupek.
 *
 * PROTOTYP: DANE PRZYKŁADOWE (12 tygodni z podłożonymi zależnościami), a dzisiejszy dzień bierze prawdziwy wpis z podlewania
 * (zdarzenie `entrychange`), więc eksperyment i podsumowanie widać „na żywo”. Opinie i eksperyment: localStorage `sci.wnioski`.
 * Podgląd etapów: ?wnioski=start | tydzien | szum | proba | koniec | niski | dom.
 * TODO backend: dni z widoku `checkin_days`, wnioski z `my_insights` (liczy je Edge Function `generate-insights` tym samym silnikiem),
 * opinie przez rpc('set_insight_feedback'), eksperyment przez rpc('start_experiment'). Karta wsparcia liczy się z dni na telefonie.
 *
 * window.WnioskiStan = { najlepsze } — to, co tej osobie najbardziej pomaga (strona główna podpowiada to w dzień „pół na pół”).
 */
(function () {
  'use strict';

  const root = document.getElementById('tracker-root');
  const Wn = window.Wnioski, WD = window.WnioskiDane;
  if (!root || !Wn || !WD) return;

  const $ = (s, r = root) => r.querySelector(s);
  const params = new URLSearchParams(location.search);
  const view = params.get('widok');
  const scenario = params.get('wnioski') || '';
  const { toast, haptic } = window.AuthCommon || { toast() {}, haptic() {} };
  const Zgody = window.Zgody;
  const KEY = 'sci.wnioski';
  const { DNI, PROGI } = WD;

  // ================================================================
  //  Dane przykładowe: 12 tygodni
  // ================================================================
  let seed = 90210;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const DAYS = scenario === 'start' ? 4 : scenario === 'tydzien' ? 10 : 84;
  const noise = scenario === 'szum';
  let prevPrepare = false;
  const demo = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(today); date.setDate(date.getDate() - (DAYS - 1 - i));
    const dow = date.getDay(), sun = dow === 0;
    const skip = i < DAYS - 1 && DAYS > 10 && rnd() < .16;
    // w nocy z soboty na niedzielę krócej i później; w niedziele częściej stres z nauką i mniej wyjść
    const sleepHours = [4, 5.5, 7.5, 7.5, 9][Math.min(4, Math.floor(rnd() * 5 - (sun ? .9 : 0) + .4))] || 4;
    const bedtime = Math.min(4, Math.max(1, 1 + Math.floor(rnd() * 4 + (sun ? .8 : 0) - (sleepHours >= 7 ? .5 : 0))));
    const sleepQuality = Math.min(4, Math.max(1, Math.round(1.5 + rnd() * 2 + (sleepHours >= 7 ? .5 : -.3))));
    const pick = (pos, neg) => { const r = rnd(); return r < neg ? -1 : r < neg + pos ? 1 : r < neg + pos + .15 ? 0 : null; };
    const areas = {};
    const put = (k, v) => { if (v != null) areas[k] = v; };
    put('friends', pick(sun ? .15 : .32, .08));
    put('nature', pick(sun ? .12 : .3, .06));
    put('family', pick(.25, .1));
    pick(.3, .06);   // dawne pole „Jedzenie” (usunięte 13.11.2026); losowanie zostaje, żeby dane pokazowe się nie przesunęły
    put('study', pick(.15, sun ? .55 : .18));
    const acts = {};
    const maybe = (k, p) => { if (rnd() < p) acts[k] = 1; };
    maybe('move', sun ? .2 : .42); maybe('hobby', .35); maybe('rest', .3); maybe('talk', .2); maybe('kindness', .18); maybe('prepare', sun ? .25 : .45);
    let mood = 5.4 + (rnd() - .5) * 2.2;
    if (!noise) {
      mood += (sleepHours >= 7 ? .9 : -.4) + (acts.move ? 1 : 0) + (areas.friends === 1 ? 1.1 : 0) + (areas.nature === 1 ? .5 : 0)
        + (areas.study === -1 ? -.7 : 0) + (prevPrepare ? .6 : 0) + (sun ? -.9 : 0);
    }
    prevPrepare = !skip && !!acts.prepare;
    const hour = sun || rnd() < .6 ? 19 + Math.floor(rnd() * 3) : 13 + Math.floor(rnd() * 5);
    return { date, sleepHours, bedtime, sleepQuality, areas, acts, hour, mood: skip ? null : Math.round(Math.min(10, Math.max(1, mood))) };
  });
  if (scenario === 'niski') demo.slice(-5).forEach((d, i) => { d.mood = [3, 2, 3, 2, 3][i]; });
  // „ciężko” w domu / ze znajomymi kilka razy w dwa tygodnie włącza kartę wsparcia: w zwykłym podglądzie jej nie chcemy
  // (dane są losowe), a ?wnioski=dom pokazuje ją celowo
  ['family', 'friends'].forEach(k => { let left = 2; demo.slice(-14).forEach(d => { if (d.areas[k] === -1 && left-- <= 0) delete d.areas[k]; }); });
  if (scenario === 'dom') demo.slice(-10).forEach((d, i) => { if (i % 2 === 0) d.areas.family = -1; });
  const demoToday = demo[demo.length - 1];

  // ================================================================
  //  Pamięć: opinie o wnioskach i tygodniowa próba
  // ================================================================
  const dayKey = n => { const d = new Date(today); d.setDate(d.getDate() - n); return Wn.key(d); };
  function loadState() {
    let s = null;
    if (!view) { try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) { s = null; } }
    s = s && typeof s === 'object' ? s : {};
    s.opinie = s.opinie || {};
    s.proba = s.proba || null;
    // podgląd stanów próby dla zespołu
    if (scenario === 'proba') s.proba = { key: 'czynnik:ruch', czynnik: 'ruch', ile: 3, start: dayKey(3) };
    if (scenario === 'koniec') s.proba = { key: 'czynnik:ruch', czynnik: 'ruch', ile: 3, start: dayKey(8) };
    return s;
  }
  const state = loadState();
  const save = () => { if (view || scenario) return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* tryb prywatny */ } };

  // dzisiejszy wpis z podlewania zastępuje przykładowy „dziś”
  function days() {
    const e = window.Podlewanie && window.Podlewanie.entry;
    if (!e) return demo;
    const live = { date: demoToday.date, mood: e.mood, sleepHours: e.sleepHours, sleepQuality: e.sleepQuality, bedtime: e.bedtime, areas: e.areas || {}, acts: e.acts || {}, hour: new Date().getHours() };
    return demo.slice(0, -1).concat(live);
  }

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const PHONE = '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>';
  const CHAT = '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>';
  const fmt = v => v.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const dni = n => `${n} ${WD.PL(n, 'dnia', 'dni', 'dni')}`;
  const podlan = n => `${n} ${WD.PL(n, 'podlanie', 'podlania', 'podlań')}`;

  // ---------- 0. wsparcie ----------
  // Treść karty przychodzi z silnika (res.wsparcie: { tytul, akapity, alarm, cisza }). Kolejność przycisków (uwaga rady):
  // najpierw ludzie — telefon zaufania, bliskie osoby — a Asystent, który jest programem, na końcu.
  const supportCard = s => `
    <section class="support is-low wn-support" aria-label="Wsparcie">
      <div class="support-low">
        <p class="support-title">${s.tytul}</p>
        ${s.akapity.map(a => `<p class="support-text">${a}</p>`).join('')}
      </div>
      <a class="support-call" href="tel:116111">${svg(PHONE)}Zadzwoń: 116 111 <small>bezpłatnie, całą dobę</small></a>
      ${s.alarm ? `<a class="support-call" href="tel:112">${svg('<path d="M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7z"/><path d="M12 8.5v4M12 15.5h.01"/>')}Gdy coś Ci grozi teraz: 112</a>` : ''}
      <button type="button" class="support-call wn-call-btn" data-sos>${svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>')}Twoje bliskie osoby i oddech</button>
      <button type="button" class="assist-btn" data-asystent="podlewanie">
        <span class="assist-ico" aria-hidden="true">${svg(CHAT)}</span>
        <span class="assist-text"><b>Porozmawiaj z Asystentem Wsparcia</b><small>Gdy chcesz pogadać</small></span>
        ${svg('<path d="M9 6l6 6-6 6"/>', 'assist-chev')}
      </button>
    </section>`;

  // ---------- 1. tydzień ----------
  function weekCard(res) {
    const t = res.tydzien;
    // gdy na górze jest karta wsparcia z powodu nastroju, nie powtarzamy tego samego liczbą („o 2,6 mniej”)
    const roznica = cisza && t.roznica < 0 ? null : t.roznica;
    const strip = t.dni.map((d, k) => `<span class="sum-day${d.today ? ' is-today' : ''}${d.mood == null ? ' is-rest' : ''}" style="--v:${d.mood == null ? .12 : d.mood / 10};--k:${k}"><b>${d.mood == null ? '' : d.mood}</b><i></i><small>${d.today ? 'dziś' : DNI.litera[d.dow]}</small></span>`).join('');
    const label = 'Ostatnie 7 dni: ' + t.dni.map(d => `${d.today ? 'dziś' : DNI.nazwa[d.dow]} ${d.mood == null ? 'odpoczynek' : `${d.mood} na 10`}`).join(', ');
    const head = t.srednia == null
      ? '<p class="wn-empty-lead">Tu pojawi się Twój tydzień, gdy podlejesz roślinkę.</p>'
      : `<p class="sum-head"><b>${fmt(t.srednia)}</b><span>/10${roznica == null ? '' : ` · ${Math.abs(roznica) < .2 ? 'podobnie jak tydzień wcześniej' : `o ${fmt(Math.abs(roznica))} ${roznica > 0 ? 'lepiej' : 'mniej'} niż tydzień wcześniej`}`}</span></p>`;
    const best = t.najlepszy;
    return `
    <section class="tr-sec week-sum" aria-labelledby="tr-week-title">
      <p class="kicker" id="tr-week-title">Twój tydzień w skrócie</p>
      ${head}
      <div class="sum-strip" role="img" aria-label="${label}">${strip}</div>
      ${best ? `<p class="sum-sub">Najlepszy dzień: ${best.today ? 'dziś' : DNI.nazwa[best.dow]}${best.pomoglo ? ` · tego dnia: ${best.pomoglo.toLowerCase()}` : ''}</p>` : ''}
    </section>`;
  }

  // ---------- 2. próba ----------
  function probaCard(pr) {
    if (!pr) return '';
    const dots = Array.from({ length: pr.cel }, (_, k) => `<i class="${k < pr.zrobione ? 'on' : ''}"></i>`).join('');
    if (pr.status === 'trwa') {
      return `
      <section class="insight wn-proba" aria-labelledby="wn-proba-title">
        <p class="insight-tag">Twój eksperyment · jeszcze ${dni(pr.zostaloDni)}</p>
        <h3 id="wn-proba-title">${pr.cel} ${pr.co}</h3>
        <p class="wn-dots" role="img" aria-label="${pr.zrobione} z ${pr.cel}">${dots}<span>${pr.zrobione} z ${pr.cel}</span></p>
        <p>${pr.gdzie || 'Liczymy to z Twojego podlewania.'} Bez presji: ile wyjdzie, tyle wyjdzie.</p>
        <button type="button" class="wn-text-btn" data-wn-proba-stop>Kończę wcześniej</button>
      </section>`;
    }
    return `
      <section class="insight wn-proba is-done" aria-labelledby="wn-proba-title">
        <p class="insight-tag">Twój eksperyment · tydzień za Tobą</p>
        <h3 id="wn-proba-title">${pr.nazwa}: ${pr.zrobione} ${WD.PL(pr.zrobione, 'raz', 'razy', 'razy')}</h3>
        <p>${pr.wynik.tekst}</p>
        <div class="wn-actions">
          ${pr.zrobione > 0 ? '<button type="button" class="btn-soft wn-btn" data-wn-proba-keep>Dodaj do moich sposobów</button>' : ''}
          <button type="button" class="wn-text-btn" data-wn-proba-stop>${pr.zrobione > 0 ? 'Nie teraz' : 'Zamknij'}</button>
        </div>
      </section>`;
  }

  // ---------- 3. wniosek ----------
  function chart(w) {
    const g = w.wykres;
    // zdanie z liczbą nie stoi już pod wykresem (powtarzało tytuł i słupki); zostaje jako opis wykresu dla czytnika ekranu
    if (!g) return `<p>${w.zdanie}</p>`;
    const opis = `role="img" aria-label="${w.zdanie.replace(/<[^>]+>/g, '')}"`;
    if (g.typ === 'tydzien') {
      return `<div class="mini-bars" ${opis}>${g.slupki.map(b => `<span class="mb${b.hl ? ' is-hl' : ''}" style="--v:${b.v == null ? 0 : b.v / 10}"><b>${b.v == null ? '–' : fmt(b.v)}</b><i></i><small>${b.label}</small></span>`).join('')}</div>`;
    }
    return `<div class="compare" ${opis}>${g.wiersze.map(r => `<span${r.hl ? ' class="is-hl"' : ''} style="--v:${r.v / 10}"><small>${r.label}</small><i></i><b>${fmt(r.v)}</b></span>`).join('')}</div>`;
  }

  function insightCard(w, i, hasProba) {
    const body = `<details class="insight-more">
           <summary>Skąd to może się brać?</summary>
           <div class="insight-body">
             ${w.powody.length ? `<ul class="why-list">${w.powody.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
             ${w.sprobuj && !cisza ? `<p class="try"><b>Spróbuj:</b> ${w.sprobuj}.</p>` : ''}
           </div>
         </details>`;
    const fb = w.opinia === 'pasuje'
      ? '<span class="wn-pinned">Pasuje do Ciebie</span>'
      : `<button type="button" class="wn-text-btn" data-wn-fb="pasuje" data-key="${w.key}">Pasuje do mnie</button>
         <button type="button" class="wn-text-btn" data-wn-fb="nie" data-key="${w.key}">Nie pasuje</button>`;
    return `
    <li class="insight" style="--i:${i + 1};--cat:var(${w.kat})">
      <p class="insight-tag"><i class="cat-dot" aria-hidden="true"></i>${w.tag}<span class="wn-sure">${w.slowo} · ${w.n} ${WD.PL(w.n, 'wpis', 'wpisy', 'wpisów')}</span></p>
      <h3>${w.tytul}</h3>
      ${chart(w)}
      ${body}
      <div class="wn-actions wn-foot">
        ${w.proba && !hasProba ? `<button type="button" class="btn-soft wn-btn" data-wn-try="${w.key}" data-czynnik="${w.proba.czynnik}" data-ile="${w.proba.ile}">Wypróbuj przez tydzień</button>` : ''}
        <span class="wn-fb">${fb}</span>
      </div>
    </li>`;
  }

  const waitCard = (title, text) => `
    <section class="insight wn-wait">
      <span class="empty-mascot" aria-hidden="true"><img src="img/listek.webp" alt="" width="60" height="42"></span>
      <h3>${title}</h3>
      <p>${text}</p>
    </section>`;

  const obsList = (list, hasProba) => (list.length ? `
    <ul class="wn-obs" aria-label="Twoje ostatnie dwa tygodnie">${list.map(o => `
      <li style="--cat:var(${o.kat})"><i class="cat-dot" aria-hidden="true"></i><span>${o.tekst}</span>
        ${o.proba && !hasProba ? `<button type="button" class="wn-text-btn" data-wn-try="${o.key}" data-czynnik="${o.proba.czynnik}" data-ile="${o.proba.ile}">Wypróbuj</button>` : ''}
      </li>`).join('')}
    </ul>
    <p class="helps-note wn-obs-note">Tyle razy było to w Twoich ostatnich dwóch tygodniach. Co z tego idzie w parze z nastrojem, pokażemy, gdy podlań będzie więcej.</p>` : '');

  function noticedBlock(res, hasProba) {
    if (res.etap === 'start') {
      return waitCard('Zbieramy pierwsze dni', res.dni
        ? `Jeszcze ${podlan(res.doPodsumowania)} i pokażemy, co było w Twoich dniach. Bez pośpiechu, roślinka poczeka.`
        : 'Po kilku podlaniach pokażemy tu, co było w Twoich dniach. Bez pośpiechu.');
    }
    if (res.etap === 'tydzien') {
      return obsList(res.obserwacje, hasProba) + waitCard('Wnioski rosną razem z roślinką', 'Potrzebują około trzech tygodni podlewania: pokazujemy je dopiero wtedy, gdy coś powtarza się dłużej niż kilka dni.');
    }
    const note = res.powrot ? `<p class="helps-note wn-note">${res.powrot.tekst}</p>` : '';
    if (!karty.length) {
      return obsList(res.obserwacje, hasProba) + waitCard('Na razie nic pewnego', 'Na razie nic się wyraźnie nie powtarza. Sprawdzamy dalej — to też informacja.') + note;
    }
    return `<ol class="tr-list">${karty.map((w, i) => insightCard(w, i, hasProba)).join('')}</ol>
      ${karty.length < 2 ? obsList(res.obserwacje, hasProba) : ''}${note}`;
  }
  const undoRow = () => (schowany ? `<p class="wn-undo" role="status">Schowane: „${schowany.tytul}”. <button type="button" class="wn-text-btn" data-wn-undo>Cofnij</button></p>` : '');

  // ---------- 4. co pomaga ----------
  function helpsBlock(res, hasProba) {
    // to, co ma już swoją kartę w „Co zauważyliśmy”, nie wraca tu drugi raz jako pasek
    const naKartach = new Set(karty.map(w => w.key));
    const pomaga = res.pomaga.filter(h => !naKartach.has(h.key));
    if (!pomaga.length && !res.ogolne.length) return '';
    const max = Math.max(...res.pomaga.map(h => h.efekt), 1);
    const own = pomaga.map((h, i) => `
      <li class="help" style="--i:${i + 1};--w:${(h.efekt / max * 100).toFixed(0)}%;--cat:var(${h.kat})">
        <i class="cat-dot" aria-hidden="true"></i>
        <span class="help-name">${h.nazwa}</span>
        <span class="help-val">+${fmt(h.efekt)}</span>
        <span class="help-bar" aria-hidden="true"><i></i></span>
      </li>`).join('');
    const gen = res.ogolne.map((g, i) => `
      <li class="help wn-general" style="--i:${pomaga.length + i + 1};--cat:var(${g.kat})">
        <i class="cat-dot" aria-hidden="true"></i>
        <span class="help-name">${g.nazwa}</span>
        <span class="wn-general-text">${g.tekst} <em>Sprawdź, jak jest u Ciebie.</em>
          ${g.proba && !hasProba ? `<button type="button" class="wn-text-btn" data-wn-try="${g.key}" data-czynnik="${g.proba.czynnik}" data-ile="${g.proba.ile}">Wypróbuj przez tydzień</button>` : ''}</span>
      </li>`).join('');
    return `
      <h2 class="sub-title">Co Ci pomaga</h2>
      ${pomaga.length ? '<p class="helps-note">Mniej więcej o tyle lepszy bywa Twój nastrój w takie dni.</p>' : '<p class="helps-note">Jeszcze za mało Twoich dni. Na start: co pomaga wielu osobom.</p>'}
      <ul class="helps">${own}${gen}</ul>`;
  }

  // ---------- 5. zielnik: tygodnie od poniedziałku ----------
  function herbarium(data) {
    const monday = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toDateString(); };
    const avg = l => l.reduce((a, b) => a + b, 0) / (l.length || 1);
    const weeks = [];
    data.forEach(d => { const k = monday(d.date); let w = weeks.find(x => x.key === k); if (!w) weeks.push(w = { key: k, days: [] }); w.days.push(d); });
    const thisWeek = weeks[weeks.length - 1];
    const pressed = weeks.slice(0, -1).filter(w => w.days.filter(d => d.mood != null).length >= 3).reverse();
    const range = w => {
      const a = w.days[0].date, b = new Date(a); b.setDate(b.getDate() + 6);
      const m = x => x.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '');
      return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
    };
    // zasuszony kwiat: liczba płatków i kolor zależą od tygodnia (im lepszy, tym pełniejszy)
    const FILLS = ['var(--plant-flower)', 'var(--accent-light)', 'var(--plant-leaf-2)', 'var(--plant-core)'];
    const flower = (w, i) => {
      const m = avg(w.days.filter(d => d.mood != null).map(d => d.mood));
      const n = m >= 7 ? 7 : m >= 5.5 ? 6 : 5, r = 9 + m * .9, fill = FILLS[i % FILLS.length], rot = (i * 37) % 60 - 30;
      const petals = Array.from({ length: n }, (_, k) => `<ellipse cx="40" cy="${38 - r * .55}" rx="${(r * .42).toFixed(1)}" ry="${(r * .62).toFixed(1)}" transform="rotate(${(k * 360 / n).toFixed(1)} 40 38)"/>`).join('');
      return `<svg viewBox="0 0 80 100" aria-hidden="true" style="transform: rotate(${rot}deg)">
        <path class="pf-stem" d="M40 96C38 80 43 62 40 44"/>
        <path class="pf-leaf" d="M40 74c-8-2-13-8-14-14 7 0 13 5 14 14zM41 64c7-3 11-8 12-13-6 1-11 5-12 13z"/>
        <g class="pf-petals" style="fill:${fill}">${petals}</g>
        <circle class="pf-core" cx="40" cy="38" r="${(r * .32).toFixed(1)}"/>
      </svg>`;
    };
    const count = thisWeek.days.filter(d => d.mood != null).length;
    return `
      <h2 class="sub-title">Zielnik</h2>
      <p class="helps-note">Kwiat za każdy tydzień z 3 podlaniami.</p>
      <ul class="herbarium">
        <li class="herb is-now"><span class="herb-seed">${Array.from({ length: 3 }, (_, k) => `<i class="${k < count ? 'on' : ''}"></i>`).join('')}</span><small>Ten tydzień</small><b>${count >= 3 ? (today.getDay() === 0 ? 'kwiat dziś' : 'kwiat w niedzielę') : `${count} z 3 podlań`}</b></li>
        ${pressed.slice(0, 8).map((w, i) => `<li class="herb" style="--i:${i + 1}">${flower(w, i)}<small>${range(w)}</small></li>`).join('')}
      </ul>`;
  }

  // ================================================================
  //  Widok
  // ================================================================
  let res = null, cisza = false, karty = [], schowany = null;   // karty: wnioski pokazane w „Co zauważyliśmy” · cisza: cięższy czas, nie dokładamy zadań · schowany: wniosek schowany przed chwilą („Nie pasuje”) — do cofnięcia
  function render() {
    // bez zgody na dane o samopoczuciu (po jej wycofaniu) nie ma z czego liczyć wniosków
    if (Zgody && !Zgody.has('health_data') && Zgody.state('health_data').withdrawn) {
      window.WnioskiStan = { najlepsze: null };
      root.innerHTML = `
        <section class="insight wn-wait">
          <span class="empty-mascot" aria-hidden="true"><img src="img/listek.webp" alt="" width="60" height="42"></span>
          <h3>Wnioski czekają na Twoją zgodę</h3>
          <p>Bez zgody na dane o samopoczuciu nie zapisujemy podlewań, więc nie ma z czego ich liczyć.</p>
          <button type="button" class="btn-soft wn-btn" data-konto="zgoda">Wyraź zgodę</button>
        </section>`;
      return;
    }
    const data = days();
    res = Wn.analyze(data, { today, feedback: state.opinie });
    const pr = state.proba ? Wn.proba(data, state.proba, { today }) : null;
    // w cięższym czasie nie dokładamy zadań: przyciski eksperymentu znikają (trwający eksperyment zostaje, bez poganiania)
    cisza = !!(res.wsparcie && res.wsparcie.cisza);
    const hasProba = !!pr || cisza;
    // karta wsparcia już mówi, że ostatnie dni są ciężkie: wniosek „Ostatnie dwa tygodnie są trudniejsze” byłby tą samą wiadomością drugi raz
    karty = res.wnioski.filter(w => !(cisza && w.key === 'trend:dol'));
    window.WnioskiStan = { najlepsze: res.pomaga[0] || null, etap: res.etap };

    const open = new Set([...root.querySelectorAll('.insight-more[open]')].map(d => d.closest('.insight').querySelector('h3').textContent));
    root.innerHTML = `
      ${res.wsparcie ? supportCard(res.wsparcie) : ''}
      ${weekCard(res)}
      ${probaCard(pr)}
      <h2 class="sub-title">Co zauważyliśmy</h2>
      ${noticedBlock(res, hasProba)}
      ${undoRow()}
      ${helpsBlock(res, hasProba)}
      ${herbarium(data)}
      <details class="wn-how">
        <summary>Jak powstają wnioski?</summary>
        <p>Porównujemy Twoje dni „z” i „bez” danej rzeczy z ostatnich 3 miesięcy. Pokazujemy tylko różnice, które utrzymują się co najmniej tydzień i nie wyglądają na przypadek. „Wstępnie” znaczy, że warto to sprawdzić; im więcej podlań, tym wniosek pewniejszy. Mimo to wniosek może być mylny: to opis Twoich dni, nie diagnoza, i nie mówi, co jest przyczyną (w lepszy dzień po prostu łatwiej się ruszyć albo z kimś spotkać).</p>
      </details>
      <p class="demo-note">Dane przykładowe${window.Podlewanie && window.Podlewanie.entry ? ' + Twój dzisiejszy wpis' : ''}. Wnioski to podpowiedzi, nie diagnoza.</p>`;
    // rozwinięte „Skąd to może się brać?” zostaje rozwinięte po odświeżeniu
    root.querySelectorAll('.insight').forEach(c => { const h = c.querySelector('h3'), d = c.querySelector('.insight-more'); if (h && d && open.has(h.textContent)) d.open = true; });
  }

  root.addEventListener('click', e => {
    const fb = e.target.closest('[data-wn-fb]');
    if (fb) {
      const card = fb.closest('.insight');
      state.opinie[fb.dataset.key] = { v: fb.dataset.wnFb, at: new Date().toISOString() };
      schowany = fb.dataset.wnFb === 'nie' ? { key: fb.dataset.key, tytul: card ? card.querySelector('h3').textContent : '' } : null;
      save(); haptic(8);
      toast(fb.dataset.wnFb === 'pasuje' ? 'Zapamiętane. Dzięki, że mówisz.' : 'Jasne, chowam ten wniosek. Dzięki, że mówisz.');
      render();
      return;
    }
    if (e.target.closest('[data-wn-undo]') && schowany) {
      delete state.opinie[schowany.key];
      schowany = null;
      save(); render();
      return;
    }
    const tr = e.target.closest('[data-wn-try]');
    if (tr) {
      state.proba = { key: tr.dataset.wnTry, czynnik: tr.dataset.czynnik, ile: Number(tr.dataset.ile), start: Wn.key(today) };
      save(); haptic(10);
      toast('Zaczynamy. Wrócę z podsumowaniem za tydzień.');
      render();
      // karta eksperymentu leży pod polem tygodnia — przewijamy do niej, żeby było widać, co się zaczęło
      const card = $('.wn-proba');
      if (card) { card.scrollIntoView({ block: 'center', behavior: view ? 'auto' : 'smooth' }); const h = card.querySelector('h3'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      return;
    }
    if (e.target.closest('[data-wn-proba-keep]')) {
      state.opinie[state.proba.key.replace(/^(obserwacja|ogolne):/, 'czynnik:')] = { v: 'pasuje', at: new Date().toISOString() };
      state.proba = null; save(); toast('Dodane do Twoich sposobów.'); render();
      return;
    }
    if (e.target.closest('[data-wn-proba-stop]')) { state.proba = null; save(); render(); }
  });

  window.addEventListener('entrychange', render);
  // wycofanie zgody usuwa też opinie o wnioskach i eksperyment (w bazie robi to wyzwalacz)
  window.addEventListener('consentchange', e => {
    if (e.detail.kind === 'health_data' && !e.detail.active && Zgody && Zgody.state('health_data').withdrawn) {
      state.opinie = {}; state.proba = null; schowany = null;
      if (!view) { try { localStorage.removeItem(KEY); } catch (_) { /* nic */ } }
    }
    render();
  });
  render();
})();
