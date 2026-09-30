/*
 * Wspólne elementy ekranów logowania i rejestracji.
 * Klasyczny skrypt (bez modułów), żeby strony działały też otwarte prosto z dysku.
 *
 * window.AuthCommon:
 *   EMAIL_RE                          prosty test adresu e-mail
 *   haptic(pattern)                   krótka wibracja (tylko telefony)
 *   toast(text)                       komunikat na dole ekranu (#toast)
 *   passwordField(input, toggle, caps) pokaż/ukryj hasło + ostrzeżenie o Caps Locku; zwraca { reset() }
 *   account.save(data) / .load()      TYMCZASOWO, do czasu backendu: profil w localStorage (bez hasła)
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
    haptic, toast, passwordField, account,
  };
})();
