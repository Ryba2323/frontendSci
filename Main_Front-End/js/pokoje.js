/*
 * POKOJE (?uklad=e, <html data-pokoje>) — propozycja po uwadze Tymka: „wszystko zlewa się w jedno, trudno zebrać myśli”.
 * Żywa planeta (D) zostaje w całości, a zakładki dostają wyraźne granice:
 *  1. Nagłówek zostaje: po przewinięciu nazwa zakładki stoi w pasku obok małej roślinki, a treść chowa się pod wyraźną
 *     krawędzią z cieniem (zamiast rozpływać się w niebie).
 *  2. Każda zakładka to osobny pokój: własny odcień gruntu (js/home2-scene.js, ROOM) i niższa scena poza Domem (css/pokoje.css).
 *  3. Skrytka: pisanie na pełnym ekranie (tylko pole, „Schowaj” i „Puść z wiatrem”), lista myśli osobno. Szkic zostaje po zamknięciu.
 *  4. Trzy poziomy tytułów (strona · rozdział · karta); Tracker w trzech rozdziałach: Ten tydzień · Co zauważyliśmy · Zielnik.
 *  5. Dom pod pierwszym ekranem: trzy wyraźne bloki (Dla Ciebie teraz · Twój tydzień · Myśl na dziś); imię roślinki, kolor,
 *     pełny ekran i „Jak działa roślinka?” w jednym arkuszu „Twoja roślinka”.
 * Logika podlewania, Skrytki i Trackera się nie zmienia: ten plik tylko przestawia gotowe elementy i dokłada nowe wejścia.
 * W React Native: nagłówek = header w (tabs)/_layout, pisanie = osobny ekran modalny (presentation: 'fullScreenModal').
 */
