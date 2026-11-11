/*
 * Strona główna (Dom) — domyślnie D „Żywa planeta” (6.11.2026, opis w CLAUDE.md); poprzednie wersje do podglądu i porównania:
 * ?uklad=a | b | c (porownanie.html pokazuje je obok siebie; przełącznik widać tylko z parametrem ?uklad).
 * ?uklad=stary — dawna strona główna z przyciskiem „Podlej roślinkę”.
 * Logika podlewania zostaje jedna: window.Podlewanie (js/home2.js) i window.Checkin (js/checkin.js).
 *
 *  D „Żywa planeta” (wybór z dyskusji o A, B i C)
 *    • pierwszy ekran to roślinka, 7 dni i jeden przycisk „Podlej roślinkę”; bez przewijania i bez nakładki,
 *    • stuknięcie zamienia dolny panel w 10 liczb w tym samym miejscu, drugie stuknięcie = deszcz — roślinkę cały czas widać,
 *    • z A: wsparcie od razu przy nastroju 1–3, „+” dla szczegółów, jedna podpowiedź; z B: pasek 7 dni na górze treści,
 *    • panel ma stałą wysokość w każdym stanie, więc nic nie skacze, a deszcz jest widoczny.
 *  A „Dziś jednym dotknięciem” (Daylio + Gentler Streak + cofanie zamiast potwierdzeń)
 *    • nastrój jako 10 dużych przycisków na samej stronie: jedno stuknięcie = podlana roślinka (zamiast 6 kroków),
 *    • sen, „co było ważne” i notatka jako opcjonalne „+” — otwierają pytania od razu od tego kroku,
 *    • „Dla Ciebie teraz”: jedna podpowiedź dopasowana do nastroju, pod nią szybkie skróty (bez przewijania na dół),
 *    • dzień bez wpisu to „odpoczynek” (nie luka).
 *  B „Strona dnia” (DailyNote / Today + How We Feel + One Line Diary)
 *    • Dom to strona dzisiejszego dnia, u góry 7 dni — stuknięcie pokazuje dawny dzień (tylko podgląd),
 *    • wszystkie pytania na jednym ekranie, bez nakładki; zapisuje się po każdej odpowiedzi,
 *    • po nastroju słowa emocji (opcjonalnie, nowe pole `words` — do ustalenia z zespołem), na końcu jedna linijka.
 *  C „Wszystko pod kciukiem” (Things 3 + Gentler Streak + How We Feel)
 *    • w pasku zakładek środkowy „+”: stuknięcie = podlewanie; przytrzymanie / przeciągnięcie w górę / strzałka w górę =
 *      nowa myśl, dobra chwila albo wpis na blogu,
 *    • „Jak mija dzień?”: status dnia (choroba, wyjazd, egzaminy…; nowe pole `status` — do ustalenia) zmienia podpowiedź,
 *    • po podlaniu karta z jednym następnym krokiem.
 * Przy nastroju 1–3 każda wersja od razu pokazuje wsparcie (Asystent + 116 111), tak jak pytania podlewania.
 * Dane wpisu żyją w pamięci strony (jak dotąd). W React Native: osobne komponenty ekranu Dom.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  // window.UKLAD_DOMYSLNY: wersja wpisana na stałe (np. w pliku podglądu bez adresu z parametrem)
  // E „Pokoje” to D z wyraźnie oddzielonymi zakładkami (js/pokoje.js): strona główna buduje się tak samo jak w D
  const U0 = (params.get('uklad') || window.UKLAD_DOMYSLNY || 'd').toLowerCase();   // domyślnie D
  const U = U0 === 'e' ? 'd' : U0;
  if (!['a', 'b', 'c', 'd'].includes(U) || !window.Podlewanie) return;
  document.documentElement.dataset.uklad = U;

  const P = window.Podlewanie, D = (window.Checkin && window.Checkin.DATA) || null;
  const { haptic } = window.AuthCommon;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('widok');
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ICON = {
    breath: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2 3"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    jar: '<path d="M8.5 3.5h7"/><path d="M9.2 3.5v2.3C7.1 6.6 5.6 8.2 5.6 10.6v6.6a2.8 2.8 0 0 0 2.8 2.8h7.2a2.8 2.8 0 0 0 2.8-2.8v-6.6c0-2.4-1.5-4-3.6-4.8V3.5"/><path d="M10.3 13.2h.01M13.8 16h.01"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    phone: '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    drop: '<path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const word = v => (P.MOOD_WORDS[v] || '');
  const LOW = D ? D.LOW : 3;
  const view = $('#view-dom');
  const anchor = $('#sec-water');
  const now = new Date();
  const weekday = now.toLocaleDateString('pl-PL', { weekday: 'long' });
  const dateLong = `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`;

  // ================================================================
  //  Wspólne komponenty
  // ================================================================
  // Przełącznik wersji (tylko w podglądzie z ?uklad) — zmiana przeładowuje stronę
  const NAMES = { a: 'Dziś jednym dotknięciem', b: 'Strona dnia', c: 'Wszystko pod kciukiem', d: 'Żywa planeta' };
  const Switch = () => `
    <nav class="du-switch" aria-label="Wersja strony głównej">
      ${['a', 'b', 'c', 'd'].map(k => `<a href="?uklad=${k}#/dom"${k === U ? ' aria-current="page"' : ''}><b>${k.toUpperCase()}</b><span>${NAMES[k]}</span></a>`).join('')}
    </nav>`;

  // Wsparcie przy niskim nastroju — ta sama treść co w pytaniach podlewania
  const Support = () => `
    <div class="du-support" hidden>
      <p class="support-title">Ciężki dzień?</p>
      <p class="support-text">Nie musisz zostawać z tym sam(a).</p>
      <button type="button" class="du-row-btn" data-asystent="dom">${svg(ICON.chat)}<span><b>Porozmawiaj z Asystentem</b><small>posłucha, bez oceniania</small></span>${svg(ICON.chev)}</button>
      <a class="support-call" href="tel:116111">${svg(ICON.phone)}Zadzwoń: 116 111 <small>bezpłatnie, całą dobę</small></a>
    </div>`;
  const paintSupport = (root, mood) => { const s = $('.du-support', root); if (s) s.hidden = !(mood && mood <= LOW); };

  // Jedna podpowiedź dopasowana do stanu (A i C)
  function suggestion(mood, status) {
    if ((mood && mood <= LOW) || status === 'ciezko') return { icon: ICON.chat, title: 'Porozmawiaj z Asystentem', why: 'gdy jest ciężko, łatwiej to z siebie wyrzucić', attr: 'data-asystent="dom"' };
    if (status === 'egzaminy') return { icon: ICON.breath, title: 'Minuta oddechu przed nauką', why: 'spokojniejsza głowa lepiej zapamiętuje', attr: 'data-breath' };
    if (status === 'choroba') return { icon: ICON.moon, title: 'Odpocznij', why: 'dzień bez wpisu nic nie psuje — roślinka poczeka', attr: 'data-breath' };
    if (mood >= 7) return { icon: ICON.jar, title: 'Wrzuć dobrą chwilę do słoika', why: 'przyda się w gorszy dzień', attr: 'data-du-jar' };
    if (mood) return { icon: ICON.breath, title: 'Minuta oddechu z roślinką', why: 'gdy dzień jest pół na pół', attr: 'data-breath' };
    return { icon: ICON.breath, title: 'Minuta oddechu', why: 'dobry początek, zanim zaczniesz dzień', attr: 'data-breath' };
  }
  const Suggest = s => `<button type="button" class="du-suggest" ${s.attr}><span class="du-ico">${svg(s.icon)}</span><span><b>${s.title}</b><small>${s.why}</small></span>${svg(ICON.chev)}</button>`;

  // Szybkie skróty (A): mniejsze, w jednym rzędzie, od razu pod podpowiedzią
  const Quick = () => `
    <div class="du-quick" role="group" aria-label="Na skróty">
      <button type="button" class="du-chip" data-go="skrytka">${svg(ICON.lock)}Zapisz myśl</button>
      <button type="button" class="du-chip" data-breath>${svg(ICON.breath)}Oddech</button>
      <button type="button" class="du-chip" data-asystent="dom">${svg(ICON.chat)}Asystent</button>
    </div>`;

  // Słoik dobrych chwil: przejście do Skrytki, karta Słoik, kursor w polu
  function openJar() {
    location.hash = '#/skrytka';
    setTimeout(() => { const b = $('[data-pane="sloik"]'); if (b) b.click(); const t = $('#jar-text'); if (t) t.focus(); }, 80);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-du-jar]')) openJar(); });

  // Dzień bez wpisu = odpoczynek (Gentler Streak): inny opis po stuknięciu w dzień
  function restLabels() {
    const { missed, names } = P.week;
    const detail = $('#day-detail');
    const say = i => { if (missed[i] && detail) detail.textContent = `${names[i]} · odpoczynek — też się liczy, roślinka nic nie traci`; };
    $('#days').addEventListener('click', e => { const b = e.target.closest('.day'); if (b) say(+b.dataset.i); });
    window.addEventListener('dayselect', e => say(e.detail.index));
    $$('.day.is-missed').forEach(b => b.setAttribute('aria-label', `${names[+b.dataset.i]}: odpoczynek`));
  }

  // ================================================================
  //  D — Żywa planeta
  // ================================================================
  // Liść dnia: dwie połówki (światło i cień) i nerw; podstawa stoi na gałązce tygodnia
  const LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="zy-l-a" d="M5 21C3.500 10.500 10 4 21 3 21 3 21 3 5 21z"/><path class="zy-l-b" d="M5 21 21 3c-.5 11-7.500 18-16 18z"/><path class="zy-l-v" d="M5 21 17 7.500"/></svg>';
  function buildD() {
    const { days, names, labels, missed } = P.week;
    const Scene = window.Home2Scene || { nudge() {}, select() {} };
    anchor.insertAdjacentHTML('beforebegin', `
      <section class="zy-panel" id="zy-panel" data-state="idle" aria-label="Dziś">
        <div class="zy-face zy-f-main">
          <div class="zy-week" role="group" aria-label="Ostatnie 7 dni">
            ${days.map((v, i) => {
              const today = i === 6, rest = missed[i];
              return `<button type="button" class="zy-day${today ? ' is-today' : ''}${rest ? ' is-rest' : ''}" data-i="${i}" aria-pressed="false" style="--v:${v || 0};--i:${i}" aria-label="${today ? 'Dziś: roślinka czeka' : rest ? `${names[i]}: odpoczynek` : `${names[i]}: ${v} na 10`}"><i>${LEAF}</i><span>${labels[i]}</span></button>`;
            }).join('')}
          </div>
          <span class="sr" id="zy-day-say" aria-live="polite"></span>
          <button type="button" class="zy-water" id="zy-water" aria-haspopup="dialog"><span class="zy-drop">${svg(ICON.drop)}</span>Podlej roślinkę</button>
          <div class="zy-done" id="zy-done">
            <span class="zy-done-ico">${svg(ICON.check)}</span>
            <b id="zy-done-text" aria-live="polite"></b>
            <button type="button" class="zy-change" data-zy-open>Zmień</button>
          </div>
        </div>

        <div class="zy-face zy-f-low">
          <p class="zy-low-title"><b>Ciężki dzień?</b> Nie musisz zostawać z tym sam(a).</p>
          <div class="zy-low-btns">
            <button type="button" class="zy-help" data-asystent="dom">${svg(ICON.chat)}<span>Porozmawiaj<br>z Asystentem</span></button>
            <a class="zy-help" href="tel:116111">${svg(ICON.phone)}<span>Zadzwoń<br><b>116 111</b></span></a>
          </div>
          <p class="zy-low-line"><span id="zy-low-text" aria-live="polite"></span> <button type="button" class="zy-change" data-zy-open>Zmień</button></p>
        </div>
      </section>

      <section class="sec zy-next" aria-labelledby="zy-next-title">
        <p class="kicker" id="zy-next-title">Dla Ciebie teraz</p>
        <div id="du-suggest">${Suggest(suggestion(null))}</div>
        <div class="du-more" id="du-more" hidden>
          <p class="du-more-title">Chcesz dodać więcej? Nie musisz.</p>
          <div class="du-add">
            <button type="button" class="du-chip" data-step="sleep">${svg(ICON.plus)}Sen</button>
            <button type="button" class="du-chip" data-step="areas">${svg(ICON.plus)}Co było ważne</button>
            <button type="button" class="du-chip" data-step="note">${svg(ICON.plus)}Notatka</button>
          </div>
        </div>
        <div class="du-quick zy-quick" role="group" aria-label="Na skróty">
          <button type="button" class="du-chip" data-go="skrytka">${svg(ICON.lock)}Zapisz myśl</button>
          <button type="button" class="du-chip" data-breath>${svg(ICON.breath)}Oddech</button>
        </div>
      </section>`);
    const root = $('#zy-panel'), next = root.nextElementSibling;
    const setState = s => { root.dataset.state = s; };
    const settled = m => (m ? (m <= LOW ? 'low' : 'done') : 'idle');

    // „Podlej roślinkę” i „Zmień” otwierają pełne pytania (js/checkin.js): ekran wyrasta kołem z przycisku,
    // zaczyna od suwaka nastroju, a sen, ważne sprawy i notatkę można przejść albo pominąć. Po ostatnim pytaniu
    // koło zwija się do roślinki i pada deszcz; window.Podlewanie zapisuje wpis i wysyła entrychange.
    function openCheckin(from) {
      Scene.nudge();
      haptic(8);
      P.open({ from, step: 'mood' });
    }
    $('#zy-water').addEventListener('click', e => openCheckin(e.currentTarget));
    // Z rejestracji („Podlej pierwszy raz”, aplikacja.html?podlej=1): pytania otwierają się same, gdy strona się ułoży.
    // Parametr znika z adresu, żeby odświeżenie strony nie otwierało ich drugi raz.
    if (params.get('podlej') === '1') {
      try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (_) { /* np. sandbox */ }
      if (!P.entry) setTimeout(() => openCheckin($('#zy-water')), 1100);
    }
    root.addEventListener('click', e => {
      const ch = e.target.closest('[data-zy-open]');
      if (ch) { openCheckin(ch); return; }
      const d = e.target.closest('.zy-day');
      if (d) { showDay(+d.dataset.i); Scene.select(+d.dataset.i); }
    });
    // po deszczu światło biegnie gałązką tygodnia do dzisiejszego liścia
    window.addEventListener('watered', () => {
      root.classList.add('is-pulse');
      setTimeout(() => root.classList.remove('is-pulse'), 800);
    });
    next.addEventListener('click', e => {
      const add = e.target.closest('[data-step]');
      if (add) P.open({ from: add, step: add.dataset.step });
    });

    // Dzień z paska: podświetla swój liść na roślince (podpis rysuje scena), czytnik ekranu dostaje tekst
    let dayTimer = 0;
    function showDay(i) {
      $$('.zy-day', root).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.i === i)));
      clearTimeout(dayTimer);
      dayTimer = setTimeout(() => $$('.zy-day', root).forEach(x => x.setAttribute('aria-pressed', 'false')), 3200);   // jak podpis na roślince
      const m = P.entry && P.entry.mood;
      $('#zy-day-say').textContent = i === 6 ? (m ? `Dziś: ${m} na 10, ${word(m)}` : 'Dziś: roślinka czeka')
        : missed[i] ? `${names[i]}: odpoczynek. Też się liczy, roślinka nic nie traci.` : `${names[i]}: ${days[i]} na 10, ${word(days[i])}`;
    }
    window.addEventListener('dayselect', e => showDay(e.detail.index));

    function paint(entry) {
      const m = entry && entry.mood;
      setState(settled(m));
      const today = $('.zy-day.is-today', root);
      today.classList.toggle('is-watered', !!m);
      today.style.setProperty('--v', m || 0);
      today.setAttribute('aria-label', m ? `Dziś: ${m} na 10` : 'Dziś: roślinka czeka');
      const said = m ? `Podlane · ${m}/10 · ${word(m)}` : '';
      $('#zy-done-text').textContent = said;
      $('#zy-low-text').textContent = said;
      $('#du-more').hidden = !m;
      $('#du-suggest').innerHTML = Suggest(suggestion(m));
      if (entry) [['sleep', entry.sleepHours != null || entry.sleepQuality != null], ['areas', Object.keys(entry.areas || {}).length], ['note', !!(entry.note || '').trim()]]
        .forEach(([k, done]) => { const c = $(`[data-step="${k}"]`, next); c.classList.toggle('is-done', !!done); c.querySelector('svg').innerHTML = done ? ICON.check : ICON.plus; });
    }
    paint(P.entry);
    window.addEventListener('entrychange', e => paint(e.detail));

    // Wskaźnik bieżącej zakładki przesuwa się między nimi (telefon)
    const bar = $('#tabbar');
    if (bar) {
      const ORDER = ['dom', 'skrytka', 'tracker', 'testy', 'blog'];
      bar.insertAdjacentHTML('afterbegin', '<span class="zy-tab-ind" aria-hidden="true"></span>');
      const place = tab => bar.style.setProperty('--ti', Math.max(0, ORDER.indexOf(tab)));
      place(document.body.dataset.tab);
      window.addEventListener('tabchange', e => place(e.detail.tab));
    }

    // Pierwsze wejście: gałązka się rysuje, liście wyrastają, przycisk wjeżdża
    if (!reduceMotion) {
      root.classList.add('is-arriving');
      setTimeout(() => root.classList.remove('is-arriving'), 2400);
      // „Myśl na dziś”: słowa po kolei, gdy sekcja wjedzie na ekran
      const q = $('#quote');
      if (q && 'IntersectionObserver' in window) {
        q.innerHTML = q.textContent.trim().split(/\s+/).map((w, i) => `<span class="zy-w" style="--i:${i}">${esc(w)}</span>`).join(' ');
        const io = new IntersectionObserver(en => { if (en.some(x => x.isIntersecting)) { q.classList.add('is-in'); io.disconnect(); } }, { threshold: .3 });
        io.observe(q);
      }
    }

    // Rzadko używane opcje schodzą z górnego paska na koniec Domu
    const foot = $('.plant-foot');
    if (foot) {
      foot.insertAdjacentHTML('beforeend', `
        <span class="zy-foot-links">
          <button type="button" class="zy-link" data-zy-click="#color-open">Kolor roślinki</button>
          <button type="button" class="zy-link" data-zy-click="#plant-zoom">Roślinka na cały ekran</button>
        </span>`);
      foot.addEventListener('click', e => {
        const b = e.target.closest('[data-zy-click]');
        if (!b) return;
        if (b.dataset.zyClick === '#plant-zoom') window.scrollTo(0, 0);
        $(b.dataset.zyClick).click();
      });
    }
  }

  // ================================================================
  //  A — Dziś jednym dotknięciem
  // ================================================================
  function buildA() {
    anchor.insertAdjacentHTML('beforebegin', `
      <section class="sec du-today" id="du-today" aria-labelledby="du-a-title">
        <p class="kicker">Dziś · ${esc(weekday)}</p>
        <h2 id="du-a-title">Jak się dziś czujesz?</h2>
        <div class="du-moods" role="radiogroup" aria-label="Nastrój od 1 do 10">
          ${Array.from({ length: 10 }, (_, i) => i + 1).map(v => `<button type="button" role="radio" aria-checked="false" class="du-mood" data-v="${v}" style="--v:${v}" aria-label="${v} — ${word(v)}"><span>${v}</span></button>`).join('')}
        </div>
        <p class="du-mood-word" id="du-mood-word" aria-live="polite">Stuknij liczbę — to wystarczy, żeby podlać roślinkę.</p>
        ${Support()}
        <div class="du-more" id="du-more" hidden>
          <p class="du-more-title">Chcesz dodać więcej? Nie musisz.</p>
          <div class="du-add">
            <button type="button" class="du-chip" data-step="sleep">${svg(ICON.plus)}Sen</button>
            <button type="button" class="du-chip" data-step="areas">${svg(ICON.plus)}Co było ważne</button>
            <button type="button" class="du-chip" data-step="note">${svg(ICON.plus)}Notatka</button>
          </div>
        </div>
      </section>
      <section class="sec du-foryou" aria-labelledby="du-a-for">
        <p class="kicker" id="du-a-for">Dla Ciebie teraz</p>
        <div id="du-suggest">${Suggest(suggestion(null))}</div>
        ${Quick()}
      </section>`);
    const root = $('#du-today');
    const moods = $$('.du-mood', root);
    // strzałki w grupie (radiogroup): jak w natywnej grupie przycisków radiowych
    root.addEventListener('keydown', e => {
      const b = e.target.closest('.du-mood');
      if (!b) return;
      const map = { ArrowRight: 1, ArrowDown: 5, ArrowLeft: -1, ArrowUp: -5 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const v = Math.min(10, Math.max(1, +b.dataset.v + map[e.key]));
      moods[v - 1].focus();
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('.du-mood');
      if (b) { P.save({ mood: +b.dataset.v }); haptic([10, 30, 10]); return; }
      const add = e.target.closest('[data-step]');
      if (add) P.open({ from: add, step: add.dataset.step });
    });
    function paint(entry) {
      const m = entry && entry.mood;
      moods.forEach(b => { const on = +b.dataset.v === m; b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!m && b.dataset.v === '5') ? 0 : -1; });
      $('#du-mood-word').innerHTML = m ? `<b>Podlane · ${m}/10 · ${word(m)}.</b> Możesz zmienić, stukając inną liczbę.` : 'Stuknij liczbę — to wystarczy, żeby podlać roślinkę.';
      $('#du-more').hidden = !m;
      paintSupport(root, m);
      $('#du-suggest').innerHTML = Suggest(suggestion(m));
      // co już jest we wpisie: „+” zmienia się w ✓
      if (entry) [['sleep', entry.sleepHours != null || entry.sleepQuality != null], ['areas', Object.keys(entry.areas || {}).length], ['note', !!(entry.note || '').trim()]]
        .forEach(([k, done]) => { const c = $(`[data-step="${k}"]`, root); c.classList.toggle('is-done', !!done); c.querySelector('svg').innerHTML = done ? ICON.check : ICON.plus; });
    }
    paint(P.entry);
    window.addEventListener('entrychange', e => paint(e.detail));
    restLabels();
  }

  // ================================================================
  //  B — Strona dnia
  // ================================================================
  const WORDS = {
    low: ['smutek', 'zmęczenie', 'niepokój', 'złość', 'samotność', 'przytłoczenie'],
    mid: ['spokój', 'zmęczenie', 'rozkojarzenie', 'napięcie', 'znudzenie', 'ulga'],
    high: ['radość', 'spokój', 'wdzięczność', 'energia', 'duma', 'ciekawość'],
  };
  function buildB() {
    const { days, names, labels, missed } = P.week;
    const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - 6 + i); return d; });
    const areas = D ? D.AREAS : [];
    const areaWord = v => (v === 1 ? 'dobrze' : v === -1 ? 'ciężko' : '');
    anchor.insertAdjacentHTML('beforebegin', `
      <section class="sec du-page" id="du-page" aria-labelledby="du-b-title">
        <div class="du-strip" role="group" aria-label="Ostatnie 7 dni">
          ${dates.map((d, i) => `<button type="button" class="du-dayb${i === 6 ? ' is-today' : ''}${missed[i] ? ' is-rest' : ''}" data-i="${i}" aria-pressed="${i === 6}" aria-label="${i === 6 ? 'Dziś' : names[i]}${i < 6 ? (missed[i] ? ': odpoczynek' : `: ${days[i]} na 10`) : ''}">
            <small>${labels[i]}</small><b>${d.getDate()}</b><i style="--v:${i < 6 && days[i] ? days[i] / 10 : 0}"></i></button>`).join('')}
        </div>

        <div class="du-past" id="du-past" hidden aria-live="polite"></div>

        <div class="du-day" id="du-day">
          <h2 id="du-b-title">${esc(dateLong)}</h2>
          <p class="du-saved" id="du-saved" aria-live="polite">Wszystko zapisuje się samo. Każde pole możesz pominąć.</p>

          <div class="du-field">
            <p class="du-label" id="du-l-mood">Nastrój</p>
            <div class="ci-mood du-moodslider" id="du-mood"></div>
          </div>
          ${Support()}
          <div class="du-field" id="du-words" hidden>
            <p class="du-label">Jak to nazwać? <small>możesz wybrać kilka</small></p>
            <div class="chip-row" id="du-word-chips"></div>
          </div>
          ${D ? `<div class="du-field">
            <p class="du-label">Sen</p>
            <div class="chip-row" role="group" aria-label="Ile spałeś/aś">
              ${D.SLEEP_HOURS.map(o => `<button type="button" class="chip" data-sleep="${o.v}" aria-pressed="false">${o.label}</button>`).join('')}
            </div>
          </div>
          <div class="du-field">
            <p class="du-label">Co było ważne? <small>stuknij: dobrze → ciężko → bez odpowiedzi</small></p>
            <div class="du-areas" role="group" aria-label="Co było ważne">
              ${areas.map(a => `<button type="button" class="du-area" data-area="${a.id}" aria-label="${a.name}: bez odpowiedzi">${svg(a.icon)}<span>${a.name}</span><em></em></button>`).join('')}
            </div>
          </div>` : ''}
          <form class="du-field du-line" id="du-line">
            <label class="du-label" for="du-line-text">Jedna linijka na dziś</label>
            <div class="du-line-row">
              <input id="du-line-text" maxlength="160" placeholder="Co dziś zapamiętać?" autocomplete="off">
              <button type="submit" class="icon-btn is-soft" aria-label="Zapisz linijkę">${svg(ICON.check)}</button>
            </div>
            <label class="ci-check"><input type="checkbox" id="du-line-vault"><span class="ci-check-box">${svg(ICON.check)}</span>Schowaj też w Skrytce</label>
          </form>
        </div>
      </section>`);
    const root = $('#du-page');
    let slider = null;
    const time = () => new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const saved = () => { $('#du-saved').textContent = `Zapisano · ${time()}`; };

    // suwak-łodyga z pytań podlewania, wbudowany w stronę (powstaje, gdy Dom jest widoczny — potrzebuje miejsca na układ)
    function makeSlider() {
      if (slider || !window.MoodSlider || view.hidden) return;
      slider = window.MoodSlider.create($('#du-mood'), { label: 'Nastrój', value: P.entry && P.entry.mood, onChange: v => { P.save({ mood: v }); saved(); } });
    }
    makeSlider();
    window.addEventListener('tabchange', e => { if (e.detail.tab === 'dom') setTimeout(makeSlider, 30); });

    function words(entry) {
      const m = entry && entry.mood;
      $('#du-words').hidden = !m;
      if (!m) return;
      const list = WORDS[m <= LOW ? 'low' : m <= 6 ? 'mid' : 'high'];
      const chosen = (entry.words || []);
      $('#du-word-chips').innerHTML = list.map(w => `<button type="button" class="chip" data-word="${w}" aria-pressed="${chosen.includes(w)}">${w}</button>`).join('');
    }
    function paint(entry) {
      words(entry);
      paintSupport(root, entry && entry.mood);
      $$('[data-sleep]', root).forEach(b => b.setAttribute('aria-pressed', String(!!entry && entry.sleepHours === +b.dataset.sleep)));
      $$('[data-area]', root).forEach(b => {
        const v = entry && entry.areas ? entry.areas[b.dataset.area] : undefined;
        b.dataset.state = v === 1 ? 'good' : v === -1 ? 'hard' : '';
        b.querySelector('em').textContent = areaWord(v);
        b.setAttribute('aria-label', `${b.querySelector('span').textContent}: ${areaWord(v) || 'bez odpowiedzi'}`);
      });
      const today = $('.du-dayb.is-today i', root);
      if (today) today.style.setProperty('--v', entry && entry.mood ? entry.mood / 10 : 0);
    }
    paint(P.entry);
    window.addEventListener('entrychange', e => paint(e.detail));

    root.addEventListener('click', e => {
      const w = e.target.closest('[data-word]');
      if (w) {
        const list = new Set((P.entry && P.entry.words) || []);
        list.has(w.dataset.word) ? list.delete(w.dataset.word) : list.add(w.dataset.word);
        P.save({ words: [...list] }); saved(); return;
      }
      const s = e.target.closest('[data-sleep]');
      if (s) { const v = +s.dataset.sleep; P.save({ sleepHours: P.entry && P.entry.sleepHours === v ? null : v }, { rain: false }); saved(); return; }
      const a = e.target.closest('[data-area]');
      if (a) {
        const cur = P.entry && P.entry.areas ? P.entry.areas[a.dataset.area] : undefined;
        const next = cur === 1 ? -1 : cur === -1 ? undefined : 1;
        const areasNow = Object.assign({}, P.entry && P.entry.areas);
        if (next === undefined) delete areasNow[a.dataset.area]; else areasNow[a.dataset.area] = next;
        // save() łączy obszary — usunięcie wymaga podmiany całego obiektu
        if (P.entry) P.entry.areas = {};
        P.save({ areas: areasNow }, { rain: false }); saved(); haptic(6); return;
      }
      const d = e.target.closest('.du-dayb');
      if (d) showDay(+d.dataset.i);
    });
    $('#du-line').addEventListener('submit', e => {
      e.preventDefault();
      const t = $('#du-line-text').value.trim();
      if (!t) { $('#du-line-text').focus(); return; }
      const toVault = $('#du-line-vault').checked;
      P.save({ note: t }, { rain: false });
      if (toVault && window.Skrytka) window.Skrytka.add({ text: t, from: 'podlewanie', mood: P.entry && P.entry.mood });
      saved();
      window.AuthCommon.toast(toVault ? 'Zapisane w dzisiejszym wpisie i w Skrytce.' : 'Zapisane w dzisiejszym wpisie.');
    });

    // dawny dzień: tylko podgląd (bez edycji przeszłości), roślinka podświetla jego liść
    function showDay(i) {
      $$('.du-dayb', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      const past = $('#du-past'), day = $('#du-day');
      const isToday = i === 6;
      past.hidden = isToday; day.hidden = !isToday;
      if (window.Home2Scene) window.Home2Scene.select(i);
      if (isToday) return;
      past.innerHTML = `
        <h2>${names[i]}</h2>
        ${missed[i] ? '<p class="du-past-big">Odpoczynek</p><p class="lead">Tego dnia nie było wpisu. Nic się nie stało — roślinka nic nie straciła.</p>'
          : `<p class="du-past-big">${days[i]}<small>/10</small></p><p class="lead">${word(days[i])[0].toUpperCase()}${word(days[i]).slice(1)}.</p>`}
        <button type="button" class="du-chip" data-today>${svg(ICON.chev)}Wróć do dziś</button>`;
    }
    root.addEventListener('click', e => { if (e.target.closest('[data-today]')) showDay(6); });
    window.addEventListener('dayselect', e => { if (e.detail.from === 'plant') showDay(e.detail.index); });
  }

  // ================================================================
  //  C — Wszystko pod kciukiem
  // ================================================================
  const STATUSES = [
    { id: 'zwykly', name: 'Zwykły dzień', text: 'Podlej roślinkę przyciskiem „+”, kiedy zechcesz.' },
    { id: 'egzaminy', name: 'Egzaminy', text: 'Trzymamy kciuki. Krótka przerwa na oddech pomaga się skupić.' },
    { id: 'choroba', name: 'Choroba', text: 'Odpocznij. Dzień bez wpisu nic nie psuje — roślinka poczeka.' },
    { id: 'wyjazd', name: 'Wyjazd', text: 'Miłej drogi. Podlejesz jednym stuknięciem, gdy znajdziesz chwilę.' },
    { id: 'ciezko', name: 'Ciężki czas', text: 'Nie musisz być z tym sam(a). Pomoc jest zawsze pod SOS.' },
  ];
  function buildC() {
    anchor.insertAdjacentHTML('beforebegin', `
      <section class="sec du-status" id="du-status" aria-labelledby="du-c-title">
        <p class="kicker">Dziś · ${esc(weekday)}</p>
        <h2 id="du-c-title">Jak mija dzień?</h2>
        <div class="chip-row du-statuses" role="radiogroup" aria-label="Jak mija dzień">
          ${STATUSES.map((s, i) => `<button type="button" class="chip" role="radio" data-status="${s.id}" aria-checked="${i === 0}">${s.name}</button>`).join('')}
        </div>
        <p class="lead du-status-text" id="du-status-text" aria-live="polite">${STATUSES[0].text}</p>
        <div class="du-done" id="du-done" hidden>
          <p class="du-done-head"><span class="du-ico is-drop">${svg(ICON.drop)}</span><span><b id="du-done-title">Podlane</b><small>Dzięki, że o siebie dbasz.</small></span></p>
          <p class="du-more-title">Co teraz?</p>
          <div id="du-next"></div>
        </div>
        ${Support()}
        <p class="du-hint"><span class="du-plus-mini" aria-hidden="true">${svg(ICON.plus)}</span><span>Na dole ekranu: <b>stuknij „+”</b>, żeby podlać. <b>Przytrzymaj albo przesuń w górę</b>, żeby dodać myśl, chwilę albo wpis.</span></p>
      </section>`);
    const root = $('#du-status');
    let status = 'zwykly';
    function paint(entry) {
      const m = entry && entry.mood;
      $$('[data-status]', root).forEach(b => b.setAttribute('aria-checked', String(b.dataset.status === status)));
      $('#du-status-text').textContent = STATUSES.find(s => s.id === status).text;
      $('#du-done').hidden = !m;
      if (m) $('#du-done-title').textContent = `Podlane · ${m}/10 · ${word(m)}`;
      $('#du-next').innerHTML = Suggest(suggestion(m, status));
      paintSupport(root, m || (status === 'ciezko' ? 1 : null));
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-status]');
      if (!b) return;
      status = b.dataset.status;
      if (P.entry) P.save({ status }, { rain: false });
      paint(P.entry);
      haptic(6);
    });
    root.addEventListener('keydown', e => {
      const b = e.target.closest('[data-status]');
      if (!b || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      e.preventDefault();
      const all = $$('[data-status]', root), i = all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1);
      all[(i + all.length) % all.length].focus();
    });
    paint(P.entry);
    window.addEventListener('entrychange', e => { if (e.detail && !e.detail.status && status !== 'zwykly') e.detail.status = status; paint(e.detail); });
    restLabels();

    // ---------- Środkowy „+” w pasku zakładek ----------
    const bar = $('#tabbar');
    const tabs = $$('.tab', bar);
    tabs[1].insertAdjacentHTML('afterend', `
      <div class="du-plus-wrap">
        <button type="button" class="du-plus" id="du-plus" aria-label="Podlej roślinkę" aria-describedby="du-plus-help" aria-haspopup="menu" aria-expanded="false">${svg(ICON.plus)}</button>
        <span class="sr" id="du-plus-help">Przytrzymaj, przesuń w górę albo naciśnij strzałkę w górę, żeby dodać myśl, dobrą chwilę albo wpis na blogu.</span>
        <div class="du-radial" id="du-radial" role="menu" aria-label="Dodaj" hidden>
          <button type="button" role="menuitem" class="du-target" data-add="mysl" style="--a:-1">${svg(ICON.lock)}<span>Myśl</span></button>
          <button type="button" role="menuitem" class="du-target" data-add="chwila" style="--a:0">${svg(ICON.jar)}<span>Chwila</span></button>
          <button type="button" role="menuitem" class="du-target" data-add="wpis" style="--a:1">${svg(ICON.pen)}<span>Wpis</span></button>
        </div>
      </div>`);
    bar.classList.add('has-plus');
    const plus = $('#du-plus'), radial = $('#du-radial');
    const targets = $$('.du-target', radial);
    const ADD = {
      mysl() { location.hash = '#/skrytka'; setTimeout(() => { const b = $('[data-pane="mysli"]'); if (b) b.click(); if (window.Skrytka) window.Skrytka.focus(); }, 80); },
      chwila: openJar,
      wpis() { location.hash = '#/blog'; setTimeout(() => { const f = $('#blog-fab'); if (f) f.click(); }, 120); },
    };
    function setRadial(on, focusFirst) {
      radial.hidden = !on;
      plus.setAttribute('aria-expanded', String(on));
      document.body.classList.toggle('du-radial-open', on);
      if (on) { haptic(12); if (focusFirst) targets[0].focus(); }
    }
    const run = id => { setRadial(false); ADD[id](); };
    // stuknięcie = podlewanie; przytrzymanie albo przeciągnięcie w górę = menu, puszczenie nad celem = akcja
    let down = null, holdTimer = 0, opened = false;
    plus.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY }; opened = false;
      plus.setPointerCapture(e.pointerId);
      holdTimer = setTimeout(() => { opened = true; setRadial(true); }, 420);
    });
    plus.addEventListener('pointermove', e => {
      if (!down) return;
      if (!opened && down.y - e.clientY > 18) { clearTimeout(holdTimer); opened = true; setRadial(true); }
      if (opened) {
        const over = document.elementFromPoint(e.clientX, e.clientY);
        targets.forEach(t => t.classList.toggle('is-over', !!over && t.contains(over)));
      }
    });
    plus.addEventListener('pointerup', e => {
      clearTimeout(holdTimer);
      if (!down) return;
      down = null;
      if (!opened) { P.open({ from: plus }); return; }
      const hit = targets.find(t => t.classList.contains('is-over'));
      targets.forEach(t => t.classList.remove('is-over'));
      if (hit) run(hit.dataset.add);                                  // puszczone nad celem
      // puszczone gdzie indziej: menu zostaje otwarte, można stuknąć cel
    });
    plus.addEventListener('pointercancel', () => { clearTimeout(holdTimer); down = null; });
    plus.addEventListener('click', e => { if (e.detail === 0) P.open({ from: plus }); });   // Enter / spacja z klawiatury
    plus.addEventListener('keydown', e => { if (e.key === 'ArrowUp') { e.preventDefault(); setRadial(true, true); } });
    radial.addEventListener('click', e => { const t = e.target.closest('[data-add]'); if (t) run(t.dataset.add); });
    radial.addEventListener('keydown', e => {
      const i = targets.indexOf(document.activeElement);
      if (e.key === 'Escape') { setRadial(false); plus.focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); targets[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3].focus(); }
    });
    document.addEventListener('pointerdown', e => { if (!radial.hidden && !e.target.closest('.du-plus-wrap')) setRadial(false); });
  }

  // ================================================================
  //  Start
  // ================================================================
  // przełącznik wersji tylko w podglądzie (?uklad=…) — zwykły użytkownik widzi po prostu stronę główną A
  const hint = $('#scroll-hint');
  if (U !== 'd' && (params.has('uklad') || window.UKLAD_DOMYSLNY)) (hint || view).insertAdjacentHTML(hint ? 'afterend' : 'afterbegin', Switch());
  ({ a: buildA, b: buildB, c: buildC, d: buildD })[U]();
  if (reduceMotion) document.documentElement.classList.add('du-still');
})();
