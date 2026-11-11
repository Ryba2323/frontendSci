/*
 * Wspólne elementy ekranów logowania i rejestracji.
 * Klasyczny skrypt (bez modułów), żeby strony działały też otwarte prosto z dysku.
 *
 * window.AuthCommon:
 *   EMAIL_RE                          prosty test adresu e-mail
 *   haptic(pattern)                   krótka wibracja (tylko telefony)
 *   toast(text)                       komunikat na dole ekranu (#toast)
 *   codeField({ input, demo, demoBtn, resend })  kod z e-maila zamiast hasła; zwraca { send(), filled(), matches(), reset() }
 *   passwordField(input, toggle, caps) pokaż/ukryj hasło + ostrzeżenie o Caps Locku; zwraca { reset() }
 *                                     (nieużywane od 11.11.2026: zostaje jako zapas, gdyby kody z e-maila nie dochodziły)
 *   stagger(step)                     numeruje elementy widoku (--i), żeby wjeżdżały po kolei (css/auth.css)
 *   account.save(data) / .load()      TYMCZASOWO, do czasu backendu: profil w localStorage (bez hasła)
 * Do tego SOS: przycisk [data-sos] otwiera arkusz <dialog id="auth-sos"> z numerami pomocowymi (jak w aplikacji).
 */
(function () {
  'use strict';

  const finePointer = window.matchMedia('(pointer: fine)').matches;

  function haptic(pattern) {
    // tylko po prawdziwym dotknięciu (inaczej przeglądarka blokuje wibrację i zgłasza błąd)
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (!finePointer && touched && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) { /* brak wsparcia */ } }
  }

  let toastTimer;
  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function passwordField(input, toggle, caps) {
    function show(on) {
      input.type = on ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', on ? 'Ukryj hasło' : 'Pokaż hasło');
      toggle.querySelector('.eye-open').style.display = on ? 'none' : '';
      toggle.querySelector('.eye-closed').style.display = on ? '' : 'none';
    }
    // pointerdown + preventDefault: klawiatura na telefonie nie chowa się po dotknięciu oka
    toggle.addEventListener('pointerdown', e => { if (document.activeElement === input) e.preventDefault(); });
    toggle.addEventListener('click', () => show(input.type === 'password'));

    const syncCaps = e => { if (caps && e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
    input.addEventListener('keydown', syncCaps);
    input.addEventListener('keyup', syncCaps);
    input.addEventListener('blur', () => { if (caps) caps.hidden = true; });

    return { reset() { show(false); if (caps) caps.hidden = true; } };
  }

  // Kod z e-maila zamiast hasła (decyzja po radzie, 11.11.2026): nie ma czego zapomnieć, znika reset hasła.
  // PROTOTYP: e-maile jeszcze nie wychodzą, więc kod losujemy tutaj i pokazujemy pod polem („Wersja testowa”),
  // stuknięcie go wpisuje. TODO backend: Supabase Auth — signInWithOtp({ email }) wysyła, verifyOtp sprawdza.
  //   input   pole kodu (same cyfry, najwyżej 6; wklejone „482 913” też działa)
  //   demo    akapit z kodem testowym, demoBtn — przycisk w nim
  //   resend  „Wyślij kod ponownie”, aktywny po RESEND_AFTER sekundach
  const RESEND_AFTER = 30;
  function codeField({ input, demo, demoBtn, resend }) {
    let code = '', left = 0, timer;
    const digits = () => input.value.replace(/\D/g, '').slice(0, 6);
    const label = () => {
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? `Wyślij ponownie za 0:${String(left).padStart(2, '0')}` : 'Wyślij kod ponownie';
    };
    function send() {
      code = String(Math.floor(100000 + Math.random() * 900000));
      input.value = '';
      demoBtn.textContent = code.slice(0, 3) + ' ' + code.slice(3);
      demo.hidden = false;
      clearInterval(timer);
      left = RESEND_AFTER;
      label();
      timer = setInterval(() => { left--; label(); if (left <= 0) clearInterval(timer); }, 1000);
    }
    input.addEventListener('input', () => {
      const d = digits();
      // odstęp po trzeciej cyfrze, jak w wiadomości z kodem
      const shown = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
      if (input.value !== shown) input.value = shown;
    });
    demoBtn.addEventListener('click', () => {
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    resend.addEventListener('click', () => {
      send();
      toast('Wysłaliśmy nowy kod.');
      input.focus();
    });
    label();
    return {
      send,
      filled: () => digits().length === 6,
      matches: () => !!code && digits() === code,
      reset() { clearInterval(timer); code = ''; left = 0; input.value = ''; demo.hidden = true; label(); },
    };
  }

  // Kolejne elementy widoku wjeżdżają z lekkim opóźnieniem. Na telefonie .panel tylko grupuje pola (display: contents),
  // więc numerujemy też jego dzieci; na komputerze .panel to karta i wjeżdża w całości.
  function stagger(step) {
    let i = 0;
    [...step.children].forEach(c => {
      c.style.setProperty('--i', i++);
      if (c.classList.contains('panel')) [...c.children].forEach(pc => pc.style.setProperty('--i', i++));
    });
  }

  // SOS: natywny <dialog> (Escape i fokus obsługuje przeglądarka); stuknięcie w tło zamyka.
  // Tylko logowanie i rejestracja: aplikacja.html ma własny arkusz SOS (js/app.js), a tego elementu tam nie ma.
  const sosSheet = document.getElementById('auth-sos');
  if (sosSheet && sosSheet.showModal) {
    document.querySelectorAll('[data-sos]').forEach(btn => btn.addEventListener('click', () => sosSheet.showModal()));
    sosSheet.addEventListener('click', e => {
      if (e.target === sosSheet || e.target.closest('[data-sos-close]')) sosSheet.close();
    });
  }

  const KEY = 'sci.account';
  const account = {
    save(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* tryb prywatny, brak miejsca */ }
    },
    load() {
      try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; }
    },
  };

  window.AuthCommon = {
    EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    haptic, toast, codeField, passwordField, stagger, account,
  };
})();
