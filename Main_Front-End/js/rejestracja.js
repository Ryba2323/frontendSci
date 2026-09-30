/*
 * Rejestracja — logika formularza (3 etapy + ekran końcowy).
 *
 * Każdy etap (form.step) ma ekrany (div.page). Na telefonie pokazujemy jeden ekran na raz,
 * na komputerze (min. 900 px) cały etap naraz. Systemowy „wstecz” na telefonie cofa o jeden ekran.
 * Scena w tle (listki, roślina, świetliki) jest w js/plant-scene.js.
 */
(function () {
  'use strict';

  const Scene = window.PlantScene || { setStage() {}, setProgress() {}, rustle() {} };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const mqDesktop = window.matchMedia('(min-width: 900px)');
  const isPaged = () => !mqDesktop.matches; // telefon: jeden ekran (pytanie) na raz

  const T_STEP = reduceMotion ? 20 : 600;  // czas przejścia między etapami (ms)
  const T_PAGE = reduceMotion ? 20 : 480;  // czas przejścia między ekranami (ms)
  const T_AUTO = 450;                      // opóźnienie auto-przejścia po wyborze (ms)

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  const haptic = pattern => {
    if (!finePointer && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) { /* brak wsparcia */ } }
  };

  const card = $('.card');
  const stepsWrap = $('#steps');
  const steps = { 1: $('#step1'), 2: $('#step2'), 3: $('#step3'), 4: $('#step4') };
  const forms = [steps[1], steps[2], steps[3]];
  const f2 = steps[2], f3 = steps[3];

  const nickInput = $('#nick');
  const emailInput = $('#email');
  const pwInput = $('#password');
  const plantInput = $('#plant');

  const data = {};
  const pageIdx = { 1: 0, 2: 0, 3: 0 };
  let current = 1;
  let busy = false;

  const pagesOf = n => (n >= 1 && n <= 3 ? $$('.page', steps[n]) : []);
  const isTextInput = el => el instanceof HTMLInputElement && el.classList.contains('input');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const MSG = {
    nick: 'Wpisz co najmniej 2 znaki.',
    emailEmpty: 'Podaj adres e-mail.',
    emailBad: 'Sprawdź adres — czegoś w nim brakuje.',
    password: 'Hasło musi mieć co najmniej 8 znaków.',
    age: 'Zaznacz swój wiek.',
    gform: 'Wybierz jedną z opcji.',
    terms: 'Zaakceptuj regulamin, żeby założyć konto.',
    parent: 'Potrzebujemy potwierdzenia zgody opiekuna.',
  };

  const CAPTIONS = {
    1: 'Każda roślina zaczyna się od jednego nasionka.',
    '1+': 'Kiełkuje! Tak trzymaj.',
    2: 'Rośnie, kiedy dajesz jej odrobinę uwagi.',
    3: 'Jeszcze kilka liści i gotowe.',
    4: 'Rozkwita — tak jak Ty, krok po kroku.',
  };

  // Kolejne elementy etapu / ekranu wjeżdżają z lekkim opóźnieniem
  Object.values(steps).forEach(s => [...s.children].forEach((c, i) => c.style.setProperty('--i', i)));
  $$('.page').forEach(p => {
    let i = 0;
    [...p.children].forEach(c => {
      if (c.classList.contains('field')) [...c.children].forEach(fc => fc.style.setProperty('--i', i++));
      else c.style.setProperty('--i', i++);
    });
  });
  card.addEventListener('animationend', e => { if (e.animationName === 'card-in') card.classList.remove('intro'); });

  // ================================================================
  //  Stan wypełnienia — napędza wzrost rośliny w trakcie etapu
  // ================================================================
  const nickOk = () => nickInput.value.trim().length >= 2;
  const emailOk = () => EMAIL_RE.test(emailInput.value.trim());
  const passwordOk = () => pwInput.value.length >= 8;
  const needsParent = () => { const age = parseInt(f2.elements.age.value, 10); return !isNaN(age) && age < 16; };
  const consentsOk = () => $('#terms').checked && (!needsParent() || $('#parent').checked);

  function stageProgress(n) {
    const share = checks => checks.filter(Boolean).length / checks.length;
    if (n === 1) return share([nickOk(), emailOk(), passwordOk()]);
    if (n === 2) return share([f2.elements.age.value, f2.elements.gform.value, $$('input[name=topics]:checked', f2).length]);
    if (n === 3) return share([plantInput.value.trim(), consentsOk()]);
    return 0;
  }

  // ================================================================
  //  Walidacja ekranów
  // ================================================================
  function setErr(id, msg) {
    const el = document.getElementById(id);
    const err = document.getElementById(id + '-err');
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    if (err) err.textContent = msg || '';
    return !msg;
  }
  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.err').forEach(e => { e.textContent = ''; });
  }

  const PAGE_CHECKS = {
    nick: () => setErr('nick', nickOk() ? '' : MSG.nick),
    email: () => setErr('email', !emailInput.value.trim() ? MSG.emailEmpty : emailOk() ? '' : MSG.emailBad),
    password: () => setErr('password', passwordOk() ? '' : MSG.password),
    age: () => setErr('age', f2.elements.age.value ? '' : MSG.age),
    gform: () => setErr('gform', f2.elements.gform.value ? '' : MSG.gform),
    consents: () => {
      const ok = setErr('terms', $('#terms').checked ? '' : MSG.terms);
      return setErr('parent', needsParent() && !$('#parent').checked ? MSG.parent : '') && ok;
    },
  };
  function validatePages(pages) {
    let ok = true;
    pages.forEach(p => { const check = PAGE_CHECKS[p.dataset.page]; if (check) ok = check() && ok; });
    return ok;
  }
  function focusFirstInvalid(pages) {
    for (const p of pages) {
      const el = p.querySelector('[aria-invalid="true"]');
      if (el) { (el.tagName === 'FIELDSET' ? el.querySelector('input') : el).focus(); return; }
    }
  }
  const pageHasValue = page => $$('input', page).some(i =>
    (i.type === 'checkbox' || i.type === 'radio') ? i.checked : i.value.trim() !== '');

  // ================================================================
  //  Nawigacja: etapy
  // ================================================================
  function goTo(n, page) {
    if (n === current || busy) return;
    busy = true;
    const dir = n > current ? 1 : -1;
    const from = steps[current], to = steps[n];
    const paged = isPaged();

    if (n <= 3) {
      const pages = pagesOf(n);
      pageIdx[n] = page != null ? page : dir > 0 ? 0 : pages.length - 1;
      pages.forEach((p, i) => { p.classList.remove('is-entering', 'is-leaving'); p.hidden = paged && i !== pageIdx[n]; });
    }

    // Na telefonie chowamy klawiaturę i wracamy na górę, żeby było widać, jak roślina rośnie
    if (paged) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    Object.values(steps).forEach(s => s.classList.remove('is-entering'));
    stepsWrap.style.height = stepsWrap.offsetHeight + 'px';
    stepsWrap.classList.add('is-animating');

    from.style.setProperty('--dx', (-dir * 28) + 'px');
    from.classList.add('is-leaving');
    to.style.setProperty('--dx', (dir * 28) + 'px');
    to.hidden = false;
    void to.offsetWidth;
    to.classList.add('is-entering');
    stepsWrap.style.height = to.offsetHeight + 'px';

    current = n;
    syncControls();
    updateCaption();
    Scene.setStage(n, stageProgress(n));
    if (dir > 0) pushGuard();

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove('is-leaving');
      stepsWrap.style.height = '';
      stepsWrap.classList.remove('is-animating');
      busy = false;
      focusAfterStep(to, n);
    }, T_STEP);
  }

  function focusAfterStep(stepEl, n) {
    if (isPaged()) {
      const page = n <= 3 ? pagesOf(n)[pageIdx[n]] : null;
      (page || stepEl.querySelector('h2')).focus({ preventScroll: true });
    } else {
      // Na komputerze od razu pole tekstowe
      const input = finePointer && stepEl.querySelector('input.input');
      (input || stepEl.querySelector('h2')).focus({ preventScroll: true });
    }
  }

  // ================================================================
  //  Nawigacja: ekrany w obrębie etapu (telefon)
  // ================================================================
  function goToPage(n, idx) {
    const pages = pagesOf(n);
    const from = pages[pageIdx[n]], to = pages[idx];
    if (busy || !from || !to || from === to) return;
    busy = true;
    const dir = idx > pageIdx[n] ? 1 : -1;
    const keyboardOpen = isTextInput(document.activeElement);
    const input = to.querySelector('input.input');

    pages.forEach(p => p.classList.remove('is-entering'));
    from.style.setProperty('--dx', (-dir * 28) + 'px');
    from.classList.add('is-leaving');
    to.style.setProperty('--dx', (dir * 28) + 'px');
    to.hidden = false;
    void to.offsetWidth;
    to.classList.add('is-entering');

    pageIdx[n] = idx;
    syncControls();
    Scene.rustle(.15);
    if (dir > 0) pushGuard();

    // Otwarta klawiatura → od razu kolejne pole, żeby nie zamykała się między pytaniami
    if (keyboardOpen && input) input.focus({ preventScroll: true });
    else if (keyboardOpen) document.activeElement.blur();

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove('is-leaving');
      busy = false;
      if (!(keyboardOpen && input)) to.focus({ preventScroll: true });
    }, T_PAGE);
  }

  function goBack() {
    if (busy || current === 4) return;
    if (isPaged() && pageIdx[current] > 0) goToPage(current, pageIdx[current] - 1);
    else if (current > 1) goTo(current - 1);
  }
  const atStart = () => current === 1 && (!isPaged() || pageIdx[1] === 0);
  const whenIdle = fn => { if (!busy) fn(); else setTimeout(() => whenIdle(fn), 60); };

  // Systemowy „wstecz” (Android, gest na iOS) cofa o jeden ekran zamiast zamykać rejestrację
  let guarded = false;
  function pushGuard() {
    if (guarded) return;
    try { history.pushState({ registration: true }, ''); guarded = true; } catch (_) { /* np. sandbox */ }
  }
  window.addEventListener('popstate', () => {
    guarded = false;
    whenIdle(() => {
      if (current !== 4) goBack();
      if (current === 4 || !atStart()) pushGuard();
    });
  });
  $$('[data-back]').forEach(btn => btn.addEventListener('click', () => {
    if (guarded) history.back(); else goBack();
  }));

  // ================================================================
  //  Przyciski, postęp, podpis sceny
  // ================================================================
  function syncControls() {
    const paged = isPaged();
    forms.forEach((form, i) => {
      const n = i + 1, pages = pagesOf(n), idx = pageIdx[n], page = pages[idx];
      const last = !paged || idx === pages.length - 1;
      form.dataset.last = String(last);

      const back = form.querySelector('[data-back]');
      if (back) back.hidden = n === 1 && (!paged || idx === 0);
      const foot = form.querySelector('.foot');
      if (foot) foot.hidden = paged && idx > 0;

      let label = n === 3 && last ? 'Załóż konto' : 'Dalej';
      if (paged && page && 'optional' in page.dataset && !pageHasValue(page)) label = 'Pomiń';
      form.querySelector('.btn-label').textContent = label;
    });
    updateStepper();
  }

  function updateStepper() {
    const paged = isPaged();
    $$('.stepper li').forEach((li, i) => {
      const s = i + 1;
      li.classList.toggle('is-done', s < current);
      li.classList.toggle('is-current', s === current);
      const dot = li.querySelector('.dot');
      const html = s < current ? CHECK_SVG : String(s);
      if (dot.innerHTML !== html) dot.innerHTML = html;
      if (s === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');

      let fill = s < current ? 1 : 0;
      if (s === current && s <= 3) fill = paged ? (pageIdx[s] + 1) / pagesOf(s).length : 1;
      li.style.setProperty('--fill', fill);
    });
  }

  const caption = $('#caption');
  const eyebrow = $('#caption-eyebrow');
  let captionKey = 1;
  let captionTimer;
  function updateCaption() {
    const plant = plantInput.value.trim();
    eyebrow.textContent = current >= 3 && plant ? plant : 'Twoja roślinka';

    const key = current === 1 && stageProgress(1) > 0 ? '1+' : current;
    if (key === captionKey) return;
    captionKey = key;
    clearTimeout(captionTimer);
    caption.classList.add('fade');
    captionTimer = setTimeout(() => {
      caption.textContent = CAPTIONS[key];
      caption.classList.remove('fade');
    }, 480);
  }

  function shake() {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  // Przełączenie telefon ↔ komputer (obrót tabletu, zmiana szerokości okna)
  function onModeChange() {
    [1, 2, 3].forEach(n => pagesOf(n).forEach((p, i) => {
      p.classList.remove('is-entering', 'is-leaving');
      p.hidden = isPaged() && i !== pageIdx[n];
    }));
    syncControls();
  }
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onModeChange);
  else mqDesktop.addListener(onModeChange);

  // ================================================================
  //  Zdarzenia formularzy
  // ================================================================
  let lastPointerDown = 0;
  let autoTimer;
  document.addEventListener('pointerdown', () => { lastPointerDown = Date.now(); }, { passive: true });

  forms.forEach((form, i) => {
    const n = i + 1;

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (busy) return;
      const pages = pagesOf(n);
      const scope = isPaged() ? [pages[pageIdx[n]]] : pages;
      if (!validatePages(scope)) { shake(); haptic([16, 40, 16]); focusFirstInvalid(scope); return; }
      // Możliwa literówka w e-mailu: najpierw pokaż podpowiedź, drugie „Dalej” przechodzi mimo to
      if (scope.some(p => p.dataset.page === 'email') && emailNeedsSuggestion()) { showEmailSuggestion(); return; }
      if (isPaged() && pageIdx[n] < pages.length - 1) { goToPage(n, pageIdx[n] + 1); return; }
      haptic(12);
      completeStage(n);
    });

    form.addEventListener('input', e => {
      const t = e.target;
      const host = t.closest('fieldset[aria-invalid]') || (t.hasAttribute('aria-invalid') ? t : null);
      if (host) setErr(host.id, '');
      // Roślina delikatnie reaguje na pisanie i wybory
      Scene.rustle(t.matches('.input') ? .05 : .15);
      Scene.setProgress(stageProgress(current));
      updateCaption();
      syncControls();
    });

    // Telefon: wybór wieku / formy od razu przechodzi do kolejnego pytania
    form.addEventListener('change', e => {
      if (!isPaged() || e.target.type !== 'radio' || Date.now() - lastPointerDown > 1000) return;
      const page = e.target.closest('.page');
      if (!page || !('auto' in page.dataset)) return;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (busy || page.hidden || page.classList.contains('is-leaving')) return;
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true }));
      }, T_AUTO);
    });

    // Enter na checkboxie/radiu też przechodzi dalej
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input[type=radio], input[type=checkbox]')) {
        e.preventDefault();
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  });

  function completeStage(n) {
    if (n === 1) {
      Object.assign(data, { nick: nickInput.value.trim(), email: emailInput.value.trim(), password: pwInput.value });
      $('#s2-title').textContent = `Miło Cię poznać, ${data.nick}!`;
    } else if (n === 2) {
      data.age = f2.elements.age.value === '19' ? '19+' : f2.elements.age.value;
      data.form = f2.elements.gform.value;
      data.topics = $$('input[name=topics]:checked', f2).map(i => i.value);
    } else if (n === 3) {
      data.plant = plantInput.value.trim();
      data.reminder = f3.elements.reminder.value;
      data.parentConsent = needsParent() ? true : null;
      // Tymczasowo: brak backendu — dane lądują w konsoli (bez hasła)
      console.log('Rejestracja (tymczasowo):', { ...data, password: '•'.repeat(data.password.length) });
      fillDone();
    }
    goTo(n + 1);
  }

  // ================================================================
  //  Etap 1 — konto
  // ================================================================
  function syncValidMarks() {
    nickInput.closest('.field').classList.toggle('is-valid', nickOk());
    emailInput.closest('.field').classList.toggle('is-valid', emailOk());
  }
  steps[1].addEventListener('input', syncValidMarks);

  nickInput.addEventListener('blur', () => {
    if (nickInput.value.trim() && !nickOk()) setErr('nick', MSG.nick);
  });
  emailInput.addEventListener('blur', () => {
    if (emailInput.value.trim() && !emailOk()) setErr('email', MSG.emailBad);
    showEmailSuggestion();
  });

  // Podpowiedź literówek w domenie („gmial.com” → „gmail.com”)
  const DOMAINS = ['gmail.com', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl', 'op.pl', 'vp.pl', 'poczta.fm',
    'outlook.com', 'hotmail.com', 'icloud.com', 'yahoo.com', 'proton.me', 'protonmail.com'];
  function levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }
  function emailSuggestion(value) {
    const at = value.lastIndexOf('@');
    if (at < 1) return null;
    const domain = value.slice(at + 1).toLowerCase();
    if (domain.length < 3 || DOMAINS.includes(domain)) return null;
    let best = DOMAINS.find(d => !domain.includes('.') && d.startsWith(domain + '.')) || null;
    if (!best) {
      let bestDist = 3;
      for (const d of DOMAINS) {
        const dist = levenshtein(domain, d);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
    }
    return best ? value.slice(0, at + 1) + best : null;
  }
  const suggestBox = $('#email-suggest');
  const suggestBtn = $('#email-suggest-btn');
  let suggestedFor = null; // adres, dla którego podpowiedź już była pokazana
  function showEmailSuggestion() {
    const value = emailInput.value.trim();
    const s = emailSuggestion(value);
    suggestBox.hidden = !s;
    if (s) { suggestBtn.textContent = s; suggestedFor = value; }
  }
  const emailNeedsSuggestion = () => {
    const value = emailInput.value.trim();
    return !!emailSuggestion(value) && suggestedFor !== value;
  };
  emailInput.addEventListener('input', () => { suggestBox.hidden = true; });
  suggestBtn.addEventListener('click', () => {
    emailInput.value = suggestBtn.textContent;
    suggestBox.hidden = true;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.focus();
  });

  // Pokaż / ukryj hasło
  const pwToggle = $('#pw-toggle');
  pwToggle.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    pwToggle.setAttribute('aria-pressed', String(show));
    pwToggle.setAttribute('aria-label', show ? 'Ukryj hasło' : 'Pokaż hasło');
    $('.eye-open', pwToggle).style.display = show ? 'none' : '';
    $('.eye-closed', pwToggle).style.display = show ? '' : 'none';
  });

  // Caps Lock
  const capsHint = $('#caps-hint');
  const syncCaps = e => { if (e.getModifierState) capsHint.hidden = !e.getModifierState('CapsLock'); };
  pwInput.addEventListener('keydown', syncCaps);
  pwInput.addEventListener('keyup', syncCaps);
  pwInput.addEventListener('blur', () => { capsHint.hidden = true; });

  // Siła hasła
  const meter = $('#pw-meter');
  const meterLabel = $('#pw-label');
  const LEVELS = ['', 'Za krótkie', 'Słabe', 'Dobre', 'Mocne'];
  function pwLevel(pw) {
    if (!pw) return 0;
    if (pw.length < 8) return 1;
    let s = 0;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s <= 1 ? 2 : s === 2 ? 3 : 4;
  }
  function syncMeter() {
    const lvl = pwLevel(pwInput.value);
    meter.dataset.level = lvl;
    meter.classList.toggle('show', lvl > 0);
    meterLabel.textContent = LEVELS[lvl];
  }
  pwInput.addEventListener('input', syncMeter);

  // ================================================================
  //  Etap 2 — o Tobie
  // ================================================================
  const parentWrap = $('#parent-wrap');
  function syncParentConsent() {
    const needs = needsParent();
    parentWrap.classList.toggle('open', needs);
    parentWrap.inert = !needs;
    if (!needs) { $('#parent').checked = false; setErr('parent', ''); }
  }
  f2.addEventListener('change', e => { if (e.target.name === 'age') syncParentConsent(); });

  // ================================================================
  //  Etap 3 — roślinka
  // ================================================================
  const NAMES = shuffle(['Kiełek', 'Bazylia', 'Mięta', 'Listek', 'Fikus', 'Pestka', 'Groszek',
    'Melisa', 'Rumianek', 'Zielu', 'Koniczynka', 'Szczypiorek']);
  let nameIdx = 0;
  const dice = $('#dice');
  dice.addEventListener('click', () => {
    plantInput.value = NAMES[nameIdx++ % NAMES.length];
    plantInput.dispatchEvent(new Event('input', { bubbles: true }));
    dice.classList.remove('roll');
    void dice.offsetWidth;
    dice.classList.add('roll');
    setTimeout(() => dice.classList.remove('roll'), 500);
  });

  // ================================================================
  //  Gotowe
  // ================================================================
  const TOPIC_COLORS = {
    'Nastrój': 'var(--mood)', 'Energia': 'var(--energy)', 'Stres': 'var(--stress)', 'Sen': 'var(--sleep)',
    'Szkoła': '#8FC3D1', 'Relacje': 'var(--peach)', 'Pewność siebie': '#E9A58A',
  };
  function fillDone() {
    $('#done-title').textContent = `Witaj, ${data.nick}!`;
    const greet = { f: 'Dobrze, że dołączyłaś.', m: 'Dobrze, że dołączyłeś.', n: 'Dobrze, że jesteś z nami.' }[data.form];
    const plant = data.plant ? `Twoja roślinka, ${data.plant}, właśnie zakwitła.` : 'Twoja roślinka właśnie zakwitła.';
    $('#done-text').textContent = `${greet} ${plant} Od dziś rośniecie razem — dzień po dniu.`;

    const pills = $('#done-pills');
    pills.innerHTML = '';
    const add = (text, color) => {
      const li = document.createElement('li');
      const dot = document.createElement('i');
      if (color) dot.style.setProperty('--c', color);
      li.append(dot, document.createTextNode(text));
      pills.append(li);
    };
    add(data.reminder === 'brak' ? 'Bez przypomnień' : `Check-in ${data.reminder}`, 'var(--teal-light)');
    data.topics.forEach(tp => add(tp, TOPIC_COLORS[tp]));
  }

  const toast = $('#toast');
  let toastTimer;
  $('#enter-app').addEventListener('click', e => {
    e.preventDefault();
    toast.textContent = 'Tu podepniemy ekran główny aplikacji.';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  });

  $('#replay').addEventListener('click', () => {
    forms.forEach(f => { f.reset(); clearErrors(f); });
    syncMeter();
    syncValidMarks();
    syncParentConsent();
    suggestBox.hidden = true;
    suggestedFor = null;
    capsHint.hidden = true;
    if (pwInput.type === 'text') pwToggle.click();
    $('#s2-title').textContent = 'Miło Cię poznać!';
    for (const k in data) delete data[k];
    goTo(1, 0);
  });

  onModeChange();
})();
