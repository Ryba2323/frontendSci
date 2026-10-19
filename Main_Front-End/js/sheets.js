/*
 * Arkusze od dołu (bottom sheets) — wspólne dla strony głównej i aplikacji.
 * Na telefonie wysuwają się od dołu, na komputerze pojawiają się na środku (css/home2.css: .bsheet).
 *
 * Wymaga w HTML: <div class="sheet-backdrop" id="sheet-backdrop" hidden></div>
 * Arkusz: <section class="bsheet" role="dialog" aria-modal="true" hidden>…</section>
 * Każdy przycisk z [data-close] w arkuszu go zamyka. Escape zamyka, Tab nie wychodzi poza arkusz.
 *
 * window.Sheets:
 *   show(sheet, { onClose })   otwiera arkusz (poprzedni zamyka od razu)
 *   hide(instant)              zamyka otwarty arkusz
 *   current                    otwarty arkusz albo null
 * W React Native: @gorhom/bottom-sheet albo Modal z Reanimated.
 */
(function () {
  'use strict';

  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="radio"]):not([disabled]), input[type="radio"]:checked, textarea, select';
  const backdrop = document.getElementById('sheet-backdrop');
  let openSheet = null, lastFocus = null, onClose = null;

  function show(sheet, opts = {}) {
    if (!sheet || !backdrop) return;
    if (openSheet) hide(true);
    lastFocus = document.activeElement;
    openSheet = sheet;
    onClose = opts.onClose || null;
    backdrop.hidden = false;
    sheet.hidden = false;
    void sheet.offsetWidth;
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
    document.body.classList.add('sheet-open');
    const first = sheet.querySelector('[autofocus]') || sheet.querySelector('input:checked') || sheet.querySelector(FOCUSABLE);
    setTimeout(() => first && first.focus({ preventScroll: true }), 60);
  }

  function hide(instant) {
    const sheet = openSheet;
    if (!sheet) return;
    openSheet = null;
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    const done = () => { sheet.hidden = true; if (!openSheet) backdrop.hidden = true; };
    if (instant) done(); else setTimeout(done, 380);
    const cb = onClose;
    onClose = null;
    if (cb) cb();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  if (backdrop) backdrop.addEventListener('click', () => hide());
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-close]');
    if (b && openSheet && openSheet.contains(b)) hide();
  });
  document.addEventListener('keydown', e => {
    if (!openSheet) return;
    if (e.key === 'Escape') { e.stopPropagation(); hide(); return; }
    if (e.key !== 'Tab') return;
    const f = $$(FOCUSABLE, openSheet).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }, true);

  window.Sheets = {
    show,
    hide,
    get current() { return openSheet; },
  };
})();
