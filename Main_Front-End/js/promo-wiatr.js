/*
 * Promo „Puść z wiatrem” — film na story (9:16, 1080×1920, 15 s) rysowany na canvasie.
 *
 * Scenariusz:
 *   1. pisze się ciężka myśl („znowu mi dziś nie wyszło”),
 *   2. przychodzi wiatr — litery przelewają się w listki i odlatują (to samo robi „Puść z wiatrem” w Skrytce),
 *   3. zostaje spokojny ekran i zdanie „Niektórych myśli nie trzeba trzymać.”,
 *   4. jeden listek wraca, siada na „l” i „relief” zmienia się w „releaf”.
 *
 * Jak to jest zbudowane:
 *   • CAŁY obraz jest funkcją czasu — render(t) nie pamięta poprzedniej klatki. Dzięki temu można przewijać,
 *     a przy renderze do wideo liczymy kilka pod-klatek na klatkę i uśredniamy je (prawdziwe rozmycie ruchu).
 *   • Kolory idą z tokenów motywu (css/tokens.css), więc ?motyw=lawenda albo ?tryb=dark dają inną wersję.
 *   • Liść jest rysowany tak samo jak w js/home2-scene.js, tylko raz — do „sprite'ów” w kilku stopniach
 *     rozmycia (głębia ostrości: liść, który oddala się od płaszczyzny tekstu, robi się miękki).
 *   • Przejście litera → liść to dwa kształty rozmyte i „progowane” po kanale alfa (wyglądają jak ciecz).
 *
 * window.PromoWiatr:
 *   czas                 długość filmu w sekundach
 *   gotowe               Promise — czcionki wczytane, pierwsza klatka narysowana
 *   render(t)            rysuje klatkę dla sekundy t
 *   klatka(i, fps, n)    klatka nr i z rozmyciem ruchu z n pod-klatek (używa narzedzia/render-promo.js)
 *   graj() / stop() / przewin(t)
 *
 * W React Native: react-native-skia (te same ścieżki i filtry) albo gotowe wideo w <Video>.
 */
