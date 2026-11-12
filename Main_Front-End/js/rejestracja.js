/*
 * Rejestracja — logika formularza (3 etapy + ekran końcowy).
 *
 * KOLEJNOŚĆ PO RADZIE (11.11.2026, do sprawdzenia na teście z nastolatkami 20.11.2026):
 *   1. Roślinka: imię, kolor            — najpierw coś swojego
 *   2. O Tobie: imię, wiek, forma
 *   3. Konto:   e-mail, kod z e-maila (zamiast hasła), [e-mail opiekuna poniżej 16 lat], zgody
 *   4. Kwiat i od razu pierwsze podlanie; poniżej 16 lat roślinka czeka w pąku na zgodę opiekuna.
 * Z rejestracji wypadły tematy i pora przypomnień (o to zapytamy w aplikacji) oraz hasło.
 *
 * Każdy etap (form.step) ma ekrany (div.page). Na telefonie pokazujemy jeden ekran na raz,
 * na komputerze (min. 900 px) cały etap naraz — poza kontem, które zawsze idzie po jednym ekranie.
 * Systemowy „wstecz” cofa o jeden ekran. Scena w tle (listki, roślina, świetliki) jest w js/plant-scene.js.
 *
 * PROTOTYP: kod z e-maila i zgoda opiekuna są symulowane (miejsca oznaczone „TODO backend”).
 */
