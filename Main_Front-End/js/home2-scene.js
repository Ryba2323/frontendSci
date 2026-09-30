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
 * API (window.Home2Scene): start({ days, labels, missed }), water(), select(i), isWatered(), debugAdvance(sec)
 */
(function () {
  'use strict';

  const canvas = document.getElementById('plant');
  const stage = document.getElementById('stage');
  if (!canvas || !canvas.getContext) { window.Home2Scene = { start() {}, water() {}, select() {}, isWatered: () => false }; return; }
  const ctx = canvas.getContext('2d');

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
      light: rgba(tint(lively, .18)),
      mid: rgba(lively),
      dark: rgba(mixC(lively, pal.stem, .35 + .15 * tone)),
      vein: rgba(tint(lively, .55), .55),
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

  const st = { intro: 0, shrink: 0, greet: 0, labels: 0, awake: 1 };
  let days = [], labels = [], missed = [];
  let fallen = null, fallDone = false, twig0 = null;
  let wateredAt = null, wetAt = -99, sel = -1, selAt = -10, flareAt = -10, pulseAt = null;
  let waveAt = -10, weekIn = false, quoteIn = false, bloomFlashAt = -10;
  const drops = [], rings = [], petals = [], sparks = [];
  const leafPos = [];
  const pointer = { x: 0, y: 0, active: false };

  const bokeh = Array.from({ length: 5 }, (_, i) => ({ nx: rand(0, 1), ny: rand(0, 1), r: rand(70, 150), spr: i % 4, a: rand(.16, .28), f: rand(.03, .07), ph: rand(0, TAU) }));
  const floaters = Array.from({ length: 6 }, () => ({ nx: rand(0, 1), ny: rand(0, 1), len: rand(12, 18), tone: rand(0, .6), f: rand(.15, .3), ph: rand(0, TAU), fall: rand(5, 10), rot: rand(0, TAU), spin: rand(-.35, .35), al: rand(.2, .34), wr: rand(.36, .44), curl: rand(-.5, .5) }));
  const fireflies = Array.from({ length: FIREFLY_N }, () => ({ cx: rand(-40, 40), cy: rand(-100, -10), rx: rand(6, 18), ry: rand(4, 12), sp: rand(.25, .55) * (Math.random() < .5 ? -1 : 1), ph: rand(0, TAU), size: rand(18, 28), bs: rand(.9, 1.9), bp: rand(0, TAU) }));
  const stars = DAYPART === 'night' ? Array.from({ length: 26 }, () => ({ nx: rand(0, 1), ny: rand(0, .55), r: rand(.6, 1.5), ph: rand(0, TAU), sp: rand(.6, 1.6) })) : [];

  // ================================================================
  //  Roślina (jednostki: pełna wysokość ≈ 100; y w górę ujemne)
  // ================================================================
  const FULL_H = 96;
  const bez = (P, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  };
  const stemP = h => [[0, 0], [-5, -h * .34], [6, -h * .68], [0, -h]];

  // Odnogi dni: im nowszy dzień, tym wyżej na łodydze
  const DAY_T = i => .24 + i * .094;
  const DAY_SIDE = i => (i % 2 ? 1 : -1);
  const dayLeaf = Array.from({ length: 7 }, (_, i) => ({
    curl: srand(-.75, .75), fold: srand(.1, .7), wr: srand(.36, .56), ph: srand(0, TAU),
    tilt: srand(-.22, .22), twist: srand(.2, .55), bend: srand(.12, .38),
    shape: i % 3 === 2 ? 'round' : 'ovate', serr: i % 4 === 3 ? 0 : 1, hue: srand(-.25, .25),
    beads: Array.from({ length: 3 }, () => [srand(.35, .8), srand(-.35, .35), srand(.6, 1)]),
  }));

  // Liście na łodydze: duże i ciemne u dołu, małe i jasne przy czubku
  const STEM_LEAVES = [
    { t: .04, side: 1, len: 17, tone: .95, wr: .5, shape: 'ovate' },
    { t: .09, side: -1, len: 19, tone: 1, wr: .48, shape: 'ovate' },
    { t: .16, side: 1, len: 14, tone: .8, wr: .46, shape: 'ovate' },
    { t: .33, side: 1, len: 7, tone: .6, wr: .42, shape: 'ovate' },
    { t: .52, side: -1, len: 6.5, tone: .5, wr: .4, shape: 'ovate' },
    { t: .72, side: 1, len: 6, tone: .35, wr: .38, shape: 'lance' },
    { t: .88, side: -1, len: 8, tone: .2, wr: .34, shape: 'lance' },
    { t: .93, side: 1, len: 7, tone: .12, wr: .32, shape: 'lance' },
  ].map(l => ({ ...l, curl: srand(-.5, .5), fold: srand(.1, .5), ph: srand(0, TAU), serr: l.shape === 'ovate' ? 1 : 0, beads: Array.from({ length: 2 }, () => [srand(.35, .8), srand(-.35, .35), srand(.6, 1)]) }));

  // Źdźbła trawy i kamyki przy ziemi
  const GRASS = Array.from({ length: 9 }, (_, i) => ({ x: (i / 8 - .5) * 30 + srand(-2, 2), h: srand(3.5, 7.5), lean: srand(-.5, .5), ph: srand(0, TAU), tone: srand(.2, .9) }));
  const PEBBLES = [{ x: -11, r: 1.6 }, { x: 13, r: 1.2 }, { x: 8.5, r: .8 }];

  function toScreen(x, y) {
    const hh = clamp(-y / 100, 0, 1.2);
    const calm = Math.sin(clock * .8 + y * .035) * 1.6 + Math.sin(clock * 1.9 + y * .09) * .4;
    const rustle = Math.sin(clock * 7 + y * .22) * wind * 1.2;
    const dx = (calm * (1 + wind * .6) + rustle) * Math.pow(hh, 1.5) * motion;
    return [baseX + (x + dx) * S, baseY + y * S];
  }
  const stemPt = (P, t) => { const p = bez(P, t); return toScreen(p[0], p[1]); };
  const stemAng = (P, t) => { const a = stemPt(P, Math.max(0, t - .02)), b = stemPt(P, Math.min(1, t + .02)); return Math.atan2(b[1] - a[1], b[0] - a[0]); };

  // Fazy wejścia (roślinka sama wyrasta po otwarciu strony)
  const introStem = () => easeOutCubic(clamp(st.intro / .5));
  const introLeaf = k => clamp((st.intro - .15 - k * .03) / .35);
  const introBranch = i => clamp((st.intro - .3 - i * .06) / .4);
  const introBloom = () => easeOutCubic(clamp((st.intro - .62) / .38));

  // ================================================================
  //  Rysowanie liścia: ogonek, blaszka zagięta wzdłuż nerwu, ząbki, gradient, żyłki, kropelki
  // ================================================================
  function leafProfile(shape, u) {
    if (shape === 'lance') return Math.pow(Math.sin(Math.PI * u), 1.15) * .7;
    if (shape === 'round') return Math.pow(Math.sin(Math.PI * Math.pow(u, .85)), .55) * .92;
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
      if (teeth && u > .12 && u < .96) w *= 1 + .07 * (1 - Math.abs(((u * teeth) % 1) * 2 - 1));
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
      const pairs = len > 40 ? 6 : 4;
      for (let j = 1; j <= pairs; j++) {
        const k = Math.round(N * (.1 + j * (.78 / pairs)));
        const m = mid[k], tu = up[Math.min(N, k + 2)], tl = lo[Math.min(N, k + 2)];
        ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo(lerp(m[0], tu[0], .5), lerp(m[1], tu[1], .3), lerp(m[0], tu[0], .85), lerp(m[1], tu[1], .85));
        ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo(lerp(m[0], tl[0], .5), lerp(m[1], tl[1], .3), lerp(m[0], tl[0], .85), lerp(m[1], tl[1], .85));
      }
      ctx.stroke();
    }
    // światło na brzegu
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
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
    const breathe = 1 + .035 * Math.sin(clock * 1.3) * motion;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(clock * .6) * .06 * motion);
    const gR = R * (2.4 + flash * 1.2);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    gl.addColorStop(0, rgba(pal.glow, (.5 + flash * .35) * open));
    gl.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, gR, 0, TAU); ctx.fill();

    ctx.scale(open * breathe, open * breathe * .92);
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
    const n = 40, pts = [];
    for (let i = 0; i <= n; i++) pts.push(stemPt(P, i / n));
    ctx.lineCap = 'round';
    const col = rgba(pal.stem), hi = rgba(tint(pal.stem, .45), .45);
    ctx.strokeStyle = col;
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = Math.max(1.2, lerp(2.3, .9, i / n) * S);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    ctx.strokeStyle = hi;
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = Math.max(.6, lerp(2.3, .9, i / n) * S * .3);
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
    ctx.fillStyle = rgba(pal.stem, .12);
    ctx.beginPath(); ctx.ellipse(baseX + 3 * S, baseY + 1.6 * S, 14 * S, 2.2 * S, 0, 0, TAU); ctx.fill();
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

  // Pora dnia: delikatne światło nad roślinką
  function drawSky() {
    if (DAYPART === 'morning') {
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
    CW = wide ? W / 2 : W;
    CH = stageMax;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const greetEl = stage.querySelector('.stage-greet');
  function frameLayout() {
    stageH = wide ? H : lerp(stageMax, stageMax * .86, st.shrink);
    if (!wide) stage.style.setProperty('--stage-h', stageH.toFixed(1) + 'px');
    greetEl.style.opacity = (1 - st.greet).toFixed(3);
    const greetBottom = greetEl.offsetTop + greetEl.offsetHeight + 8;
    // na telefonie powitanie znika przy przewijaniu, a roślinka zajmuje zwolnione miejsce
    topReserve = wide ? Math.max(greetBottom + 30, H * .14) : lerp(greetBottom, 58, st.greet);
    baseX = CW / 2;
    baseY = stageH - (wide ? H * .1 : 24);
    S = clamp(Math.min((baseY - topReserve) / (FULL_H + 12), CW * .9 / 78), .9, 7);
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
    }
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

    drawGround();
    if (h < 1) return;

    // ---- odnogi dni ----
    leafPos.length = 0;
    const twigs = [];
    for (let i = 0; i < 7; i++) {
      const e = introBranch(i);
      if (e <= 0) { leafPos[i] = null; continue; }
      const k = reduceMotion ? 1 : easeOutBack(e);
      const t = DAY_T(i), side = DAY_SIDE(i), L = dayLeaf[i];
      const [sx, sy] = stemPt(P, t);
      // stemAng wskazuje w górę łodygi; odnoga odchyla się od niej na zewnątrz
      const dir = stemAng(P, t) + side * (1.15 - i * .05) + L.tilt * .5;
      const isToday = i === 6;
      const off = !isToday && !!missed[i];                           // dzień bez podlania
      const watered = isToday && wateredAt != null && clock >= wateredAt;
      const m = days[i];
      const mood = off ? 2.5 : m == null ? (watered ? 7 : 4) : m;
      const len = (11 + 11 * mood / 10) * k * S;
      const ex = sx + Math.cos(dir) * len, ey = sy + Math.sin(dir) * len - len * L.bend * .5;
      const cx = sx + Math.cos(dir) * len * .45, cy = sy + Math.sin(dir) * len * .45 - len * L.bend;
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
      ctx.lineWidth = Math.max(1.3, 1.05 * S);
      ctx.beginPath(); ctx.moveTo(tw.sx, tw.sy); ctx.quadraticCurveTo(tw.cx, tw.cy, tw.ex, tw.ey); ctx.stroke();
    }

    drawStem(P);
    // węzły przy odnogach
    ctx.fillStyle = rgba(pal.stem);
    for (const tw of twigs) { ctx.beginPath(); ctx.arc(tw.sx, tw.sy, Math.max(1.2, 1.2 * S), 0, TAU); ctx.fill(); }

    // ---- liście na łodydze ----
    const wet = clamp(1 - (clock - wetAt) / 7) * (clock >= wetAt ? 1 : 0);
    STEM_LEAVES.forEach((l, idx) => {
      const e = introLeaf(idx);
      if (e <= 0) return;
      const s = reduceMotion ? 1 : easeOutBack(e);
      const [x, y] = stemPt(P, l.t);
      const sway = (Math.sin(clock * 1.5 + l.ph) * .07 + Math.sin(clock * 8.5 + l.ph * 3) * .15 * wind) * motion;
      const ang = stemAng(P, l.t) + l.side * (1.05 + l.fold * .25 + (l.t < .2 ? .35 : 0)) + sway;
      drawLeaf(x, y, ang, l.len * 1.5 * S * s, { wr: l.wr, curl: l.curl * l.side, fold: l.fold, serr: l.serr, shape: l.shape, colors: leafColors(l.tone, .85), wet, beads: l.beads });
    });

    // ---- najstarszy liść: wisi, a chwilę po wejściu odpada ----
    if (!fallDone && twig0 && motion && st.intro > .55) {
      const s = easeOutBack(clamp((st.intro - .55) / .3));
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
      const sway = (Math.sin(clock * 1.4 + L.ph) * .08 + Math.sin(clock * 8 + L.ph * 3) * .16 * wind) * motion;
      const angTip = Math.atan2(tw.ey - tw.cy, tw.ex - tw.cx) + sway;
      const waveK = motion ? Math.exp(-Math.pow((wave - tw.i * .12 - .2) * 5, 2)) : 0;
      const selK = tw.i === sel ? 1 : 0;
      const bump = 1 + .1 * waveK + (selK ? .08 + .1 * Math.exp(-(clock - selAt) * 4) * Math.sin((clock - selAt) * 16) : 0);

      if (tw.isToday && !tw.watered) {
        // pąk na dziś: zwinięty listek w przerywanym kółku
        const pr = 1 + .07 * Math.sin(clock * 3) * motion;
        drawLeaf(tw.ex, tw.ey, angTip - .3, 7 * S * tw.k * pr, { wr: .28, curl: .4, fold: .6, stalk: .2, shape: 'lance', colors: leafColors(.1, .9) });
        const bx = tw.ex + Math.cos(angTip - .3) * 3.5 * S, by = tw.ey + Math.sin(angTip - .3) * 3.5 * S;
        ctx.beginPath();
        ctx.arc(bx, by, (6.5 + 1.5 * Math.sin(clock * 3) * motion) * S * .9, 0, TAU);
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
        const grow = tw.isToday ? (reduceMotion ? 1 : easeOutBack(clamp((clock - wateredAt) / 1))) : 1;
        const len = (8 + 10 * tw.mood / 10) * 1.55 * S * tw.k * grow * bump;
        const vivid = tw.isToday ? .95 : clamp((tw.mood - 3) / 6);
        const tone = .35 + .5 * (1 - tw.i / 6);
        // liść powoli obraca się w świetle (widać go raz szerzej, raz węziej)
        const sy = 1 - L.twist * .6 * (.5 + .5 * Math.sin(clock * .35 + L.ph)) * motion;
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
        const reach = (tw.isToday && !tw.watered) || tw.off ? 12 * S : (8 + 10 * tw.mood / 10) * 1.55 * S * tw.k + 10;
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

  function water() {
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

  paintBokeh();

  window.Home2Scene = {
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
