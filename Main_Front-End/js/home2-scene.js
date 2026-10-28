/*
 * Strona główna, wersja 2 — roślinka na górze ekranu (canvas 2D w .stage).
 *
 * Roślinka jest od razu dorosła: po wejściu sama wyrasta (ok. 2 s) — łodyga, 7 odnóg (po jednej na każdy dzień
 * tygodnia) i kwiat na czubku. Liść na końcu odnogi pokazuje, jaki był dzień: większy i żywszy = lepszy dzień.
 * Dzisiejsza odnoga to pąk, który rozwija się po podlaniu. Dzień bez podlania = mały, uśpiony pąk (bez więdnięcia).
 * Kwiat jest otwarty przy co najmniej 3 podlaniach w ostatnich 7 dniach, inaczej zamyka się w pąk.
 * Po wejściu najstarszy liść (sprzed 8 dni) odpada i spływa na ziemię — okno 7 dni przesuwa się codziennie.
 *
 * Przewijanie ożywia roślinkę:
 *   • szybkość przewijania = wiatr (liście szumią),
 *   • sekcja „Twój tydzień” na ekranie → podpisy dni + fala podświetlenia przez liście dni,
 *   • sekcja „Myśl na dziś” → kwiat rozbłyska i sypie płatkami,
 *   • powitanie znika, a scena lekko się zmniejsza, żeby zrobić miejsce na treść.
 * Podlewanie: deszcz, światło w górę łodygi, kropelki zostające na liściach, dzisiejszy pąk rozwija się w liść.
 * Stuknięcie w liść dnia podświetla go i zgłasza zdarzenie 'dayselect'.
 * Tło sceny zależy od pory dnia (rano ciepłe światło, wieczorem więcej świetlików, w nocy gwiazdki).
 *
 * Kolory z motywu (css/tokens.css, --plant-*), płynna zmiana po 'themechange'.
 * ?widok=… — bez animacji (zrzuty, podgląd dla zespołu).
 *
 * API (window.Home2Scene): start({ days, labels, missed }), water(mood?), select(i), isWatered(), debugAdvance(sec)
 *   water(mood) — mood 1–10 z pytań podlewania ustala wielkość dzisiejszego liścia (bez niego: średni liść).
 *   full(t, fast) — 0–1: scena rośnie do pełnego ekranu (telefon; aplikacja pociąga w dół na górze strony).
 * <div class="stage" data-blisko> (aplikacja.html) — na telefonie roślinka jest większa („bliżej”), lekko w prawo od powitania,
 * a canvas ma wysokość całego ekranu, żeby scena mogła urosnąć do pełnego ekranu.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('plant');
  const stage = document.getElementById('stage');
  if (!canvas || !canvas.getContext) { window.Home2Scene = { start() {}, water() {}, select() {}, isWatered: () => false }; return; }
  const ctx = canvas.getContext('2d');
  const closeUp = stage.hasAttribute('data-blisko');

  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;
  const motion = reduceMotion ? 0 : 1;
  const TAU = Math.PI * 2;

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const flipScale = phi => { const c = Math.cos(phi); return (c < 0 ? -1 : 1) * Math.max(.2, Math.abs(c)); };
  const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = seeded(20260930);
  const rand = (a, b) => a + Math.random() * (b - a);
  const srand = (a, b) => a + rnd() * (b - a);

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
  const WHITE = [255, 255, 255];
  const tint = (c, t) => mixC(c, WHITE, t);
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => hex(cs.getPropertyValue(name));
    return {
      stem: v('--plant-stem'), l1: v('--plant-leaf-1'), l2: v('--plant-leaf-2'), l3: v('--plant-leaf-3'),
      flower: v('--plant-flower'), tip: v('--plant-flower-tip'), core: v('--plant-core'),
      ground: v('--plant-ground'), glow: v('--plant-glow'),
      primary: v('--primary'), muted: v('--text-muted'),
      water: mixC(v('--accent-light'), WHITE, .2),
      bokeh: [v('--mist'), v('--mint'), v('--accent-light'), v('--plant-flower')],
    };
  }
  const lerpDeep = (a, b, t) => typeof a[0] === 'number' ? mixC(a, b, t) : a.map((x, i) => lerpDeep(x, b[i], t));
  function lerpPalette(a, b, t) { const o = {}; for (const k in a) o[k] = lerpDeep(a[k], b[k], t); return o; }
  let pal = readPalette(), palFrom = pal, palTo = pal, palT = 1;

  // Kolory liścia: ton (0 = młody/jasny … 1 = dojrzały/ciemny) i żywość (0 = blady … 1 = soczysty)
  function leafColors(tone, vivid, hue = 0) {
    let base = mixC(mixC(pal.l3, pal.l2, clamp(tone * 1.6)), pal.l1, clamp(tone * 1.4 - .4));
    base = hue > 0 ? mixC(base, pal.l3, hue) : mixC(base, pal.l1, -hue);
    const lively = mixC(tint(base, .62), base, .2 + .8 * vivid);
    return {
      light: rgba(tint(lively, .07)),
      mid: rgba(lively),
      dark: rgba(mixC(lively, pal.stem, .2 + .1 * tone)),
      edge: rgba(mixC(lively, pal.stem, .55), .35),
      vein: rgba(tint(lively, .45), .3),
    };
  }

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
  //  Pora dnia (tło sceny)
  // ================================================================
  const hour = new Date().getHours();
  const DAYPART = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'evening' : 'night';
  const FIREFLY_N = { morning: 7, day: 6, evening: 14, night: 18 }[DAYPART];

  // ================================================================
  //  Stan
  // ================================================================
  let W = 0, H = 0, CW = 0, CH = 0, wide = false, stageMax = 0;
  let stageH = 0, baseX = 0, baseY = 0, S = 2, topReserve = 110;
  let clock = 0, lastMs = performance.now(), wind = 0, lastScroll = window.scrollY;
  let started = false;

  const st = { intro: 0, shrink: 0, greet: 0, labels: 0, awake: 1, full: 0 };
  let fullTarget = 0, fullRate = 6;
  let days = [], labels = [], missed = [];
  let fallen = null, fallDone = false, twig0 = null;
  let todayMood = null;                                           // nastrój z dzisiejszego podlewania
  let wateredAt = null, wetAt = -99, sel = -1, selAt = -10, flareAt = -10, pulseAt = null;
  let waveAt = -10, weekIn = false, quoteIn = false, bloomFlashAt = -10;
  const drops = [], rings = [], petals = [], sparks = [];
  const leafPos = [];
  const pointer = { x: 0, y: 0, active: false };

  const bokeh = Array.from({ length: 5 }, (_, i) => ({ nx: rand(0, 1), ny: rand(0, 1), r: rand(70, 150), spr: i % 4, a: rand(.16, .28), f: rand(.03, .07), ph: rand(0, TAU) }));
  const floaters = Array.from({ length: 6 }, () => ({ nx: rand(0, 1), ny: rand(0, 1), len: rand(12, 18), tone: rand(0, .6), f: rand(.15, .3), ph: rand(0, TAU), fall: rand(5, 10), rot: rand(0, TAU), spin: rand(-.35, .35), al: rand(.2, .34), wr: rand(.36, .44), curl: rand(-.5, .5) }));
  const fireflies = Array.from({ length: FIREFLY_N }, () => ({ cx: rand(-40, 40), cy: rand(-100, -10), rx: rand(6, 18), ry: rand(4, 12), sp: rand(.25, .55) * (Math.random() < .5 ? -1 : 1), ph: rand(0, TAU), size: rand(18, 28), bs: rand(.9, 1.9), bp: rand(0, TAU) }));
  const stars = Array.from({ length: 30 }, () => ({ nx: rand(0, 1), ny: rand(0, .55), r: rand(.6, 1.5), ph: rand(0, TAU), sp: rand(.6, 1.6) }));
  // Tryb nocny (js/theme.js): zawsze nocne niebo z gwiazdami i księżycem
  const darkMode = () => !!(window.Theme && window.Theme.isDark && window.Theme.isDark());

  // ================================================================
  //  Roślina (jednostki: pełna wysokość ≈ 100; y w górę ujemne)
  // ================================================================
  const FULL_H = 96;
  // Kształt rośliny jest naturalny i niesymetryczny, ale stały (losowanie z ziarnem — zawsze ta sama roślinka).
  const FLIP = rnd() < .5 ? -1 : 1;                                   // w którą stronę się przechyla
  const LEAN = srand(6, 10) * FLIP;
  const STEM_CP = [
    [0, 0], [srand(-2.4, -.8) * FLIP, -.16], [srand(.6, 2) * FLIP, -.33], [LEAN * .22 + srand(-1.2, 1.2), -.5],
    [LEAN * .5 + srand(-1, 1), -.67], [LEAN * .8, -.84], [LEAN * .95, -.95], [LEAN, -1],
  ];
  // Łodyga jako gładka krzywa (Catmull-Rom) z parametrem po długości
  function stemP(h) {
    const k = h / FULL_H;
    const cp = STEM_CP.map(([x, y]) => [x * k, y * h]);
    const pts = [];
    for (let i = 0; i < cp.length - 1; i++) {
      const p0 = cp[i - 1] || cp[i], p1 = cp[i], p2 = cp[i + 1], p3 = cp[i + 2] || p2;
      for (let s = i ? 1 : 0; s <= 8; s++) {
        const t = s / 8, t2 = t * t, t3 = t2 * t;
        pts.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
      }
    }
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, L, tot: L[L.length - 1] || 1 };
  }
  function stemRaw(P, t) {
    const d = clamp(t) * P.tot;
    let i = 1;
    while (i < P.L.length - 1 && P.L[i] < d) i++;
    const f = (d - P.L[i - 1]) / ((P.L[i] - P.L[i - 1]) || 1);
    return [lerp(P.pts[i - 1][0], P.pts[i][0], f), lerp(P.pts[i - 1][1], P.pts[i][1], f)];
  }

  // Odnogi dni: im nowszy dzień, tym wyżej. Odstępy, kąty i długości nierówne; niższe (starsze) opadają.
  const DAY_T0 = [.19, .28, .37, .47, .57, .67, .78];
  const SIDES = [1, -1, -1, 1, -1, 1, -1].map(v => v * FLIP);
  const dayTwig = Array.from({ length: 7 }, (_, i) => ({
    t: DAY_T0[i] + srand(-.015, .015), side: SIDES[i],
    spread: srand(.95, 1.35) - i * .03,            // odchylenie od łodygi
    droop: (1 - i / 6) * .32 + srand(0, .14),      // grawitacja: starsze odnogi są cięższe
    lenK: srand(.82, 1.18),
    leafDroop: srand(.12, .4),
    curl: srand(-.6, .6), fold: srand(.1, .45), ph: srand(0, TAU),
    // różnorodność: część liści wąska i długa, część szersza; różna wielkość i odcień
    shape: i === 1 || i === 4 ? 'lance' : 'ovate', wr: i === 1 || i === 4 ? srand(.28, .33) : srand(.36, .46),
    sizeK: srand(.82, 1.15), toneK: srand(-.15, .15),
    serr: rnd() < .5 ? 1 : 0, hue: srand(-.3, .3),
    beads: Array.from({ length: 3 }, () => [srand(.35, .8), srand(-.35, .35), srand(.6, 1)]),
    // drobne listki po drodze (nie oznaczają dni — robią roślinkę gęstszą)
    extra: Array.from({ length: i < 5 ? (rnd() < .6 ? 1 : 2) : 1 }, (_, e) => ({ f: srand(.35, .65), side: e % 2 ? 1 : -1, len: srand(4.5, 7), tone: srand(.4, .8), wr: srand(.34, .42), curl: srand(-.5, .5), ph: srand(0, TAU) })),
  }));
  const dayLeaf = dayTwig;   // (zgodność nazw w rysowaniu)

  // Liście na łodydze: gęsta, nierówna kępa u dołu, pojedyncze wyżej, młode przy czubku
  // (dolne liście łukiem w górę i na boki, za łodygą — nie opadają do ziemi jak „nogi”)
  const STEM_LEAVES = [
    { t: .07, side: -1, len: 15, spread: 1.08, droop: .05, tone: 1, wr: .42, behind: true },
    { t: .09, side: 1, len: 13.5, spread: 1.0, droop: .04, tone: .95, wr: .41, behind: true },
    { t: .135, side: -1, len: 10, spread: .88, droop: .02, tone: .85, wr: .4 },
    { t: .42, side: 1, len: 6, spread: .95, tone: .55, wr: .38 },
    { t: .62, side: -1, len: 5.5, spread: .9, tone: .45, wr: .36 },
    { t: .86, side: 1, len: 7.5, spread: .75, tone: .25, wr: .3, shape: 'lance' },
    { t: .93, side: -1, len: 6.5, spread: .62, tone: .15, wr: .28, shape: 'lance' },
  ].map(l => ({ ...l, side: l.side * FLIP, t: l.t + srand(-.01, .01), len: l.len * srand(.9, 1.1), curl: srand(-.5, .5), fold: srand(.15, .5), ph: srand(0, TAU), serr: l.shape ? 0 : 1, beads: Array.from({ length: 2 }, () => [srand(.35, .8), srand(-.35, .35), srand(.6, 1)]) }));

  // Zapasowy pąk przy czubku (po przeciwnej stronie niż przechył)
  const SPARE_BUD = { t: .9, side: -FLIP, spread: .75, len: 7 };

  // Źdźbła trawy i kamyki przy ziemi
  const GRASS = Array.from({ length: 9 }, (_, i) => ({ x: (i / 8 - .5) * 30 + srand(-2, 2), h: srand(3.5, 7.5), lean: srand(-.5, .5), ph: srand(0, TAU), tone: srand(.2, .9) }));
  const PEBBLES = [{ x: -11, r: 1.6 }, { x: 13, r: 1.2 }, { x: 8.5, r: .8 }];

  // Łodyga prawie sztywna: kołysze się tylko lekko u góry (szeleszczą głównie liście)
  function toScreen(x, y) {
    const hh = clamp(-y / 100, 0, 1.2);
    const calm = Math.sin(clock * .55 + y * .02) * .6 + Math.sin(clock * 1.3 + y * .05) * .18;
    const rustle = Math.sin(clock * 6 + y * .15) * wind * .45;
    const dx = (calm * (1 + wind * .8) + rustle) * hh * hh * motion;
    return [baseX + (x + dx) * S, baseY + y * S];
  }
  const stemPt = (P, t) => { const p = stemRaw(P, t); return toScreen(p[0], p[1]); };
  const stemAng = (P, t) => { const a = stemPt(P, Math.max(0, t - .02)), b = stemPt(P, Math.min(1, t + .02)); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  // kąt „z opadaniem”: przesunięcie w stronę dołu-na-zewnątrz
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const droopAng = (a, side, k) => a + angDiff(a, side > 0 ? .5 : Math.PI - .5) * k;

  // Fazy wejścia (roślinka sama wyrasta po otwarciu strony) — płynnie, bez sprężynowania
  const introStem = () => easeOutCubic(clamp(st.intro / .5));
  const introLeaf = k => clamp((st.intro - .15 - k * .03) / .35);
  const introBranch = i => clamp((st.intro - .3 - i * .06) / .4);
  const introBloom = () => easeOutCubic(clamp((st.intro - .62) / .38));
  const grown = e => (reduceMotion ? 1 : easeOutCubic(e));
  // długość liścia dnia: zależy od samopoczucia, ale każdy liść ma też swój rozmiar
  const dayLeafLen = tw => (6.5 + 7.5 * tw.mood / 10) * 1.3 * tw.L.sizeK * S * tw.k;

  // ================================================================
  //  Rysowanie liścia: ogonek, blaszka zagięta wzdłuż nerwu, ząbki, gradient, żyłki, kropelki
  // ================================================================
  function leafProfile(shape, u) {
    if (shape === 'lance') return Math.pow(Math.sin(Math.PI * u), 1.15) * .7;
    return Math.pow(Math.sin(Math.PI * Math.pow(u, .72)), .82);
  }
  function drawLeaf(x, y, ang, len, o, alpha = 1) {
    if (len < 1.5 || alpha <= .01) return;
    const col = o.colors;
    const stalkL = len * (o.stalk != null ? o.stalk : .14);
    const bl = len - stalkL, Wd = bl * o.wr;
    const N = len > 40 ? 20 : 14;
    const shape = o.shape || 'ovate';
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
      let w = Wd * leafProfile(shape, u);
      if (teeth && u > .12 && u < .96) w *= 1 + .035 * (1 - Math.abs(((u * teeth) % 1) * 2 - 1));
      up.push([mid[k][0] - nx * w * (1 - fold * .35), mid[k][1] - ny * w * (1 - fold * .35)]);
      lo.push([mid[k][0] + nx * w * (1 + fold * .06), mid[k][1] + ny * w * (1 + fold * .06)]);
    }
    // gładka krzywa przez punkty brzegu
    const trace = pts => {
      ctx.lineTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    };

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (o.sy) ctx.scale(1, o.sy);
    else if (o.flip) ctx.scale(1, flipScale(o.flip));
    ctx.globalAlpha = alpha;

    // ogonek
    ctx.lineCap = 'round';
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = Math.max(1, len * .035);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(stalkL * .5, mid[0][1] - len * .01, mid[0][0], mid[0][1]); ctx.stroke();

    // górna połowa (w świetle) — gradient od nasady do czubka
    const g = ctx.createLinearGradient(stalkL, 0, len, 0);
    g.addColorStop(0, col.mid);
    g.addColorStop(1, col.light);
    ctx.beginPath();
    ctx.moveTo(mid[0][0], mid[0][1]);
    trace(up);
    for (let k = N; k >= 0; k--) ctx.lineTo(mid[k][0], mid[k][1]);
    ctx.fillStyle = g;
    ctx.fill();
    // dolna połowa (w cieniu)
    ctx.beginPath();
    ctx.moveTo(mid[0][0], mid[0][1]);
    trace(lo);
    for (let k = N; k >= 0; k--) ctx.lineTo(mid[k][0], mid[k][1]);
    ctx.fillStyle = col.dark;
    ctx.fill();
    // cienki kontur — liść wygląda na płaski i matowy, nie „gumowy”
    ctx.beginPath();
    ctx.moveTo(mid[0][0], mid[0][1]);
    trace(up);
    for (let k = N; k >= 0; k--) ctx.lineTo(lo[k][0], lo[k][1]);
    ctx.strokeStyle = col.edge;
    ctx.lineWidth = Math.max(.5, len * .012);
    ctx.stroke();

    // nerw główny i boczne żyłki
    ctx.strokeStyle = col.vein;
    ctx.lineWidth = Math.max(.7, len * .018);
    ctx.beginPath();
    ctx.moveTo(mid[0][0], mid[0][1]);
    for (let k = 1; k <= N; k++) ctx.lineTo(mid[k][0], mid[k][1]);
    ctx.stroke();
    if (len > 18) {
      ctx.lineWidth = Math.max(.5, len * .009);
      ctx.beginPath();
      const pairs = len > 40 ? 4 : 3;
      for (let j = 1; j <= pairs; j++) {
        const k = Math.round(N * (.1 + j * (.78 / pairs)));
        const m = mid[k], tu = up[Math.min(N, k + 2)], tl = lo[Math.min(N, k + 2)];
        ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo(lerp(m[0], tu[0], .5), lerp(m[1], tu[1], .3), lerp(m[0], tu[0], .85), lerp(m[1], tu[1], .85));
        ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo(lerp(m[0], tl[0], .5), lerp(m[1], tl[1], .3), lerp(m[0], tl[0], .85), lerp(m[1], tl[1], .85));
      }
      ctx.stroke();
    }
    // światło na brzegu
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = Math.max(.6, len * .012);
    ctx.beginPath();
    ctx.moveTo(up[1][0], up[1][1]);
    for (let k = 2; k < N * .85; k++) ctx.lineTo(up[k][0], up[k][1]);
    ctx.stroke();

    // kropelki po podlaniu
    if (o.wet > 0 && o.beads) {
      for (const [bu, bv, bs] of o.beads) {
        const k = Math.round(bu * N), m = mid[k], u2 = up[k];
        const px = lerp(m[0], u2[0], .5 + bv), py = lerp(m[1], u2[1], .5 + bv);
        const r = Math.max(1.2, len * .045 * bs);
        ctx.globalAlpha = alpha * o.wet;
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath(); ctx.arc(px - r * .3, py - r * .3, r * .35, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Kwiat: dwie warstwy płatków, pręciki, lekki „oddech”
  function drawFlower(x, y, R, open, flash) {
    if (open <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(clock * .5) * .03 * motion);
    const gR = R * (2.4 + flash * 1.2);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    gl.addColorStop(0, rgba(pal.glow, (.5 + flash * .35) * open));
    gl.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, gR, 0, TAU); ctx.fill();

    // lekko z profilu, przechylony w stronę, w którą rośnie roślinka
    ctx.rotate(FLIP * .18);
    ctx.scale(open * .9, open * .82);
    const petal = (len, wid, rot, c1, c2) => {
      ctx.save();
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(wid, -len * .25, wid * .95, -len * .8, 0, -len);
      ctx.bezierCurveTo(-wid * .95, -len * .8, -wid, -len * .25, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = Math.max(.6, R * .03);
      ctx.beginPath(); ctx.moveTo(0, -len * .12); ctx.lineTo(0, -len * .75); ctx.stroke();
      ctx.restore();
    };
    for (let k = 0; k < 6; k++) petal(R * 1.05, R * .5, k * TAU / 6 + .26, rgba(pal.flower), rgba(tint(pal.tip, .1)));
    for (let k = 0; k < 5; k++) petal(R * .72, R * .36, k * TAU / 5, rgba(mixC(pal.flower, pal.core, .15)), rgba(pal.tip));
    ctx.beginPath(); ctx.arc(0, 0, R * .3, 0, TAU); ctx.fillStyle = rgba(pal.core); ctx.fill();
    ctx.fillStyle = rgba(mixC(pal.core, WHITE, .45));
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8 + .2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * R * .19, Math.sin(a) * R * .19, R * .045, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(-R * .08, -R * .08, R * .08, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    ctx.restore();
  }

  function drawStem(P) {
    const n = 48, pts = [];
    for (let i = 0; i <= n; i++) pts.push(stemPt(P, i / n));
    ctx.lineCap = 'round';
    const col = rgba(pal.stem), hi = rgba(tint(pal.stem, .4), .35);
    ctx.strokeStyle = col;
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = Math.max(1.2, lerp(2.7, .85, Math.pow(i / n, .8)) * S);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    ctx.strokeStyle = hi;
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = Math.max(.6, lerp(2.7, .85, Math.pow(i / n, .8)) * S * .28);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0] - .8, pts[i - 1][1]); ctx.lineTo(pts[i][0] - .8, pts[i][1]); ctx.stroke();
    }
  }

  function drawGround() {
    ctx.save();
    ctx.translate(baseX, baseY + 1.5 * S);
    ctx.scale(1, .24);
    const R = 40 * S;
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    halo.addColorStop(0, rgba(pal.l2, .35));
    halo.addColorStop(1, rgba(pal.l2, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
    // cień roślinki
    const sh = ctx.createRadialGradient(baseX + 2 * S, baseY + 1.4 * S, 0, baseX + 2 * S, baseY + 1.4 * S, 16 * S);
    sh.addColorStop(0, rgba(pal.stem, .22));
    sh.addColorStop(1, rgba(pal.stem, 0));
    ctx.save();
    ctx.translate(0, baseY + 1.4 * S);
    ctx.scale(1, .2);
    ctx.translate(0, -(baseY + 1.4 * S));
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(baseX + 2 * S, baseY + 1.4 * S, 16 * S, 0, TAU); ctx.fill();
    ctx.restore();
    const rx = 20 * S, ry = 4.4 * S, cy = baseY + 1.3 * S;
    const mg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    mg.addColorStop(0, rgba(tint(pal.ground, .4)));
    mg.addColorStop(1, rgba(pal.ground));
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(baseX, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(baseX, cy, rx * .96, ry * .9, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    // kamyki
    for (const p of PEBBLES) {
      ctx.fillStyle = rgba(mixC(pal.ground, pal.stem, .35));
      ctx.beginPath(); ctx.ellipse(baseX + p.x * S, cy + .4 * S, p.r * S, p.r * .65 * S, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.ellipse(baseX + (p.x - p.r * .3) * S, cy + .1 * S, p.r * .35 * S, p.r * .2 * S, 0, 0, TAU); ctx.fill();
    }
    // trawa
    ctx.lineCap = 'round';
    for (const g of GRASS) {
      const sway = (Math.sin(clock * 1.7 + g.ph) * .25 + Math.sin(clock * 8 + g.ph) * wind * .3) * motion;
      const gx = baseX + g.x * S, gy = cy - .5 * S;
      const tx = gx + (g.lean + sway) * g.h * S, ty = gy - g.h * S * clamp(st.intro * 2);
      ctx.strokeStyle = leafColors(g.tone, .7).mid;
      ctx.lineWidth = Math.max(1, .55 * S);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + g.lean * g.h * .3 * S, gy - g.h * .6 * S, tx, ty); ctx.stroke();
    }
  }

  // Kopczyk ziemi u nasady: łodyga z niego wyrasta (z korzonkami i odrobiną mchu)
  function drawSoil(P) {
    const [bx0] = stemPt(P, 0);
    const cy = baseY + .6 * S;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mixC(pal.stem, pal.ground, .35));
    ctx.lineWidth = Math.max(1, .7 * S);
    for (const [dx, len, bend] of [[-1, 4.5, .6], [1, 5, -.5], [-.3, 3, .2]]) {
      ctx.beginPath();
      ctx.moveTo(bx0 + dx * .4 * S, cy - .3 * S);
      ctx.quadraticCurveTo(bx0 + dx * len * .6 * S, cy + bend * S, bx0 + dx * len * S, cy + .9 * S);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(bx0, cy - .6 * S, 0, bx0, cy - .6 * S, 6 * S);
    g.addColorStop(0, rgba(mixC(pal.ground, pal.stem, .45)));
    g.addColorStop(1, rgba(mixC(pal.ground, pal.stem, .2)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(bx0, cy - .2 * S, 5.5 * S, 1.9 * S, 0, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx0, cy - .2 * S, 5.5 * S, .9 * S, 0, 0, Math.PI); ctx.fill();
    // mech
    ctx.fillStyle = rgba(mixC(pal.l2, pal.stem, .25), .9);
    for (const [dx, r] of [[-4.2, .9], [-3.2, .7], [3.6, .85], [4.6, .6], [2.8, .55]]) {
      ctx.beginPath(); ctx.arc(bx0 + dx * S, cy - .7 * S, r * S, 0, TAU); ctx.fill();
    }
  }

  // Pora dnia: delikatne światło nad roślinką
  function drawSky() {
    const part = darkMode() ? 'moon' : DAYPART;
    if (part === 'moon') {
      // księżyc w prawym górnym rogu: miękka poświata + tarcza
      const mx = CW * .8, my = Math.max(70, stageH * .17), r = 15;
      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, r * 7);
      glow.addColorStop(0, 'rgba(255,244,214,.28)');
      glow.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, CW, stageH);
      ctx.fillStyle = 'rgba(255,246,222,.95)';
      ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(214,206,186,.35)';
      ctx.beginPath(); ctx.arc(mx - 4, my - 3, 3.2, 0, TAU); ctx.arc(mx + 5, my + 4, 2.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = .3 + .5 * (.5 + .5 * Math.sin(clock * s.sp + s.ph));
        ctx.beginPath(); ctx.arc(s.nx * CW, s.ny * stageH, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (DAYPART === 'morning') {
      const g = ctx.createRadialGradient(CW * .85, 0, 0, CW * .85, 0, Math.max(CW, stageH) * .9);
      g.addColorStop(0, 'rgba(255,226,180,.32)');
      g.addColorStop(1, 'rgba(255,226,180,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, stageH);
    } else if (DAYPART === 'evening') {
      const g = ctx.createLinearGradient(0, 0, 0, stageH);
      g.addColorStop(0, 'rgba(246,184,158,.22)');
      g.addColorStop(1, 'rgba(246,184,158,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, stageH);
    } else if (DAYPART === 'night') {
      const g = ctx.createLinearGradient(0, 0, 0, stageH);
      g.addColorStop(0, 'rgba(40,52,90,.16)');
      g.addColorStop(1, 'rgba(40,52,90,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, stageH);
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = .35 + .5 * (.5 + .5 * Math.sin(clock * s.sp + s.ph));
        ctx.beginPath(); ctx.arc(s.nx * CW, s.ny * stageH, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  }

  // ================================================================
  //  Rozmiar i układ
  // ================================================================
  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    wide = W >= 1024;
    if (wide) stageMax = H;
    else {
      // --stage-max jest w clamp()/svh — mierzymy rzeczywistą wysokość elementem testowym
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--stage-max)';
      document.body.appendChild(probe);
      stageMax = probe.offsetHeight || Math.min(440, H * .47);
      probe.remove();
    }
    // komputer: szerokość sceny z CSS (połowa strony — mniej, gdy obok jest panel Asystenta)
    CW = wide ? (stage.getBoundingClientRect().width || W / 2) : W;
    CH = closeUp && !wide ? H : stageMax;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const greetEl = stage.querySelector('.stage-greet');
  function frameLayout() {
    const f = wide ? 0 : st.full;
    stageH = wide ? H : lerp(lerp(stageMax, stageMax * .86, st.shrink), H, f);
    if (!wide) stage.style.setProperty('--stage-h', stageH.toFixed(1) + 'px');
    greetEl.style.opacity = ((1 - st.greet) * (1 - f)).toFixed(3);
    const greetBottom = greetEl.offsetTop + greetEl.offsetHeight + 8;
    // na telefonie powitanie znika przy przewijaniu, a roślinka zajmuje zwolnione miejsce
    if (wide) topReserve = Math.max(greetBottom + 30, H * .14);
    else if (closeUp) topReserve = lerp(lerp(Math.min(104, greetBottom), 58, st.greet), 84, f);   // „bliżej”: roślinka sięga nad powitanie (stoi obok niego)
    else topReserve = lerp(greetBottom, 58, st.greet);
    baseX = closeUp && !wide ? CW * lerp(lerp(.57, .5, st.greet), .5, f) : CW / 2;
    baseY = stageH - (wide ? H * .1 : lerp(22, 150, f));                // w pełnym ekranie nad kaflem i paskiem zakładek
    S = clamp(Math.min((baseY - topReserve) / (FULL_H + 12), CW * lerp(.9, 1, f) / 78), .9, 7);
  }

  // ================================================================
  //  Aktualizacja
  // ================================================================
  function inView(el) {
    const r = el.getBoundingClientRect();
    const top0 = wide ? 0 : stageH;
    return r.top < H - (H - top0) * .45 && r.bottom > top0 + 40;
  }

  function update(dt) {
    const sy = window.scrollY;
    // wiatr od przewijania: im szybciej, tym mocniej szumi
    const dy = Math.abs(sy - lastScroll);
    lastScroll = sy;
    if (motion && dy > 0) wind = Math.min(1.5, wind + dy * .0028);

    const tShrink = wide ? 0 : clamp(sy / 260);
    const tGreet = wide ? 0 : clamp((sy - 20) / 140);
    const weekVis = inView(document.getElementById('sec-week'));
    const quoteVis = inView(document.getElementById('sec-quote'));
    if (weekVis && !weekIn) waveAt = clock;                              // fala przez liście dni
    if (quoteVis && !quoteIn && st.intro >= 1) { bloomFlashAt = clock; petalBurst(6); }
    weekIn = weekVis; quoteIn = quoteVis;

    // kwiat: otwarty przy >= 3 podlaniach w ostatnich 7 dniach (dzisiejsze też się liczy)
    const wateredCount = days.filter(v => v != null).length + (wateredAt != null && clock >= wateredAt ? 1 : 0);
    const awake = wateredCount >= 3 ? 1 : 0;
    if (reduceMotion) {
      st.intro = 1; st.shrink = tShrink; st.greet = tGreet; st.labels = weekVis ? 1 : 0; st.awake = awake;
    } else {
      st.intro = Math.min(1, st.intro + dt / 2);
      st.shrink = approach(st.shrink, tShrink, 8, dt);
      st.greet = approach(st.greet, tGreet, 8, dt);
      st.labels = approach(st.labels, weekVis ? 1 : 0, 5, dt);
      st.awake = approach(st.awake, awake, 2, dt);
      st.full = approach(st.full, fullTarget, fullRate, dt);
    }
    if (reduceMotion) st.full = fullTarget;
    frameLayout();

    // najstarszy liść odpada chwilę po wejściu (okno 7 dni przesunęło się o dzień)
    if (!fallDone && motion && st.intro >= 1 && twig0) {
      fallDone = true;
      fallen = { x: twig0.x, y: twig0.y, ang: twig0.ang, len: twig0.len, vx: twig0.side * 14, vy: -6, rot: 0, t0: clock, ph: rand(0, TAU) };
    }
    if (fallen) {
      const age = clock - fallen.t0;
      fallen.vy += 26 * dt;
      fallen.vx += Math.sin(clock * 2.2 + fallen.ph) * 30 * dt;
      fallen.vx *= 1 - .8 * dt; fallen.vy = Math.min(fallen.vy, 38);
      fallen.x += fallen.vx * dt; fallen.y += fallen.vy * dt;
      fallen.rot += Math.sin(clock * 1.8 + fallen.ph) * 1.2 * dt;
      if (age > 6 || fallen.y > baseY + 6) fallen = age > 6 ? null : fallen;
      if (fallen && fallen.y > baseY + 2) { fallen.y = baseY + 2; fallen.vy = 0; fallen.vx *= .9; }
    }

    wind *= Math.exp(-dt * 1.2);
    if (palT < 1) {
      palT = Math.min(1, palT + dt / 1.1);
      pal = lerpPalette(palFrom, palTo, easeInOut(palT));
      paintBokeh();
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (clock < d.t0) continue;
      d.vy += 900 * dt;
      d.y += d.vy * dt;
      if (d.y >= d.floor) {
        rings.push({ x: d.x, y: d.floor, t0: clock, r: 8 + d.s * 2 });
        for (let k = 0; k < 2; k++) sparks.push({ x: d.x, y: d.floor, vx: rand(-50, 50), vy: rand(-90, -40), life: 0, max: rand(.35, .6), s: d.s * .45 });
        drops.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) if (clock - rings[i].t0 > .7) rings.splice(i, 1);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt; p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life > p.max) sparks.splice(i, 1);
    }

    // płatki: co jakiś czas pojedynczy, przy wietrze częściej
    if (motion && st.intro >= 1 && Math.random() < dt * (.18 + wind * .5) && petals.length < 10) petalBurst(1);
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life += dt; p.vy += 6 * dt; p.vx += Math.sin(clock * 1.2 + p.seed) * 10 * dt + wind * 12 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.phi += p.vphi * dt;
      if (p.life > p.max || p.y > CH + 20) petals.splice(i, 1);
    }
  }

  function petalBurst(n) {
    if (!motion || !baseX) return;
    const [fx, fy] = stemPt(stemP(FULL_H * introStem()), 1);
    for (let k = 0; k < n; k++) {
      petals.push({ x: fx + rand(-8, 8), y: fy + rand(-6, 4), vx: rand(-30, 30), vy: rand(-8, 12), rot: rand(0, TAU), vr: rand(-2, 2), phi: rand(0, TAU), vphi: rand(2, 3.5), s: 10 * S * rand(.2, .28), life: 0, max: rand(4, 6), seed: rand(0, TAU) });
    }
  }

  // ================================================================
  //  Klatka
  // ================================================================
  function draw() {
    ctx.clearRect(0, 0, CW, CH);
    drawSky();
    for (const o of bokeh) {
      const bx = o.nx * CW + Math.sin(clock * o.f + o.ph) * 30 * motion;
      const by = o.ny * stageH + Math.cos(clock * o.f * 1.3 + o.ph) * 20 * motion;
      ctx.globalAlpha = o.a;
      ctx.drawImage(bokehSprites[o.spr], bx - o.r, by - o.r, o.r * 2, o.r * 2);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      const span = stageH + 60;
      const fy = (f.ny * span + clock * f.fall * motion) % span - 30;
      const fx = f.nx * CW + Math.sin(clock * f.f + f.ph) * 22 * motion;
      drawLeaf(fx, fy, f.rot + clock * f.spin * motion, f.len, { wr: f.wr, curl: f.curl, fold: .3, stalk: .1, colors: leafColors(f.tone, .5), flip: clock * .5 * motion + f.ph }, f.al);
    }

    const h = FULL_H * introStem();
    const P = stemP(h);
    const bloom = introBloom() * lerp(.3, 1, st.awake);

    const gy = baseY - h * .5 * S;
    const glow = ctx.createRadialGradient(baseX, gy, 0, baseX, gy, Math.max(h, 40) * 1.05 * S);
    glow.addColorStop(0, rgba(pal.glow, .36 + .2 * bloom));
    glow.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CW, stageH);
    // niebo i blask wygaszamy przy dolnej krawędzi sceny — inaczej widać ostrą linię tam, gdzie zaczyna się treść
    if (!wide) {
      const fade = ctx.createLinearGradient(0, stageH * .72, 0, stageH);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = fade;
      ctx.fillRect(0, stageH * .72, CW, stageH * .28);
      ctx.globalCompositeOperation = 'source-over';
    }

    drawGround();
    if (h < 1) return;

    // ---- odnogi dni ----
    leafPos.length = 0;
    const twigs = [];
    for (let i = 0; i < 7; i++) {
      const e = introBranch(i);
      if (e <= 0) { leafPos[i] = null; continue; }
      const k = grown(e);
      const L = dayTwig[i], t = L.t, side = L.side;
      const [sx, sy] = stemPt(P, t);
      // stemAng wskazuje w górę łodygi; odnoga odchyla się na zewnątrz i trochę opada pod własnym ciężarem
      const dir = stemAng(P, t) + side * L.spread;
      const isToday = i === 6;
      const off = !isToday && !!missed[i];                           // dzień bez podlania
      const watered = isToday && wateredAt != null && clock >= wateredAt;
      const m = days[i];
      const mood = off ? 2.5 : m == null ? (watered ? todayMood || 7 : 4) : m;
      const len = (9 + 9 * mood / 10) * L.lenK * k * S;
      const ex = sx + Math.cos(dir) * len, ey = sy + Math.sin(dir) * len + len * L.droop * .55;
      const cx = sx + Math.cos(dir) * len * .5, cy = sy + Math.sin(dir) * len * .5 - len * (.2 - L.droop * .25);
      twigs.push({ i, sx, sy, cx, cy, ex, ey, k, mood, m, isToday, watered, off, side, L });
    }
    if (twigs.length && twigs[0].i === 0 && !fallDone) {
      // liść „sprzed 8 dni” — wisi pod najstarszą odnogą, dopóki nie opadnie
      const t0 = twigs[0], [ox, oy] = stemPt(P, .17);
      twig0 = { x: ox, y: oy, ang: stemAng(P, .17) - t0.side * 1.2, len: 13 * S, side: -t0.side };
    }
    ctx.lineCap = 'round';
    for (const tw of twigs) {
      const g = ctx.createLinearGradient(tw.sx, tw.sy, tw.ex, tw.ey);
      g.addColorStop(0, rgba(pal.stem));
      g.addColorStop(1, rgba(mixC(pal.stem, pal.l1, .35)));
      ctx.strokeStyle = g;
      // dwa pociągnięcia: grubsza nasada, cieńszy koniec
      const qx = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
      const mx = qx(tw.sx, tw.cx, tw.ex, .5), my = qx(tw.sy, tw.cy, tw.ey, .5);
      ctx.lineWidth = Math.max(1.4, 1.25 * S);
      ctx.beginPath(); ctx.moveTo(tw.sx, tw.sy); ctx.quadraticCurveTo(lerp(tw.sx, tw.cx, .5), lerp(tw.sy, tw.cy, .5), mx, my); ctx.stroke();
      ctx.lineWidth = Math.max(1, .8 * S);
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(lerp(tw.cx, tw.ex, .5), lerp(tw.cy, tw.ey, .5), tw.ex, tw.ey); ctx.stroke();
      // drobne listki po drodze
      for (const x of tw.L.extra) {
        const px = qx(tw.sx, tw.cx, tw.ex, x.f), py = qx(tw.sy, tw.cy, tw.ey, x.f);
        const tx = qx(tw.sx, tw.cx, tw.ex, x.f + .05) - px, ty = qx(tw.sy, tw.cy, tw.ey, x.f + .05) - py;
        const a0 = Math.atan2(ty, tx) + x.side * .95;
        const sw = (Math.sin(clock * 1.3 + x.ph) * .04 + Math.sin(clock * 7 + x.ph * 2) * .12 * wind) * motion;
        drawLeaf(px, py, droopAng(a0, Math.cos(a0) >= 0 ? 1 : -1, .25) + sw, x.len * 1.1 * S * tw.k, { wr: x.wr, curl: x.curl, fold: .35, serr: 1, colors: leafColors(x.tone, .7) });
      }
    }

    // ---- liście na łodydze (dolne za łodygą, reszta przed) ----
    const wet = clamp(1 - (clock - wetAt) / 7) * (clock >= wetAt ? 1 : 0);
    const stemLeaves = behind => STEM_LEAVES.forEach((l, idx) => {
      if (!!l.behind !== behind) return;
      const e = introLeaf(idx);
      if (e <= 0) return;
      const s = grown(e);
      const [x, y] = stemPt(P, l.t);
      const sway = (Math.sin(clock * 1.2 + l.ph) * .035 + Math.sin(clock * 7.5 + l.ph * 3) * .11 * wind) * motion;
      // rozwija się z pozycji złożonej przy łodydze; duże liście u dołu opadają
      const ang = stemAng(P, l.t) + l.side * l.spread * (.55 + .45 * s);
      drawLeaf(x, y, droopAng(ang, l.side, l.droop != null ? l.droop : .08) + sway, l.len * 1.2 * S * s, { wr: l.wr, curl: l.curl * l.side, fold: l.fold, serr: l.serr, shape: l.shape, colors: leafColors(l.tone, .85), wet, beads: l.beads });
    });
    stemLeaves(true);
    drawStem(P);
    drawSoil(P);
    // węzły przy odnogach
    ctx.fillStyle = rgba(pal.stem);
    for (const tw of twigs) { ctx.beginPath(); ctx.arc(tw.sx, tw.sy, Math.max(1.2, 1.2 * S), 0, TAU); ctx.fill(); }
    stemLeaves(false);
    // zapasowy pąk przy czubku
    [SPARE_BUD].forEach(b => {
      const e = introBranch(3);
      if (e <= 0) return;
      const [x, y] = stemPt(P, b.t);
      const a = stemAng(P, b.t) + b.side * b.spread + Math.sin(clock * 1.1) * .03 * motion;
      const len = b.len * S * grown(e);
      ctx.strokeStyle = rgba(pal.stem);
      ctx.lineWidth = Math.max(1, .6 * S);
      const bx = x + Math.cos(a) * len * .7, by = y + Math.sin(a) * len * .7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * .3, y + Math.sin(a) * len * .3 - len * .15, bx, by); ctx.stroke();
      drawLeaf(bx, by, a - b.side * .25, len * .7, { wr: .32, curl: .3, fold: .6, stalk: .1, shape: 'lance', colors: leafColors(.3, .8) });
      ctx.fillStyle = rgba(mixC(pal.flower, pal.l2, .35));
      ctx.beginPath(); ctx.ellipse(bx + Math.cos(a) * len * .5, by + Math.sin(a) * len * .5, len * .12, len * .18, a + Math.PI / 2, 0, TAU); ctx.fill();
    });

    // ---- najstarszy liść: wisi, a chwilę po wejściu odpada ----
    if (!fallDone && twig0 && motion && st.intro > .55) {
      const s = easeOutCubic(clamp((st.intro - .55) / .3));
      drawLeaf(twig0.x, twig0.y, twig0.ang, twig0.len * s, { wr: .42, curl: .3, fold: .3, serr: 1, colors: leafColors(.8, .35) });
    }
    if (fallen) {
      const a = 1 - clamp((clock - fallen.t0 - 4.5) / 1.5);
      drawLeaf(fallen.x, fallen.y, fallen.ang + fallen.rot, fallen.len, { wr: .42, curl: .3, fold: .3, serr: 1, colors: leafColors(.8, .35), flip: (clock - fallen.t0) * 2.2 + .01 }, a);
    }

    // ---- liście dni ----
    const wave = clock - waveAt;
    const tags = [];
    for (const tw of twigs) {
      const L = tw.L;
      const sway = (Math.sin(clock * 1.2 + L.ph) * .04 + Math.sin(clock * 7 + L.ph * 3) * .12 * wind) * motion;
      // liść na końcu odnogi zwisa trochę pod własnym ciężarem
      const angTip = droopAng(Math.atan2(tw.ey - tw.cy, tw.ex - tw.cx), tw.side, L.leafDroop) + sway;
      const waveK = motion ? Math.exp(-Math.pow((wave - tw.i * .12 - .2) * 5, 2)) : 0;
      const selK = tw.i === sel ? 1 : 0;
      // zaznaczenie / fala: łagodne powiększenie, bez sprężynowania
      const bump = 1 + .05 * waveK + (selK ? .07 * (1 - Math.exp(-(clock - selAt) * 6)) : 0);

      if (tw.isToday && !tw.watered) {
        // pąk na dziś: zwinięty listek w przerywanym kółku
        const pr = 1 + .03 * Math.sin(clock * 2) * motion;
        drawLeaf(tw.ex, tw.ey, angTip - .3, 7 * S * tw.k * pr, { wr: .28, curl: .4, fold: .6, stalk: .2, shape: 'lance', colors: leafColors(.1, .9) });
        const bx = tw.ex + Math.cos(angTip - .3) * 3.5 * S, by = tw.ey + Math.sin(angTip - .3) * 3.5 * S;
        ctx.beginPath();
        ctx.arc(bx, by, (6.5 + 1 * Math.sin(clock * 2) * motion) * S * .9, 0, TAU);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba(pal.primary, .6 * tw.k);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        leafPos[tw.i] = { x: bx, y: by };
      } else if (tw.off) {
        // dzień bez podlania: mały, blady, zwinięty pąk — „śpi”, nie więdnie
        const a = angTip - .25;
        drawLeaf(tw.ex, tw.ey, a, 6.5 * S * tw.k * (selK ? 1.15 : 1), { wr: .3, curl: .5, fold: .65, stalk: .25, shape: 'lance', colors: leafColors(.15, 0) });
        if (motion) {
          // trzy malutkie kropki unoszące się nad pąkiem (sen)
          for (let z = 0; z < 3; z++) {
            const ph = (clock * .45 + z / 3 + tw.i * .17) % 1;
            const zx = tw.ex + Math.cos(a) * 5 * S + ph * 6 * S * tw.side, zy = tw.ey + Math.sin(a) * 5 * S - ph * 10 * S;
            ctx.globalAlpha = Math.sin(Math.PI * ph) * .55 * tw.k;
            ctx.fillStyle = rgba(pal.muted);
            ctx.beginPath(); ctx.arc(zx, zy, (.6 + ph * .5) * S * .9, 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        leafPos[tw.i] = { x: tw.ex + Math.cos(a) * 4 * S, y: tw.ey + Math.sin(a) * 4 * S };
      } else {
        const grow = tw.isToday ? grown(clamp((clock - wateredAt) / 1.2)) : 1;
        const len = dayLeafLen(tw) * grow * bump;
        const vivid = tw.isToday ? .95 : clamp((tw.mood - 3) / 6);
        const tone = clamp(.35 + .5 * (1 - tw.i / 6) + L.toneK);
        // liść bardzo powoli obraca się w świetle
        const sy = 1 - .08 * (.5 + .5 * Math.sin(clock * .3 + L.ph)) * motion;
        if (selK || waveK > .05) {
          const hx = tw.ex + Math.cos(angTip) * len * .55, hy = tw.ey + Math.sin(angTip) * len * .55;
          const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, len * .95);
          gr.addColorStop(0, rgba(pal.glow, .85 * Math.max(selK, waveK)));
          gr.addColorStop(1, rgba(pal.glow, 0));
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(hx, hy, len * .95, 0, TAU); ctx.fill();
        }
        drawLeaf(tw.ex, tw.ey, angTip, len, { wr: L.wr, curl: L.curl * tw.side, fold: L.fold, serr: L.serr, shape: L.shape, colors: leafColors(tone, vivid, L.hue), sy, wet, beads: L.beads });
        leafPos[tw.i] = { x: tw.ex + Math.cos(angTip) * len * .55, y: tw.ey + Math.sin(angTip) * len * .55 };
      }

      // podpis dnia (zaznaczony: dzień i wynik w dymku) — rysowany po wszystkich liściach
      const lab = tw.i === sel ? 1 : st.labels;
      if (lab > .02) {
        const selected = tw.i === sel;
        const reach = (tw.isToday && !tw.watered) || tw.off ? 12 * S : dayLeafLen(tw) + 10;
        const text = !selected ? labels[tw.i]
          : tw.off ? `${labels[tw.i]} · bez podlania`
          : tw.m == null ? `${labels[tw.i]} · ${tw.watered ? 'podlane' : 'czeka'}` : `${labels[tw.i]} · ${tw.m}/10`;
        tags.push({ x: tw.ex + Math.cos(angTip) * reach, y: tw.ey + Math.sin(angTip) * reach, text, selected, lab });
      }
    }

    // podpisy: bez nachodzenia na siebie (zaznaczony zawsze na wierzchu)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed = [];
    tags.sort((a, b) => a.selected - b.selected || a.y - b.y);
    for (const t of tags) {
      ctx.font = `${t.selected ? 800 : 700} ${t.selected ? 12 : 10.5}px "Plus Jakarta Sans", system-ui, sans-serif`;
      const bw = ctx.measureText(t.text).width + (t.selected ? 16 : 10), bh = t.selected ? 22 : 16;
      let px = clamp(t.x, bw / 2 + 4, CW - bw / 2 - 4), py = clamp(t.y, 12, stageH - 12);
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find(p => Math.abs(p.x - px) < (p.w + bw) / 2 + 2 && Math.abs(p.y - py) < (p.h + bh) / 2 + 2);
        if (!hit) break;
        py = hit.y + (py >= hit.y ? 1 : -1) * ((hit.h + bh) / 2 + 3);
      }
      placed.push({ x: px, y: py, w: bw, h: bh });
      ctx.globalAlpha = t.lab;
      if (t.selected) {
        ctx.fillStyle = rgba(pal.primary);
        roundRect(px - bw / 2, py - 11, bw, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        roundRect(px - bw / 2, py - 8, bw, 16, 8);
        ctx.fill();
        ctx.fillStyle = rgba(pal.muted);
      }
      ctx.fillText(t.text, px, py + .5);
    }
    ctx.globalAlpha = 1;

    // ---- światło w górę łodygi po podlaniu ----
    if (pulseAt != null && clock > pulseAt) {
      const age = clock - pulseAt, pos = age / 1.1, fade = 1 - clamp((age - .8) / .6);
      if (fade > 0) {
        for (let k = 0; k <= 22; k++) {
          const t = k / 22, d = Math.abs(t - pos);
          if (d > .16) continue;
          const [x, y] = stemPt(P, t);
          const r = (1 - d / .16) * 6 * S * .6;
          const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
          gr.addColorStop(0, `rgba(255,255,255,${(.85 * fade * (1 - d / .16)).toFixed(3)})`);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(x, y, r * 2, 0, TAU); ctx.fill();
        }
      } else pulseAt = null;
    }

    // ---- kwiat ----
    const [fx, fy] = stemPt(P, 1);
    const flash = motion ? clamp(1 - (clock - bloomFlashAt) / 1.4) : 0;
    drawFlower(fx, fy - 2 * S, 10 * S, bloom, flash);

    for (const p of petals) {
      const a = Math.min(1, p.life * 2) * (1 - clamp((p.life - p.max + 1.2) / 1.2));
      if (a <= 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, flipScale(p.phi));
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(mixC(pal.flower, pal.tip, .35));
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * .5, p.s, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ---- deszcz ----
    for (const d of drops) {
      if (clock < d.t0) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = rgba(pal.water);
      ctx.beginPath();
      ctx.moveTo(0, -d.s * 2);
      ctx.bezierCurveTo(d.s * .9, -d.s * .4, d.s, d.s * .5, 0, d.s);
      ctx.bezierCurveTo(-d.s, d.s * .5, -d.s * .9, -d.s * .4, 0, -d.s * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(-d.s * .3, 0, d.s * .25, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (const r of rings) {
      const e = (clock - r.t0) / .7;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, lerp(2, r.r, easeOutCubic(e)), lerp(1, r.r * .4, easeOutCubic(e)), 0, 0, TAU);
      ctx.strokeStyle = rgba(pal.water, .9 * (1 - e));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = rgba(pal.water);
    for (const p of sparks) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- świetliki ----
    const flare = clamp(1 - (clock - flareAt) / 1.8);
    for (const f of fireflies) {
      const th = clock * f.sp * motion + f.ph;
      const ox = lerp(f.cx, f.cx * .5, bloom * .5), oy = lerp(f.cy, -h - 4 + f.cy * .2, bloom * .3);
      let x = baseX + (ox + Math.cos(th) * f.rx) * S, y = baseY + (oy + Math.sin(th * 1.3) * f.ry) * S;
      if (pointer.active && motion) {
        const dx = pointer.x - x, dy = pointer.y - y, dd = Math.hypot(dx, dy);
        if (dd < 150) { const kk = (1 - dd / 150) * .35; x += dx * kk; y += dy * kk; }
      }
      const blink = .35 + .65 * Math.pow(.5 + .5 * Math.sin(clock * f.bs + f.bp), 2);
      const size = f.size * (1 + flare * .6);
      ctx.globalAlpha = st.intro * Math.min(1, blink + flare * .6);
      ctx.drawImage(fireflySprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function frame(ms) {
    const dt = Math.min(.05, Math.max(0, (ms - lastMs) / 1000));
    lastMs = ms;
    clock += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ================================================================
  //  Wejście: stukanie w liście, szelest pod kursorem
  // ================================================================
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointermove', e => {
    const [x, y] = local(e);
    if (pointer.active && Math.abs(x - baseX) < 60 * S && y < baseY + 10 && y > baseY - (FULL_H + 20) * S) {
      wind = Math.min(1.5, wind + Math.hypot(x - pointer.x, y - pointer.y) * .003 * motion);
    }
    pointer.x = x; pointer.y = y; pointer.active = true;
  });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });
  canvas.addEventListener('click', e => {
    const [x, y] = local(e);
    let best = -1, bd = 42;
    leafPos.forEach((p, i) => { if (!p) return; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    wind = Math.min(1.5, wind + .5 * motion);
    if (best >= 0) {
      select(best);
      window.dispatchEvent(new CustomEvent('dayselect', { detail: { index: best, from: 'plant' } }));
    }
  });

  // ================================================================
  //  API
  // ================================================================
  function select(i) {
    sel = i;
    selAt = clock;
    wind = Math.min(1.5, wind + .3 * motion);
  }

  function water(mood) {
    if (Number.isInteger(mood) && mood >= 1 && mood <= 10) todayMood = mood;
    for (let k = 0; k < 28; k++) {
      const x = baseX + rand(-38, 38) * S;
      const floor = baseY - rand(0, FULL_H * .9) * S;
      drops.push({ x, y: rand(-30, 10), vy: rand(260, 420), s: rand(2.6, 4.4), floor, t0: clock + rand(0, .5) });
    }
    wind = Math.min(1.5, wind + 1 * motion);
    flareAt = clock + .5;
    pulseAt = clock + .6;
    wetAt = clock + .6;
    if (wateredAt == null) wateredAt = clock + 1;
    if (reduceMotion) { drops.length = 0; wateredAt = clock; wetAt = clock; }
  }

  window.addEventListener('themechange', () => {
    palFrom = pal;
    palTo = readPalette();
    palT = 0;
    if (reduceMotion) { pal = palTo; palT = 1; paintBokeh(); }
    wind = Math.min(1.5, wind + .6 * motion);
  });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 80); });
  // komputer: scena płynnie zwęża się, gdy obok otwiera się panel Asystenta — przeliczamy rozmiar w każdej klatce zmiany.
  // ResizeObserver działa już po narysowaniu klatki, a zmiana rozmiaru czyści canvas — rysujemy od razu, inaczej
  // roślinka znika na czas całego otwierania i zamykania panelu.
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (!wide || Math.abs(stage.getBoundingClientRect().width - CW) <= .5) return;
    layout();
    if (started) { frameLayout(); draw(); }
  }).observe(stage);

  paintBokeh();

  // Pełny ekran: t 0–1 (fast — w trakcie przeciągania palcem scena idzie za palcem bez opóźnienia)
  function full(t, fast) {
    const was = fullTarget;
    fullTarget = clamp(t);
    fullRate = fast ? 30 : 5;
    if (!fast && fullTarget === 1 && was < 1) { wind = Math.min(1.5, wind + .9 * motion); if (motion) petalBurst(5); }
  }

  window.Home2Scene = {
    full,
    start(opts) {
      days = opts.days;
      labels = opts.labels;
      missed = opts.missed || [];
      if (started) return;
      started = true;
      layout();
      if (reduceMotion) st.intro = 1;
      requestAnimationFrame(frame);
    },
    water,
    select,
    isWatered: () => wateredAt != null,
    // Tylko do testów (np. gdy karta przeglądarki jest w tle i nie dostaje klatek): przewija czas sceny
    debugAdvance(sec) {
      for (let t = 0; t < sec; t += 1 / 60) { clock += 1 / 60; update(1 / 60); }
      draw();
    },
  };
})();
