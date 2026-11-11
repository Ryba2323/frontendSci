/*
 * Logowanie — logika ekranu (e-mail → kod z e-maila → powitanie).
 *
 * Hasła nie ma (decyzja po radzie, 11.11.2026): logujemy kodem wysłanym na e-mail, więc zniknął też reset hasła.
 * Roślinka czeka już wyrośnięta z pąkami, podrasta przy wpisywaniu danych i rozkwita po zalogowaniu.
 * Backendu jeszcze nie ma: wysyłka i sprawdzenie kodu są symulowane (miejsca oznaczone „TODO backend”).
 * Scena w tle jest w js/plant-scene.js, wspólne elementy (w tym pole kodu) w js/auth-common.js.
 */
(function () {
  'use strict';

  const Scene = window.PlantScene || { setGrowth() {}, rustle() {} };
  const { EMAIL_RE, haptic, codeField, stagger, account } = window.AuthCommon;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const T_STEP = reduceMotion ? 20 : 600;  // czas przejścia między widokami (ms)
  const T_FAKE = reduceMotion ? 300 : 900; // udawany czas odpowiedzi serwera (ms)

  // Wzrost rośliny: czeka z pąkami → podrasta przy wpisywaniu → rozkwita po zalogowaniu
  const G_REST = 1.3, G_READY = 1.95, G_BLOOM = 3;

  const $ = (s, r = document) => r.querySelector(s);

  const card = $('.card');
  const stepsWrap = $('#steps');
  const views = { login: $('#login'), verify: $('#verify'), welcome: $('#welcome') };
  const ORDER = ['login', 'verify', 'welcome'];
  const emailInput = $('#email');
  const codeInput = $('#code');
  const caption = $('#caption');
  const eyebrow = $('#caption-eyebrow');

  const MSG = {
    emailEmpty: 'Podaj adres e-mail.',
    emailBad: 'Sprawdź adres — czegoś w nim brakuje.',
    codeEmpty: 'Wpisz 6 cyfr z wiadomości.',
    codeBad: 'Ten kod nie pasuje. Sprawdź wiadomość albo wyślij nowy.',
  };

  let current = 'login';
  let busy = false;

  // Kolejne elementy widoku wjeżdżają z lekkim opóźnieniem
  Object.values(views).forEach(stagger);
  card.addEventListener('animationend', e => { if (e.animationName === 'card-in') card.classList.remove('intro'); });

  // ================================================================
  //  Zapamiętany profil (tymczasowo z rejestracji w tej przeglądarce)
  // ================================================================
  const saved = account.load();
  const plantName = saved && saved.plant;
  eyebrow.textContent = plantName || 'Twoja roślinka';
  if (saved && saved.email) emailInput.value = saved.email;

  const CAPTIONS = {
    rest: 'Czeka na Ciebie.',
    code: 'Jeszcze kod i gotowe.',
    ready: 'Już się budzi…',
    bloom: 'Rozkwita na powitanie.',
  };
  let captionKey = 'rest';
  let captionTimer;
  function setCaption(key) {
    if (key === captionKey) return;
    captionKey = key;
    clearTimeout(captionTimer);
    caption.classList.add('fade');
    captionTimer = setTimeout(() => {
      caption.textContent = CAPTIONS[key];
      caption.classList.remove('fade');
    }, 450);
  }
  caption.textContent = CAPTIONS.rest;

  // ================================================================
  //  Kod z e-maila i roślinka, która reaguje na wypełnianie
  // ================================================================
  const code = codeField({ input: codeInput, demo: $('#code-demo'), demoBtn: $('#code-demo-btn'), resend: $('#code-resend') });
  let codeSentFor = null;   // adres, na który poszedł ostatni kod
  const emailOk = () => EMAIL_RE.test(emailInput.value.trim());

  // połowa drogi do rozkwitu za poprawny e-mail, druga połowa za sześć cyfr kodu
  function syncGrowth() {
    const p = (emailOk() ? .5 : 0) + (current === 'verify' && code.filled() ? .5 : 0);
    Scene.setGrowth(G_REST + (G_READY - G_REST) * p);
    setCaption(p === 1 ? 'ready' : current === 'verify' ? 'code' : 'rest');
  }
  Scene.setGrowth(G_REST, { instant: true });
  syncGrowth();

  // ================================================================
  //  Walidacja
  // ================================================================
  function setErr(input, msg) {
    const err = document.getElementById(input.id + '-err');
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    err.textContent = msg || '';
    return !msg;
  }
  const emailMsg = () => {
    const v = emailInput.value.trim();
    return !v ? MSG.emailEmpty : EMAIL_RE.test(v) ? '' : MSG.emailBad;
  };

  function shake() {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    haptic([16, 40, 16]);
  }

  const isLoading = form => form.getAttribute('aria-busy') === 'true';
  function setLoading(form, on) {
    const btn = form.querySelector('.btn-primary');
    btn.classList.toggle('is-loading', on);
    btn.disabled = on;
    form.setAttribute('aria-busy', String(on));
  }

  // ================================================================
  //  Przejścia między widokami
  // ================================================================
  function goTo(name) {
    if (name === current || busy) return;
    busy = true;
    const from = views[current], to = views[name];
    const dir = ORDER.indexOf(name) > ORDER.indexOf(current) ? 1 : -1;

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    Object.values(views).forEach(v => v.classList.remove('is-entering'));
    stepsWrap.style.height = stepsWrap.offsetHeight + 'px';
    stepsWrap.classList.add('is-animating');

    from.style.setProperty('--dx', (-dir * 28) + 'px');
    from.classList.add('is-leaving');
    to.style.setProperty('--dx', (dir * 28) + 'px');
    to.hidden = false;
    void to.offsetWidth;
    to.classList.add('is-entering');
    stepsWrap.style.height = to.offsetHeight + 'px';
    current = name;
    if (name !== 'welcome') syncGrowth();

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove('is-leaving');
      stepsWrap.style.height = '';
      stepsWrap.classList.remove('is-animating');
      busy = false;
      const input = finePointer && name !== 'welcome' && to.querySelector('input.input');
      (input || to.querySelector('.title, h2')).focus({ preventScroll: true });
    }, T_STEP);
  }

  // Systemowy „wstecz” (Android, gest na iOS) z ekranu kodu wraca do adresu e-mail
  let guarded = false;
  function pushGuard() {
    if (guarded) return;
    try { history.pushState({ login: true }, ''); guarded = true; } catch (_) { /* np. sandbox */ }
  }
  const backToEmail = () => { if (guarded) history.back(); else goTo('login'); };
  window.addEventListener('popstate', () => {
    guarded = false;
    if (current === 'verify' && !isLoading(views.verify)) goTo('login');
  });

  // ================================================================
  //  E-mail → wysyłka kodu
  // ================================================================
  const loginForm = views.login;

  loginForm.addEventListener('input', e => {
    if (e.target.hasAttribute('aria-invalid')) setErr(e.target, '');
    Scene.rustle(.05);
    syncGrowth();
  });

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    if (busy || isLoading(loginForm)) return;
    if (!setErr(emailInput, emailMsg())) { shake(); emailInput.focus(); return; }

    const email = emailInput.value.trim();
    $('#code-email').textContent = email;
    const show = () => { setErr(codeInput, ''); pushGuard(); goTo('verify'); };
    if (codeSentFor === email) { show(); return; }   // powrót i ten sam adres: kod już poszedł

    setLoading(loginForm, true);
    Scene.rustle(.3);
    // TODO backend: supabase.auth.signInWithOtp({ email }); odpowiedź zawsze taka sama — nie zdradzamy, czy konto istnieje
    setTimeout(() => {
      setLoading(loginForm, false);
      codeSentFor = email;
      code.send();
      haptic(12);
      show();
    }, T_FAKE);
  });

  // ================================================================
  //  Kod → logowanie
  // ================================================================
  const verifyForm = views.verify;

  verifyForm.querySelector('[data-back]').addEventListener('click', () => { if (!isLoading(verifyForm)) backToEmail(); });

  // Sześć cyfr wpisane (albo wklejone, albo podpowiedziane przez telefon) → logujemy bez stukania w przycisk
  let codeTimer;
  verifyForm.addEventListener('input', e => {
    if (e.target.hasAttribute('aria-invalid')) setErr(e.target, '');
    Scene.rustle(.05);
    syncGrowth();
    clearTimeout(codeTimer);
    if (code.filled()) codeTimer = setTimeout(() => {
      if (current !== 'verify') return;
      if (verifyForm.requestSubmit) verifyForm.requestSubmit();
      else verifyForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }, 250);
  });

  verifyForm.addEventListener('submit', e => {
    e.preventDefault();
    if (busy || isLoading(verifyForm)) return;
    if (!setErr(codeInput, !code.filled() ? MSG.codeEmpty : code.matches() ? '' : MSG.codeBad)) { shake(); codeInput.focus(); return; }

    setLoading(verifyForm, true);
    Scene.rustle(.3);
    // TODO backend: supabase.auth.verifyOtp({ email, token, type: 'email' }); przy błędzie → setErr(codeInput, MSG.codeBad)
    setTimeout(() => {
      setLoading(verifyForm, false);
      haptic(12);
      welcome(emailInput.value.trim());
    }, T_FAKE);
  });

  // ================================================================
  //  Powitanie
  // ================================================================
  function welcome(email) {
    // adres e-mail nie rozróżnia wielkości liter („Ola@…” to to samo konto co „ola@…”)
    const me = saved && saved.email && saved.email.toLowerCase() === email.toLowerCase() ? saved : null;
    $('#welcome-title').textContent = me ? `Witaj ponownie, ${me.nick}!` : 'Witaj ponownie!';
    const back = { f: 'Cieszymy się, że wróciłaś.', m: 'Cieszymy się, że wróciłeś.' }[me && me.form] || 'Dobrze, że znów jesteś.';
    const plant = me && me.plant ? `Twoja roślinka, ${me.plant}, zakwitła na powitanie.` : 'Twoja roślinka zakwitła na powitanie.';
    $('#welcome-text').textContent = `${back} ${plant}`;
    if (me && me.plant) eyebrow.textContent = me.plant;

    code.reset();
    codeSentFor = null;
    Scene.setGrowth(G_BLOOM);
    setCaption('bloom');
    goTo('welcome');
  }

  $('#switch-account').addEventListener('click', () => {
    emailInput.value = '';
    [emailInput, codeInput].forEach(i => setErr(i, ''));
    eyebrow.textContent = plantName || 'Twoja roślinka';
    Scene.setGrowth(G_REST);
    setCaption('rest');
    goTo('login');
  });

  // Na komputerze od razu pole do wpisania
  if (finePointer) emailInput.focus({ preventScroll: true });
})();
