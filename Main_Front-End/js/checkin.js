/*
 * Codzienne podlewanie (check-in) — pytania otwierane przyciskiem „Podlej roślinkę” w aplikacji.
 *
 * Pierwszy ekran to design z nastroj.html (suwak-łodyga + wsparcie przy niskim nastroju), dalej krótkie pytania
 * z tabeli `daily_checkins`: sen (godziny, jakość), co miało znaczenie (jedzenie, rodzina, przyjaciele, miłość,
 * natura, nauka) i notatka. Każde pytanie można pominąć („Pomiń” → po odpowiedzi „Dalej”).
 * Skale pól poza nastrojem nie są ustalone (notes/CLAUDE.md) — tu propozycja: sen w przedziałach, jakość 1–4,
 * obszary −1 / 0 / 1 („ciężko / ok / dobrze”).
 * Nastrój jest w bazie wymagany, a design z nastroj.html pozwala go pominąć — do ustalenia z zespołem.
 *
 * Wejście: ekran „wylewa się” kołem z przycisku. Wyjście po ostatnim pytaniu: koło zwija się do roślinki,
 * a strona główna odpala deszcz (js/home2.js → Home2Scene.water(mood)).
 * Przy słowach kryzysowych w notatce (js/moderacja.js) od razu pokazujemy 116 111 i 112.
 *
 * window.Checkin.open({ from, entry, onDone(entry) })
 *   from     element, z którego wychodzi animacja (przycisk)
 *   entry    poprzedni dzisiejszy wpis do edycji albo null
 *   onDone   dostaje { mood, sleepHours, sleepQuality, areas: { food: 1, … }, note, toVault }
 * W React Native: osobny ekran Expo Router (modal) + Reanimated do przejść.
 */