(function () {
  'use strict';

  const Scene = window.PlantScene || { setStage() {}, setProgress() {}, setGrowth() {}, rustle() {} };
  const { EMAIL_RE, haptic, toast, codeField, stagger, account } = window.AuthCommon;
  const Theme = window.Theme || { list: [], current: null, apply() {} };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const mqDesktop = window.matchMedia('(min-width: 900px)');
  const STAGE_PAGED = 3;   // konto: kolejne ekrany zależą od poprzednich (kod przychodzi po podaniu e-maila)
  // telefon: jeden ekran (pytanie) na raz; komputer: tylko etap konta
  const isPaged = n => !mqDesktop.matches || n === STAGE_PAGED;

  const T_STEP = reduceMotion ? 20 : 600;  // czas przejścia między etapami (ms)
  const T_PAGE = reduceMotion ? 20 : 480;  // czas przejścia między ekranami (ms)
  const T_AUTO = 450;                      // opóźnienie auto-przejścia po wyborze (ms)
  const G_BUDS = 2.1;                      // wzrost rośliny z pąkami, tuż przed rozkwitem (js/plant-scene.js)

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };

  const card = $('.card');
  const stepsWrap = $('#steps');
  const steps = { 1: $('#step1'), 2: $('#step2'), 3: $('#step3'), 4: $('#step4') };
  const forms = [steps[1], steps[2], steps[3]];
  const f1 = steps[1], f2 = steps[2], f3 = steps[3];

  const plantInput = $('#plant');
  const nickInput = $('#nick');
  const emailInput = $('#email');
  const codeInput = $('#code');
  const parentInput = $('#pemail');
  const parentPage = $('.page[data-page="parent"]');

  const data = {};
  const pageIdx = { 1: 0, 2: 0, 3: 0 };
  const passed = new Set();   // ekrany, przez które użytkownik już przeszedł (liczą się do wzrostu rośliny)
  let colorTouched = false;
  let current = 1;
  let busy = false;

  // ekran z data-off nie należy do etapu (e-mail opiekuna od 16 lat nie jest potrzebny)
  const pagesOf = n => (n >= 1 && n <= 3 ? $$('.page', steps[n]).filter(p => !('off' in p.dataset)) : []);
  const currentPage = () => pagesOf(current)[pageIdx[current]] || null;
  const isTextInput = el => el instanceof HTMLInputElement && el.classList.contains('input');
  const submitForm = form => {
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { cancelable: true }));
  };

  const MSG = {
    nick: 'Wpisz co najmniej 2 znaki.',
    emailEmpty: 'Podaj adres e-mail.',
    emailBad: 'Sprawdź adres — czegoś w nim brakuje.',
    codeEmpty: 'Wpisz 6 cyfr z wiadomości.',
    codeBad: 'Ten kod nie pasuje. Sprawdź wiadomość albo wyślij nowy.',
    age: 'Zaznacz swój wiek.',
    gform: 'Wybierz jedną z opcji.',
    parentEmpty: 'Podaj adres e-mail opiekuna.',
    parentSame: 'To musi być adres opiekuna, nie Twój.',
    terms: 'Zaakceptuj regulamin, żeby założyć konto.',
    health: 'Bez tej zgody nie możemy zapisywać Twoich wpisów.',
  };

  // Podpis nad roślinką: etap + czy jest już za połową etapu
  const CAPTIONS = {
    1: 'Każda roślina zaczyna się od jednego nasionka.',
    '1+': 'Kiełkuje! Tak trzymaj.',
    2: 'Wypuszcza pierwsze gałązki.',
    '2+': 'Rośnie, kiedy dajesz jej odrobinę uwagi.',
    3: 'Pojawiają się pierwsze pąki.',
    '3+': 'Jeszcze chwila — zaraz rozkwitnie.',
    4: 'Rozkwita — tak jak Ty, krok po kroku.',
    wait: 'Czeka w pąku. Nic jej nie będzie.',
  };

  // Kolejne elementy etapu / ekranu wjeżdżają z lekkim opóźnieniem
  Object.values(steps).forEach(stagger);
  $$('.page').forEach(p => {
    let i = 0;
    [...p.children].forEach(c => {
      if (c.classList.contains('field')) [...c.children].forEach(fc => fc.style.setProperty('--i', i++));
      else c.style.setProperty('--i', i++);
    });
  });
  card.addEventListener('animationend', e => { if (e.animationName === 'card-in') card.classList.remove('intro'); });

  // ================================================================
  //  Kod z e-maila (zamiast hasła)
  // ================================================================
  const code = codeField({ input: codeInput, demo: $('#code-demo'), demoBtn: $('#code-demo-btn'), resend: $('#code-resend') });
  let codeSentFor = null;   // adres, na który poszedł ostatni kod
  function sendCode() {
    const email = emailInput.value.trim();
    $('#code-email').textContent = email;
    if (codeSentFor === email) return;   // powrót do e-maila bez zmiany adresu nie wysyła drugiego kodu
    codeSentFor = email;
    // TODO backend: supabase.auth.signInWithOtp({ email }) — tu prosimy serwer o wysłanie kodu
    code.send();
  }

  // ================================================================
  //  Stan wypełnienia — napędza wzrost rośliny w trakcie etapu
  // ================================================================
  const nickOk = () => nickInput.value.trim().length >= 2;
  const emailOk = () => EMAIL_RE.test(emailInput.value.trim());
  const ageValue = () => f2.elements.age.value;
  const under13 = () => ageValue() === '12';
  const needsParent = () => { const age = parseInt(ageValue(), 10); return !isNaN(age) && age < 16; };
  const parentOk = () => {
    const v = parentInput.value.trim().toLowerCase();
    return EMAIL_RE.test(v) && v !== emailInput.value.trim().toLowerCase();
  };
  const consentsOk = () => $('#terms').checked && $('#health').checked;

  // Ekran jest „zrobiony”, gdy ma poprawną odpowiedź albo użytkownik już przez niego przeszedł
  // (np. nie nadał roślince imienia). Każdy zrobiony ekran to kawałek wzrostu rośliny.
  const PAGE_FILLED = {
    plant: () => !!plantInput.value.trim(),
    color: () => colorTouched,
    nick: nickOk,
    age: () => !!ageValue() && !under13(),
    gform: () => !!f2.elements.gform.value,
    email: emailOk,
    code: () => code.matches(),
    parent: parentOk,
    consents: consentsOk,
  };
  const pageDone = p => passed.has(p.dataset.page) || PAGE_FILLED[p.dataset.page]();
  function stageProgress(n) {
    const pages = pagesOf(n);
    return pages.length ? pages.filter(pageDone).length / pages.length : 0;
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

  const PAGE_CHECKS = {
    nick: () => setErr('nick', nickOk() ? '' : MSG.nick),
    age: () => setErr('age', ageValue() ? '' : MSG.age),
    gform: () => setErr('gform', f2.elements.gform.value ? '' : MSG.gform),
    email: () => setErr('email', !emailInput.value.trim() ? MSG.emailEmpty : emailOk() ? '' : MSG.emailBad),
    code: () => setErr('code', !code.filled() ? MSG.codeEmpty : code.matches() ? '' : MSG.codeBad),
    parent: () => {
      const v = parentInput.value.trim();
      return setErr('pemail', !v ? MSG.parentEmpty : !EMAIL_RE.test(v) ? MSG.emailBad : parentOk() ? '' : MSG.parentSame);
    },
    consents: () => {
      const ok = setErr('terms', $('#terms').checked ? '' : MSG.terms);
      return setErr('health', $('#health').checked ? '' : MSG.health) && ok;
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

  // ================================================================
  //  Nawigacja: etapy
  // ================================================================
  function goTo(n, page) {
    if (n === current || busy) return;
    busy = true;
    const dir = n > current ? 1 : -1;
    const from = steps[current], to = steps[n];

    if (n <= 3) {
      const pages = pagesOf(n), paged = isPaged(n);
      pageIdx[n] = page != null ? page : dir > 0 ? 0 : pages.length - 1;
      pages.forEach((p, i) => { p.classList.remove('is-entering', 'is-leaving'); p.hidden = paged && i !== pageIdx[n]; });
    }

    // Na telefonie chowamy klawiaturę i wracamy na górę, żeby było widać, jak roślina rośnie
    if (!mqDesktop.matches) {
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
    // poniżej 16 lat roślinka nie kwitnie od razu: zostaje w pąkach do zgody opiekuna
    if (n === 4 && data.parentPending) Scene.setStage(3, 1);
    else Scene.setStage(n, stageProgress(n));
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

  // Telefon (dotyk): fokus na ekranie, żeby klawiatura nie wyskakiwała sama. Komputer: od razu pole tekstowe.
  function focusTarget(scope, fallback) {
    const input = finePointer && scope && scope.querySelector('input.input');
    return input || fallback;
  }
  function focusAfterStep(stepEl, n) {
    const page = n <= 3 && isPaged(n) ? pagesOf(n)[pageIdx[n]] : null;
    focusTarget(page || stepEl, page || stepEl.querySelector('h2')).focus({ preventScroll: true });
  }

  // ================================================================
  //  Nawigacja: ekrany w obrębie etapu
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

    if (dir > 0) passed.add(from.dataset.page);
    pageIdx[n] = idx;
    syncControls();
    Scene.rustle(.15);
    Scene.setProgress(stageProgress(n));
    updateCaption();
    if (dir > 0) pushGuard();

    // Otwarta klawiatura → od razu kolejne pole, żeby nie zamykała się między pytaniami
    if (keyboardOpen && input) input.focus({ preventScroll: true });
    else if (keyboardOpen) document.activeElement.blur();

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove('is-leaving');
      busy = false;
      if (!(keyboardOpen && input)) focusTarget(to, to).focus({ preventScroll: true });
    }, T_PAGE);
  }

  function goBack() {
    if (busy || current === 4) return;
    if (isPaged(current) && pageIdx[current] > 0) goToPage(current, pageIdx[current] - 1);
    else if (current > 1) goTo(current - 1);
  }
  const atStart = () => current === 1 && (!isPaged(1) || pageIdx[1] === 0);
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
    forms.forEach((form, i) => {
      const n = i + 1, paged = isPaged(n), pages = pagesOf(n), idx = pageIdx[n], page = pages[idx];
      const last = !paged || idx === pages.length - 1;
      form.dataset.last = String(last);

      const back = form.querySelector('[data-back]');
      if (back) back.hidden = n === 1 && (!paged || idx === 0);
      const foot = form.querySelector('.foot');
      if (foot) foot.hidden = paged && idx > 0;

      let label = n === 3 && last ? 'Załóż konto' : 'Dalej';
      if (paged && page && page.dataset.page === 'email') label = 'Wyślij kod';
      form.querySelector('.btn-label').textContent = label;
    });
    updateStepper();
  }

  // Gałązka postępu (css/auth.css): ukończony etap ma pełny liść, a przy bieżącym liść rośnie
  // z każdym pytaniem, które jest już za użytkownikiem (--fill 0–1; etap pokazany w całości na komputerze: 0)
  function updateStepper() {
    $$('.stepper li').forEach((li, i) => {
      const s = i + 1;
      li.classList.toggle('is-done', s < current);
      li.classList.toggle('is-current', s === current);
      if (s === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');

      let fill = s < current ? 1 : 0;
      if (s === current && s <= 3 && isPaged(s)) fill = pageIdx[s] / pagesOf(s).length;
      li.style.setProperty('--fill', fill);
    });
  }

  const caption = $('#caption');
  const eyebrow = $('#caption-eyebrow');
  let captionKey = 1;
  let captionTimer;
  function updateCaption() {
    // roślinka dostaje imię już na pierwszym ekranie, więc podpis nosi je od razu
    eyebrow.textContent = plantInput.value.trim() || 'Twoja roślinka';

    const p = current <= 3 ? stageProgress(current) : 0;
    const key = current === 4 ? (data.parentPending ? 'wait' : 4)
      : current === 1 ? (p > 0 ? '1+' : 1)
      : p >= .5 ? current + '+' : current;
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
    [1, 2, 3].forEach(n => {
      const pages = pagesOf(n);
      pageIdx[n] = Math.min(pageIdx[n], Math.max(0, pages.length - 1));
      pages.forEach((p, i) => {
        p.classList.remove('is-entering', 'is-leaving');
        p.hidden = isPaged(n) && i !== pageIdx[n];
      });
    });
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
      const pages = pagesOf(n), paged = isPaged(n);
      const scope = paged ? [pages[pageIdx[n]]] : pages;
      const has = name => scope.some(p => p.dataset.page === name);

      // Poniżej 13 lat: bez komunikatu o błędzie i bez potrząsania, tylko spokojna informacja pod wiekiem
      if (has('age') && under13()) { showUnder13(true); return; }
      if (!validatePages(scope)) { shake(); haptic([16, 40, 16]); focusFirstInvalid(scope); return; }
      if (has('email')) {
        // Możliwa literówka w e-mailu: najpierw pokaż podpowiedź, drugie „Dalej” przechodzi mimo to
        if (emailNeedsSuggestion()) { showEmailSuggestion(true); haptic(8); return; }
        sendCode();
      }
      if (paged && pageIdx[n] < pages.length - 1) { goToPage(n, pageIdx[n] + 1); return; }
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
      if (!isPaged(n) || e.target.type !== 'radio' || Date.now() - lastPointerDown > 1000) return;
      const page = e.target.closest('.page');
      if (!page || !('auto' in page.dataset) || under13()) return;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (busy || page.hidden || page.classList.contains('is-leaving')) return;
        submitForm(form);
      }, T_AUTO);
    });

    // Enter na checkboxie/radiu też przechodzi dalej
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input[type=radio], input[type=checkbox]')) {
        e.preventDefault();
        submitForm(form);
      }
    });
  });

  function completeStage(n) {
    pagesOf(n).forEach(p => passed.add(p.dataset.page));
    if (n === 1) {
      data.plant = plantInput.value.trim();
      data.theme = f1.elements.theme.value;
    } else if (n === 2) {
      data.nick = nickInput.value.trim();
      data.age = ageValue() === '19' ? '19+' : ageValue();
      data.form = f2.elements.gform.value;
    } else if (n === 3) {
      data.email = emailInput.value.trim();
      data.parentEmail = needsParent() ? parentInput.value.trim() : null;
      data.parentPending = needsParent();
      // osobno regulamin i dane o zdrowiu, z datą — tak, jak pójdą do tabeli zgód (TODO backend)
      // wersje dokumentów jak w js/zgody.js (DOCS) i w tabeli legal_documents; aplikacja przenosi to do dziennika zgód
      data.consents = { terms: true, health: true, at: new Date().toISOString(), versions: { terms: '0.1', privacy: '0.1', health_data: '0.1' } };
      Theme.apply(data.theme, { save: true });
      // Tymczasowo, do czasu backendu: profil zostaje w przeglądarce, żeby logowanie mogło przywitać po imieniu.
      // TODO backend: supabase.auth.verifyOtp + zapis profilu; poniżej 16 lat wysyłka prośby do opiekuna
      account.save(data);
      fillDone();
    }
    goTo(n + 1);
  }

  // ================================================================
  //  Etap 1 — roślinka
  // ================================================================
  // Kolor: podgląd na żywo (roślina i cała paleta), zapis dopiero po założeniu konta
  const colorQ = $('#color-q');
  const syncColorQuestion = () => {
    colorQ.textContent = `Jaki kolor ma mieć ${plantInput.value.trim() || 'Twoja roślinka'}?`;
  };
  const selectCurrentTheme = () => {
    const radio = $$('input[name=theme]', f1).find(r => r.value === Theme.current);
    if (radio) radio.checked = true;
  };
  plantInput.addEventListener('input', syncColorQuestion);
  f1.addEventListener('change', e => {
    if (e.target.name !== 'theme') return;
    colorTouched = true;
    Theme.apply(e.target.value);
    haptic(8);
  });
  selectCurrentTheme();

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
  //  Etap 2 — o Tobie
  // ================================================================
  function syncValidMarks() {
    nickInput.closest('.field').classList.toggle('is-valid', nickOk());
    emailInput.closest('.field').classList.toggle('is-valid', emailOk());
  }
  f2.addEventListener('input', syncValidMarks);
  f3.addEventListener('input', syncValidMarks);

  nickInput.addEventListener('blur', () => {
    if (nickInput.value.trim() && !nickOk()) setErr('nick', MSG.nick);
  });

  // Poniżej 13 lat: informacja w ciepłym świetle zamiast błędu (wcześniej nie było takiej odpowiedzi)
  const under13Box = $('#under13');
  function showUnder13(focus) {
    under13Box.classList.add('open');
    under13Box.inert = false;
    setErr('age', '');
    if (focus) {
      const note = $('#under13-note');
      note.focus({ preventScroll: true });
      note.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  function hideUnder13() {
    under13Box.classList.remove('open');
    under13Box.inert = true;
  }

  // Poniżej 16 lat etap konta dostaje dodatkowy ekran: e-mail rodzica lub opiekuna
  function syncParent() {
    if (needsParent()) delete parentPage.dataset.off;
    else { parentPage.dataset.off = ''; parentInput.value = ''; setErr('pemail', ''); }
  }
  f2.addEventListener('change', e => {
    if (e.target.name !== 'age') return;
    syncParent();
    if (under13()) showUnder13(false); else hideUnder13();
  });

  // ================================================================
  //  Etap 3 — konto
  // ================================================================
  emailInput.addEventListener('blur', e => {
    if (emailInput.value.trim() && !emailOk()) setErr('email', MSG.emailBad);
    // Stuknięcie w „Dalej” też zabiera fokus z pola: wtedy podpowiedź tylko się pokazuje, a „widziana” robi się
    // dopiero w obsłudze wysyłki. Inaczej to samo stuknięcie pokazywało ją i od razu przechodziło dalej.
    const viaSubmit = e.relatedTarget instanceof Element && e.relatedTarget.matches('button[type=submit]');
    showEmailSuggestion(!viaSubmit);
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
  let suggestedFor = null; // adres, dla którego użytkownik już widział podpowiedź (kolejne „Dalej” przechodzi mimo niej)
  function showEmailSuggestion(seen = true) {
    const value = emailInput.value.trim();
    const s = emailSuggestion(value);
    suggestBox.hidden = !s;
    if (s) { suggestBtn.textContent = s; if (seen) suggestedFor = value; }
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

  // Sześć cyfr wpisane (albo wklejone, albo podpowiedziane przez telefon) → od razu sprawdzamy, bez stukania w „Dalej”
  let codeTimer;
  codeInput.addEventListener('input', () => {
    clearTimeout(codeTimer);
    if (!code.filled()) return;
    codeTimer = setTimeout(() => {
      const page = currentPage();
      if (!busy && current === 3 && page && page.dataset.page === 'code') submitForm(f3);
    }, 250);
  });

  // Regulamin i polityka prywatności (regulamin.html, polityka-prywatnosci.html) otwierają się w nowej karcie
  // (target="_blank" w rejestracja.html), żeby formularz został tak, jak był.

  // ================================================================
  //  Gotowe
  // ================================================================
  function fillDone() {
    const pending = !!data.parentPending;
    steps[4].dataset.pending = String(pending);
    const plant = data.plant;
    if (pending) {
      $('#done-title').textContent = `Jeszcze chwila, ${data.nick}`;
      $('#done-text').textContent = `Wysłaliśmy prośbę o zgodę na adres ${data.parentEmail}. Gdy opiekun ją potwierdzi, ${plant || 'Twoja roślinka'} rozkwitnie. Nic nie przepadnie — poczeka na Ciebie w pąku.`;
      return;
    }
    $('#done-title').textContent = `Witaj, ${data.nick}!`;
    const greet = { f: 'Dobrze, że dołączyłaś.', m: 'Dobrze, że dołączyłeś.', n: 'Dobrze, że jesteś z nami.' }[data.form];
    const bloom = plant ? `Twoja roślinka, ${plant}, właśnie zakwitła.` : 'Twoja roślinka właśnie zakwitła.';
    $('#done-text').textContent = `${greet} ${bloom} Podlej ją pierwszy raz — to kilka krótkich pytań o Twój dzień.`;
  }

  // Powtórka samego rozkwitu: roślina wraca do pąków i kwitnie jeszcze raz. Formularz zostaje nietknięty
  // (wcześniej ten przycisk kasował wszystko i zaczynał rejestrację od nowa).
  let replayTimer;
  $('#replay').addEventListener('click', () => {
    clearTimeout(replayTimer);
    Scene.setGrowth(G_BUDS);
    replayTimer = setTimeout(() => Scene.setStage(4), reduceMotion ? 300 : 1400);
  });

  $('#parent-resend').addEventListener('click', () => {
    // TODO backend: ponowna wysyłka prośby o zgodę do opiekuna
    toast(`Prośba poszła jeszcze raz na ${data.parentEmail}.`);
  });
  // PROTOTYP: opiekun „potwierdza” jednym stuknięciem — roślinka rozkwita i ekran zmienia się w powitanie
  $('#parent-demo').addEventListener('click', () => {
    data.parentPending = false;
    account.save(data);
    fillDone();
    Scene.setStage(4);
    updateCaption();
    haptic(12);
    $('#done-title').focus({ preventScroll: true });
  });

  syncParent();
  onModeChange();
})();