(function () {
  'use strict';

  const html = document.documentElement;
  if (!html.hasAttribute('data-pokoje')) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Sheets = window.Sheets || { show() {}, hide() {} };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z"/><path d="M12 14.5c0-3.2-2.4-5.2-6-5.2 0 3.2 2.4 5.2 6 5.2z"/>',
    palette: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 20.5c-1.5 0-2-1.2-1.4-2.3.7-1.3-.2-2.7-1.7-2.7H8"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  };

  // ================================================================
  //  1. Nazwa zakładki w zwiniętym pasku
  // ================================================================
  const TITLES = { dom: '', skrytka: 'Skrytka', tracker: 'Tracker', testy: 'Testy', blog: 'Blog' };
  const brand = $('.app-top .brand');
  if (brand) brand.insertAdjacentHTML('afterend', '<p class="pk-title" id="pk-title" aria-hidden="true"></p>');
  const title = $('#pk-title');
  const setTitle = tab => { if (title) title.textContent = TITLES[tab] || ''; };
  setTitle(document.body.dataset.tab);
  window.addEventListener('tabchange', e => setTitle(e.detail.tab));

  // ================================================================
  //  3. Skrytka: pisanie na pełnym ekranie
  // ================================================================
  const form = $('#vault-form'), text = $('#vault-text'), skrytka = $('#view-skrytka');
  if (form && text && skrytka) {
    // wejście do pisania: jedyny pełny przycisk na ekranie Skrytki, nad listą myśli
    form.insertAdjacentHTML('beforebegin', `
      <button type="button" class="pk-write" id="pk-write" aria-haspopup="dialog">${svg(ICON.pen)}<span>Napisz myśl</span></button>`);
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'pk-write-title');
    form.insertAdjacentHTML('afterbegin', `
      <header class="pk-write-head">
        <button type="button" class="pk-x" id="pk-write-close" aria-label="Zamknij. Szkic zostanie">${svg(ICON.x)}</button>
        <div class="pk-write-name">
          <h2 id="pk-write-title">Twoja myśl</h2>
          <p>Widzisz ją tylko Ty.</p>
        </div>
        <button type="button" class="sos" data-sos aria-haspopup="dialog">${svg(ICON.heart)}<span>SOS</span></button>
      </header>`);
    // wsparcie przy słowach kryzysowych musi być widać w trakcie pisania
    const alert = $('#vault-alert'), harm = $('#vault-harm');
    if (alert) text.insertAdjacentElement('afterend', alert);
    if (harm) (alert || text).insertAdjacentElement('afterend', harm);   // karta przy słowach o krzywdzie (js/moderacja.js)

    const openBtn = $('#pk-write');
    let writing = false, token = 0;
    // wpis „pisanie” w historii po przeładowaniu strony jest już nieaktualny
    if (history.state && history.state.pk === 'pisanie') history.replaceState(null, '');
    function open() {
      if (writing) { text.focus(); return; }
      writing = true;
      document.body.classList.add('pk-writing');
      token = Date.now();
      history.pushState({ pk: 'pisanie', t: token }, '');   // „wstecz” w telefonie zamyka pisanie, a nie zakładkę
      setTimeout(() => text.focus(), 60);
    }
    function close() {
      if (!writing) return;
      writing = false;
      document.body.classList.remove('pk-writing');
      if (history.state && history.state.t === token) history.back();
      openBtn.focus({ preventScroll: true });
    }
    openBtn.addEventListener('click', open);
    $('#pk-write-close').addEventListener('click', close);
    window.addEventListener('popstate', () => { if (writing) close(); });
    window.addEventListener('tabchange', close);
    form.addEventListener('keydown', e => { if (e.key === 'Escape' && !Sheets.current) { e.preventDefault(); close(); } });
    // po „Schowaj” i „Puść z wiatrem” (js/skrytka.js czyści pole) wracamy do listy; puste pole zostaje otwarte
    const afterSend = () => setTimeout(() => { if (writing && !text.value) close(); }, 0);
    form.addEventListener('submit', afterSend);
    const release = $('#vault-release');
    if (release) release.addEventListener('click', afterSend);
    // „Zapisz myśl” z Domu (js/app.js woła Skrytka.focus) otwiera od razu pisanie
    if (window.Skrytka) window.Skrytka.focus = open;
  }

  // ================================================================
  //  4. Tracker w trzech rozdziałach
  // ================================================================
  const tr = $('#tracker-root');
  if (tr && tr.firstElementChild) {
    const week = $('.week-sum', tr), weekTitle = $('#tr-week-title', tr);
    const subs = $$('.sub-title', tr);
    const find = t => subs.find(h => h.textContent.trim() === t);
    const hNotice = find('Co zauważyliśmy'), hHelps = find('Co Ci pomaga'), hHerb = find('Zielnik');
    const chapter = (id, name, lead) => {
      const s = document.createElement('section');
      s.className = 'pk-chapter';
      s.setAttribute('aria-labelledby', id);
      s.innerHTML = `<h2 class="pk-h2" id="${id}">${name}</h2>${lead ? `<p class="pk-lead">${lead}</p>` : ''}`;
      return s;
    };
    const c1 = chapter('pk-tr-week', 'Ten tydzień');
    const c2 = chapter('pk-tr-notice', 'Co zauważyliśmy', 'Z Twoich podlewań z ostatnich tygodni.');
    const c3 = chapter('pk-tr-herb', 'Zielnik', 'Kwiat za każdy tydzień z 3 podlaniami.');
    const demo = $('.demo-note', tr);
    // rozdział 1: tylko podsumowanie tygodnia (tytuł karty przechodzi do rozdziału)
    if (week) {
      if (weekTitle) weekTitle.remove();
      week.setAttribute('aria-labelledby', 'pk-tr-week');
      c1.append(week);
    }
    // rozdział 2: wnioski + „Co Ci pomaga” jako jedna z kart
    const list = $('.tr-list', tr), helps = $('.helps', tr);
    if (list) c2.append(list);
    if (hHelps && helps) {
      const card = document.createElement('div');
      card.className = 'pk-card pk-helps';
      const note = hHelps.nextElementSibling && hHelps.nextElementSibling.classList.contains('helps-note') ? hHelps.nextElementSibling : null;
      card.innerHTML = '<h3 class="pk-h3">Co Ci pomaga</h3>';
      if (note) card.append(note);
      card.append(helps);
      c2.append(card);
    }
    // rozdział 3: zielnik zwinięty do jednego rzędu, reszta po stuknięciu
    const herb = $('.herbarium', tr);
    if (herb) {
      const n = $$('.herb:not(.is-now)', herb).length;
      herb.id = 'pk-herb-list';
      herb.classList.add('is-folded');
      c3.append(herb);
      if (n > 2) {
        c3.insertAdjacentHTML('beforeend', `<button type="button" class="pk-more" aria-expanded="false" aria-controls="pk-herb-list">Pokaż cały zielnik · ${n}</button>`);
        const more = c3.lastElementChild;
        more.addEventListener('click', () => {
          const on = more.getAttribute('aria-expanded') !== 'true';
          more.setAttribute('aria-expanded', String(on));
          herb.classList.toggle('is-folded', !on);
          more.textContent = on ? 'Zwiń zielnik' : `Pokaż cały zielnik · ${n}`;
        });
      }
    }
    [hNotice, hHelps, hHerb].forEach(h => h && h.remove());
    $$('.helps-note', tr).forEach(p => { if (!p.closest('.pk-card')) p.remove(); });
    tr.prepend(c1, c2, c3);
    if (demo) tr.append(demo);
  }

  // ================================================================
  //  5. Dom: trzy bloki i arkusz „Twoja roślinka”
  // ================================================================
  const secWeek = $('#sec-week'), secQuote = $('#sec-quote'), foot = $('.plant-foot');
  if (secWeek) {
    secWeek.insertAdjacentHTML('beforeend', `<button type="button" class="pk-link" data-go="tracker">Więcej w Trackerze${svg(ICON.chev)}</button>`);
  }
  const how = secWeek && $('.how ul', secWeek);
  if (secQuote && foot) {
    secQuote.insertAdjacentHTML('afterend', `
      <button type="button" class="pk-plant-row" id="pk-plant-open" aria-haspopup="dialog">
        <span class="pk-plant-ico">${svg(ICON.sprout)}</span>
        <span class="pk-plant-txt"><b id="pk-plant-name"></b><small>Kolor, pełny ekran i jak rośnie</small></span>
        ${svg(ICON.chev)}
      </button>`);
    document.body.insertAdjacentHTML('beforeend', `
      <section class="bsheet" id="plant-sheet" role="dialog" aria-modal="true" aria-labelledby="pk-plant-title" hidden>
        <span class="grabber" aria-hidden="true"></span>
        <h2 class="sos-title" id="pk-plant-title"></h2>
        <p class="sos-sub" id="pk-plant-days"></p>
        <div class="pk-sheet-acts">
          <button type="button" class="pk-act" data-pk="color">${svg(ICON.palette)}<span><b>Kolor i tryb nocny</b><small>Razem z roślinką zmieni się cała aplikacja</small></span></button>
          <button type="button" class="pk-act" data-pk="full">${svg(ICON.full)}<span><b>Roślinka na cały ekran</b><small>Tylko ona i niebo</small></span></button>
        </div>
        <p class="sheet-label">Jak działa roślinka?</p>
        <ul class="pk-how">${how ? how.innerHTML : ''}</ul>
        <button type="button" class="sos-close" data-close>Gotowe</button>
      </section>`);
    const sheet = $('#plant-sheet');
    const name = () => ($('#plant-name').textContent || 'Twoja roślinka').trim();
    const paintRow = () => { $('#pk-plant-name').textContent = `Twoja roślinka · ${name()}`; };
    paintRow();
    $('#pk-plant-open').addEventListener('click', () => {
      $('#pk-plant-title').textContent = name();
      const days = ($('#plant-days').textContent || '').split('·')[0].trim();
      $('#pk-plant-days').textContent = days ? `${days[0].toUpperCase()}${days.slice(1)}. Każde podlewanie to nowy listek.` : '';
      Sheets.show(sheet);
    });
    sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-pk]');
      if (!b) return;
      if (b.dataset.pk === 'color') { Sheets.hide(true); $('#color-open').click(); return; }
      Sheets.hide(true);
      window.scrollTo(0, 0);
      $('#plant-zoom').click();
    });
  }
})();
