/*
 * Aplikacja w jednym miejscu (aplikacja.html): zakładki zamiast osobnych stron.
 *
 * Zakładki z planu (notes/CLAUDE.md): Dom (strona główna z roślinką) · Skrytka · Tracker · Testy · Blog.
 * Adres w hashu (#/skrytka) — działa też z dysku (file://), przycisk „wstecz” przełącza zakładki.
 * Telefon: pasek na dole ekranu. Tablet i komputer: pływający pasek na dole (na komputerze pod treścią po prawej,
 * roślinka zostaje w lewej połowie na każdej zakładce).
 * Każda zakładka pamięta, gdzie była przewinięta. Stuknięcie w aktywną zakładkę przewija na górę.
 * SOS: [data-sos] w każdym nagłówku, oddech: [data-breath], skróty: [data-go="skrytka"].
 * W React Native: Expo Router, (tabs)/_layout.tsx z <Tabs>.
 */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Sheets = window.Sheets || { show() {}, hide() {} };
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;

  const TABS = [
    { id: 'dom', title: 'Dom' },
    { id: 'skrytka', title: 'Skrytka myśli' },
    { id: 'tracker', title: 'Tracker' },
    { id: 'testy', title: 'Testy' },
    { id: 'blog', title: 'Blog' },
  ];
  const views = Object.fromEntries(TABS.map(t => [t.id, document.getElementById(`view-${t.id}`)]));
  const scrollPos = {};
  let current = null;

  function tabFromHash() {
    const id = (location.hash.match(/^#\/([a-z]+)/) || [])[1];
    return views[id] ? id : 'dom';
  }

  function show(tab) {
    if (tab === current) return;
    if (current) scrollPos[current] = window.scrollY;
    if (window.Checkin && window.Checkin.isOpen) window.Checkin.close();
    if (Sheets.current) Sheets.hide(true);

    TABS.forEach(t => { views[t.id].hidden = t.id !== tab; });
    document.body.dataset.tab = tab;
    $$('.tab').forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${TABS.find(t => t.id === tab).title} · SCI++`;
    window.scrollTo(0, scrollPos[tab] || 0);

    const v = views[tab];
    if (current && !reduceMotion) { v.classList.remove('is-entering'); void v.offsetWidth; v.classList.add('is-entering'); }
    // czytnik ekranu: po zmianie zakładki fokus na tytuł
    if (current) {
      const h = v.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    current = tab;
    window.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
  }

  window.addEventListener('hashchange', () => show(tabFromHash()));
  show(tabFromHash());

  $('#tabbar').addEventListener('click', e => {
    const a = e.target.closest('.tab');
    if (a && a.dataset.tab === current) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  // ================================================================
  //  Telefon: kafel wjeżdża na roślinkę. Scena lekko odpływa w górę i przygasa,
  //  a górny pasek dostaje tło, gdy kafel do niego dojedzie.
  // ================================================================
  const stage = $('#stage'), top = $('#app-top'), homeSheet = views.dom;
  let ticking = false;
  function onScroll() {
    ticking = false;
    const phone = window.innerWidth < 1024;
    const sy = window.scrollY;
    if (phone && current === 'dom') {
      const h = stage.offsetHeight || 1;
      const p = Math.min(1, sy / h);
      stage.style.transform = reduceMotion ? '' : `translate3d(0, ${(-sy * .35).toFixed(1)}px, 0)`;
      stage.style.opacity = (1 - p * .7).toFixed(3);
    } else {
      stage.style.transform = '';
      stage.style.opacity = '';
    }
    // iPhone: „gumka” przy górnej krawędzi (scrollY < 0) też otwiera pełny ekran
    if (sy < -45 && !isFull && pullY == null && canPull()) setFull(true);
    const sheetTop = homeSheet.getBoundingClientRect().top;
    top.classList.toggle('is-solid', phone && current === 'dom' && sheetTop < top.offsetHeight + 4);
  }
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('tabchange', queue);
  onScroll();

  // ================================================================
  //  Telefon: roślinka na cały ekran. Trzy drogi, bo w niektórych przeglądarkach (np. w aplikacji, która osadza stronę)
  //  gest pociągnięcia przejmuje sama aplikacja:
  //    • przycisk z lupą przy roślince (#plant-zoom) — działa zawsze,
  //    • pociągnięcie w dół na samej górze (także gdy dojedziesz do góry rozpędem),
  //    • „gumka” przeglądarki (scrollY < 0 na iPhonie).
  //  Kafel zjeżdża na dół (widać tylko jego brzeg). Powrót: przesunięcie w górę, stuknięcie w kafel, przycisk albo kółko myszy.
  // ================================================================
  const Scene = window.Home2Scene || { full() {} };
  const content = $('#content'), tabbar = $('#tabbar');
  let isFull = false, pullY = null, pullP = 0, shift = 0;
  const canPull = () => window.innerWidth < 1024 && current === 'dom' && !Sheets.current && !(window.Checkin && window.Checkin.isOpen);
  // o ile zjechać kaflem, żeby nad paskiem zakładek został tylko jego brzeg
  const fullShift = () => Math.max(0, window.innerHeight - tabbar.offsetHeight - 76 - (homeSheet.getBoundingClientRect().top - shift));

  function moveSheet(px, animate) {
    shift = px;
    content.style.transition = animate && !reduceMotion ? 'transform .8s cubic-bezier(.2, .8, .2, 1)' : 'none';
    content.style.transform = px ? `translate3d(0, ${px.toFixed(1)}px, 0)` : '';
  }
  const hint = $('#scroll-hint');
  const hintText = hint ? hint.lastChild.textContent : '';
  const zoomBtn = $('#plant-zoom');
  function setFull(on) {
    isFull = on;
    if (zoomBtn) {
      zoomBtn.setAttribute('aria-label', on ? 'Zmniejsz roślinkę' : 'Powiększ roślinkę na cały ekran');
      zoomBtn.setAttribute('aria-pressed', String(on));
    }
    if (hint) { hint.lastChild.textContent = on ? ' Przesuń w górę, żeby wrócić' : hintText; hint.classList.remove('is-gone'); }
    document.body.classList.toggle('plant-full', on);
    Scene.full(on ? 1 : 0);
    moveSheet(on ? fullShift() : 0, true);
    if (on && window.AuthCommon) window.AuthCommon.haptic(8);
  }

  if (zoomBtn) zoomBtn.addEventListener('click', e => { e.stopPropagation(); setFull(!isFull); });

  let lastTouchY = 0;
  window.addEventListener('touchstart', e => {
    lastTouchY = e.touches[0].clientY;
    if (!canPull() || e.target.closest('#plant-zoom')) return;
    if (isFull || window.scrollY <= 0) pullY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    const y = e.touches[0].clientY;
    // dojechało do góry w trakcie tego samego przeciągnięcia → od teraz ciągniemy roślinkę
    if (pullY == null && !isFull && canPull() && window.scrollY <= 0 && y > lastTouchY) pullY = lastTouchY;
    lastTouchY = y;
    if (pullY == null) return;
    const dy = y - pullY;
    if (isFull) {
      if (dy < -24) { pullY = null; setFull(false); }
      e.preventDefault();
      return;
    }
    if (dy <= 0 || window.scrollY > 0) { if (pullP) { pullP = 0; Scene.full(0, true); moveSheet(0); } return; }
    e.preventDefault();                                       // bez „gumki” przeglądarki — ciągnie roślinka
    pullP = Math.min(1, dy / 260);
    const eased = 1 - Math.pow(1 - pullP, 2);
    Scene.full(eased, true);
    moveSheet(fullShift() * eased);
  }, { passive: false });
  window.addEventListener('touchend', () => {
    if (pullY == null) return;
    pullY = null;
    if (!isFull && pullP) { const go = pullP > .35; pullP = 0; setFull(go); }
  });
  window.addEventListener('wheel', e => {
    if (!canPull()) return;
    if (!isFull && window.scrollY <= 0 && e.deltaY < -30) setFull(true);
    else if (isFull && Math.abs(e.deltaY) > 10) { e.preventDefault(); setFull(false); }
  }, { passive: false });
  homeSheet.addEventListener('click', e => {
    if (!isFull) return;
    e.preventDefault(); e.stopPropagation();
    setFull(false);
  }, true);
  window.addEventListener('tabchange', () => { if (isFull) { isFull = false; document.body.classList.remove('plant-full'); Scene.full(0); moveSheet(0); } });
  window.addEventListener('resize', () => { if (isFull) moveSheet(fullShift()); });

  // ================================================================
  //  Tryb nocny (w arkuszu „Kolor roślinki”)
  // ================================================================
  const modeSeg = $('#mode-seg');
  if (modeSeg && window.Theme && window.Theme.setMode) {
    const paint = () => modeSeg.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === window.Theme.mode)));
    paint();
    modeSeg.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      window.Theme.setMode(b.dataset.mode, { save: !new URLSearchParams(location.search).has('widok') });
      paint();
    });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-sos]')) { Sheets.show($('#sos-sheet')); return; }
    if (e.target.closest('[data-breath]')) { if (window.Oddech) window.Oddech.open(); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      location.hash = `#/${go.dataset.go}`;
      if (go.dataset.go === 'skrytka' && window.Skrytka) setTimeout(() => window.Skrytka.focus(), 60);
    }
  });
})();
