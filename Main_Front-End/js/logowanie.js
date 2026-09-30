/*
 * Logowanie — logika ekranu (logowanie → reset hasła → powitanie).
 *
 * Roślinka czeka już wyrośnięta z pąkami, podrasta przy wpisywaniu danych i rozkwita po zalogowaniu.
 * Backendu jeszcze nie ma: logowanie i wysyłka linku są symulowane (miejsca oznaczone „TODO backend”).
 * Scena w tle jest w js/plant-scene.js, wspólne elementy w js/auth-common.js.
 */
(function () {
  'use strict';

  const Scene = window.PlantScene || { setGrowth() {}, rustle() {} };
  const { EMAIL_RE, haptic, passwordField, account } = window.AuthCommon;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const T_STEP = reduceMotion ? 20 : 600;  // czas przejścia między widokami (ms)
  const T_FAKE = reduceMotion ? 300 : 900; // udawany czas odpowiedzi serwera (ms)

  // Wzrost rośliny: czeka z pąkami → podrasta przy wpisywaniu → rozkwita po zalogowaniu
  const G_REST = 1.3, G_READY = 1.95, G_BLOOM = 3;

  const $ = (s, r = document) => r.querySelector(s);

  const card = $('.card');
  const stepsWrap = $('#steps');
  const views = { login: $('#login'), forgot: $('#forgot'), welcome: $('#welcome') };
  const emailInput = $('#email');
  const pwInput = $('#password');
  const femailInput = $('#femail');
  const caption = $('#caption');
  const eyebrow = $('#caption-eyebrow');

  const MSG = {
    emailEmpty: 'Podaj adres e-mail.',
    emailBad: 'Sprawdź adres — czegoś w nim brakuje.',
    password: 'Wpisz hasło.',
  };

  let current = 'login';
  let busy = false;

  // Kolejne elementy widoku wjeżdżają z lekkim opóźnieniem
  Object.values(views).forEach(v => [...v.children].forEach((c, i) => c.style.setProperty('--i', i)));
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
    ready: 'Już się budzi…',
    forgot: 'Poczeka, aż wrócisz.',
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
  //  Roślinka reaguje na wypełnianie
  // ================================================================
  const emailOk = () => EMAIL_RE.test(emailInput.value.trim());
  const pwFilled = () => pwInput.value.length > 0;

  function syncGrowth() {
    const p = (emailOk() ? .5 : 0) + (pwFilled() ? .5 : 0);
    Scene.setGrowth(G_REST + (G_READY - G_REST) * p);
    setCaption(p === 1 ? 'ready' : 'rest');
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
  const emailMsg = input => {
    const v = input.value.trim();
    return !v ? MSG.emailEmpty : EMAIL_RE.test(v) ? '' : MSG.emailBad;
  };

  function shake() {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    haptic([16, 40, 16]);
  }

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
    const dir = name === 'login' ? -1 : 1;

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
    if (name === 'login') syncGrowth();

    setTimeout(() => {
      from.hidden = true;
      from.classList.remove('is-leaving');
      stepsWrap.style.height = '';
      stepsWrap.classList.remove('is-animating');
      busy = false;
      const input = finePointer && name !== 'welcome' && to.querySelector('input.input:not([hidden])');
      (input || to.querySelector('.title, h2')).focus({ preventScroll: true });
    }, T_STEP);
  }

  // Systemowy „wstecz” (Android, gest na iOS) z resetu hasła wraca do logowania
  let guarded = false;
  function pushGuard() {
    if (guarded) return;
    try { history.pushState({ login: true }, ''); guarded = true; } catch (_) { /* np. sandbox */ }
  }
  window.addEventListener('popstate', () => {
    guarded = false;
    if (current === 'forgot') goTo('login');
  });

  // ================================================================
  //  Logowanie
  // ================================================================
  const loginForm = views.login;

  loginForm.addEventListener('input', e => {
    const t = e.target;
    if (t.hasAttribute('aria-invalid')) setErr(t, '');
    Scene.rustle(.05);
    syncGrowth();
  });

  // Enter w polu e-mail przechodzi do hasła, zamiast od razu wysyłać
  emailInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (setErr(emailInput, emailMsg(emailInput))) pwInput.focus();
    else shake();
  });

  const pwField = passwordField(pwInput, $('#pw-toggle'), $('#caps-hint'));

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    if (busy || loginForm.getAttribute('aria-busy') === 'true') return;
    const okEmail = setErr(emailInput, emailMsg(emailInput));
    const okPw = setErr(pwInput, pwFilled() ? '' : MSG.password);
    if (!okEmail || !okPw) {
      shake();
      (okEmail ? pwInput : emailInput).focus();
      return;
    }

    setLoading(loginForm, true);
    Scene.rustle(.3);
    // TODO backend: tu wysyłamy e-mail i hasło; przy błędzie → setErr(pwInput, 'Nieprawidłowy e-mail lub hasło.')
    setTimeout(() => {
      setLoading(loginForm, false);
      haptic(12);
      welcome(emailInput.value.trim());
    }, T_FAKE);
  });

  // ================================================================
  //  Powitanie
  // ================================================================
  function welcome(email) {
    const me = saved && saved.email === email ? saved : null;
    $('#welcome-title').textContent = me ? `Witaj ponownie, ${me.nick}!` : 'Witaj ponownie!';
    const back = { f: 'Cieszymy się, że wróciłaś.', m: 'Cieszymy się, że wróciłeś.' }[me && me.form] || 'Dobrze, że znów jesteś.';
    const plant = me && me.plant ? `Twoja roślinka, ${me.plant}, zakwitła na powitanie.` : 'Twoja roślinka zakwitła na powitanie.';
    $('#welcome-text').textContent = `${back} ${plant}`;
    if (me && me.plant) eyebrow.textContent = me.plant;

    pwInput.value = '';
    pwField.reset();
    Scene.setGrowth(G_BLOOM);
    setCaption('bloom');
    goTo('welcome');
  }


  $('#switch-account').addEventListener('click', () => {
    emailInput.value = '';
    [emailInput, pwInput].forEach(i => setErr(i, ''));
    eyebrow.textContent = plantName || 'Twoja roślinka';
    Scene.setGrowth(G_REST);
    setCaption('rest');
    goTo('login');
  });

  // ================================================================
  //  Reset hasła
  // ================================================================
  const forgotForm = views.forgot;
  const sentBox = $('#forgot-sent');
  const forgotField = $('#forgot-field');
  const forgotBtnLabel = $('.btn-label', forgotForm);

  function resetForgot() {
    sentBox.hidden = true;
    forgotField.hidden = false;
    forgotBtnLabel.textContent = 'Wyślij link';
    forgotForm.dataset.sent = 'false';
    setErr(femailInput, '');
  }

  $('#forgot-open').addEventListener('click', () => {
    resetForgot();
    femailInput.value = emailInput.value.trim();
    setCaption('forgot');
    pushGuard();
    goTo('forgot');
  });

  forgotForm.querySelector('[data-back]').addEventListener('click', () => {
    if (guarded) history.back(); else goTo('login');
  });
  forgotForm.addEventListener('input', e => { if (e.target.hasAttribute('aria-invalid')) setErr(e.target, ''); });

  forgotForm.addEventListener('submit', e => {
    e.preventDefault();
    if (busy || forgotForm.getAttribute('aria-busy') === 'true') return;
    // Po wysłaniu główny przycisk wraca do logowania
    if (forgotForm.dataset.sent === 'true') {
      if (guarded) history.back(); else goTo('login');
      return;
    }
    if (!setErr(femailInput, emailMsg(femailInput))) { shake(); femailInput.focus(); return; }

    setLoading(forgotForm, true);
    // TODO backend: tu prosimy serwer o wysłanie linku (odpowiedź zawsze taka sama — nie zdradzamy, czy konto istnieje)
    setTimeout(() => {
      setLoading(forgotForm, false);
      const email = femailInput.value.trim();
      $('#forgot-sent-text').textContent =
        `Jeśli konto ${email} istnieje, za chwilę dostaniesz od nas wiadomość z linkiem. Sprawdź też folder Spam.`;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      forgotField.hidden = true;
      sentBox.hidden = false;
      forgotBtnLabel.textContent = 'Wróć do logowania';
      forgotForm.dataset.sent = 'true';
      emailInput.value = email;
      haptic(12);
    }, T_FAKE);
  });

  // Na komputerze od razu pole do wpisania (hasło, jeśli e-mail już znamy)
  if (finePointer) (emailInput.value ? pwInput : emailInput).focus({ preventScroll: true });
})();
