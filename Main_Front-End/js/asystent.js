/*
 * Asystent Wsparcia — rozmowa z roślinką-towarzyszem (aplikacja.html).
 *
 * Wejścia:
 *   • przycisk-kiełek w rogu (na każdej zakładce) i skrót „Porozmawiaj” na Dom,
 *   • Skrytka: „Zapytaj Asystenta” → zgoda → myśl zwija się w liść, liść leci do kiełka i z liścia wyrasta ekran rozmowy,
 *   • podlewanie: „Porozmawiaj z Asystentem Wsparcia” przy niskim nastroju.
 * Ekran wyrasta kołem z miejsca, z którego go otwarto (jak podlewanie). SOS jest zawsze widoczny.
 * Wiadomości użytkownika sprawdza js/moderacja.js: słowa kryzysowe → od razu 116 111 / 112 / oddech.
 *
 * MAKIETA: odpowiedzi są przykładowe, nic nie jest wysyłane. Myśl ze Skrytki trafia tu tylko po zgodzie.
 * TODO backend: prawdziwy model AI (funkcja po stronie serwera), historia rozmów.
 * window.Asystent: open({ from, zrodlo, tekst, kiedy }), send(el, { tekst, kiedy }), close()
 */
(function () {
  'use strict';

  const { haptic } = window.AuthCommon;
  const Mod = window.Moderacja || { check: () => ({ verdict: 'ok', hits: [] }) };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('widok');
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  // Kiełek (awatar i przycisk): łodyżka + dwa listki w kolorach roślinki
  const SPROUT = `<svg class="as-sprout" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21V12" stroke="var(--plant-stem)" stroke-width="2" stroke-linecap="round"/>
    <path class="lf-l" d="M12 15C7 15 5 12 5 8c4 0 7 2 7 7z" fill="var(--plant-leaf-1)"/>
    <path class="lf-r" d="M12 13c0-5 3-8 7-8 0 4-2 8-7 8z" fill="var(--plant-leaf-2)"/></svg>`;
  // Dymek czatu pod kiełkiem w przycisku (kolor motywu, ogonek w prawo w dół — w stronę rogu ekranu)
  const BUBBLE = `<svg class="as-bubble" viewBox="0 0 56 56" aria-hidden="true">
    <defs><linearGradient id="as-bubble-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color: var(--primary)"/><stop offset="1" style="stop-color: var(--primary-dark)"/></linearGradient></defs>
    <path d="M20 4h16a16 16 0 0 1 16 16v10c0 5-2 9.5-5.5 12l2.5 8.5c.3 1.1-.8 1.9-1.8 1.3l-8.7-6.2c-.8.3-1.6.4-2.5.4H20A16 16 0 0 1 4 30V20A16 16 0 0 1 20 4z" fill="url(#as-bubble-g)"/></svg>`;
  const LEAF ='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" fill="currentColor"/><path d="M5 19L14 10" stroke="var(--surface)" stroke-width="1.4" stroke-linecap="round"/></svg>';

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  // Wypowiedzi Asystenta mają po lewej mały kiełek — odróżniają się od propozycji odpowiedzi (te są po stronie użytkownika)
  const BotRow = inner => `<div class="as-row"><span class="as-mini">${SPROUT}</span>${inner}</div>`;
  const Bubble = (who, text) => {
    const msg = `<div class="as-msg is-${who}">${esc(text)}</div>`;
    return who === 'bot' ? BotRow(msg) : msg;
  };
  const Quote = (text, kiedy) => `<div class="as-quote"><span>${LEAF}Ze Skrytki${kiedy ? ` · ${esc(kiedy)}` : ''}</span><p>${esc(text)}</p></div>`;
  const Quick = list => `<div class="as-quick">${list.map(q => `<button type="button" class="chip" data-q>${esc(q)}</button>`).join('')}</div>`;
  const Typing = () => BotRow('<div class="as-dots" aria-label="Asystent pisze"><i></i><i></i><i></i></div>');
  const Crisis = () => `<section class="ci-alert as-crisis">
      <p class="support-title">Martwię się o Ciebie.</p>
      <p class="support-text">Nie musisz być z tym sam(a). Porozmawiaj teraz z kimś prawdziwym.</p>
      <a class="support-call" href="tel:116111">Zadzwoń: 116 111 <small>całą dobę, za darmo</small></a>
      <a class="support-call" href="tel:112">Zagrożenie życia: 112</a>
      <button type="button" class="btn-ghost" data-breath>Oddychaj z roślinką · 1 min</button>
    </section>`;

  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" class="as-fab" id="as-fab" aria-label="Porozmawiaj z Asystentem">${BUBBLE}${SPROUT}</button>
    <section class="as" id="as" role="dialog" aria-modal="true" aria-labelledby="as-title" hidden>
      <canvas class="as-flow" id="as-flow" aria-hidden="true"></canvas>
      <header class="as-top">
        <button type="button" class="ci-back" data-as-close aria-label="Wróć">${svg('<path d="M15 6l-6 6 6 6"/>')}</button>
        <div class="as-who">
          <span class="as-ava" id="as-ava">${SPROUT}</span>
          <div><b id="as-title">Asystent</b><small id="as-status">Jest tu dla Ciebie</small></div>
        </div>
        <button type="button" class="sos" data-sos aria-haspopup="dialog">${svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')}<span>SOS</span></button>
      </header>
      <div class="as-log" id="as-log" aria-live="polite"></div>
      <form class="as-compose" id="as-form">
        <textarea id="as-input" rows="1" maxlength="1000" placeholder="Napisz, co czujesz…" aria-label="Wiadomość do Asystenta"></textarea>
        <button type="submit" class="icon-btn is-primary" aria-label="Wyślij">${svg('<path d="M5 12h13M13 6l6 6-6 6"/>')}</button>
      </form>
    </section>`);

  const as = document.getElementById('as'), log = document.getElementById('as-log');
  const input = document.getElementById('as-input'), fab = document.getElementById('as-fab');
  const status = document.getElementById('as-status'), ava = document.getElementById('as-ava');
  let lastFocus = null, run = 0;

  // ================================================================
  //  Strumienie kolorów w tle: miękkie, skręcające się wstęgi w barwach roślinki z motywu.
  //  Canvas w niskiej rozdzielczości + rozmycie w CSS. Płyną tylko przy otwartej rozmowie; przy ograniczonym ruchu stoją.
  // ================================================================
  const Flow = (function () {
    const cv = document.getElementById('as-flow'), ctx = cv.getContext('2d');
    const TAU = Math.PI * 2, RES = .3, N = 40;
    // a → b: początek i koniec (ułamki szerokości / wysokości), w: szerokość (ułamek szerokości), c: kolory z tokenów,
    // k: siła, ph: przesunięcie fal (każda wstęga płynie inaczej), sheen: jaśniejszy połysk w środku i jasny brzeg
    const RIBBONS = [
      { a: [-.25, .3],   b: [1.25, .04], w: .3,  c: ['--plant-flower', '--plant-flower-tip'], k: 1,   ph: 0,   sheen: true },
      { a: [-.2, .68],   b: [1.2, .38],  w: .42, c: ['--plant-leaf-1', '--plant-leaf-3'],     k: .9,  ph: 2.1, sheen: true },
      { a: [-.15, 1.04], b: [1.2, .8],   w: .36, c: ['--primary', '--plant-flower'],          k: .75, ph: 4.2, sheen: false },
      { a: [-.25, .5],   b: [1.25, .2],  w: .07, c: ['--plant-core', '--plant-flower-tip'],   k: .85, ph: 5.3, sheen: false },   // cienkie nitki
      { a: [-.2, .86],   b: [1.25, .6],  w: .05, c: ['--plant-leaf-2', '--plant-core'],       k: .75, ph: 1.2, sheen: false },
    ];
    let W = 0, H = 0, pal = [], amp = .3, dark = false, raf = 0, last = 0;

    const parse = v => {
      v = v.trim();
      if (v[0] === '#') { if (v.length === 4) v = '#' + [...v.slice(1)].map(c => c + c).join(''); return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); }
      const m = v.match(/[\d.]+/g);
      return m ? m.slice(0, 3).map(Number) : [128, 160, 160];
    };
    const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, a).toFixed(3)})`;

    function recolor() {
      const s = getComputedStyle(document.documentElement);
      pal = RIBBONS.map(R => R.c.map(n => parse(s.getPropertyValue(n))));
      // pastele na jasnym tle ledwo widać, a na ciemnym świecą — stąd osobna siła dla trybu nocnego
      dark = !!(window.Theme && Theme.isDark());
      amp = dark ? .4 : .8;
    }
    function size() {
      W = Math.max(1, Math.round(cv.clientWidth * RES));
      H = Math.max(1, Math.round(cv.clientHeight * RES));
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
    }

    // Wielokąt wstęgi: oś + połowy szerokości (mnożone przez f — połysk to węższa kopia)
    function shape(axis, f) {
      ctx.beginPath();
      axis.forEach(([x, y, nx, ny, h], j) => ctx[j ? 'lineTo' : 'moveTo'](x + nx * h * f, y + ny * h * f));
      for (let j = axis.length - 1; j >= 0; j--) { const [x, y, nx, ny, h] = axis[j]; ctx.lineTo(x - nx * h * f, y - ny * h * f); }
      ctx.closePath();
    }

    function ribbon(R, [c1, c2], time) {
      const ax = R.a[0] * W, ay = R.a[1] * H, bx = R.b[0] * W, by = R.b[1] * H;
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const axis = [];
      for (let j = 0; j <= N; j++) {
        const t = j / N;
        // dwie fale płynące w przeciwne strony + powolny dryf całej wstęgi
        const off = H * (.07 * Math.sin(TAU * .8 * t + R.ph + time * .23)
                       + .035 * Math.sin(TAU * 1.9 * t - R.ph * 1.3 - time * .31)
                       + .03 * Math.sin(time * .09 + R.ph));
        // zwęża się na końcach i „skręca” jak jedwabna wstęga (przewężenia przesuwają się wzdłuż niej)
        const twist = .12 + .88 * Math.abs(Math.cos(Math.PI * 1.6 * t + R.ph + time * .12));
        axis.push([ax + dx * t + nx * off, ay + dy * t + ny * off, nx, ny, W * R.w * .5 * Math.pow(Math.sin(Math.PI * t), .7) * twist]);
      }
      // kolor przechodzi wzdłuż wstęgi z c1 w c2, a jaśniejsze miejsca płyną od początku do końca
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      for (let s = 0; s <= 8; s++) {
        const u = s / 8, wave = .55 + .45 * Math.sin(TAU * (u * 1.3 - time * .045) + R.ph);
        g.addColorStop(u, rgba(mix(c1, c2, u), amp * R.k * Math.sin(Math.PI * u) * wave));
      }
      ctx.fillStyle = g;
      shape(axis, 1);
      ctx.fill();
      if (R.sheen) {
        const h = ctx.createLinearGradient(ax, ay, bx, by);
        for (let s = 0; s <= 4; s++) { const u = s / 4; h.addColorStop(u, rgba(mix(c2, [255, 255, 255], dark ? .15 : .45),amp * R.k * .5 * Math.sin(Math.PI * u))); }
        ctx.fillStyle = h;
        shape(axis, .3);
        ctx.fill();
        // jasny brzeg z jednej strony — wstęga wygląda jak zagięty jedwab, nie jak plama
        ctx.strokeStyle = h;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        axis.forEach(([x, y, nx, ny, hw], j) => ctx[j ? 'lineTo' : 'moveTo'](x + nx * hw, y + ny * hw));
        ctx.stroke();
      }
    }

    function draw(time) {
      size();
      ctx.clearRect(0, 0, W, H);
      RIBBONS.forEach((R, i) => ribbon(R, pal[i], time));
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;   // ~30 kl./s wystarczy przy tak wolnym ruchu
      last = now;
      draw(now / 1000);
    }

    window.addEventListener('themechange', () => { recolor(); if (!as.hidden && reduceMotion) draw(30); });
    return {
      start() { recolor(); if (reduceMotion) { draw(30); return; } if (!raf) raf = requestAnimationFrame(frame); },
      stop() { cancelAnimationFrame(raf); raf = 0; },
    };
  })();

  const add = html => { log.insertAdjacentHTML('beforeend', html); log.scrollTop = log.scrollHeight; };
  async function say(text, after = '') {
    const my = run;
    as.classList.add('is-typing'); status.textContent = 'Pisze…';
    add(Typing());
    await wait(900 + Math.min(text.length * 12, 1400));
    if (my !== run) return;   // rozmowę zamknięto w trakcie
    log.querySelector('.as-dots')?.closest('.as-row').remove();
    as.classList.remove('is-typing'); status.textContent = 'Jest tu dla Ciebie';
    add(Bubble('bot', text) + after);
  }

  // Pierwsza odpowiedź zależy od tego, skąd przyszła rozmowa (przykładowe teksty)
  const START = {
    skrytka: ['Dziękuję, że mi to pokazujesz. Brzmi, jakby to mocno w Tobie siedziało. Chcesz o tym pogadać?', ['Tak, chcę pogadać', 'Co mogę z tym zrobić?', 'Tylko chciałem(-am) to komuś pokazać']],
    podlewanie: ['Widzę, że dziś było trudniej. Chcesz opowiedzieć, co się wydarzyło? Możesz też po prostu chwilę tu posiedzieć.', ['Opowiem', 'Tylko posiedzę', 'Pomóż mi się uspokoić']],
    dom: ['Cześć! Jestem tu, żeby posłuchać. O czym chcesz dziś pogadać?', ['Mam gorszy dzień', 'Stresuję się szkołą', 'Chcę się czymś pochwalić']],
  };

  // ================================================================
  //  Otwieranie i zamykanie (koło wyrasta z miejsca `from`)
  // ================================================================
  function origin(from) {
    if (from && from.getBoundingClientRect) { const r = from.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
    if (from && 'x' in from) return [from.x, from.y];
    return [innerWidth - 40, innerHeight - 120];
  }

  async function open({ from = fab, zrodlo = 'dom', tekst = '', kiedy = '' } = {}) {
    run++;
    const my = run;
    lastFocus = document.activeElement;
    const [x, y] = origin(from);
    as.style.setProperty('--ox', `${x}px`);
    as.style.setProperty('--oy', `${y}px`);
    log.innerHTML = '<p class="as-note">Asystent to program, nie terapeuta. Gdy jest naprawdę ciężko, zadzwoń pod 116 111.</p>';
    as.hidden = false;
    document.body.classList.add('as-open');
    void as.offsetWidth;
    Flow.start();
    as.classList.add('is-open');
    ava.classList.remove('is-catch'); void ava.offsetWidth; ava.classList.add('is-catch');
    await wait(550);
    if (my !== run) return;
    input.focus({ preventScroll: true });
    if (tekst) add(Quote(tekst, kiedy));
    const [t, q] = START[zrodlo] || START.dom;
    say(t, Quick(q));
  }

  function close() {
    if (as.hidden) return;
    run++;
    as.classList.remove('is-open');
    document.body.classList.remove('as-open');
    setTimeout(() => { if (!as.classList.contains('is-open')) { as.hidden = true; Flow.stop(); } }, reduceMotion ? 0 : 700);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // ================================================================
  //  Przekazanie ze Skrytki: element zwija się w liść, liść leci do kiełka, z liścia wyrasta rozmowa
  // ================================================================
  async function send(el, { tekst, kiedy = '' }) {
    const r = el.getBoundingClientRect(), f = fab.getBoundingClientRect();
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    const tx = f.left + f.width / 2, ty = f.top + f.height / 2;
    haptic([6, 50, 6]);
    if (reduceMotion) return open({ from: fab, zrodlo: 'skrytka', tekst, kiedy });

    el.classList.add('is-folding');
    await wait(380);
    const leaf = document.createElement('div');
    leaf.className = 'as-leaf';
    leaf.innerHTML = LEAF;
    document.body.appendChild(leaf);
    // łuk Béziera przez punkt nad trasą; liść kręci się jak na wietrze i maleje przy kiełku
    const cx = (sx + tx) / 2 - 60, cy = Math.min(sy, ty) - 120, frames = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      const x = u * u * sx + 2 * u * t * cx + t * t * tx, y = u * u * sy + 2 * u * t * cy + t * t * ty;
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${-20 + 380 * t}deg) scale(${1.4 - .6 * t})` });
    }
    await leaf.animate(frames, { duration: 1150, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).finished;
    // kiełek łapie liść, a z liścia rozchodzi się fala i wyrasta ekran rozmowy
    fab.classList.remove('is-catch'); void fab.offsetWidth; fab.classList.add('is-catch');
    leaf.classList.add('is-burst');
    setTimeout(() => leaf.remove(), 700);
    setTimeout(() => el.classList.remove('is-folding'), 900);
    await wait(180);
    open({ from: { x: tx, y: ty }, zrodlo: 'skrytka', tekst, kiedy });
  }

  // ================================================================
  //  Rozmowa
  // ================================================================
  function userSays(text) {
    add(Bubble('me', text));
    if (Mod.check(text).verdict === 'kryzys') {
      say('Dobrze, że to napisałeś(-aś). To, co czujesz, jest ważne i nie musisz z tym zostawać sam(a).', Crisis());
    } else {
      say('Rozumiem. Opowiedz mi o tym trochę więcej, jeśli chcesz. Nie spiesz się.');
    }
  }

  document.getElementById('as-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    input.value = '';
    input.style.height = '';
    userSays(v);
  });
  // Enter wysyła, Shift+Enter to nowa linia; pole rośnie z tekstem
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('as-form').requestSubmit(); }
  });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; });

  log.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (!q) return;
    q.parentElement.remove();
    userSays(q.textContent);
  });
  as.addEventListener('click', e => { if (e.target.closest('[data-as-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !as.hidden && !document.querySelector('.sheet.is-open')) close();
  });
  fab.addEventListener('click', () => open({ from: fab, zrodlo: 'dom' }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-asystent]');
    if (b) open({ from: b, zrodlo: b.dataset.asystent || 'dom' });
  });

  window.Asystent = { open, send, close };
})();
