/*
 * Motyw kolorystyczny (kolor roślinki + paleta aplikacji).
 * Ładowany w <head> BEZ defer, po arkuszach stylów — ustawia <html data-theme> zanim strona się narysuje,
 * więc nie ma mignięcia domyślnych kolorów. Same kolory są w css/tokens.css.
 *
 * window.Theme:
 *   list                     dostępne motywy [{ id, name }]
 *   current                  id aktualnego motywu
 *   apply(id, { save })      zmienia motyw (save: true — zapamiętuje go na tym urządzeniu)
 *   saved()                  zapamiętany motyw albo domyślny
 * Po każdej zmianie leci zdarzenie window 'themechange' (detail: { id }) — słucha go scena z roślinką.
 */
(function () {
  'use strict';

  const LIST = [
    { id: 'morski', name: 'Morski' },
    { id: 'zielony', name: 'Zielony' },
    { id: 'niebieski', name: 'Niebieski' },
    { id: 'lawenda', name: 'Lawenda' },
    { id: 'rozowy', name: 'Różowy' },
    { id: 'morelowy', name: 'Morelowy' },
  ];
  const DEFAULT = 'morski';
  const KEY = 'sci.theme';
  const valid = id => LIST.some(t => t.id === id);

  function saved() {
    let id = null;
    try { id = localStorage.getItem(KEY); } catch (_) { /* tryb prywatny */ }
    return valid(id) ? id : DEFAULT;
  }

  let current = null;
  function apply(id, opts = {}) {
    if (!valid(id)) id = DEFAULT;
    if (opts.save) { try { localStorage.setItem(KEY, id); } catch (_) { /* tryb prywatny */ } }
    if (id === current) return;
    current = id;
    const root = document.documentElement;
    root.dataset.theme = id;

    // Kolor paska przeglądarki na telefonie = tło motywu
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && bg) meta.setAttribute('content', bg);

    window.dispatchEvent(new CustomEvent('themechange', { detail: { id } }));
  }

  // ?motyw=rozowy w adresie — podgląd motywu bez zapisywania (np. w podglad.html)
  const fromUrl = new URLSearchParams(location.search).get('motyw');
  apply(valid(fromUrl) ? fromUrl : saved());

  window.Theme = {
    list: LIST,
    get current() { return current; },
    apply,
    saved,
  };
})();
