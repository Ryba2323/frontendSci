/*
 * Samouczek po rejestracji — krótkie „relacje” o tym, jak działa aplikacja (aplikacja.html). Style: css/samouczek.css.
 *
 * Kiedy: rejestracja zostawia w localStorage sci.samouczek = 'nowy'. Przy pierwszym wejściu na stronę główną
 * relacje otwierają się same — wyrastają kołem z kółka z kolorem roślinki (jak „awatar” z relacją).
 * Po zamknięciu: sci.samouczek = 'obejrzany'. ?samouczek w adresie otwiera je zawsze (podgląd dla zespołu).
 *
 * Sterowanie jak w relacjach: stuknięcie z prawej = dalej, z lewej = wstecz, przytrzymanie = pauza,
 * strzałki / Esc na klawiaturze. Każda relacja trwa ok. 6,5 s. Przy prefers-reduced-motion bez animacji
 * i bez samoczynnego przewijania (tylko stuknięcia). SOS jest w nagłówku cały czas.
 *
 * window.Samouczek: open(), close()
 */
(function () {
  'use strict';

  const KEY = 'sci.samouczek';
  const DUR = 6500;
  const params = new URLSearchParams(location.search);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('widok');
  const Scene = window.Home2Scene || { select() {} };
  const $ = (s, r = document) => r.querySelector(s);
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    up: '<path d="M12 5l7 8h-4.5v6h-5v-6H5z"/>',
    down: '<path d="M12 19l-7-8h4.5V5h5v6H19z"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
    phone: '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>',
  };

  function account() {
    try { return JSON.parse(localStorage.getItem('sci.account')) || {}; } catch (_) { return {}; }
  }
  const plantName = () => account().plant || '';

  // ================================================================
  //  Relacje: tekst + mała „żywa” ilustracja (dane)
  // ================================================================
  const STORIES = [
    {
      id: 'roslinka', plant: true, kicker: 'Twoja roślinka',
      title: () => (plantName() ? `To jest ${plantName()}` : 'To Twoja roślinka'),
      text: 'Rośnie razem z Tobą, dzień po dniu. Nigdy nie więdnie — nawet gdy zrobisz sobie przerwę.',
    },
    {
      id: 'podlewanie', kicker: 'Codzienne podlewanie', title: () => 'Jak się dziś czujesz?',
      text: 'Raz dziennie kilka krótkich pytań o Twój dzień. Każda odpowiedź to kropla dla roślinki, a każde pytanie możesz pominąć.',
      html: () => `
        <div class="st-demo st-water">
          <div class="card st-q">
            <p class="kicker">Pytanie 1 z 4</p>
            <p class="st-q-title">Jak się dziś czujesz?</p>
            <div class="meter"><span class="meter-fill"></span></div>
            <p class="st-q-val"><span>1</span><b class="st-q-word"></b><span>10</span></p>
          </div>
          <div class="water-btn" aria-hidden="true">
            <span class="drop"><svg viewBox="0 0 24 24"><path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z"/></svg></span>
            <span class="water-label">Podlej roślinkę</span>
          </div>
        </div>`,
      run(el, later) {
        const card = $('.st-q', el), btn = $('.water-btn', el), fill = $('.meter-fill', el), word = $('.st-q-word', el);
        card.style.opacity = '0';
        later(700, () => { btn.classList.add('is-pouring'); btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 300 }); });
        later(1000, () => {
          card.style.opacity = '';
          card.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        });
        later(1700, () => {
          fill.animate([{ width: '0%' }, { width: '70%' }], { duration: 1300, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
        });
        later(2700, () => { word.textContent = '7 · całkiem dobrze'; word.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); });
      },
    },
    {
      id: 'liscie', plant: true, kicker: 'Twój tydzień', title: () => 'Każdy liść to jeden dzień',
      text: 'Im lepszy dzień, tym większy liść. Dzień bez podlania zostawia mały, uśpiony pąk — nic nie przepada.',
      run(el, later) {
        // prawdziwa roślinka: po kolei podświetlają się liście dni (dzień i wynik w dymku)
        [4, 2, 5, 3].forEach((d, i) => later(500 + i * 1300, () => Scene.select(d)));
      },
      leave() { Scene.select(-1); },
    },
    {
      id: 'skrytka', kicker: 'Skrytka', title: () => 'Miejsce na Twoje myśli',
      text: 'Widzisz je tylko Ty. Schowaj myśl na później albo puść ją z wiatrem.',
      html: () => `
        <div class="st-demo st-vault">
          <div class="card vault-compose">
            <div class="st-vault-text"></div>
            <div class="vault-bar">
              <span class="quiet-btn">${svg(ICON.leaf)}Puść z wiatrem</span>
              <span class="btn-primary is-small">${svg(ICON.lock)}Schowaj</span>
            </div>
          </div>
          <div class="st-leaf">${svg(ICON.leaf)}<span></span></div>
        </div>`,
      run(el, later) {
        const box = $('.st-vault-text', el), rel = $('.quiet-btn', el), leaf = $('.st-leaf', el);
        const text = 'Dziś w szkole było trochę za dużo. Chcę to po prostu z siebie wyrzucić.';
        let n = 0;
        const type = () => { box.textContent = text.slice(0, ++n); if (n < text.length) later(32, type); };
        later(350, type);
        later(3000, () => rel.classList.add('is-pressed'));
        later(3250, () => {
          leaf.querySelector('span').textContent = text;
          box.textContent = '';
          rel.classList.remove('is-pressed');
          leaf.classList.add('is-flying');
        });
      },
    },
    {
      id: 'tracker', kicker: 'Tracker', title: () => 'Zobacz, co Ci pomaga',
      text: 'Krótkie podsumowanie tygodnia i podpowiedzi z Twoich wpisów. To wskazówki, nie diagnoza.',
      html: () => {
        const days = [['P', 6], ['W', 5], ['Ś', null], ['C', 7], ['P', 8], ['S', 9], ['dziś', 7]];
        const strip = days.map(([l, v], i) => `<span class="sum-day${i === 6 ? ' is-today' : ''}${v == null ? ' is-rest' : ''}" style="--v:${v == null ? .12 : v / 9};--d:${i}"><i></i><small>${l}</small></span>`).join('');
        return `
          <div class="st-demo st-track">
            <section class="card week-sum">
              <p class="kicker">Twój tydzień w skrócie</p>
              <div class="sum-strip" aria-hidden="true">${strip}</div>
              <p class="sum-head"><b>7,0</b><span>/10 · o 0,6 lepiej niż tydzień wcześniej</span></p>
              <p class="sum-sub">Najlepszy dzień: sobota · pomogło: przyjaciele</p>
            </section>
          </div>`;
      },
      run(el) { $('.st-track', el).classList.add('is-run'); },
      leave(el) { $('.st-track', el).classList.remove('is-run'); },
    },
    {
      id: 'blog', kicker: 'Blog', title: () => 'Anonimowo i życzliwie',
      text: 'Czytaj i pisz pod roślinkowym pseudonimem — bez imienia i zdjęcia. Możesz też tylko czytać.',
      html: () => {
        const post = (i, av, nick, ago, title, body, votes, com) => `
          <li class="post" style="--i:${i}">
            <div class="post-open">
              <span class="post-meta"><span class="dot" style="--av: var(${av})"></span>${nick} · ${ago}</span>
              <span class="post-title">${title}</span>
              <span class="post-body">${body}</span>
            </div>
            <div class="post-actions">
              <span class="vote"><button type="button" tabindex="-1">${svg(ICON.up)}</button><b>${votes}</b><button type="button" tabindex="-1">${svg(ICON.down)}</button></span>
              <span class="post-count">${svg(ICON.chat)}<span>${com}</span></span>
            </div>
          </li>`;
        return `<ul class="st-demo st-blog">
          ${post(0, '--plant-leaf-1', 'Cicha Paproć', '2 godz.', 'Co Wam pomaga przed sprawdzianem?', 'Mnie spacer z psem i lista rzeczy, które już umiem. A Wam?', 24, 9)}
          ${post(1, '--plant-flower', 'Senna Lawenda', 'wczoraj', 'Mały sukces: odezwałam się pierwsza', 'Po długiej przerwie napisałam do przyjaciółki. Było łatwiej, niż myślałam.', 41, 12)}
        </ul>`;
      },
      run(el, later) {
        const ul = $('.st-blog', el);
        ul.classList.add('is-run');
        later(2300, () => {
          const v = el.querySelectorAll('.vote')[1], b = v.querySelector('b');
          v.classList.add('is-up'); v.querySelector('button').setAttribute('aria-pressed', 'true');
          b.textContent = '42'; b.classList.add('is-bump');
        });
      },
      leave(el) {
        $('.st-blog', el).classList.remove('is-run');
        const v = el.querySelectorAll('.vote')[1];
        v.classList.remove('is-up'); v.querySelector('button').removeAttribute('aria-pressed');
        v.querySelector('b').textContent = '41'; v.querySelector('b').classList.remove('is-bump');
      },
    },
    {
      id: 'sos', kicker: 'Gdy jest trudno', title: () => 'Pomoc jest zawsze pod ręką',
      text: 'Przycisk SOS jest u góry ekranu: minuta oddechu z roślinką i telefon zaufania 116 111 — bezpłatnie, całą dobę.',
      html: () => `
        <div class="st-demo st-sos-demo">
          <div class="breath" aria-hidden="true"><div class="breath-flower">${Array.from({ length: 6 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}<b></b></div></div>
          <div class="sos-item is-main"><span class="sos-ico">${svg(ICON.phone)}</span><span><b>Zadzwoń: 116 111</b><small>Telefon zaufania dla dzieci i młodzieży — bezpłatnie, całą dobę</small></span></div>
        </div>`,
      run(el, later) {
        const f = $('.breath-flower', el);
        // wdech 2,4 s → wydech 2,4 s (jak w „Oddychaj z roślinką”, tylko krócej)
        const cycle = k => { f.classList.toggle('is-open', k % 2 === 0); later(2400, () => cycle(k + 1)); };
        later(150, () => cycle(0));
      },
      leave(el) { $('.breath-flower', el).classList.remove('is-open'); },
    },
    {
      id: 'start', plant: true, kicker: 'Gotowe', title: () => 'Zaczynamy?',
      text: () => `Pierwsze podlewanie czeka na stronie głównej. ${plantName() || 'Twoja roślinka'} już się cieszy.`,
      cta: true,
    },
  ];

  // ================================================================
  //  Budowa
  // ================================================================
  let root, bars, sheet, visuals, idx = -1, built = false;
  let elapsed = 0, lastT = 0, paused = false, held = false, raf = 0, open_ = false;
  let timers = [];
  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const clearLater = () => { timers.forEach(clearTimeout); timers = []; };

  function build() {
    if (built) return;
    built = true;
    root = document.createElement('section');
    root.className = 'stories';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Jak działa aplikacja');
    root.tabIndex = -1;
    root.innerHTML = `
      <div class="st-bg"></div>
      <div class="st-visuals">${STORIES.map(s => `<div class="st-vis" data-id="${s.id}">${s.html ? s.html() : ''}${s.plant ? `<p class="st-look">${svg(ICON.left)}Twoja roślinka jest po lewej</p>` : ''}</div>`).join('')}</div>
      <button type="button" class="st-tap st-prev" aria-label="Poprzednia"></button>
      <button type="button" class="st-tap st-next" aria-label="Następna"></button>
      <header class="st-top">
        <div class="st-bars" aria-hidden="true">${STORIES.map(() => '<span><i></i></span>').join('')}</div>
        <div class="st-head">
          <span class="st-ava" aria-hidden="true"><span><span class="color-dot"></span></span></span>
          <span class="st-who"><b class="st-name"></b><small class="st-count"></small></span>
          <button type="button" class="sos st-sos" aria-haspopup="dialog">${svg(ICON.heart)}<span>SOS</span></button>
          <button type="button" class="st-close" aria-label="Zamknij samouczek">${svg(ICON.close)}</button>
        </div>
      </header>
      <div class="st-sheet">
        <div class="st-text" aria-live="polite"></div>
        <p class="st-hint" aria-hidden="true">Stuknij, żeby przejść dalej${svg(ICON.next)}</p>
        <div class="st-cta" hidden>
          <button type="button" class="btn-primary st-go">Zaczynamy${svg(ICON.arrow)}</button>
          <button type="button" class="st-again">Obejrzyj jeszcze raz</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    bars = [...root.querySelectorAll('.st-bars span')];
    sheet = $('.st-sheet', root);
    visuals = [...root.querySelectorAll('.st-vis')];

    // stuknięcie / przytrzymanie
    let downAt = 0, holdTimer;
    const onDown = () => { downAt = performance.now(); holdTimer = setTimeout(() => { held = true; root.classList.add('is-held'); }, 220); };
    const onUp = dir => e => {
      e.preventDefault();
      clearTimeout(holdTimer);
      if (held) { held = false; root.classList.remove('is-held'); lastT = performance.now(); return; }
      go(idx + dir);
    };
    for (const [sel, dir] of [['.st-prev', -1], ['.st-next', 1]]) {
      const b = $(sel, root);
      b.addEventListener('pointerdown', onDown);
      b.addEventListener('click', onUp(dir));
    }
    $('.st-close', root).addEventListener('click', () => close());
    $('.st-go', root).addEventListener('click', () => close());
    $('.st-again', root).addEventListener('click', () => go(0));
    // SOS: samouczek ustępuje arkuszowi pomocy
    $('.st-sos', root).addEventListener('click', e => {
      e.stopPropagation();
      close();
      const sos = document.getElementById('sos-open');
      if (sos) setTimeout(() => sos.click(), reduceMotion ? 0 : 300);
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
    });
  }

  function show(i) {
    const prev = STORIES[idx];
    if (prev && prev.leave) prev.leave(visuals[idx]);
    clearLater();
    idx = i;
    const s = STORIES[i];
    bars.forEach((b, k) => { b.classList.toggle('is-done', k < i); b.querySelector('i').style.transform = k < i ? 'scaleX(1)' : 'scaleX(0)'; });
    visuals.forEach((v, k) => v.classList.toggle('is-active', k === i));
    root.classList.toggle('is-plant', !!s.plant);
    $('.st-name', root).textContent = plantName() || 'Twoja roślinka';
    $('.st-count', root).textContent = `Jak to działa · ${i + 1} z ${STORIES.length}`;
    const text = typeof s.text === 'function' ? s.text() : s.text;
    $('.st-text', root).innerHTML = `<p class="kicker">${s.kicker}</p><h2>${s.title()}</h2><p class="lead">${text}</p>`;
    $('.st-cta', root).hidden = !s.cta;
    $('.st-hint', root).hidden = !!s.cta || i > 1;
    elapsed = 0;
    lastT = performance.now();
    if (s.run && !reduceMotion) s.run(visuals[i], later);
  }

  function go(i) {
    if (i < 0) i = 0;
    if (i >= STORIES.length) { close(); return; }
    show(i);
  }

  // pasek postępu i samoczynne przewijanie (pauza przy przytrzymaniu)
  function tick(now) {
    if (!open_) return;
    const dt = now - lastT;
    lastT = now;
    const s = STORIES[idx];
    if (!held && !paused && !reduceMotion && !s.cta) {
      elapsed += dt;
      const p = Math.min(1, elapsed / DUR);
      bars[idx].querySelector('i').style.transform = `scaleX(${p.toFixed(4)})`;
      if (p >= 1) go(idx + 1);
    } else if (s.cta) bars[idx].querySelector('i').style.transform = 'scaleX(1)';
    raf = requestAnimationFrame(tick);
  }

  // ================================================================
  //  Otwieranie i zamykanie (koło z kółka koloru roślinki)
  // ================================================================
  function origin() {
    const b = document.getElementById('color-open');
    const r = b ? b.getBoundingClientRect() : { left: window.innerWidth - 60, top: 20, width: 40, height: 40 };
    const box = root.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left, y = r.top + r.height / 2 - box.top;
    root.style.setProperty('--ox', x + 'px');
    root.style.setProperty('--oy', y + 'px');
    root.style.setProperty('--or', Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y)) + 2 + 'px');
  }

  function open() {
    build();
    if (open_) return;
    open_ = true;
    document.body.classList.add('st-open');
    root.hidden = false;
    root.classList.remove('is-closing');
    origin();
    show(0);
    void root.offsetWidth;
    root.classList.add('is-open');
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
    root.focus({ preventScroll: true });                  // strzałki i Esc działają od razu
  }

  function close() {
    if (!open_) return;
    open_ = false;
    cancelAnimationFrame(raf);
    const s = STORIES[idx];
    if (s && s.leave) s.leave(visuals[idx]);
    clearLater();
    try { localStorage.setItem(KEY, 'obejrzany'); } catch (_) { /* tryb prywatny */ }
    origin();
    root.classList.add('is-closing');
    root.classList.remove('is-open');
    document.body.classList.remove('st-open');
    setTimeout(() => { root.hidden = true; idx = -1; }, reduceMotion ? 0 : 520);
    const water = document.getElementById('water-btn');
    if (water) water.focus({ preventScroll: true });
  }

  // Pierwsze wejście po rejestracji (albo ?samouczek)
  let pending = params.has('samouczek');
  try { pending = pending || localStorage.getItem(KEY) === 'nowy'; } catch (_) { /* tryb prywatny */ }
  if (pending) setTimeout(open, reduceMotion ? 0 : 900);

  window.Samouczek = { open, close };
})();