(function () {
  'use strict';

  const root = document.getElementById('checkin');
  if (!root || !window.MoodSlider) return;

  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const { toast, haptic } = window.AuthCommon;
  const Mod = window.Moderacja || { check: () => ({ verdict: 'ok', hits: [] }) };
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;

  // ================================================================
  //  Dane pytań
  // ================================================================
  // Zdanie pod suwakiem dla każdej wartości (z nastroj.js; bez form zależnych od płci)
  const NOTES = [
    'Dzięki, że mówisz, jak jest.',
    'Daj sobie dziś chwilę oddechu.',
    'Bywają takie dni. Dobrze, że jesteś.',
    'Tak sobie też jest w porządku.',
    'Zwyczajny dzień też się liczy.',
    'Nieźle! Co dziś pomogło?',
    'Miło to słyszeć.',
    'Super! Roślinka zakwita.',
    'Świetnie! Zapamiętaj, co pomogło.',
    'Wspaniale! Pełny rozkwit.',
  ];
  const LOW = 3; // do tej wartości włącznie wyróżniamy wsparcie

  const SLEEP_HOURS = [
    { v: 4, label: 'mniej niż 5 h' },
    { v: 5.5, label: '5–6 h' },
    { v: 7.5, label: '7–8 h' },
    { v: 9, label: '9 h i więcej' },
  ];
  const SLEEP_QUALITY = [
    { v: 1, label: 'Źle' },
    { v: 2, label: 'Tak sobie' },
    { v: 3, label: 'Dobrze' },
    { v: 4, label: 'Świetnie' },
  ];
  const AREA_SCALE = [
    { v: -1, label: 'Ciężko' },
    { v: 0, label: 'Ok' },
    { v: 1, label: 'Dobrze' },
  ];
  const AREAS = [
    { id: 'food', name: 'Jedzenie', icon: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7.5c0-1.5 1-2 1-3.5M13.5 7.5c0-1.5 1-2 1-3.5"/>' },
    { id: 'family', name: 'Rodzina', icon: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>' },
    { id: 'friends', name: 'Przyjaciele', icon: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>' },
    { id: 'love', name: 'Miłość', icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
    { id: 'nature', name: 'Natura', icon: '<path d="M12 21v-7"/><path d="M12 14c-4 0-7-2.7-7-6.5C5 4.5 8 3 12 3s7 1.5 7 4.5C19 11.3 16 14 12 14z"/>' },
    { id: 'study', name: 'Nauka', icon: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v14H5.5A1.5 1.5 0 0 0 4 18.5zM4 18.5A1.5 1.5 0 0 0 5.5 20H20"/>' },
  ];
  const NOTE_MAX = 500;

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const DROP = '<svg class="ci-drop" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z"/></svg>';
  const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const PHONE = '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>';

  const chips = (name, list) => `<div class="ci-chips" data-group="${name}">${list.map(o =>
    `<button type="button" class="ci-chip" data-v="${o.v}" aria-pressed="false">${o.label}</button>`).join('')}</div>`;

  // Krok 1 — ten sam układ co nastroj.html
  const stepMood = () => `
    <h2 class="ci-q" id="ci-title">Jak się dziś czujesz?</h2>
    <p class="ci-hint">Im lepiej, tym dalej przeciągnij łodygę.</p>
    <div class="ci-mood" id="ci-mood"></div>
    <p class="ci-note" id="ci-mood-note" aria-live="polite"></p>
    <section class="support" id="ci-support" aria-label="Wsparcie">
      <div class="support-low">
        <p class="support-title">Ciężki dzień?</p>
        <p class="support-text">Nie musisz zostawać z tym sam na sam.</p>
      </div>
      <button type="button" class="assist-btn" data-assist>
        <span class="assist-ico" aria-hidden="true">${svg('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>')}</span>
        <span class="assist-text"><b>Porozmawiaj z Asystentem Wsparcia</b><small>Gdy chcesz pogadać</small></span>
        ${svg('<path d="M9 6l6 6-6 6"/>', 'assist-chev')}
      </button>
      <a class="support-call" href="tel:116111">${svg(PHONE)}Zadzwoń: 116 111 <small>bezpłatnie, całą dobę</small></a>
    </section>`;

  const stepSleep = () => `
    <h2 class="ci-q">Jak minęła noc?</h2>
    <p class="ci-hint">Wystarczy mniej więcej. Sen mocno wpływa na samopoczucie.</p>
    <div class="ci-group" role="group" aria-labelledby="ci-l-hours">
      <p class="ci-label" id="ci-l-hours">Ile godzin snu?</p>
      ${chips('sleepHours', SLEEP_HOURS)}
    </div>
    <div class="ci-group" role="group" aria-labelledby="ci-l-quality">
      <p class="ci-label" id="ci-l-quality">Jak się spało?</p>
      ${chips('sleepQuality', SLEEP_QUALITY)}
    </div>`;

  const stepAreas = () => `
    <h2 class="ci-q">Co dziś miało znaczenie?</h2>
    <p class="ci-hint">Zaznacz tylko to, co chcesz. Reszta może zostać pusta.</p>
    <ul class="ci-areas">${AREAS.map(a => `
      <li class="ci-area">
        <span class="ci-area-name">${svg(a.icon)}${a.name}</span>
        <span class="ci-seg" role="group" aria-label="${a.name}" data-area="${a.id}">${AREA_SCALE.map(o =>
          `<button type="button" data-v="${o.v}" aria-pressed="false">${o.label}</button>`).join('')}</span>
      </li>`).join('')}
    </ul>`;

  const stepNote = () => `
    <h2 class="ci-q">Chcesz coś dopisać?</h2>
    <p class="ci-hint">Kilka słów o dniu — co pomogło, co było trudne. Widzisz to tylko Ty.</p>
    <div class="ci-textwrap">
      <textarea class="ci-text" id="ci-note" rows="5" maxlength="${NOTE_MAX}" placeholder="Dziś…" aria-label="Notatka do dzisiejszego wpisu"></textarea>
      <span class="ci-chars" id="ci-chars" aria-hidden="true">0/${NOTE_MAX}</span>
    </div>
    <label class="ci-check">
      <input type="checkbox" id="ci-vault">
      <span class="ci-check-box" aria-hidden="true">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>')}</span>
      <span>Schowaj tę notatkę także w <b>Skrytce myśli</b></span>
    </label>
    <section class="ci-alert" id="ci-alert" aria-live="polite" hidden>
      <p class="support-title">To brzmi naprawdę ciężko.</p>
      <p class="support-text">Dobrze, że to piszesz. Porozmawiaj teraz z kimś, kto pomoże — za darmo, o każdej porze.</p>
      <a class="support-call" href="tel:116111">${svg(PHONE)}Zadzwoń: 116 111 <small>całą dobę</small></a>
      <a class="support-call" href="tel:112">${svg('<path d="M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7z"/><path d="M12 8.5v4M12 15.5h.01"/>')}Zagrożenie życia: 112</a>
    </section>`;

  const STEPS = [
    { id: 'mood', html: stepMood },
    { id: 'sleep', html: stepSleep },
    { id: 'areas', html: stepAreas },
    { id: 'note', html: stepNote },
  ];

  root.innerHTML = `
    <div class="ci">
      <header class="ci-top">
        <button type="button" class="ci-close" data-ci-close aria-label="Zamknij pytania">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
        <p class="ci-kicker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z"/></svg>Codzienne podlewanie</p>
        <span class="ci-count" id="ci-count"></span>
      </header>
      <div class="ci-progress" aria-hidden="true">${STEPS.map(() => '<i></i>').join('')}</div>
      ${STEPS.map((s, i) => `<section class="ci-main ci-step" data-step="${s.id}"${i ? ' hidden' : ''}>${s.html()}</section>`).join('')}
      <footer class="ci-actions">
        <button type="button" class="ci-back" id="ci-back">${svg('<path d="M19 12H5M11 6l-6 6 6 6"/>')}<span>Wstecz</span></button>
        <button type="button" class="btn-primary" id="ci-next"><span id="ci-next-label">Pomiń</span>${ARROW}</button>
      </footer>
    </div>`;

  // ================================================================
  //  Stan i odpowiedzi
  // ================================================================
  const blank = () => ({ mood: null, sleepHours: null, sleepQuality: null, areas: {}, note: '', toVault: false });
  let ans = blank(), draft = null, idx = 0, onDone = null, mood = null, fromEl = null, isOpen = false, lastFocus = null;
  const steps = $$('.ci-step');
  const bars = $$('.ci-progress i');
  const nextBtn = $('#ci-next'), nextLabel = $('#ci-next-label'), backBtn = $('#ci-back');

  function answered(i) {
    const id = STEPS[i].id;
    if (id === 'mood') return ans.mood != null;
    if (id === 'sleep') return ans.sleepHours != null || ans.sleepQuality != null;
    if (id === 'areas') return Object.keys(ans.areas).length > 0;
    return ans.note.trim().length > 0;
  }

  function syncFooter() {
    const last = idx === STEPS.length - 1;
    nextBtn.classList.toggle('is-final', last);
    nextLabel.textContent = last ? 'Podlej roślinkę' : answered(idx) ? 'Dalej' : 'Pomiń';
    const ico = nextBtn.querySelector('svg');
    ico.outerHTML = last ? DROP : ARROW;
    backBtn.classList.toggle('is-hidden', idx === 0);
    $('#ci-count').textContent = `${idx + 1} z ${STEPS.length}`;
    bars.forEach((b, i) => { b.classList.toggle('is-done', i < idx || (i === idx && answered(i))); b.classList.toggle('is-now', i === idx); });
  }

  // ---------- Krok 1: nastrój ----------
  const moodNote = $('#ci-mood-note');
  const support = $('#ci-support');
  let noteTimer;
  function showMoodNote(v) {
    const text = v == null ? '' : NOTES[v - 1];
    if (moodNote.textContent === text) return;
    clearTimeout(noteTimer);
    moodNote.classList.add('is-fading');
    noteTimer = setTimeout(() => { moodNote.textContent = text; moodNote.classList.remove('is-fading'); }, reduceMotion ? 0 : 160);
  }
  function onMood(v) {
    ans.mood = v;
    showMoodNote(v);
    support.classList.toggle('is-low', v != null && v <= LOW);
    syncFooter();
  }
  $('[data-assist]').addEventListener('click', () => {
    // TODO: Asystent Wsparcia (chatbot AI, plan P2) — tu otworzy się rozmowa
    toast('Asystent Wsparcia jest w przygotowaniu — tu otworzy się rozmowa.');
  });

  // ---------- Krok 2 i 3: przyciski wyboru (stuknięcie w zaznaczony odznacza) ----------
  root.addEventListener('click', e => {
    const b = e.target.closest('.ci-chip, .ci-seg button');
    if (!b) return;
    const group = b.parentElement;
    const on = b.getAttribute('aria-pressed') !== 'true';
    group.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b && on)));
    const v = on ? Number(b.dataset.v) : null;
    if (group.dataset.group) ans[group.dataset.group] = v;
    else if (v == null) delete ans.areas[group.dataset.area];
    else ans.areas[group.dataset.area] = v;
    haptic(6);
    syncFooter();
  });
  function paintChoices() {
    $$('.ci-chips').forEach(g => g.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', String(ans[g.dataset.group] === Number(b.dataset.v)))));
    $$('.ci-seg').forEach(g => g.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', String(ans.areas[g.dataset.area] === Number(b.dataset.v)))));
  }

  // ---------- Krok 4: notatka (+ wsparcie przy słowach kryzysowych) ----------
  const note = $('#ci-note'), chars = $('#ci-chars'), alertBox = $('#ci-alert'), vault = $('#ci-vault');
  function onNote() {
    ans.note = note.value;
    chars.textContent = `${note.value.length}/${NOTE_MAX}`;
    alertBox.hidden = Mod.check(note.value).verdict !== 'kryzys';
    syncFooter();
  }
  note.addEventListener('input', onNote);
  vault.addEventListener('change', () => { ans.toVault = vault.checked; });

  // ================================================================
  //  Przechodzenie między pytaniami
  // ================================================================
  function go(i, dir = 1) {
    const prev = steps[idx];
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    const cur = steps[idx];
    if (prev !== cur) {
      prev.hidden = true;
      cur.hidden = false;
      cur.classList.remove('from-left', 'from-right');
      void cur.offsetWidth;
      cur.classList.add(dir > 0 ? 'from-right' : 'from-left');
    }
    root.scrollTop = 0;
    syncFooter();
    const focusEl = STEPS[idx].id === 'mood' ? null : cur.querySelector('.ci-q');
    if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
  }
  nextBtn.addEventListener('click', () => {
    haptic(10);
    if (idx < STEPS.length - 1) go(idx + 1, 1);
    else finish();
  });
  backBtn.addEventListener('click', () => go(idx - 1, -1));

  // ================================================================
  //  Otwieranie i zamykanie (koło z przycisku / do roślinki)
  // ================================================================
  function setOrigin(x, y) {
    const r = root.getBoundingClientRect();
    const ox = x - r.left, oy = y - r.top;
    const far = Math.hypot(Math.max(ox, r.width - ox), Math.max(oy, r.height - oy));
    root.style.setProperty('--ox', `${ox}px`);
    root.style.setProperty('--oy', `${oy}px`);
    root.style.setProperty('--or', `${Math.ceil(far) + 20}px`);
  }
  const centerOf = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

  function open(opts = {}) {
    if (isOpen) return;
    isOpen = true;
    onDone = opts.onDone || null;
    fromEl = opts.from || null;
    lastFocus = document.activeElement;
    // poprzedni wpis do edycji, a jeśli go nie ma — szkic z niedokończonego otwarcia
    ans = opts.entry ? JSON.parse(JSON.stringify(opts.entry)) : draft || blank();

    root.hidden = false;
    document.body.classList.add('ci-open');
    root.classList.remove('is-closing');
    const [x, y] = fromEl ? centerOf(fromEl) : [window.innerWidth / 2, window.innerHeight];
    setOrigin(x, y);
    void root.offsetWidth;
    root.classList.add('is-open');

    // suwak powstaje przy pierwszym otwarciu (potrzebuje widocznego miejsca na układ)
    if (!mood) mood = window.MoodSlider.create($('#ci-mood'), { value: ans.mood, onInput: onMood, onChange: onMood });
    else if (ans.mood != null) mood.set(ans.mood);
    note.value = ans.note || '';
    vault.checked = !!ans.toVault;
    paintChoices();
    onNote();
    onMood(mood.value);
    steps.forEach((s, i) => { s.hidden = i !== 0; s.classList.remove('from-left', 'from-right'); });
    idx = 0;
    syncFooter();
    setTimeout(() => $('[data-ci-close]').focus({ preventScroll: true }), reduceMotion ? 0 : 320);
  }

  function close(toPlant) {
    if (!isOpen) return;
    isOpen = false;
    draft = toPlant ? null : ans;
    if (toPlant) {
      // koło zwija się do roślinki: na telefonie u góry ekranu, na komputerze — w lewej połowie
      const wide = window.innerWidth >= 1024;
      setOrigin(wide ? window.innerWidth * .25 : window.innerWidth / 2, wide ? window.innerHeight * .5 : window.innerHeight * .22);
    } else if (fromEl) {
      setOrigin(...centerOf(fromEl));
    }
    root.classList.add('is-closing');
    root.classList.remove('is-open');
    document.body.classList.remove('ci-open');
    setTimeout(() => { if (!isOpen) { root.hidden = true; root.classList.remove('is-closing'); } }, reduceMotion ? 0 : 620);
    if (!toPlant && lastFocus) lastFocus.focus({ preventScroll: true });
  }

  function finish() {
    const entry = JSON.parse(JSON.stringify(ans));
    entry.note = entry.note.trim();
    if (entry.toVault && entry.note && window.Skrytka) window.Skrytka.add({ text: entry.note, from: 'podlewanie', mood: entry.mood });
    // na telefonie roślinka jest na górze strony — przewijamy, zanim ekran pytań zniknie
    if (window.innerWidth < 1024) window.scrollTo(0, 0);
    close(true);
    const cb = onDone;
    setTimeout(() => { if (cb) cb(entry); if (fromEl) fromEl.focus({ preventScroll: true }); }, reduceMotion ? 0 : 260);
  }

  root.addEventListener('click', e => { if (e.target.closest('[data-ci-close]')) close(false); });
  document.addEventListener('keydown', e => {
    if (!isOpen || (window.Sheets && window.Sheets.current)) return;
    if (e.key === 'Escape') { close(false); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), textarea, input, [role="slider"]').filter(el => el.offsetParent !== null && !el.classList.contains('is-hidden'));
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  window.Checkin = { open, close: () => close(false), get isOpen() { return isOpen; } };
})();
