/*
 * Tło strony głównej: gałąź z liśćmi (canvas 2D, przypięty do ekranu, rysowany z przesunięciem o scroll).
 *
 * Gałąź wchodzi od góry i rośnie w dół razem z przewijaniem: po drodze wypuszcza odnogi i liście,
 * dochodzi do kart-liści (podlewanie, bilans) i kończy się kwiatem, który rozkwita na dole strony.
 * Kształt liczony jest z położenia kart w dokumencie, więc pasuje do telefonu, tabletu i komputera.
 * Na komputerze gałąź biegnie obok kolumny, a odnogi (i druga gałąź z prawej) wypełniają boki.
 *
 * Kolory z motywu (css/tokens.css, --plant-*), płynne przejście po zdarzeniu 'themechange'.
 *
 * API (window.HomeScene):
 *   start()        pierwsze ułożenie (po wypełnieniu treści przez js/home.js)
 *   relayout()     przeliczenie po zmianie rozmiaru/treści
 *   water(x, y)    efekt podlewania z punktu na ekranie (środek przycisku)
 */
(function () {
  'use strict';

  const canvas = document.getElementById('bg');
  const openAll = () => document.querySelectorAll('[data-branch-leaf], .bloom').forEach(e => e.classList.add('is-open'));
  if (!canvas || !canvas.getContext) { window.HomeScene = { start: openAll, relayout() {}, water() {} }; return; }
  const ctx = canvas.getContext('2d');
  // Druga, przezroczysta warstwa NAD treścią: krople i iskierki z podlewania (przycisk leży na liściu-karcie)
  const fxCanvas = document.createElement('canvas');
  fxCanvas.id = 'fx';
  fxCanvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fxCanvas);
  const fx = fxCanvas.getContext('2d');

  // ?widok=… w adresie (podgląd dla zespołu, zrzuty ekranu) działa jak ograniczony ruch: wszystko od razu wyrośnięte
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('widok');
  const motion = reduceMotion ? 0 : 1;
  const TAU = Math.PI * 2;

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const flipScale = phi => { const c = Math.cos(phi); return (c < 0 ? -1 : 1) * Math.max(.14, Math.abs(c)); };
  // Stałe „losowanie” — po przeliczeniu liście zostają w tych samych miejscach
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ================================================================
  //  Kolory z motywu
  // ================================================================
  const hex = h => {
    h = (h || '').trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h, 16) || 0x888888;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const WHITE = [255, 255, 255], INK = [20, 34, 40];
  const tint = (c, t) => mixC(c, WHITE, t);
  const shade = (c, t) => mixC(c, INK, t);
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => hex(cs.getPropertyValue(name));
    const stem = v('--plant-stem'), l1 = v('--plant-leaf-1'), l2 = v('--plant-leaf-2'), l3 = v('--plant-leaf-3');
    const flower = v('--plant-flower'), tip = v('--plant-flower-tip');
    const deep = (c, t) => mixC(c, stem, t);
    return {
      bark: [shade(stem, .2), mixC(stem, l1, .12), tint(stem, .35)],   // cień, kora, połysk
      leaves: [
        [l1, deep(l1, .35)], [l2, deep(l2, .3)], [l3, deep(l3, .35)],
        [tint(l2, .2), deep(l2, .12)], [deep(l1, .18), deep(l1, .5)], [tint(l1, .3), tint(l1, .05)],
      ],
      flower, tip, core: v('--plant-core'), petal: mixC(flower, tip, .35),
      glow: v('--plant-glow'), halo: l2,
      water: mixC(v('--accent-light'), WHITE, .2),
      bokeh: [v('--mist'), v('--mint'), v('--accent-light'), flower],
    };
  }
  const lerpDeep = (a, b, t) => typeof a[0] === 'number' ? mixC(a, b, t) : a.map((x, i) => lerpDeep(x, b[i], t));
  function lerpPalette(a, b, t) { const o = {}; for (const k in a) o[k] = lerpDeep(a[k], b[k], t); return o; }

  let pal = readPalette(), palFrom = pal, palTo = pal, palT = 1;
  let C = {};
  function bake() {
    C = {
      bark: pal.bark.map(c => rgba(c)),
      leaves: pal.leaves.map(([a, b]) => [rgba(a), rgba(b)]),
      flower: rgba(pal.flower), tip: rgba(pal.tip), core: rgba(pal.core), petal: rgba(pal.petal),
      water: rgba(pal.water),
    };
  }

  // Sprite'y: świetlik i miękkie plamy światła (bokeh)
  const fireflySprite = document.createElement('canvas');
  fireflySprite.width = fireflySprite.height = 64;
  {
    const g = fireflySprite.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,230,1)');
    gr.addColorStop(.1, 'rgba(255,216,135,1)');
    gr.addColorStop(.24, 'rgba(246,184,106,.6)');
    gr.addColorStop(.55, 'rgba(246,184,106,.16)');
    gr.addColorStop(1, 'rgba(246,184,106,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const bokehSprites = [0, 1, 2, 3].map(() => { const c = document.createElement('canvas'); c.width = c.height = 128; return c; });
  function paintBokeh() {
    bokehSprites.forEach((c, i) => {
      const g = c.getContext('2d'), col = pal.bokeh[i];
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(col, 1));
      gr.addColorStop(.55, rgba(col, .45));
      gr.addColorStop(1, rgba(col, 0));
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
  }

  // ================================================================
  //  Stan
  // ================================================================
  let W = 0, H = 0, scrollY = 0, clock = 0, lastMs = performance.now();
  let wind = 0;
  let geo = null;
  let started = false;
  // Do jakiej wysokości dokumentu roślina już urosła (sprężyna goni dół ekranu)
  const grow = { y: -160, v: 0, target: -160 };
  const pointer = { x: 0, y: 0, active: false };
  const particles = [], rings = [], petals = [], sparks = [];
  let pulse = null, flareAt = -10;
  const sprouts = [];           // listki dodane przez podlewanie (pozycja jako długość wzdłuż gałęzi)

  // Tło: miękkie plamy światła i kilka listków spadających w oddali (warstwa ekranu, lekka paralaksa)
  const bokeh = Array.from({ length: 7 }, (_, i) => ({
    nx: rand(0, 1), ny: rand(0, 1), r: rand(70, 170), spr: i % 4,
    a: i % 4 === 3 ? rand(.1, .16) : rand(.18, .3), f: rand(.03, .07), ph: rand(0, TAU),
  }));
  const floaters = Array.from({ length: 9 }, () => ({
    nx: rand(0, 1), ny: rand(0, 1), len: rand(10, 17), ci: Math.floor(rand(0, 6)),
    f: rand(.15, .3), ph: rand(0, TAU), fall: rand(5, 11), rot: rand(0, TAU), spin: rand(-.35, .35), al: rand(.25, .42),
  }));

  // ================================================================
  //  Geometria (współrzędne dokumentu)
  // ================================================================
  function sampleSpline(P, k = .95) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k];
      const n = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5));
      for (let s = i ? 1 : 0; s <= n; s++) {
        const t = s / n, u = 1 - t;
        out.push([
          u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
          u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
        ]);
      }
    }
    return out;
  }
  // Gałąź: próbki + długość narastająca + grubość (grubsza u góry, cieńsza na końcu)
  function makeBranch(P, w0, w1) {
    const S = sampleSpline(P);
    const L = [0];
    for (let i = 1; i < S.length; i++) L.push(L[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    const tot = L[L.length - 1] || 1;
    const Wd = L.map(l => lerp(w0, w1, Math.pow(l / tot, .85)));
    return { S, L, Wd, tot };
  }
  const nearestIdx = (B, y, filter) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < B.S.length; i++) {
      if (filter && !filter(B.S[i])) continue;
      const d = Math.abs(B.S[i][1] - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const upAngle = (B, i) => {
    const a = B.S[Math.max(0, i - 2)], b = B.S[Math.min(B.S.length - 1, i + 2)];
    return Math.atan2(a[1] - b[1], a[0] - b[0]); // kierunek „pod prąd” gałęzi, czyli w górę
  };

  // Odnoga: krzywa od punktu na gałęzi, z liśćmi po drodze i na końcu
  function makeTwig(B, i, ang, len, rnd, leafLen) {
    const [x0, y0] = B.S[i];
    const bend = (rnd() - .5) * .9;
    const x2 = x0 + Math.cos(ang) * len, y2 = y0 + Math.sin(ang) * len;
    const cx = x0 + Math.cos(ang + bend) * len * .55, cy = y0 + Math.sin(ang + bend) * len * .55;
    const pts = [];
    const n = Math.max(6, Math.ceil(len / 6));
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2]);
    }
    const w0 = B.Wd[i] * .42;
    const leaves = [];
    const count = Math.max(1, Math.round(len / 34));
    for (let k = 1; k <= count; k++) {
      const f = k / (count + .6);
      const p = pts[Math.round(f * n)], q = pts[Math.min(n, Math.round(f * n) + 1)];
      const dir = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const side = k % 2 ? 1 : -1;
      leaves.push({ f, x: p[0], y: p[1], ang: dir + side * (.75 + rnd() * .35), len: leafLen * (.75 + rnd() * .35), ci: Math.floor(rnd() * 6), ph: rnd() * TAU, wr: .36 + rnd() * .06 });
    }
    const tp = pts[n], tq = pts[n - 1];
    leaves.push({ f: 1, x: tp[0], y: tp[1], ang: Math.atan2(tp[1] - tq[1], tp[0] - tq[0]), len: leafLen * (.95 + rnd() * .3), ci: Math.floor(rnd() * 6), ph: rnd() * TAU, wr: .38 });
    return { pts, w0, baseY: y0, shownAt: null, leaves };
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = fxCanvas.width = Math.round(W * dpr);
    canvas.height = fxCanvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pozycje z układu (offset*), a nie z getBoundingClientRect — karty przed rozwinięciem są pomniejszone transformacją
    const docRect = node => {
      let x = 0, y = 0;
      for (let n = node; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      return { x, y, w: node.offsetWidth, h: node.offsetHeight };
    };
    const cardEls = [...document.querySelectorAll('[data-branch-leaf]')];
    if (!cardEls.length) return;
    const cards = cardEls.map(el => ({ el, r: docRect(el) }));
    const greet = docRect(document.getElementById('greet'));
    const fa = docRect(document.getElementById('flower-anchor'));
    const bloomEl = document.querySelector('.bloom');
    const docH = document.documentElement.scrollHeight;

    const wide = W >= 1024;
    const rnd = seeded(23);
    const colLeft = cards[0].r.x, colRight = cards[0].r.x + cards[0].r.w;
    const stripX = colLeft - Math.min(wide ? 44 : 30, colLeft * .5);
    const wTop = clamp(W * .05, 16, 28);
    const leafLen = wide ? 34 : 24;

    // ---------- główna gałąź ----------
    const P = [[wide ? stripX - 140 : -34, -70], [stripX + 4, greet.y + greet.h * .35]];
    const apexes = [];
    cards.forEach((c, i) => {
      P.push([stripX - 3, c.r.y + c.r.h * .2]);
      P.push([stripX + 5, c.r.y + c.r.h * .64]);
      const nextTop = i < cards.length - 1 ? cards[i + 1].r.y : fa.y - 40;
      const gy = (c.r.y + c.r.h + nextTop) / 2;
      if (i < cards.length - 1) {
        // w przerwie między liśćmi gałąź „rozchodzi się”: wychyla się w wolne miejsce
        const ax = wide ? stripX - Math.min(170, stripX * .5) : W * .42;
        P.push([ax, gy]);
        apexes.push(P.length - 1);
      }
    });
    const last = cards[cards.length - 1].r;
    P.push([lerp(stripX, fa.x, .35), lerp(last.y + last.h, fa.y, .45)]);
    P.push([fa.x, fa.y]);
    const main = makeBranch(P, wTop, wTop * .34);

    const blocks = cards.map(c => ({ x1: c.r.x - 2, y1: c.r.y - 2, x2: c.r.x + c.r.w + 2, y2: c.r.y + c.r.h + 2 }));
    const hidden = (x, y) => blocks.some(b => x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2);

    // ---------- ogonki do kart ----------
    const petioles = cards.map(c => {
      const base = [c.r.x + 4, c.r.y + c.r.h * .52];
      const i = nearestIdx(main, base[1] + 16, p => p[0] < base[0] - 6);
      const [x0, y0] = main.S[i];
      return { el: c.el, i, x0, y0, base, w0: main.Wd[i] * .55, baseY: y0, open: c.el.classList.contains('is-open') };
    });

    // ---------- odnogi ----------
    const twigs = [];
    const twigAt = (B, i, ang, len) => twigs.push(makeTwig(B, i, ang, len, rnd, leafLen));
    // w wychyleniach między kartami
    apexes.forEach(pi => {
      const [ax, ay] = P[pi];
      const i = nearestIdx(main, ay);
      if (wide) twigAt(main, i, Math.PI + .35, Math.min(ax - 30, 230));
      else twigAt(main, i, -.1, Math.min(W - ax - 26, 130));
    });
    // co kawałek na zewnątrz (w lewo): na telefonie krótkie, na komputerze długie
    for (let l = 160; l < main.tot - 140; l += wide ? 190 : 230) {
      const i = main.L.findIndex(v => v >= l);
      const [x, y] = main.S[i];
      if (hidden(x, y) || petioles.some(p => Math.abs(p.y0 - y) < 40)) continue;
      const len = wide ? 90 + rnd() * (Math.min(210, x - 20) - 90) : 34 + rnd() * 14;
      if (len > 20) twigAt(main, i, Math.PI + (rnd() - .5) * .9 - .35, len);
    }

    // ---------- liście prosto na gałęzi ----------
    const leaves = [];
    let side = 1;
    for (let l = 50; l < main.tot - 30; l += (wide ? 58 : 64) + rnd() * 26) {
      const i = main.L.findIndex(v => v >= l);
      const [x, y] = main.S[i];
      if (hidden(x, y) || petioles.some(p => Math.hypot(p.x0 - x, p.y0 - y) < 24)) continue;
      leaves.push({ x, y, ang: upAngle(main, i) + side * (.9 + rnd() * .4), len: leafLen * (.7 + rnd() * .4), ci: Math.floor(rnd() * 6), ph: rnd() * TAU, wr: .36 + rnd() * .06, baseY: y, shownAt: null });
      side = -side;
    }
    // listki z podlewania
    sprouts.forEach(sp => {
      const i = main.L.findIndex(v => v >= sp.l);
      if (i < 0) return;
      const [x, y] = main.S[i];
      leaves.push({ x, y, ang: upAngle(main, i) + sp.side * 1.05, len: leafLen * 1.05, ci: sp.ci, ph: sp.ph, wr: .38, baseY: y, shownAt: sp.shownAt, sprout: true });
    });

    // ---------- druga gałąź z prawej (tylko szerokie ekrany) ----------
    let second = null;
    if (wide && W - colRight > 180) {
      const gut = W - colRight;
      const midY = cards[Math.min(1, cards.length - 1)].r.y + cards[Math.min(1, cards.length - 1)].r.h * .6;
      second = makeBranch([
        [W + 80, -60],
        [colRight + gut * .52, greet.y + 30],
        [colRight + gut * .36, lerp(greet.y, midY, .55)],
        [colRight + gut * .44, midY],
      ], wTop * .8, wTop * .3);
      for (let l = 120; l < second.tot - 40; l += 170) {
        const i = second.L.findIndex(v => v >= l);
        twigAt(second, i, -.2 + (rnd() - .5) * .6, 90 + rnd() * (Math.min(200, W - second.S[i][0] - 20) - 90));
      }
      let s2 = 1;
      for (let l = 60; l < second.tot - 20; l += 60 + rnd() * 20) {
        const i = second.L.findIndex(v => v >= l);
        const [x, y] = second.S[i];
        leaves.push({ x, y, ang: upAngle(second, i) + s2 * (.9 + rnd() * .4), len: leafLen * (.7 + rnd() * .4), ci: Math.floor(rnd() * 6), ph: rnd() * TAU, wr: .37, baseY: y, shownAt: null });
        s2 = -s2;
      }
    }

    // ---------- świetliki ----------
    const anchors = [...leaves.map(l => [l.x, l.y]), ...twigs.map(t => t.pts[t.pts.length - 1])];
    const nFly = wide ? 20 : 11;
    const fireflies = Array.from({ length: nFly }, (_, k) => {
      const a = anchors[Math.floor(rnd() * anchors.length)] || [W / 2, 300];
      return { ax: a[0] + (rnd() - .5) * 40, ay: a[1] + (rnd() - .5) * 40, rx: 14 + rnd() * 40, ry: 10 + rnd() * 26, sp: (.25 + rnd() * .35) * (rnd() < .5 ? -1 : 1), ph: rnd() * TAU, size: 18 + rnd() * 12, bs: .9 + rnd(), bp: rnd() * TAU, vis: 0, k: k };
    });

    // Zachowanie tego, co już urosło (po zmianie rozmiaru nic nie „odrasta” od nowa)
    const prev = geo;
    const already = y => (prev && y <= grow.y) ? -10 : null;
    leaves.forEach(l => { if (l.shownAt == null) l.shownAt = already(l.baseY); });
    twigs.forEach(t => { t.shownAt = already(t.baseY); });

    geo = {
      main, second, petioles, twigs, leaves, fireflies, docH,
      flower: { x: fa.x, y: fa.y, R: wide ? 30 : 24, el: bloomEl, openAt: prev && prev.flower.openAt != null ? -10 : null },
    };
    if (bloomEl.classList.contains('is-open')) geo.flower.openAt = -10;
  }

  // ================================================================
  //  Aktualizacja
  // ================================================================
  function update(dt) {
    // wzrost: sprężyna krytycznie tłumiona do dołu ekranu (nie cofa się przy przewijaniu w górę)
    grow.target = Math.max(grow.target, scrollY + H * .88);
    if (reduceMotion) { grow.y = grow.target; grow.v = 0; }
    else {
      const w = 3.2;
      const a = w * w * (grow.target - grow.y) - 2 * w * grow.v;
      grow.v += a * dt;
      grow.y += grow.v * dt;
    }

    wind *= Math.exp(-dt * 1.3);
    if (palT < 1) {
      palT = Math.min(1, palT + dt / 1.1);
      pal = lerpPalette(palFrom, palTo, easeInOut(palT));
      bake();
      paintBokeh();
    }

    const g = grow.y;
    const reached = y => y <= g;
    geo.petioles.forEach(p => {
      if (!p.open && reached(p.baseY - 10)) {
        p.open = true;
        p.el.classList.add('is-open');
        p.el.dispatchEvent(new CustomEvent('leafopen', { bubbles: true }));
      }
    });
    geo.twigs.forEach(t => { if (t.shownAt == null && reached(t.baseY)) t.shownAt = clock; });
    geo.leaves.forEach(l => { if (l.shownAt == null && reached(l.baseY)) l.shownAt = clock; });
    const fl = geo.flower;
    if (fl.openAt == null && reached(fl.y - 10)) { fl.openAt = clock; fl.el.classList.add('is-open'); }

    // spadające płatki z rozkwitniętego kwiatu
    if (fl.openAt != null && motion && clock - fl.openAt > 1.6 && Math.random() < dt * .3 && petals.length < 8) {
      petals.push({ x: fl.x + rand(-10, 10), y: fl.y + rand(-6, 6), vx: rand(-18, 18), vy: rand(6, 16), rot: rand(0, TAU), vr: rand(-1.5, 1.5), phi: rand(0, TAU), vphi: rand(2, 3.5), s: fl.R * rand(.22, .3), life: 0, max: rand(5, 7), seed: rand(0, TAU) });
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life += dt; p.vy += 5 * dt;
      p.vx += Math.sin(clock * 1.1 + p.seed) * 10 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.phi += p.vphi * dt;
      if (p.life > p.max) petals.splice(i, 1);
    }

    // krople z podlewania
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.vy += 760 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vy > 0 && p.y >= p.floor) {
        rings.push({ x: p.x, y: p.y, t0: clock, r: 10 + p.s * 2 });
        particles.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) if (clock - rings[i].t0 > .7) rings.splice(i, 1);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
      if (p.life > p.max) sparks.splice(i, 1);
    }
    if (pulse && clock - pulse.t0 > 1.8) pulse = null;
  }

  // ================================================================
  //  Rysowanie
  // ================================================================
  const inView = (y, m = 90) => y > scrollY - m && y < scrollY + H + m;

  function drawLeaf(x, y, a, len, wr, [col, dark], alpha, phi) {
    if (len < .5 || alpha <= .01) return;
    const w = len * wr;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    if (phi) ctx.scale(1, flipScale(phi));
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * .28, -w * 1.05, len * .7, -w * .8, len, 0);
    ctx.bezierCurveTo(len * .7, w * .8, len * .28, w * 1.05, 0, 0);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.bezierCurveTo(len * .7, w * .8, len * .28, w * 1.05, 0, 0);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = Math.max(.8, len * .024);
    ctx.beginPath();
    ctx.moveTo(len * .04, 0);
    ctx.quadraticCurveTo(len * .5, -w * .08, len * .9, 0);
    ctx.stroke();
    if (len > 26) {
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = Math.max(.6, len * .012);
      ctx.beginPath();
      for (const [f, reach] of [[.28, .5], [.48, .46], [.66, .32]]) {
        const vx = len * f, ex = vx + len * .14, vy = w * reach;
        ctx.moveTo(vx, 0); ctx.quadraticCurveTo(vx + len * .07, -vy * .45, ex, -vy);
        ctx.moveTo(vx, 0); ctx.quadraticCurveTo(vx + len * .07, vy * .45, ex, vy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Gałąź jako wypełniony, zwężający się kształt + połysk kory; rośnie do grow.y
  function drawBranch(B) {
    const S = B.S, g = grow.y;
    let end = S.length - 1;
    while (end > 0 && S[end][1] > g) end--;
    if (end < 1) return;
    let start = 0;
    while (start < end && S[start][1] < scrollY - 120) start++;
    let stop = end;
    while (stop > start && S[stop][1] > scrollY + H + 120) stop--;
    if (stop - start < 1) return;

    const left = [], right = [];
    for (let i = Math.max(0, start - 1); i <= stop; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      // rosnący czubek: cienki koniec tam, gdzie gałąź właśnie dorasta
      const tipF = i > end - 12 ? clamp((end - i) / 12, .25, 1) : 1;
      const w = B.Wd[i] * tipF / 2;
      left.push([S[i][0] + nx * w, S[i][1] + ny * w]);
      right.push([S[i][0] - nx * w, S[i][1] - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = C.bark[1];
    ctx.fill();

    // cień po prawej i połysk po lewej stronie kory
    ctx.lineCap = 'round';
    for (const [side, col, wf, al] of [[-1, C.bark[0], .3, .5], [1, C.bark[2], .22, .55]]) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = al;
      for (let i = Math.max(1, start); i <= stop; i++) {
        const a = S[i - 1], b = S[i];
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const tipF = i > end - 12 ? clamp((end - i) / 12, .25, 1) : 1;
        const w = B.Wd[i] * tipF;
        const o = side * w * .26;
        ctx.lineWidth = w * wf;
        ctx.beginPath();
        ctx.moveTo(a[0] + nx * o, a[1] + ny * o);
        ctx.lineTo(b[0] + nx * o, b[1] + ny * o);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Odnoga/ogonek: rysowany od nasady do postępu t (0–1)
  function drawTwig(pts, w0, w1, t) {
    const n = pts.length - 1, upto = t * n;
    if (upto <= 0) return;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.bark[1];
    for (let k = 1; k <= Math.ceil(upto); k++) {
      const f = Math.min(1, upto - (k - 1));
      const a = pts[k - 1], b = pts[k];
      ctx.lineWidth = lerp(w0, w1, k / n);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f));
      ctx.stroke();
    }
    // węzeł przy nasadzie
    ctx.fillStyle = C.bark[1];
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], w0 * .7, 0, TAU); ctx.fill();
  }

  function leafAnim(l) {
    if (l.shownAt == null) return 0;
    return reduceMotion ? 1 : easeOutBack(clamp((clock - l.shownAt) / .85));
  }
  function swayOf(l) {
    return (Math.sin(clock * 1.4 + l.ph) * .06 + Math.sin(clock * 8 + l.ph * 3) * .13 * wind) * motion;
  }

  function drawFlower(fl) {
    const t = fl.openAt == null ? 0 : reduceMotion ? 1 : clamp((clock - fl.openAt) / 1.6);
    const open = easeOutCubic(t);
    const { x, y, R } = fl;
    // poświata
    const glowR = R * (2.2 + 1.4 * open);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    gr.addColorStop(0, rgba(pal.glow, .55 * (.35 + .65 * open)));
    gr.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(clock * .6) * .05 * motion + open * .5);
    // działki
    ctx.fillStyle = C.leaves[4][1];
    for (let k = 0; k < 5; k++) {
      ctx.save(); ctx.rotate(k * TAU / 5 + .6);
      ctx.beginPath(); ctx.ellipse(0, -R * .38, R * .14, R * .34, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // płatki: z zamkniętego pąka w otwarty kwiat
    const n = 6;
    const pl = R * lerp(.5, 1, open), pw = R * lerp(.3, .44, open), off = R * lerp(.12, .5, open);
    const grd = ctx.createLinearGradient(0, 0, 0, -off - pl);
    grd.addColorStop(0, C.flower);
    grd.addColorStop(1, C.tip);
    ctx.fillStyle = grd;
    for (let k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate(k * TAU / n);
      ctx.beginPath(); ctx.ellipse(0, -off, pw, pl * .55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * (.16 + .14 * open), 0, TAU); ctx.fillStyle = C.core; ctx.fill();
    ctx.beginPath(); ctx.arc(-R * .06, -R * .06, R * .07 * (.5 + open), 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // --- tło (warstwa ekranu) ---
    for (const o of bokeh) {
      const bx = o.nx * W + Math.sin(clock * o.f + o.ph) * 40 * motion;
      let by = (o.ny * (H + 300) - scrollY * .12) % (H + 300);
      if (by < 0) by += H + 300;
      by -= 150;
      ctx.globalAlpha = o.a;
      ctx.drawImage(bokehSprites[o.spr], bx - o.r, by - o.r, o.r * 2, o.r * 2);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      const span = H + 80;
      let fy = (f.ny * span + clock * f.fall * motion - scrollY * .3) % span;
      if (fy < 0) fy += span;
      fy -= 40;
      const fx = f.nx * W + Math.sin(clock * f.f + f.ph) * 26 * motion;
      drawLeaf(fx, fy, f.rot + clock * f.spin * motion, f.len, .34, C.leaves[f.ci], f.al, clock * .5 * motion + f.ph);
    }

    // --- roślina (warstwa dokumentu) ---
    ctx.save();
    ctx.translate(0, -scrollY);
    const { main, second, petioles, twigs, leaves, flower } = geo;

    // odnogi (pod gałęzią)
    for (const t of twigs) {
      if (t.shownAt == null || !inView(t.baseY, 260)) continue;
      const p = reduceMotion ? 1 : easeOutCubic(clamp((clock - t.shownAt) / .9));
      drawTwig(t.pts, t.w0, 1.6, p);
    }
    drawBranch(main);
    if (second) drawBranch(second);

    // ogonki do kart
    for (const p of petioles) {
      if (!inView(p.y0) || p.y0 > grow.y) continue;
      const pts = [];
      const cx = (p.x0 + p.base[0]) / 2, cy = Math.min(p.y0, p.base[1]) - 8;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, u = 1 - t;
        pts.push([u * u * p.x0 + 2 * u * t * cx + t * t * p.base[0], u * u * p.y0 + 2 * u * t * cy + t * t * p.base[1]]);
      }
      drawTwig(pts, p.w0, 4, 1);
    }

    // liście na odnogach i na gałęzi
    for (const t of twigs) {
      if (t.shownAt == null || !inView(t.baseY, 260)) continue;
      for (const l of t.leaves) {
        const s = reduceMotion ? 1 : easeOutBack(clamp((clock - t.shownAt - l.f * .6) / .8));
        if (s <= 0) continue;
        drawLeaf(l.x, l.y, l.ang + swayOf(l), l.len * s, l.wr, C.leaves[l.ci], 1, 0);
      }
    }
    for (const l of leaves) {
      if (!inView(l.y)) continue;
      const s = leafAnim(l);
      if (s <= 0) continue;
      drawLeaf(l.x, l.y, l.ang + swayOf(l), l.len * s, l.wr, C.leaves[l.ci], 1, 0);
    }

    // kwiat na końcu gałęzi
    if (inView(flower.y, 140) && flower.y - 30 <= grow.y) drawFlower(flower);
    for (const p of petals) {
      const a = Math.min(1, p.life * 2) * (1 - clamp((p.life - p.max + 1.2) / 1.2));
      if (a <= 0 || !inView(p.y)) continue;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, flipScale(p.phi));
      ctx.globalAlpha = a;
      ctx.fillStyle = C.petal;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * .5, p.s, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // podlewanie: światło płynące wzdłuż gałęzi
    if (pulse) {
      const age = clock - pulse.t0;
      if (age > 0) {
        const d = age * 520, fade = 1 - clamp(age / 1.8);
        ctx.lineCap = 'round';
        for (let i = 1; i < main.S.length; i++) {
          const dist = Math.abs(Math.abs(main.L[i] - pulse.l0) - d);
          if (dist > 70 || main.S[i][1] > grow.y || !inView(main.S[i][1])) continue;
          ctx.strokeStyle = `rgba(255,255,255,${(.7 * (1 - dist / 70) * fade).toFixed(3)})`;
          ctx.lineWidth = main.Wd[i] * .5;
          ctx.beginPath();
          ctx.moveTo(main.S[i - 1][0], main.S[i - 1][1]);
          ctx.lineTo(main.S[i][0], main.S[i][1]);
          ctx.stroke();
        }
      }
    }

    // świetliki
    const flare = clamp(1 - (clock - flareAt) / 1.8);
    for (const f of geo.fireflies) {
      f.vis += ((f.ay - 20 <= grow.y ? 1 : 0) - f.vis) * .03;
      if (f.vis < .01) continue;
      const th = clock * f.sp * motion + f.ph;
      let x = f.ax + Math.cos(th) * f.rx, y = f.ay + Math.sin(th * 1.3) * f.ry;
      if (!inView(y)) continue;
      if (pointer.active && motion) {
        const dx = pointer.x - x, dy = pointer.y + scrollY - y, d = Math.hypot(dx, dy);
        if (d < 170) { const k = (1 - d / 170) * .35; x += dx * k; y += dy * k; }
      }
      const blink = .35 + .65 * Math.pow(.5 + .5 * Math.sin(clock * f.bs + f.bp), 2);
      const size = f.size * (1 + flare * .6);
      ctx.globalAlpha = f.vis * Math.min(1, blink + flare * .6);
      ctx.drawImage(fireflySprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawFx();
  }

  // Warstwa nad treścią: krople, rozbryzgi, iskierki
  let fxDirty = false;
  function drawFx() {
    if (!particles.length && !rings.length && !sparks.length) {
      if (fxDirty) { fx.clearRect(0, 0, W, H); fxDirty = false; }
      return;
    }
    fxDirty = true;
    fx.clearRect(0, 0, W, H);
    fx.save();
    fx.translate(0, -scrollY);
    for (const p of particles) {
      const ang = Math.atan2(p.vy, p.vx) - Math.PI / 2;
      fx.save();
      fx.translate(p.x, p.y); fx.rotate(ang);
      fx.fillStyle = C.water;
      fx.beginPath();
      fx.moveTo(0, -p.s * 1.9);
      fx.bezierCurveTo(p.s * .9, -p.s * .4, p.s, p.s * .5, 0, p.s);
      fx.bezierCurveTo(-p.s, p.s * .5, -p.s * .9, -p.s * .4, 0, -p.s * 1.9);
      fx.fill();
      fx.fillStyle = 'rgba(255,255,255,.75)';
      fx.beginPath(); fx.arc(-p.s * .3, 0, p.s * .25, 0, TAU); fx.fill();
      fx.restore();
    }
    for (const r of rings) {
      const e = (clock - r.t0) / .7;
      fx.beginPath();
      fx.ellipse(r.x, r.y, lerp(3, r.r, easeOutCubic(e)), lerp(1.5, r.r * .45, easeOutCubic(e)), 0, 0, TAU);
      fx.strokeStyle = rgba(pal.water, .9 * (1 - e));
      fx.lineWidth = 1.8;
      fx.stroke();
    }
    for (const p of sparks) {
      const a = Math.sin(Math.PI * clamp(p.life / p.max));
      const r = p.s * (.6 + .4 * a);
      fx.save();
      fx.translate(p.x, p.y); fx.rotate(p.rot + p.life * 2);
      fx.globalAlpha = a;
      fx.fillStyle = '#fff';
      fx.beginPath();
      for (let k = 0; k < 4; k++) {
        fx.rotate(Math.PI / 2);
        fx.moveTo(0, 0); fx.quadraticCurveTo(r * .18, r * .18, 0, r); fx.quadraticCurveTo(-r * .18, r * .18, 0, 0);
      }
      fx.fill();
      fx.restore();
    }
    fx.globalAlpha = 1;
    fx.restore();
  }

  function frame(ms) {
    const dt = Math.min(.05, Math.max(0, (ms - lastMs) / 1000));
    lastMs = ms;
    clock += dt;
    scrollY = window.scrollY;
    if (geo) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }

  // ================================================================
  //  Wejście: kursor / dotyk
  // ================================================================
  window.addEventListener('pointermove', e => {
    if (pointer.active && geo) {
      // szelest liści, gdy kursor przechodzi przez roślinę
      const x = e.clientX, y = e.clientY + scrollY;
      const near = geo.leaves.some(l => Math.abs(l.x - x) < 50 && Math.abs(l.y - y) < 50);
      if (near) wind = Math.min(1.6, wind + Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) * .004 * motion);
    }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') pointer.active = false; });
  window.addEventListener('blur', () => { pointer.active = false; });

  // ================================================================
  //  API
  // ================================================================
  let relayoutTimer;
  function relayout() {
    if (!started) return;
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(layout, 80);
  }

  function water(vx, vy) {
    if (!geo) return;
    const x = vx, y = vy + scrollY;
    for (let i = 0; i < 12; i++) {
      particles.push({ x: x + rand(-6, 6), y, vx: rand(-140, 140), vy: rand(-360, -180), s: rand(3.4, 6), life: 0, floor: y + rand(40, 150) });
    }
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU), sp = rand(60, 170);
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: rand(4, 8), rot: rand(0, TAU), life: 0, max: rand(.6, 1.1) });
    }
    wind = Math.min(1.6, wind + 1);
    flareAt = clock;
    // światło płynie gałęzią od miejsca najbliżej przycisku, a po chwili wyrasta nowy listek
    const i = nearestIdx(geo.main, y, p => p[1] <= grow.y);
    if (i >= 0) {
      pulse = { l0: geo.main.L[i], t0: clock + .35 };
      if (sprouts.length < 10) {
        const l = clamp(geo.main.L[i] + rand(-140, 60), 40, geo.main.tot - 40);
        sprouts.push({ l, side: Math.random() < .5 ? -1 : 1, ci: Math.floor(rand(0, 6)), ph: rand(0, TAU), shownAt: clock + .8 });
        layout();
      }
    }
  }

  window.addEventListener('themechange', () => {
    palFrom = pal;
    palTo = readPalette();
    palT = 0;
    if (reduceMotion) { pal = palTo; palT = 1; bake(); paintBokeh(); }
    wind = Math.min(1.6, wind + .6 * motion);
  });
  window.addEventListener('resize', relayout);

  bake();
  paintBokeh();

  window.HomeScene = {
    start() {
      started = true;
      layout();
      if (reduceMotion) grow.y = grow.target = 1e6;
      if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.querySelector('.page'));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
      requestAnimationFrame(frame);
    },
    relayout,
    water,
    // Tylko do testów (np. gdy karta przeglądarki jest w tle i nie dostaje klatek): przewija czas sceny
    debugAdvance(sec) {
      for (let t = 0; t < sec; t += 1 / 60) { clock += 1 / 60; scrollY = window.scrollY; if (geo) update(1 / 60); }
      if (geo) draw();
    },
  };
})();
