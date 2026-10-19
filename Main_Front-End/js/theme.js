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
 *   mode / setMode('auto'|'light'|'dark') / isDark()   tryb nocny (<html data-mode>, zapis w sci.mode)
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

  // ================================================================
  //  Tryb nocny: auto (jak system) / light / dark — <html data-mode>, zapis w sci.mode
  // ================================================================
  const MODE_KEY = 'sci.mode';
  const MODES = ['auto', 'light', 'dark'];
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  let mode = 'auto';
  try { const m = localStorage.getItem(MODE_KEY); if (MODES.includes(m)) mode = m; } catch (_) { /* tryb prywatny */ }
  function setMode(m, opts = {}) {
    if (!MODES.includes(m)) m = 'auto';
    mode = m;
    if (opts.save !== false) { try { localStorage.setItem(MODE_KEY, m); } catch (_) { /* tryb prywatny */ } }
    const root = document.documentElement;
    if (m === 'auto') delete root.dataset.mode; else root.dataset.mode = m;
    window.dispatchEvent(new CustomEvent('themechange', { detail: { id: current, mode: m } }));
  }
  const isDark = () => mode === 'dark' || (mode === 'auto' && systemDark.matches);
  if (mode !== 'auto') document.documentElement.dataset.mode = mode;
  if (systemDark.addEventListener) systemDark.addEventListener('change', () => { if (mode === 'auto') setMode('auto', { save: false }); });

  window.Theme = {
    list: LIST,
    get current() { return current; },
    apply,
    saved,
    get mode() { return mode; },
    setMode,
    isDark,
  };
})();
