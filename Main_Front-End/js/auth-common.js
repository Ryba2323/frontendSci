/*
 * Wspólne elementy ekranów logowania i rejestracji.
 * Klasyczny skrypt (bez modułów), żeby strony działały też otwarte prosto z dysku.
 *
 * window.AuthCommon:
 *   EMAIL_RE                          prosty test adresu e-mail
 *   haptic(pattern)                   krótka wibracja (tylko telefony)
 *   toast(text)                       komunikat na dole ekranu (#toast)
 *   passwordField(input, toggle, caps) pokaż/ukryj hasło + ostrzeżenie o Caps Locku; zwraca { reset() }
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
    haptic, toast, passwordField, stagger, account,
  };
})();