(function () {
  'use strict';

  const W = 1080, H = 1920, DUR = 15;
  const TAU = Math.PI * 2;
  const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ================================================================
  //  Dane: teksty i oś czasu (sekundy) — oddzielone od rysowania
  // ================================================================
  const COPY = {
    mysl: ['znowu mi dziś', 'nie wyszło'],
    zdanie: ['Niektórych myśli', 'nie trzeba trzymać.'],
    przed: 'relief',
    po: 'releaf',
    haslo: 'Ulga, która rośnie.',
  };
  const T = {
    pisanie: .75,        // pierwsza litera
    kursorZnika: 3.7,
    wiatr: 4.0,          // wiatr dociera do pierwszej litery
    wiatrTrwa: 1.35,     // …i przechodzi przez cały tekst
    zdanie: 7.45, zdanieZnika: 10.15,
    znak: 10.8,          // pojawia się „relief”
    lisc: 10.45,         // listek wlatuje z góry
    laduje: 12.0,        // siada na „l”; „ie” → „ea”
    haslo: 12.85,
  };

  const params = new URLSearchParams(location.search);
  const widok = params.get('widok');
  if (widok) document.documentElement.dataset.widok = widok;
  if (params.get('tryb') === 'dark' && window.Theme) window.Theme.setMode('dark', { save: false });
  if (params.get('tryb') === 'light' && window.Theme) window.Theme.setMode('light', { save: false });

  const cv = document.getElementById('promo');
  if (!cv) return;
  const out = cv.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const scene = mk(W, H);
  const sceneCtx = scene.getContext('2d');
  let ctx = out;                                       // gdzie teraz rysujemy (ekran albo pod-klatka)
  const HAS_FILTER = typeof out.filter === 'string';   // Safari nie ma ctx.filter — wtedy bez rozmyć

  // ================================================================
  //  Pomocnicze: matematyka, wygładzanie, losowość z ziarnem
  // ================================================================
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const outCubic = t => 1 - Math.pow(1 - clamp(t), 3);
  const outQuint = t => 1 - Math.pow(1 - clamp(t), 5);
  const inOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const inOutSine = t => .5 - .5 * Math.cos(Math.PI * clamp(t));
  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = rng(20261113);
  const rand = (a, b) => a + (b - a) * rnd();

  // ================================================================
  //  Kolory z tokenów motywu
  // ================================================================
  const hex = h => {
    h = (h || '').trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? [136, 136, 136] : [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const WHITE = [255, 255, 255];
  const tint = (c, t) => mixC(c, WHITE, t);
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const lum = c => (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255;

  let pal;
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => hex(cs.getPropertyValue(name));
    const p = {
      text: v('--text'), muted: v('--text-muted'), bg: v('--bg'), bg2: v('--bg-2'),
      primary: v('--primary'), accent: v('--accent-light'), mist: v('--mist'), mint: v('--mint'),
      stem: v('--plant-stem'), l1: v('--plant-leaf-1'), l2: v('--plant-leaf-2'), l3: v('--plant-leaf-3'),
      flower: v('--plant-flower'), tip: v('--plant-flower-tip'), glow: v('--plant-glow'),
    };
    p.dark = lum(p.bg) < .35;
    p.ink = p.dark ? p.accent : p.primary;             // „leaf” w znaku — na ciemnym tle jaśniejszy akcent
    return p;
  }

  // Kolory liścia jak w js/home2-scene.js: ton (0 = młody … 1 = dojrzały), żywość (0 = blady … 1 = soczysty)
  function leafColors(tone, vivid, hue = 0) {
    let base = mixC(mixC(pal.l3, pal.l2, clamp(tone * 1.6)), pal.l1, clamp(tone * 1.4 - .4));
    base = hue > 0 ? mixC(base, pal.l3, hue) : mixC(base, pal.l1, -hue);
    const lively = mixC(tint(base, .62), base, .2 + .8 * vivid);
    return {
      rgb: lively,
      light: rgba(tint(lively, .07)),
      mid: rgba(lively),
      dark: rgba(mixC(lively, pal.stem, .2 + .1 * tone)),
      edge: rgba(mixC(lively, pal.stem, .55), .35),
      vein: rgba(tint(lively, .45), .3),
    };
  }

  // ================================================================
  //  Liść (ten sam kształt co w aplikacji): ogonek, blaszka zagięta wzdłuż nerwu, ząbki, żyłki
  //  Rysowany od nasady (0, 0) wzdłuż osi +x.
  // ================================================================
  function leafProfile(shape, u) {
    if (shape === 'lance') return Math.pow(Math.sin(Math.PI * u), 1.15) * .7;
    return Math.pow(Math.sin(Math.PI * Math.pow(u, .72)), .82);
  }
  function paintLeaf(g, len, o, col) {
    const stalkL = len * (o.stalk != null ? o.stalk : .14);
    const bl = len - stalkL, Wd = bl * o.wr;
    const N = 26;
    const mid = [], up = [], lo = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      mid.push([stalkL + bl * u, (o.curl || 0) * bl * .22 * Math.sin(Math.PI * u) * u]);
    }
    const teeth = o.serr ? 8 + Math.round(len / 12) : 0;
    const fold = o.fold || 0;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const a = mid[Math.max(0, k - 1)], b = mid[Math.min(N, k + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      let w = Wd * leafProfile(o.shape || 'ovate', u);
      if (teeth && u > .12 && u < .96) w *= 1 + .035 * (1 - Math.abs(((u * teeth) % 1) * 2 - 1));
      up.push([mid[k][0] - nx * w * (1 - fold * .35), mid[k][1] - ny * w * (1 - fold * .35)]);
      lo.push([mid[k][0] + nx * w * (1 + fold * .06), mid[k][1] + ny * w * (1 + fold * .06)]);
    }
    const trace = pts => {
      g.lineTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
        g.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
      }
      g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    };

    // ogonek
    g.lineCap = 'round';
    g.strokeStyle = col.dark;
    g.lineWidth = Math.max(1, len * .035);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(stalkL * .5, mid[0][1] - len * .01, mid[0][0], mid[0][1]); g.stroke();

    // górna połowa (w świetle) — gradient od nasady do czubka
    const gr = g.createLinearGradient(stalkL, 0, len, 0);
    gr.addColorStop(0, col.mid);
    gr.addColorStop(1, col.light);
    g.beginPath();
    g.moveTo(mid[0][0], mid[0][1]);
    trace(up);
    for (let k = N; k >= 0; k--) g.lineTo(mid[k][0], mid[k][1]);
    g.fillStyle = gr;
    g.fill();
    // dolna połowa (w cieniu)
    g.beginPath();
    g.moveTo(mid[0][0], mid[0][1]);
    trace(lo);
    for (let k = N; k >= 0; k--) g.lineTo(mid[k][0], mid[k][1]);
    g.fillStyle = col.dark;
    g.fill();
    // cienki kontur — liść wygląda na płaski i matowy
    g.beginPath();
    g.moveTo(mid[0][0], mid[0][1]);
    trace(up);
    for (let k = N; k >= 0; k--) g.lineTo(lo[k][0], lo[k][1]);
    g.strokeStyle = col.edge;
    g.lineWidth = Math.max(.5, len * .012);
    g.stroke();

    // nerw główny i boczne żyłki
    g.strokeStyle = col.vein;
    g.lineWidth = Math.max(.7, len * .018);
    g.beginPath();
    g.moveTo(mid[0][0], mid[0][1]);
    for (let k = 1; k <= N; k++) g.lineTo(mid[k][0], mid[k][1]);
    g.stroke();
    g.lineWidth = Math.max(.5, len * .009);
    g.beginPath();
    for (let j = 1; j <= 4; j++) {
      const k = Math.round(N * (.1 + j * (.78 / 4)));
      const m = mid[k], tu = up[Math.min(N, k + 3)], tl = lo[Math.min(N, k + 3)];
      g.moveTo(m[0], m[1]); g.quadraticCurveTo(lerp(m[0], tu[0], .5), lerp(m[1], tu[1], .3), lerp(m[0], tu[0], .85), lerp(m[1], tu[1], .85));
      g.moveTo(m[0], m[1]); g.quadraticCurveTo(lerp(m[0], tl[0], .5), lerp(m[1], tl[1], .3), lerp(m[0], tl[0], .85), lerp(m[1], tl[1], .85));
    }
    g.stroke();
    // światło na brzegu
    g.strokeStyle = 'rgba(255,255,255,.14)';
    g.lineWidth = Math.max(.6, len * .012);
    g.beginPath();
    g.moveTo(up[1][0], up[1][1]);
    for (let k = 2; k < N * .85; k++) g.lineTo(up[k][0], up[k][1]);
    g.stroke();
  }

  // ----------------------------------------------------------------
  //  Sprite'y liści: każdy wariant narysowany raz, w kilku stopniach rozmycia
  // ----------------------------------------------------------------
  const SPR = 240;                                             // długość liścia w sprite'cie (px)
  const BLURS = [0, 1.5, 3, 5, 7.5, 10.5, 14, 18, 23, 29, 37]; // stopnie rozmycia (px w sprite'cie)
  const PAD = 100;
  const VARIANTS = [
    { wr: .40, curl: .30, fold: .30, serr: 1, tone: .22, hue: .1 },
    { wr: .44, curl: -.35, fold: .40, serr: 1, tone: .55, hue: 0 },
    { wr: .37, curl: .50, fold: .25, serr: 0, tone: .85, hue: -.15 },
    { wr: .31, curl: -.25, fold: .45, serr: 0, tone: .40, hue: .2, shape: 'lance' },
    { wr: .42, curl: .15, fold: .35, serr: 1, tone: .70, hue: -.05 },
    { wr: .29, curl: .40, fold: .50, serr: 0, tone: .15, hue: .25, shape: 'lance' },
  ];
  let sprites = [], logoSprite = null;
  function makeSprite(o, len = SPR) {
    const col = leafColors(o.tone, o.vivid != null ? o.vivid : .92, o.hue);
    const k = len / SPR;
    const pad = Math.ceil(PAD * k);
    const w = Math.ceil(len + pad * 2), h = Math.ceil(len * o.wr * 2.3 + pad * 2);
    const base = mk(w, h);
    const g = base.getContext('2d');
    g.translate(pad, h / 2);
    paintLeaf(g, len, o, col);
    const levels = BLURS.map(b => {
      if (!b || !HAS_FILTER) return base;
      const c = mk(w, h), cg = c.getContext('2d');
      cg.filter = `blur(${(b * k).toFixed(2)}px)`;
      cg.drawImage(base, 0, 0);
      return c;
    });
    return { levels, ox: pad, oy: h / 2, cx: pad + len * .55, len, k, rgb: col.rgb };
  }
  // rysuje sprite: (x, y) to środek liścia albo — z kotwica = true — nasada ogonka
  function drawSprite(sp, x, y, ang, len, sy, blur, alpha, kotwica) {
    const k = len / sp.len;
    const want = blur / (k * sp.k);                     // rozmycie przeliczone na piksele sprite'a
    let i = 0;
    while (i < BLURS.length - 1 && (BLURS[i] + BLURS[i + 1]) / 2 < want) i++;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(k, k * sy);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.levels[i], -(kotwica ? sp.ox : sp.cx), -sp.oy);
    ctx.restore();
  }

  // ----------------------------------------------------------------
  //  „Ciecz”: dwa kształty (A znika, B rośnie) rozmyte i sprogowane po alfie — płynne przelanie
  // ----------------------------------------------------------------
  const GS = 400;
  const goo = mk(GS, GS);
  const gctx = goo.getContext('2d', { willReadFrequently: true });
  function gooDraw(x, y, color, m, drawA, drawB) {
    const wA = 1 - smooth(.3, .92, m), wB = smooth(.08, .7, m);
    const blur = 8.5 * Math.sin(Math.PI * m);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.globalCompositeOperation = 'source-over';
    gctx.globalAlpha = 1;
    gctx.filter = 'none';
    gctx.clearRect(0, 0, GS, GS);
    gctx.globalCompositeOperation = 'lighter';
    if (HAS_FILTER && blur > .4) gctx.filter = `blur(${blur.toFixed(2)}px)`;
    gctx.translate(GS / 2, GS / 2);
    if (wA > .01) { gctx.save(); gctx.globalAlpha = wA; drawA(gctx); gctx.restore(); }
    if (wB > .01) { gctx.save(); gctx.globalAlpha = wB; drawB(gctx); gctx.restore(); }
    gctx.filter = 'none';
    const img = gctx.getImageData(0, 0, GS, GS), d = img.data;
    const r = color[0] | 0, gg = color[1] | 0, b = color[2] | 0;
    for (let p = 3; p < d.length; p += 4) {
      const a = d[p];
      if (!a) continue;
      const v = (a - 128) * 9 + 128;
      d[p - 3] = r; d[p - 2] = gg; d[p - 1] = b;
      d[p] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    gctx.putImageData(img, 0, 0);
    ctx.drawImage(goo, x - GS / 2, y - GS / 2);
  }

  // ================================================================
  //  Układ: pisana myśl (każda litera wie, kiedy się pojawia i kiedy odlatuje)
  // ================================================================
  const mctx = mk(8, 8).getContext('2d');
  const TYPE = { size: 106, weight: 600, lh: 142, mid: 905 };
  const TC = .62;                                       // jak szybko liść nabiera prędkości wiatru
  let chars = [], caretStops = [], typeEnd = 0, flightEnd = 0;

  function layoutTyped() {
    const font = `${TYPE.weight} ${TYPE.size}px ${FONT}`;
    mctx.font = font;
    chars = []; caretStops = [];
    let tt = T.pisanie;
    const lines = COPY.mysl;
    lines.forEach((line, li) => {
      const base = TYPE.mid + (li - (lines.length - 1) / 2) * TYPE.lh + TYPE.size * .27;
      const x0 = W / 2 - mctx.measureText(line).width / 2;
      caretStops.push({ t: tt - .001, x: x0, y: base });
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const x = x0 + mctx.measureText(line.slice(0, i)).width;
        const end = x0 + mctx.measureText(line.slice(0, i + 1)).width;
        if (ch !== ' ') chars.push({ ch, x, w: end - x, base, cx: (x + end) / 2, cy: base - TYPE.size * .27, line: li, tt, font });
        caretStops.push({ t: tt, x: end, y: base });
        tt += ch === ' ' ? rand(.11, .16) : rand(.07, .115);
      }
      tt += .34;                                        // oddech przed następną linijką
    });
    typeEnd = tt - .34;

    const xs = chars.map(c => c.cx), xmin = Math.min(...xs), xmax = Math.max(...xs);
    const heroes = [3, 9, 16];                          // trzy liście lecą prosto „na kamerę”
    chars.forEach((c, i) => {
      const d = rnd();                                  // głębia: 0 = daleko, 1 = blisko
      c.t0 = T.wiatr + (c.cx - xmin) / (xmax - xmin) * T.wiatrTrwa + c.line * .17 + rand(0, .22);
      c.hero = heroes.includes(i) ? 1 : 0;
      c.depth = c.hero ? .9 : d;
      c.V = lerp(520, 860, c.depth) * rand(.9, 1.12);
      const th = rand(.62, 1.2);                       // kierunek lotu: w prawo i w górę
      c.cos = Math.cos(th); c.sin = Math.sin(th);
      c.curv = rand(.00004, .00016);
      c.ax = rand(40, 120); c.ay = rand(30, 90);
      c.kx = TAU / rand(520, 900); c.ky = TAU / rand(440, 760);
      c.px = rand(0, TAU); c.py = rand(0, TAU);
      c.a0 = rand(-1.5, -.9);
      c.spin = (rnd() < .5 ? -1 : 1) * rand(.9, 2.6);
      c.fp = rand(-.5, .5); c.fw = rand(2.2, 4.6);
      c.len = rand(118, 168) * lerp(.72, 1.4, c.depth);
      c.defocus = Math.abs(c.depth - .42) * 15;
      c.sp = i % VARIANTS.length;
      c.lean = rand(.07, .15);
    });
    flightEnd = Math.max(...chars.map(c => c.t0)) + 4.2;
  }

  // Lot liścia: τ = sekundy od oderwania. Wzór zamknięty (bez całkowania), więc render(t) jest powtarzalny.
  function flight(c, tau) {
    const se = tau - TC * (1 - Math.exp(-tau / TC));    // „rozpędzony” czas: start miękki, potem stała prędkość
    const s = c.V * se;
    const g = smooth(0, 420, s);
    const u = clamp(s / 1500);
    const grow = 1 + c.hero * 1.9 * u * u;
    const face = smooth(.15, .8, tau);
    return {
      x: c.cx + 9 + s * c.cos + c.ax * Math.sin(c.kx * s + c.px) * g,     // +9 / −6: tam kończy się pochylenie litery
      y: c.cy - 6 - s * c.sin - c.curv * s * s + c.ay * Math.sin(c.ky * s + c.py) * g,
      ang: c.a0 + c.spin * se + .28 * Math.sin(3.6 * tau + c.px) * g,
      sy: lerp(1, Math.cos(c.fp + c.fw * se), face),
      len: c.len * grow * lerp(.46, 1, inOutSine(tau / 1.15)),   // zaczyna w rozmiarze litery i rośnie w locie
      blur: c.defocus * smooth(40, 760, s) + c.hero * 30 * u * u,
    };
  }

  // ================================================================
  //  Układ: zdanie i znak
  // ================================================================
  let words = [];
  function layoutLine2() {
    const size = 74, lh = 104, mid = 905;
    const font = `600 ${size}px ${FONT}`;
    mctx.font = font;
    words = [];
    let n = 0;
    COPY.zdanie.forEach((line, li) => {
      const base = mid + (li - (COPY.zdanie.length - 1) / 2) * lh + size * .27;
      const x0 = W / 2 - mctx.measureText(line).width / 2;
      let pos = 0;
      line.split(' ').forEach(w => {
        const x = x0 + mctx.measureText(line.slice(0, pos)).width;
        words.push({ w, x, base, font, i: n++, line: li });
        pos += w.length + 1;
      });
    });
  }

  const MARK = { size: 204, weight: 800, base: 978, track: -.022 };
  let mark = null;
  function layoutMark() {
    const font = `${MARK.weight} ${MARK.size}px ${FONT}`;
    mctx.font = font;
    const a = COPY.przed, b = COPY.po;
    const mw = s => mctx.measureText(s).width;
    const kern = (p, q) => mw(p + q) - mw(p) - mw(q);
    const slots = [];
    for (let i = 0; i < a.length; i++) {
      slots.push({
        a: a[i], b: b[i], zmiana: a[i] !== b[i],
        wa: mw(a[i]), wb: mw(b[i]),
        ka: i < a.length - 1 ? kern(a[i], a[i + 1]) : 0,
        kb: i < b.length - 1 ? kern(b[i], b[i + 1]) : 0,
      });
    }
    const first = slots.findIndex(s => s.zmiana);
    const lIdx = b.indexOf('l');
    const ml = mctx.measureText('l');
    const mx = mctx.measureText('x');
    mark = { font, slots, first, lIdx, lAsc: ml.actualBoundingBoxAscent, xh: mx.actualBoundingBoxAscent };
    mctx.font = `500 46px ${FONT}`;
    mark.tagFont = mctx.font;
    mark.tagW = mctx.measureText(COPY.haslo).width;
  }

  // ================================================================
  //  Tło: miękkie plamy koloru, ciepła poświata tam, dokąd lecą liście, drobinki w powietrzu
  // ================================================================
  let blobSprites = {}, grain = null, motes = [], streaks = [];
  function makeBlob(c) {
    const s = mk(256, 256), g = s.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(.35, rgba(c, .62));
    gr.addColorStop(.7, rgba(c, .16));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return s;
  }
  function buildBackdrop() {
    blobSprites = {
      mint: makeBlob(pal.mint), mist: makeBlob(pal.mist), accent: makeBlob(pal.accent),
      warm: makeBlob(pal.dark ? pal.flower : pal.tip), light: makeBlob(pal.dark ? pal.glow : WHITE),
      mote: makeBlob(pal.dark ? tint(pal.accent, .5) : WHITE), moteInk: makeBlob(pal.primary),
    };
    // ziarno: nieruchomy, bardzo delikatny szum — bez niego łagodne przejścia robią w wideo „schodki”
    grain = mk(256, 256);
    const g = grain.getContext('2d'), img = g.createImageData(256, 256), r = rng(7);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = r() < .5 ? 0 : 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = r() * (pal.dark ? 11 : 9);
    }
    g.putImageData(img, 0, 0);

    const r2 = rng(99);
    const R = (a, b) => a + (b - a) * r2();
    motes = Array.from({ length: 54 }, () => ({
      x: R(0, 1), y: R(0, 1), z: R(.25, 1), r: R(2.5, 8), a: R(.25, .7), ph: R(0, TAU), ink: r2() < .4,
    }));
    streaks = Array.from({ length: 6 }, (_, i) => ({
      t0: T.wiatr - .35 + i * .24 + R(0, .1), dur: R(1.5, 1.9),
      x: R(-260, 80), y: R(900, 1750) - i * 60, th: R(.78, 1.0),
      amp: R(40, 90), k: TAU / R(900, 1400), ph: R(0, TAU), len: R(2100, 2500), w: R(7, 16), a: R(.45, .8),
    }));
  }

  const setBlur = px => { if (HAS_FILTER) ctx.filter = px > .25 ? `blur(${px.toFixed(2)}px)` : 'none'; };

  // jak mocno wieje (0…1) i ile „przewiało” od początku — wspólne dla drobinek, plam i kamery
  const windPush = t => smoother((t - (T.wiatr - .45)) / 4.0);
  function drawBlob(s, x, y, r, a) {
    if (a <= .005) return;
    ctx.globalAlpha = a;
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(pal.bg));
    g.addColorStop(1, rgba(pal.bg2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const wp = windPush(t), dx = wp * 90, dy = -wp * 60;
    const k = pal.dark ? .9 : 1;
    drawBlob(blobSprites.mint, 170 + 40 * Math.sin(t * .21) + dx, 470 + 50 * Math.cos(t * .17) + dy, 720, .85 * k);
    drawBlob(blobSprites.mist, 900 + 50 * Math.cos(t * .19 + 1) + dx * .7, 1500 + 40 * Math.sin(t * .23) + dy * .7, 800, .8 * k);
    drawBlob(blobSprites.accent, 80 + 30 * Math.sin(t * .16 + 2) + dx * .5, 1640 + dy * .5, 560, pal.dark ? .16 : .3);
    // miękkie światło za tekstem
    drawBlob(blobSprites.light, 540, 900, 700, pal.dark ? .1 : .6);
    // ciepła poświata w prawym górnym rogu — rośnie, kiedy myśli odlatują
    const warm = .25 + .5 * smooth(T.wiatr, T.wiatr + 3.2, t) - .2 * smooth(T.zdanieZnika, T.laduje, t);
    drawBlob(blobSprites.warm, 960 + 20 * Math.sin(t * .3), 250 + 20 * Math.cos(t * .26), 760, warm * (pal.dark ? .3 : .9));
  }
  function drawMotes(t, near) {
    const wp = windPush(t);
    const BX = W + 240, BY = H + 240;
    for (const m of motes) {
      if ((m.z > .62) !== near) continue;
      const travel = (20 * t + 2500 * wp) * m.z;
      let x = m.x * BX + travel * .64 + 16 * Math.sin(t * .7 + m.ph);
      let y = m.y * BY - travel * .77 + 14 * Math.cos(t * .6 + m.ph * 1.7);
      x = ((x % BX) + BX) % BX - 120;
      y = ((y % BY) + BY) % BY - 120;
      const tw = .65 + .35 * Math.sin(t * 1.3 + m.ph * 3);
      const r = m.r * (.6 + m.z * 1.1);
      drawBlob(m.ink ? blobSprites.moteInk : blobSprites.mote, x, y, r, m.a * tw * (m.ink ? (pal.dark ? .35 : .22) : (pal.dark ? .5 : .95)));
    }
  }
  // smugi wiatru: miękkie wstęgi światła, które przebiegają przez kadr razem z podmuchem
  function drawStreaks(t) {
    for (const s of streaks) {
      const u = (t - s.t0) / s.dur;
      if (u <= 0 || u >= 1) continue;
      const head = inOutSine(u) * 1.3, tail = head - .3;
      const a0 = clamp(tail), a1 = clamp(head, 0, 1);
      if (a1 - a0 < .01) continue;
      const cos = Math.cos(s.th), sin = Math.sin(s.th);
      const pt = q => {
        const d = q * s.len, off = s.amp * Math.sin(s.k * d + s.ph);
        return [s.x + d * cos + off * sin, s.y - d * sin + off * cos];
      };
      const p0 = pt(a0), p1 = pt(a1);
      const c = pal.dark ? tint(pal.accent, .4) : WHITE;
      const al = s.a * Math.sin(Math.PI * u) * (pal.dark ? .3 : .95);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const p = pt(lerp(a0, a1, i / 28));
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      // miękka krawędź bez ctx.filter (rozmycie całej kreski jest bardzo wolne): trzy coraz węższe pociągnięcia
      for (const [wk, ak] of [[2.4, .16], [1.5, .26], [.7, .42]]) {
        const gr = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
        gr.addColorStop(0, rgba(c, 0));
        gr.addColorStop(.75, rgba(c, al * ak));
        gr.addColorStop(1, rgba(c, 0));
        ctx.strokeStyle = gr;
        ctx.lineWidth = s.w * wk;
        ctx.stroke();
      }
    }
  }

  // ================================================================
  //  Akt 1 i 2: pisanie, kursor, wiatr
  // ================================================================
  function drawTyped(t) {
    if (t > flightEnd) return;
    const ink = rgba(pal.text);
    const flying = [];
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (const c of chars) {
      if (t < c.tt) continue;
      const tau = t - c.t0;
      if (tau >= 0) { flying.push(c); continue; }
      ctx.font = c.font;
      ctx.fillStyle = ink;
      const a = outCubic((t - c.tt) / .2);
      if (a < 1) {
        // litera „wsiąka” w ekran: z dołu, z rozmycia
        ctx.globalAlpha = a;
        setBlur((1 - a) * 9);
        ctx.fillText(c.ch, c.x, c.base + (1 - a) * 16);
        setBlur(0);
        ctx.globalAlpha = 1;
      } else if (tau > -.6) {
        // tuż przed oderwaniem litera pochyla się z wiatrem i lekko drży
        const p = Math.pow(1 + tau / .6, 2);
        ctx.save();
        ctx.translate(c.cx + 9 * p, c.cy - 6 * p);
        ctx.rotate(c.lean * p + .022 * Math.sin(tau * 34 + c.px) * p);
        ctx.fillText(c.ch, -c.w / 2, c.base - c.cy);
        ctx.restore();
      } else {
        ctx.fillText(c.ch, c.x, c.base);
      }
    }

    // liście: najpierw dalekie, na końcu te najbliżej kamery
    flying.sort((p, q) => p.depth - q.depth);
    for (const c of flying) {
      const tau = t - c.t0;
      const f = flight(c, tau);
      if (f.x > W + 520 || f.y < -520) continue;
      const sp = sprites[c.sp];
      const m = tau / .56;
      if (m < 1) {
        // litera przelewa się w liść
        const color = mixC(pal.text, sp.rgb, smooth(.05, .8, m));
        const lean = c.lean, rot = lerp(lean, f.ang * .35, inOutCubic(m));
        gooDraw(f.x, f.y, color, m,
          g => { g.rotate(rot); g.font = c.font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(c.ch, -c.w / 2, c.base - c.cy); },
          g => { const k = f.len / sp.len; g.rotate(f.ang); g.scale(k, k * f.sy); g.drawImage(sp.levels[0], -sp.cx, -sp.oy); });
        const cf = smooth(.72, 1, m);
        if (cf > 0) drawSprite(sp, f.x, f.y, f.ang, f.len, f.sy, 0, cf);
      } else {
        drawSprite(sp, f.x, f.y, f.ang, f.len, f.sy, f.blur, c.depth < .25 ? .88 : 1);
      }
    }
  }

  function drawCaret(t) {
    const out = 1 - smooth(T.kursorZnika, T.kursorZnika + .4, t);
    const inn = smooth(.25, .6, t);
    if (out <= 0 || inn <= 0) return;
    let i = 0;
    while (i < caretStops.length - 1 && caretStops[i + 1].t <= t) i++;
    const cur = caretStops[i], prev = caretStops[Math.max(0, i - 1)];
    const sameLine = prev.y === cur.y;
    const e = outCubic((t - cur.t) / .12);
    const x = sameLine ? lerp(prev.x, cur.x, e) : cur.x;
    const y = cur.y;
    // w trakcie pisania kursor świeci równo; kiedy czeka (przed pisaniem i po nim) — spokojnie pulsuje
    const od = t < T.pisanie ? 0 : i >= caretStops.length - 1 ? cur.t : t;
    const blink = lerp(1, .5 + .5 * Math.cos((t - od) * TAU / 1.05), smooth(.2, .45, t - od));
    const jump = sameLine ? 1 : e;
    ctx.globalAlpha = out * inn * blink * jump;
    ctx.fillStyle = rgba(pal.ink);
    const h = TYPE.size * .98, w = 6;
    roundRect(x + 7, y - h * .8, w, h, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ================================================================
  //  Akt 3: zdanie — słowo po słowie wychodzi z rozmycia
  // ================================================================
  function drawLine2(t) {
    if (t < T.zdanie || t > T.zdanieZnika + .9) return;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (const w of words) {
      const a = outQuint((t - T.zdanie - w.i * .13 - w.line * .12) / .95);
      const o = inOutCubic((t - T.zdanieZnika - w.i * .035) / .6);
      const alpha = a * (1 - o);
      if (alpha <= .004) continue;
      ctx.font = w.font;
      ctx.fillStyle = rgba(w.line ? pal.ink : pal.text);
      ctx.globalAlpha = alpha;
      setBlur((1 - a) * 16 + o * 12);
      ctx.fillText(w.w, w.x, w.base + (1 - a) * 30 - o * 22);
    }
    setBlur(0);
    ctx.globalAlpha = 1;
  }

  // ================================================================
  //  Akt 4: listek wraca, siada na „l”, „relief” → „releaf”
  // ================================================================
  function markLayout(q) {
    // q[i] — postęp zamiany litery w slocie i (0 = „relief”, 1 = „releaf”); szerokości płyną razem z nią
    const tr = MARK.size * MARK.track;
    const xs = [];
    let x = 0;
    mark.slots.forEach((s, i) => {
      const e = inOutCubic(q[i] || 0);
      const w = lerp(s.wa, s.wb, e);
      xs.push({ x, w });
      const en = inOutCubic(Math.max(q[i] || 0, q[i + 1] || 0));
      x += w + lerp(s.ka, s.kb, en) + tr;
    });
    const total = x - tr;
    const x0 = W / 2 - total / 2;
    xs.forEach(p => { p.x += x0; });
    return xs;
  }

  function drawMark(t) {
    if (t < T.lisc) return;
    const tl = t - T.laduje;                            // sekundy od lądowania listka
    const q = mark.slots.map((s, i) => s.zmiana ? clamp((tl - .05 - (i - mark.first) * .13) / .62) : 0);
    const xs = markLayout(q);
    const bounce = tl > 0 ? 7 * Math.exp(-6.5 * tl) * Math.sin(15 * tl) : 0;
    const base = MARK.base + bounce;

    // rozbłysk przy lądowaniu
    if (tl > 0 && tl < 1.4) {
      const p = outCubic(tl / 1.4);
      drawBlob(blobSprites.light, xs[mark.lIdx].x + xs[mark.lIdx].w / 2 + 60, base - 110, lerp(160, 620, p), (1 - p) * (pal.dark ? .22 : .85));
    }

    // --- listek (pod literami: ogonek wychodzi „z wnętrza” litery l) ---
    const L = xs[mark.lIdx];
    const ax = L.x + L.w / 2, ay = base - mark.lAsc + 16;
    const u = clamp((t - T.lisc) / (T.laduje - T.lisc));
    const e = inOutSine(u) * .35 + outCubic(u) * .65;
    const fin = -.66;                                   // kąt listka w znaku
    const sx = 1060, sy0 = -210, cxp = 700, cyp = 470;  // skąd przylatuje i przez co
    const bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cxp + e * e * ax;
    const by = (1 - e) * (1 - e) * sy0 + 2 * (1 - e) * e * cyp + e * e * ay;
    const swayP = u * TAU * 1.55 + .5, fade = Math.pow(1 - e, 1.25);
    let lx = bx + 150 * Math.sin(swayP) * fade;
    let ly = by - 26 * Math.abs(Math.cos(swayP)) * fade;
    let ang = fin + fade * (2.1 + .95 * Math.cos(swayP));
    let flip = lerp(Math.cos(u * 8.5 + .4), 1, smooth(.5, .96, u));
    let len = 172 * lerp(2.0, 1, e), blur = 20 * Math.pow(1 - e, 1.4);
    if (tl > 0) {
      ang += .24 * Math.exp(-4.2 * tl) * Math.sin(12.5 * tl) + .035 * Math.sin(1.7 * tl) * smooth(.6, 1.6, tl);
      lx = ax; ly = ay; flip = 1; len = 172; blur = 0;
    }
    drawSprite(logoSprite, lx, ly, ang, len, flip, blur, smooth(0, .12, u), true);

    // --- litery ---
    const reveal = t - T.znak;
    if (reveal < 0) return;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = mark.font;
    mark.slots.forEach((s, i) => {
      const a = outQuint((reveal - i * .055) / .85);
      if (a <= .004) return;
      const tone = i >= mark.lIdx ? smooth(0, .55, tl - (i - mark.lIdx) * .08) : 0;
      const color = mixC(pal.text, pal.ink, tone);
      const p = xs[i], m = q[i];
      const y = base + (1 - a) * 34;
      if (m > 0 && m < 1) {
        // litera przelewa się w inną — tak samo jak wcześniej litery w liście
        const mid = mark.xh / 2;
        gooDraw(p.x + p.w / 2, y - mid, color, m,
          g => { g.font = mark.font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(s.a, -s.wa / 2, mid); },
          g => { g.font = mark.font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(s.b, -s.wb / 2, mid); });
        return;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(color);
      setBlur((1 - a) * 18);
      ctx.fillText(m >= 1 ? s.b : s.a, p.x, y);
    });
    setBlur(0);
    ctx.globalAlpha = 1;

    // --- hasło ---
    const ta = outQuint((t - T.haslo) / 1.1);
    if (ta > .004) {
      ctx.font = mark.tagFont;
      ctx.fillStyle = rgba(pal.muted);
      ctx.globalAlpha = ta;
      setBlur((1 - ta) * 12);
      ctx.fillText(COPY.haslo, W / 2 - mark.tagW / 2, MARK.base + 104 + (1 - ta) * 22);
      setBlur(0);
      ctx.globalAlpha = 1;
    }
  }

  // ================================================================
  //  Klatka: kamera (powolny najazd, oddech przy wietrze) + warstwy
  // ================================================================
  function camera(t) {
    const push = .045 * inOutSine(t / T.wiatr);                          // powoli bliżej, kiedy pisze się myśl
    const release = .06 * smoother((t - T.wiatr) / 3.4);                 // wiatr: kadr się „rozluźnia”
    const logo = .035 * inOutSine((t - T.lisc) / (DUR - T.lisc));        // spokojny najazd na znak
    const wp = windPush(t), back = smoother((t - T.zdanie + .6) / 2.4);
    return {
      z: 1 + push - release + logo,
      x: 26 * wp * (1 - back),
      y: -22 * wp * (1 - back),
    };
  }
  function withCamera(cam, k, fn) {
    ctx.save();
    ctx.translate(W / 2 + cam.x * k, H * .47 + cam.y * k);
    const z = 1 + (cam.z - 1) * k;
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H * .47);
    fn();
    ctx.restore();
  }

  function render(t) {
    t = clamp(t, 0, DUR);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (HAS_FILTER) ctx.filter = 'none';
    const cam = camera(t);

    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(1.06, 1.06); ctx.translate(-W / 2, -H / 2);   // zapas na ruch kamery
    withCamera(cam, .35, () => drawBackground(t));
    ctx.restore();
    withCamera(cam, .6, () => { drawMotes(t, false); drawStreaks(t); });
    withCamera(cam, 1, () => {
      drawTyped(t);
      drawCaret(t);
      drawLine2(t);
      drawMark(t);
    });
    withCamera(cam, 1.5, () => drawMotes(t, true));

    // ziarno + miękkie otwarcie z koloru tła
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, W, H);
    const veil = 1 - smooth(0, .8, t);
    if (veil > 0) { ctx.fillStyle = rgba(pal.bg, veil); ctx.fillRect(0, 0, W, H); }
  }

  // Klatka do wideo: n pod-klatek w czasie otwarcia migawki (połowa klatki), uśrednione — rozmycie ruchu
  function klatka(i, fps = 30, n = 8, migawka = .5) {
    const t = i / fps;
    for (let k = 0; k < n; k++) {
      ctx = sceneCtx;
      render(t + ((k + .5) / n - .5) * migawka / fps);
      ctx = out;
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.globalAlpha = 1 / (k + 1);
      out.drawImage(scene, 0, 0);
    }
    out.globalAlpha = 1;
  }

  // ================================================================
  //  Start, odtwarzanie, przyciski
  // ================================================================
  function build() {
    pal = readPalette();
    sprites = VARIANTS.map(v => makeSprite(v));
    logoSprite = makeSprite({ wr: .35, curl: .42, fold: .3, serr: 0, stalk: .2, tone: .5, hue: 0, vivid: 1 }, 400);
    buildBackdrop();
    layoutTyped();
    layoutLine2();
    layoutMark();
  }

  const btn = document.getElementById('promo-play');
  const range = document.getElementById('promo-range');
  const label = document.getElementById('promo-time');
  let now = 0, playing = false, raf = 0, last = 0;
  const PAUZA = 1.4;                                    // chwila na ostatniej klatce przed powtórką

  function show(t) {
    now = t;
    render(Math.min(t, DUR));
    if (range) range.value = Math.min(t, DUR).toFixed(2);
    if (label) label.textContent = `${Math.min(t, DUR).toFixed(1).replace('.', ',')} s`;
  }
  function tick(ms) {
    if (!playing) return;
    const dt = Math.min(.1, (ms - last) / 1000);
    last = ms;
    let t = now + dt;
    if (t > DUR + PAUZA) t = 0;
    show(t);
    raf = requestAnimationFrame(tick);
  }
  function graj() {
    if (playing) return;
    if (now >= DUR) now = 0;
    playing = true;
    last = performance.now();
    if (btn) btn.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    if (btn) btn.setAttribute('aria-pressed', 'false');
  }
  function przewin(t) { stop(); show(clamp(+t || 0, 0, DUR)); }

  if (btn) btn.addEventListener('click', () => (playing ? stop() : graj()));
  if (range) range.addEventListener('input', () => przewin(range.value));
  cv.addEventListener('click', () => (playing ? stop() : graj()));
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); if (playing) stop(); else graj(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && playing) last = performance.now(); });
  window.addEventListener('themechange', () => { build(); if (!playing) show(now); });

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fonts = document.fonts
    ? Promise.all(['500 46px', '600 106px', '800 204px'].map(f => document.fonts.load(`${f} "Plus Jakarta Sans"`, 'aąśłóż')))
      .then(() => document.fonts.ready).catch(() => {})
    : Promise.resolve();

  const gotowe = fonts.then(() => {
    build();
    const t = parseFloat(params.get('t'));
    if (!Number.isNaN(t)) show(clamp(t, 0, DUR));
    else if (widok === 'statyczny' || reduce) show(DUR);   // bez animacji: gotowy znak
    else if (widok === 'czysty') show(0);                  // render do wideo steruje klatkami sam
    else { show(0); graj(); }
  });

  window.PromoWiatr = { czas: DUR, gotowe, render, klatka, graj, stop, przewin };
})();
