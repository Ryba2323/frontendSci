/*
 * Scena w tle rejestracji (canvas 2D).
 *
 * Luźne listki unoszą się w tle → w etapie 2 zlatują się wirem i tworzą roślinę →
 * w etapie 3 roślina się rozrasta i wypuszcza pąki → po rejestracji kwitnie i gubi płatki.
 * Do tego świetliki krążące wokół rośliny, miękki bokeh, reakcja na kursor i na pisanie.
 *
 * API (window.PlantScene):
 *   setStage(n, progress)  n: 1–3 = etapy formularza, 4 = gotowe; progress 0–1 = wypełnienie etapu
 *   setProgress(progress)  mikro-wzrost podczas wypełniania bieżącego etapu
 *   rustle(amount)         poruszenie liśćmi, np. przy pisaniu
 */
(function () {
  'use strict';

  const canvas = document.getElementById('scene');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const card = document.querySelector('.card');
  const layout = document.querySelector('.layout');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = reduceMotion ? .3 : 1;
  const TAU = Math.PI * 2;
  // Tempo całej sceny: 1 = pierwotna prędkość, mniej = spokojniej
  const TEMPO = .8;

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  // Obrót liścia wokół własnej osi (efekt 3D): skala w pionie = cos(fazy), nigdy całkiem płaska
  const flipScale = phi => { const c = Math.cos(phi); return (c < 0 ? -1 : 1) * Math.max(.14, Math.abs(c)); };

  // ================================================================
  //  Etapy
  // ================================================================
  // Wzrost g: 0 = nasionko · 1 = etap 2 · 2 = etap 3 (pąki) · 3 = rozkwit
  const STAGE_BASE = { 1: 0, 2: 1, 3: 2, 4: 3 };
  // Ile dodatkowego wzrostu dają wypełnione pola w danym etapie
  const STAGE_MICRO = { 1: .19, 2: .24, 3: .1, 4: 0 };
  // Sztywność sprężyny wzrostu (większa = szybciej)
  const SPRING = { forward: 1.55, back: 2.3, micro: 1.9 };

  // ================================================================
  //  Geometria rośliny
  //  Jednostki: finalna wysokość ≈ 100. c = punkty kontrolne krzywej Béziera względem początku
  //  gałęzi, w = grubość [nasada, koniec], g = przedział wzrostu, w którym gałąź się wydłuża.
  // ================================================================
  const BRANCHES = [
    { id: 'm1',  parent: null, t: 0,   c: [[-5, -17], [6, -35], [0, -52]],     w: [1.75, 1.15], g: [0, 1],       col: '#2F7F8F' },
    { id: 'l1',  parent: 'm1', t: .45, c: [[-7, -3], [-15, -10], [-25, -21]],  w: [.85, .35],   g: [.5, .98],    col: '#3A8D9E' },
    { id: 'r1',  parent: 'm1', t: .62, c: [[7, -3], [15, -9], [24, -19]],      w: [.8, .33],    g: [.66, 1],     col: '#3A8D9E' },
    { id: 'm2',  parent: 'm1', t: 1,   c: [[-5, -15], [7, -30], [2, -46]],     w: [1.15, .45],  g: [1, 1.84],    col: '#2F7F8F', flower: 5.4 },
    { id: 'l1b', parent: 'l1', t: .62, c: [[-1, -6], [-4, -11], [-2, -17]],    w: [.45, .22],   g: [1.08, 1.6],  col: '#4A9CA5', flower: 3.8 },
    { id: 'r1b', parent: 'r1', t: .66, c: [[2, -6], [5, -11], [3, -16]],       w: [.42, .22],   g: [1.18, 1.68], col: '#4A9CA5', flower: 3.8 },
    { id: 'r2',  parent: 'm2', t: .3,  c: [[8, -2], [17, -9], [27, -21]],      w: [.75, .3],    g: [1.28, 1.84], col: '#3A8D9E', flower: 4.8 },
    { id: 'l2',  parent: 'm2', t: .56, c: [[-8, -2], [-17, -8], [-26, -17]],   w: [.7, .3],     g: [1.5, 1.93],  col: '#3A8D9E', flower: 4.8 },
  ];
  const byId = {};

  function bez(P, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0],
            a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  }
  BRANCHES.forEach(b => {
    byId[b.id] = b;
    const s = b.parent ? bez(byId[b.parent].P, b.t) : [0, 0];
    b.P = [s, ...b.c.map(([x, y]) => [s[0] + x, s[1] + y])];
  });
  const FLOWERS = BRANCHES.filter(b => b.flower);

  // Miejsca na liście. Bez "at" liść pojawia się, gdy łodyga dorośnie do jego miejsca.
  const SLOTS = [
    // etap 2
    { b: 'm1', t: .2,  side: -1, size: 8.5 },
    { b: 'm1', t: .34, side: 1,  size: 9 },
    { b: 'l1', t: .5,  side: 1,  size: 8 },
    { b: 'm1', t: .78, side: -1, size: 9.5 },
    { b: 'r1', t: .45, side: -1, size: 8 },
    { b: 'l1', t: 1,   side: 0,  size: 9.5 },
    { b: 'm1', t: .9,  side: 1,  size: 8.5 },
    { b: 'r1', t: 1,   side: 0,  size: 9.5 },
    { b: 'm1', t: 1,   side: -1, size: 7 },
    { b: 'm1', t: 1,   side: 1,  size: 7 },
    // etap 3
    { b: 'm1', t: .1,  side: 1,  size: 7, at: 1.08 },
    { b: 'l1', t: .22, side: -1, size: 7, at: 1.16 },
    { b: 'm2', t: .18, side: 1,  size: 10 },
    { b: 'm2', t: .42, side: -1, size: 10 },
    { b: 'r2', t: .5,  side: -1, size: 9 },
    { b: 'l1b', t: .55, side: -1, size: 6.5 },
    { b: 'r1b', t: .5, side: 1,  size: 6.5 },
    { b: 'm2', t: .72, side: 1,  size: 9 },
    { b: 'r2', t: .82, side: 1,  size: 9.5 },
    { b: 'l2', t: .45, side: 1,  size: 9 },
    { b: 'm2', t: .9,  side: -1, size: 8 },
    { b: 'l2', t: .8,  side: -1, size: 9.5 },
  ];
  SLOTS.forEach(s => {
    const b = byId[s.b];
    if (s.at == null) s.at = b.g[0] + s.t * (b.g[1] - b.g[0]);
    s.ph = rand(0, TAU);
    s.leaf = null;
  });
  const LEAF_SCALE = 1.5;

  const plantH = g => 12 + 42 * clamp(g) + 46 * clamp(g - 1);
  const plantW = g => 20 + 28 * clamp(g / 2);

  // ================================================================
  //  Stan
  // ================================================================
  let W = 0, H = 0, baseX = 0, baseY = 0, S = 6;
  let floatScale = 1;            // rozmiar luźnych listków (na telefonie mniejsze)
  let clock = 0;                 // zegar sceny (stoi, gdy karta jest w tle)
  let lastMs = performance.now();
  let stage = 1, progress = 0;
  let wind = 0;                  // 0–1.5: szelest liści (kursor, pisanie, podmuch)
  let gather = 0, gatherTarget = 0;

  // Wzrost jako sprężyna krytycznie tłumiona — płynnie reaguje na zmiany celu w trakcie ruchu
  const growth = { g: 0, v: 0, target: 0, omega: SPRING.forward };

  const pointer = { x: 0, y: 0, active: false, overCard: false };

  // ================================================================
  //  Przeliczenia na ekran
  // ================================================================
  function toScreen(x, y) {
    const h = clamp(-y / 100, 0, 1.2);
    const calm = Math.sin(clock * .8 + y * .035) * 2 + Math.sin(clock * 1.9 + y * .09) * .45;
    const rustle = Math.sin(clock * 7 + y * .22) * wind * 1.1;
    const dx = (calm * (1 + wind * .6) + rustle) * Math.pow(h, 1.5) * motion;
    return [baseX + (x + dx) * S, baseY + y * S];
  }
  function branchPt(b, tt) { const p = bez(b.P, tt); return toScreen(p[0], p[1]); }
  function branchAng(b, tt) {
    const p1 = branchPt(b, Math.max(0, tt - .02)), p2 = branchPt(b, Math.min(1, tt + .02));
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }
  const reveal = (b, g) => clamp((g - b.g[0]) / (b.g[1] - b.g[0]));
  const bloomOf = (i, g) => easeOutCubic(clamp((g - 2 - i * .1) / .45));

  // ================================================================
  //  Liście
  // ================================================================
  const LEAF_COLORS = [
    ['#5DB3AE', '#3F97A0'], ['#78C9B7', '#55AE9C'], ['#7CC9D4', '#55AAB8'],
    ['#8FD3C0', '#65B8A4'], ['#4FA3A5', '#35818F'], ['#A2DACB', '#78BFAB'],
  ];
  const leaves = [];
  const COLS = 7, ROWS = 4;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const [col, dark] = pick(LEAF_COLORS);
      leaves.push({
        nx: (c + rand(.15, .85)) / COLS, ny: .03 + (r + rand(.1, .9)) / ROWS * .9,
        ax: rand(10, 26) * motion, ay: rand(8, 18) * motion,
        f1: rand(.12, .3), f2: rand(.15, .35), f3: rand(.25, .55), ph: rand(0, TAU),
        rot: rand(0, TAU), fs: rand(13, 24), fal: rand(.45, .72), wr: rand(.3, .37),
        ft: rand(.25, .6) * (Math.random() < .5 ? -1 : 1), fp: rand(0, TAU),
        ox: 0, oy: 0, vx: 0, vy: 0,
        col, dark,
        state: 'float', slot: null, fl: null, pending: false, minStart: 0, fdur: 2, attachedAt: -10,
      });
    }
  }

  function floatPose(L) {
    return {
      x: L.nx * W + Math.sin(clock * L.f1 + L.ph) * L.ax + L.ox,
      y: L.ny * H + Math.cos(clock * L.f2 + L.ph * 1.3) * L.ay + L.oy,
      a: L.rot + Math.sin(clock * L.f3 + L.ph) * .6 * motion,
      s: L.fs * floatScale, al: L.fal,
      phi: clock * L.ft * motion + L.fp,
    };
  }
  function slotPose(sl, g) {
    const b = byId[sl.b];
    const [x, y] = branchPt(b, sl.t);
    const flutter = Math.sin(clock * 1.6 + sl.ph) * .07 + Math.sin(clock * 9 + sl.ph * 3) * .14 * wind;
    const growF = .72 + .28 * clamp((g - sl.at) / 1.1);
    return { x, y, a: branchAng(b, sl.t) + sl.side * .95 + flutter, s: sl.size * LEAF_SCALE * S * growF, al: 1, phi: 0 };
  }
  function flightPose(L, g) {
    const f = L.fl;
    const e = easeInOut(clamp((clock - f.t0) / f.dur));
    const to = f.toSlot ? slotPose(f.toSlot, g) : floatPose(L);
    const k = 1 - e, b0 = k * k * k, b1 = 3 * k * k * e, b2 = 3 * k * e * e, b3 = e * e * e;
    return {
      x: b0 * f.from.x + b1 * f.c1x + b2 * f.c2x + b3 * to.x,
      y: b0 * f.from.y + b1 * f.c1y + b2 * f.c2y + b3 * to.y,
      a: f.from.a + (f.da0 + f.spin + (to.a - f.toA0)) * e,
      s: lerp(f.from.s, to.s, e),
      al: lerp(f.from.al, to.al, e),
      phi: lerp(f.phi0, f.phi1, e),
    };
  }
  function poseOf(L, g) {
    if (L.state === 'fly') return flightPose(L, g);
    if (L.state === 'attached') {
      const p = slotPose(L.slot, g);
      const dt = clock - L.attachedAt;
      p.s *= 1 + .16 * Math.exp(-dt * 5) * Math.sin(dt * 15);
      return p;
    }
    return floatPose(L);
  }

  // Środek i promień wiru, którym listki zlatują się do rośliny
  const vortexCenter = () => ({ x: baseX, y: baseY - plantH(growth.target) * .5 * S });
  const vortexRadius = () => Math.max(plantW(growth.target) * S * 1.15, 70);

  function fly(L, toSlot, g, dur) {
    const from = poseOf(L, g);
    const f = { t0: clock, dur, from, toSlot, phi0: from.phi };

    if (toSlot) {
      L.slot = toSlot;
      const to0 = slotPose(toSlot, g);
      // Wir: wszystkie liście krążą w tę samą stronę wokół rośliny, zanim usiądą na gałęzi
      const C = vortexCenter(), R = vortexRadius();
      const th = Math.atan2(from.y - C.y, from.x - C.x);
      const r1 = lerp(Math.hypot(from.x - C.x, from.y - C.y), R, .55);
      f.c1x = C.x + Math.cos(th - 1) * r1;   f.c1y = C.y + Math.sin(th - 1) * r1 * .75;
      f.c2x = C.x + Math.cos(th - 2.1) * R;  f.c2y = C.y + Math.sin(th - 2.1) * R * .75;
      f.da0 = angDiff(from.a, to0.a); f.toA0 = to0.a;
      f.spin = 0;
      f.phi1 = Math.ceil(from.phi / TAU) * TAU + TAU; // jedno przewrócenie w locie, ląduje prosto
    } else {
      // Powrót do tła (cofanie): łagodny łuk w losowe miejsce
      L.slot = null;
      L.nx = rand(.04, .96); L.ny = rand(.05, .88);
      const to0 = floatPose(L);
      const dx = to0.x - from.x, dy = to0.y - from.y;
      const bend = rand(.18, .42) * (Math.random() < .5 ? -1 : 1);
      const cx = (from.x + to0.x) / 2 - dy * bend, cy = (from.y + to0.y) / 2 + dx * bend - Math.hypot(dx, dy) * .12;
      f.c1x = f.c2x = cx; f.c1y = f.c2y = cy;
      f.da0 = angDiff(from.a, to0.a); f.toA0 = to0.a;
      f.spin = reduceMotion ? 0 : pick([-TAU, 0, TAU]);
      f.phi1 = from.phi + TAU * 2 * Math.sign(L.ft);
      L.fp = f.phi1 - (clock + dur) * L.ft * motion; // po wylądowaniu faza obrotu płynnie przechodzi dalej
    }
    L.state = 'fly';
    L.fl = f;
  }

  function land(L, g) {
    if (L.fl.toSlot) {
      L.state = 'attached';
      L.attachedAt = clock;
      wind = Math.min(1.5, wind + .04);
      if (!reduceMotion) { const p = slotPose(L.slot, g); rings.push({ x: p.x, y: p.y, t0: clock }); }
    } else {
      L.state = 'float';
    }
    L.fl = null;
  }

  // Trajektoria wzrostu na najbliższe 8 s — do planowania, kiedy liść ma wystartować
  function trajectory() {
    const out = [], h = 1 / 30, w = growth.omega, T = growth.target;
    let g = growth.g, v = growth.v;
    for (let i = 0; i < 240; i++) { out.push(g); const a = w * w * (T - g) - 2 * w * v; v += a * h; g += v * h; }
    return out;
  }
  function reachTime(traj, val) {
    for (let i = 0; i < traj.length; i++) if (traj[i] >= val - .012) return i / 30;
    return Infinity;
  }

  function setTarget(target, omega) {
    growth.target = target;
    growth.omega = omega;
    if (reduceMotion) { growth.g = target; growth.v = 0; }
    const g = growth.g;

    // Liście, których miejsca "znikają" (cofanie), odlatują z powrotem w tło
    leaves.filter(L => L.slot && L.slot.at > target + 1e-6)
      .forEach(L => {
        L.slot.leaf = null;
        if (L.pending) { L.pending = false; L.slot = null; }
        else fly(L, null, g, reduceMotion ? .001 : rand(1.2, 1.7));
      });

    // Wolne liście dostają nowe miejsca na roślinie
    const free = shuffle(leaves.filter(L => !L.slot));
    for (const sl of SLOTS) {
      if (sl.at > target + 1e-6 || sl.leaf) continue;
      const L = free.pop();
      if (!L) break;
      sl.leaf = L; L.slot = sl; L.pending = true;
      L.fdur = reduceMotion ? .001 : rand(1.9, 2.5);
      L.minStart = clock + (reduceMotion ? 0 : rand(0, .7)); // rozłożone w czasie, nie wszystkie naraz
    }
  }

  // Podmuch przy przejściu dalej: luźne listki dostają pchnięcie w kierunku wiru
  function gust() {
    if (reduceMotion) return;
    wind = Math.min(1.5, wind + .45);
    const C = vortexCenter();
    for (const L of leaves) {
      if (L.slot || L.state !== 'float') continue;
      const p = floatPose(L);
      const dx = p.x - C.x, dy = p.y - C.y, d = Math.hypot(dx, dy) || 1;
      const s = rand(90, 170);
      L.vx += (dy / d) * s;
      L.vy += (-dx / d) * s;
    }
  }

  // ================================================================
  //  Świetliki, bokeh, płatki, kręgi
  // ================================================================
  const fireflySprite = document.createElement('canvas');
  fireflySprite.width = fireflySprite.height = 64;
  {
    const sg = fireflySprite.getContext('2d');
    const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,230,1)');
    gr.addColorStop(.1, 'rgba(255,216,135,1)');
    gr.addColorStop(.24, 'rgba(246,184,106,.6)');
    gr.addColorStop(.55, 'rgba(246,184,106,.16)');
    gr.addColorStop(1, 'rgba(246,184,106,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 64, 64);
  }
  // Etap, od którego świetlik się pojawia — z każdym etapem jest ich trochę więcej
  const FIREFLY_STAGES = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4];
  const fireflies = FIREFLY_STAGES.map((st, i) => {
    const orb = i % 2 === 0; // co drugi krąży wokół rośliny, reszta po całym ekranie
    return {
      st, orb,
      nx: rand(.05, .95), ny: rand(.08, .85),
      cxf: rand(-.6, .6), cyf: rand(.25, .95),
      rx: orb ? rand(7, 18) : rand(30, 90), ry: orb ? rand(4, 12) : rand(20, 60),
      sp: rand(.25, .55) * (Math.random() < .5 ? -1 : 1) * motion,
      ph: rand(0, TAU), k: Math.random() < .3 ? 2 : 1,
      size: rand(18, 30), bs: rand(.9, 1.9), bp: rand(0, TAU),
      vis: 0, ox: 0, oy: 0, x: 0, y: 0,
    };
  });

  const BOKEH_RGB = ['183,220,229', '184,227,211', '124,201,212', '246,184,158'];
  const bokehSprites = BOKEH_RGB.map(rgb => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(.55, `rgba(${rgb},.5)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  });
  const bokeh = Array.from({ length: 8 }, (_, i) => ({
    nx: rand(0, 1), ny: rand(0, 1), r: rand(60, 160),
    spr: bokehSprites[i % 4], a: i % 4 === 3 ? rand(.12, .2) : rand(.2, .34),
    f: rand(.03, .07), ph: rand(0, TAU), ax: rand(20, 60), ay: rand(14, 40),
  }));

  const petals = [];
  const emittedFor = new Set();
  let petalTimer = 0;
  function emitPetal(b) {
    if (petals.length > 26) return;
    const [x, y] = branchPt(b, 1);
    petals.push({
      x, y, vx: rand(-20, 30), vy: rand(-30, -5),
      rot: rand(0, TAU), vr: rand(-2, 2), phi: rand(0, TAU), vphi: rand(2, 4),
      s: b.flower * S * rand(.26, .36), life: 0, max: rand(4.5, 6.5), seed: rand(0, TAU),
    });
  }

  const rings = [];

  // ================================================================
  //  Aktualizacja
  // ================================================================
  function stepGrowth(dt) {
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n, w = growth.omega;
    for (let i = 0; i < n; i++) {
      const a = w * w * (growth.target - growth.g) - 2 * w * growth.v;
      growth.v += a * h;
      growth.g += growth.v * h;
    }
  }

  function updateLeaves(dt, g) {
    let traj = null;
    const repel = pointer.active && !pointer.overCard && !reduceMotion;
    for (const L of leaves) {
      if (L.pending && clock >= L.minStart) {
        traj = traj || trajectory();
        // Start tak, żeby liść dotarł mniej więcej wtedy, gdy łodyga dorośnie do jego miejsca
        if (reachTime(traj, L.slot.at) <= L.fdur * .8) { L.pending = false; fly(L, L.slot, g, L.fdur); }
      }
      if (L.state === 'fly' && clock >= L.fl.t0 + L.fl.dur) land(L, g);
      if (L.state === 'attached') continue;

      // Przesunięcie od kursora / podmuchu — sprężyna wraca listek na miejsce
      let fx = -18 * L.ox - 4.5 * L.vx;
      let fy = -18 * L.oy - 4.5 * L.vy;
      if (repel) {
        const p = floatPose(L);
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d = Math.hypot(dx, dy);
        if (d < 120 && d > .1) {
          const push = Math.pow(1 - d / 120, 2) * 2600;
          fx += dx / d * push; fy += dy / d * push;
        }
      }
      L.vx += fx * dt; L.vy += fy * dt;
      L.ox += L.vx * dt; L.oy += L.vy * dt;
    }
  }

  function updateFireflies(dt, g) {
    const crownY = baseY - plantH(g) * .55 * S;
    const attract = pointer.active && !pointer.overCard && !reduceMotion;
    for (const f of fireflies) {
      f.vis += ((stage >= f.st ? 1 : 0) - f.vis) * Math.min(1, dt * 1.2);
      const th = clock * f.sp + f.ph;
      let cx, cy, rx, ry;
      if (f.orb) {
        cx = baseX + f.cxf * plantW(g) * S;
        cy = baseY - f.cyf * plantH(g) * S;
        rx = f.rx * S; ry = f.ry * S;
      } else {
        // Po rejestracji świetliki z całego ekranu zlatują się wokół kwitnącej rośliny
        cx = lerp(f.nx * W, baseX + f.cxf * 45 * S, gather * .65);
        cy = lerp(f.ny * H, crownY + (f.cyf - .6) * 60 * S, gather * .65);
        rx = f.rx; ry = f.ry;
      }
      const x = cx + Math.cos(th) * rx + Math.sin(clock * 1.3 + f.ph) * 5 * motion;
      const y = cy + Math.sin(th * f.k) * ry + Math.cos(clock * 1.1 + f.ph) * 4 * motion;
      // Ciekawskie świetliki: lekko podlatują do kursora
      let tx = 0, ty = 0;
      if (attract) {
        const dx = pointer.x - x, dy = pointer.y - y, d = Math.hypot(dx, dy);
        if (d < 180) { const k = (1 - d / 180) * .6; tx = dx * k; ty = dy * k; }
      }
      f.ox += (tx - f.ox) * Math.min(1, dt * 2);
      f.oy += (ty - f.oy) * Math.min(1, dt * 2);
      f.x = x + f.ox; f.y = y + f.oy;
    }
  }

  function updatePetals(dt, g) {
    FLOWERS.forEach((b, i) => {
      const bl = bloomOf(i, g);
      if (bl > .95 && !emittedFor.has(i)) { emittedFor.add(i); emitPetal(b); }
      if (bl < .5) emittedFor.delete(i);
    });
    if (!reduceMotion && g > 2.8) {
      petalTimer -= dt;
      if (petalTimer <= 0) { petalTimer = rand(2.6, 4.4); emitPetal(pick(FLOWERS)); }
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life += dt;
      p.vy += 16 * dt;
      p.vx += Math.sin(clock * 1.2 + p.seed) * 14 * dt;
      p.vx *= 1 - .5 * dt; p.vy *= 1 - .6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.phi += p.vphi * dt;
      if (p.life > p.max || p.y > H + 20) petals.splice(i, 1);
    }
  }

  // ================================================================
  //  Rysowanie
  // ================================================================
  function drawLeaf(x, y, a, len, wr, col, dark, alpha, phi) {
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

    if (len > 28) {
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

  function drawStem(b, r, g) {
    const n = Math.max(2, Math.ceil(30 * r));
    const wm = (.55 + .45 * clamp(g / 2) + .1 * clamp(g - 2)) * S;
    const pts = [], ws = [];
    for (let i = 0; i <= n; i++) {
      const tt = r * i / n;
      pts.push(branchPt(b, tt));
      let w = lerp(b.w[0], b.w[1], tt) * wm;
      if (r < 1) w *= clamp(.35 + (r - tt) / .18 * .65, .35, 1); // cieńszy, rosnący czubek
      ws.push(Math.max(1, w));
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = b.col;
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = ws[i];
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    for (let i = 1; i <= n; i++) {
      ctx.lineWidth = ws[i] * .32;
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  }

  // Dwa liścienie na czubku kiełka — widoczne na początku, znikają, gdy przylatują prawdziwe liście
  function drawSprout(g) {
    const b = byId.m1, r = reveal(b, g);
    const k = clamp(g / .05) * (1 - clamp((g - .45) / .35));
    if (k <= 0 || r <= 0) return;
    const [x, y] = branchPt(b, r);
    const ang = branchAng(b, Math.max(.02, r));
    const len = 4.4 * S * easeOutBack(clamp(g / .1)) * k;
    const flutter = Math.sin(clock * 2.1) * .06 * motion;
    drawLeaf(x, y, ang - .95 + flutter, len, .44, '#8FD3C0', '#65B8A4', 1, 0);
    drawLeaf(x, y, ang + .95 - flutter, len, .44, '#8FD3C0', '#65B8A4', 1, 0);
  }

  function drawFlower(b, idx, g) {
    const budStart = Math.min(b.g[1] - .04, 1.86);
    const appear = clamp((g - budStart) / .12);
    if (appear <= 0) return;
    const bloom = bloomOf(idx, g);
    const [x, y] = branchPt(b, 1);
    const tang = branchAng(b, 1);
    const R = b.flower * S;
    const sc = easeOutBack(appear);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(tang, -Math.PI / 2, .5 * bloom) + Math.sin(clock * .7 + idx) * .05 + Math.PI / 2);
    ctx.scale(sc, sc);
    // działki kielicha
    ctx.fillStyle = '#55AE9C';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * R * .16, -R * .16, R * .13, R * .34, sd * (.45 + .5 * bloom), 0, TAU);
      ctx.fill();
    }
    // płatki: zamknięty pąk → otwarty kwiat
    const n = 5, spread = lerp(.16, 1, bloom);
    const pl = R * lerp(.62, 1, bloom), pw = R * lerp(.26, .42, bloom);
    for (let k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate((k - (n - 1) / 2) * (TAU / n) * spread);
      const grd = ctx.createLinearGradient(0, 0, 0, -pl);
      grd.addColorStop(0, '#F3A487');
      grd.addColorStop(1, '#FBD6C6');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, -pl * .52, pw, pl * .52, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (bloom > .02) {
      ctx.beginPath(); ctx.arc(0, 0, R * .27 * bloom, 0, TAU); ctx.fillStyle = '#F6B86A'; ctx.fill();
      ctx.beginPath(); ctx.arc(-R * .07, -R * .07, R * .09 * bloom, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    }
    ctx.restore();
  }

  function drawSeed(g) {
    const a = 1 - clamp((g - .3) / .3);
    if (a <= 0) return;
    const p = 1 + .07 * Math.sin(clock * 2.2) * motion;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(baseX, baseY - 3 * S);
    ctx.rotate(-.35);
    ctx.scale(p, p);
    ctx.fillStyle = '#3A8D9E';
    ctx.beginPath(); ctx.ellipse(0, 0, 2.3 * S, 1.6 * S, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.ellipse(-.7 * S, -.5 * S, .7 * S, .4 * S, -.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    ctx.save();
    ctx.translate(baseX, baseY + 1.5 * S);
    ctx.scale(1, .24);
    const R = 34 * S;
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    halo.addColorStop(0, 'rgba(120,201,183,.35)');
    halo.addColorStop(1, 'rgba(120,201,183,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();

    const rx = 17 * S, ry = 3.8 * S, cy = baseY + 1.2 * S;
    const mg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    mg.addColorStop(0, '#CBEBDF');
    mg.addColorStop(1, '#A4D6C5');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(baseX, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(baseX, cy, rx * .96, ry * .9, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
  }

  function drawBokeh() {
    for (const o of bokeh) {
      const x = o.nx * W + Math.sin(clock * o.f + o.ph) * o.ax * motion;
      const y = o.ny * H + Math.cos(clock * o.f * 1.3 + o.ph) * o.ay * motion;
      ctx.globalAlpha = o.a;
      ctx.drawImage(o.spr, x - o.r, y - o.r, o.r * 2, o.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawPetals() {
    for (const p of petals) {
      const a = Math.min(1, p.life * 3) * (1 - clamp((p.life - p.max + 1.2) / 1.2));
      if (a <= 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, flipScale(p.phi));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#F6B89E';
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * .5, p.s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-p.s * .12, -p.s * .3, p.s * .16, p.s * .4, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawRings() {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], e = (clock - r.t0) / .6;
      if (e >= 1) { rings.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(r.x, r.y, lerp(3, 20, easeOutCubic(e)), 0, TAU);
      ctx.strokeStyle = `rgba(120,201,183,${.55 * (1 - e)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  function drawFireflies() {
    for (const f of fireflies) {
      if (f.vis < .01) continue;
      const blink = .35 + .65 * Math.pow(.5 + .5 * Math.sin(clock * f.bs + f.bp), 2);
      ctx.globalAlpha = f.vis * blink;
      ctx.drawImage(fireflySprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    ctx.globalAlpha = 1;
  }

  function draw(g) {
    ctx.clearRect(0, 0, W, H);
    drawBokeh();

    // poświata za rośliną — mocniejsza, im roślina większa
    const ph = plantH(g);
    const gy = baseY - ph * .45 * S;
    const glow = ctx.createRadialGradient(baseX, gy, 0, baseX, gy, Math.max(ph, 40) * .95 * S);
    glow.addColorStop(0, `rgba(184,227,211,${.32 + .2 * clamp(g / 3)})`);
    glow.addColorStop(1, 'rgba(184,227,211,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // luźne listki w tle
    for (const L of leaves) {
      if (L.state === 'float' || (L.state === 'fly' && !L.fl.toSlot)) {
        const p = poseOf(L, g);
        drawLeaf(p.x, p.y, p.a, p.s, L.wr, L.col, L.dark, p.al, p.phi);
      }
    }

    drawSeed(g);
    for (const b of BRANCHES) {
      const r = reveal(b, g);
      if (r > 0) drawStem(b, r, g);
    }
    drawSprout(g);
    drawGround();

    for (const L of leaves) {
      if (L.state === 'attached') {
        const p = poseOf(L, g);
        drawLeaf(p.x, p.y, p.a, p.s, L.wr, L.col, L.dark, 1, 0);
      }
    }
    FLOWERS.forEach((b, i) => drawFlower(b, i, g));
    drawPetals();

    // liście w locie do rośliny — na wierzchu
    for (const L of leaves) {
      if (L.state === 'fly' && L.fl.toSlot) {
        const p = poseOf(L, g);
        drawLeaf(p.x, p.y, p.a, p.s, L.wr, L.col, L.dark, p.al, p.phi);
      }
    }
    drawRings();
    drawFireflies();
  }

  function frame(ms) {
    const dt = Math.min(.05, Math.max(0, (ms - lastMs) / 1000)) * TEMPO;
    lastMs = ms;
    clock += dt;

    stepGrowth(dt);
    const g = growth.g;
    wind *= Math.exp(-dt * 1.4);
    gather += (gatherTarget - gather) * Math.min(1, dt * .8);

    updateLeaves(dt, g);
    updateFireflies(dt, g);
    updatePetals(dt, g);
    draw(g);
    requestAnimationFrame(frame);
  }

  // ================================================================
  //  Rozmiar i układ
  // ================================================================
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (W >= 900) {
      // Komputer: roślina na środku wolnej przestrzeni po lewej od karty
      const area = Math.max(260, card.getBoundingClientRect().left - 20);
      baseX = area / 2 + 10;
      baseY = H - Math.max(36, H * .075);
      S = Math.min(H * .7, area * 1.05) / 100;
      floatScale = 1;
    } else {
      // Telefon: roślina w pasie nad arkuszem z formularzem (wysokość = górny padding layoutu)
      const hero = parseFloat(getComputedStyle(layout).paddingTop) || 220;
      baseX = W / 2;
      baseY = hero - 10;
      S = Math.min(hero * .8, W * .9) / 100;
      floatScale = .85;
    }
  }

  // ================================================================
  //  Wejście: kursor
  // ================================================================
  function overPlant(x, y) {
    const g = growth.g;
    return Math.abs(x - baseX) < Math.max(plantW(g) * S * 1.1, 40)
      && y < baseY + 10 && y > baseY - plantH(g) * S * 1.1;
  }
  window.addEventListener('pointermove', e => {
    if (pointer.active && overPlant(e.clientX, e.clientY)) {
      const d = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      wind = Math.min(1.5, wind + d * .0025 * motion);
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.overCard = e.target instanceof Element && !!e.target.closest('.card');
  }, { passive: true });
  const deactivate = () => { pointer.active = false; };
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') deactivate(); });
  window.addEventListener('pointerout', e => { if (!e.relatedTarget) deactivate(); });
  window.addEventListener('blur', deactivate);

  // ================================================================
  //  API
  // ================================================================
  function retarget(omega) {
    const eased = 1 - Math.pow(1 - progress, 2); // pierwsze pole daje wyraźny efekt
    setTarget(STAGE_BASE[stage] + STAGE_MICRO[stage] * eased, omega);
  }

  window.PlantScene = {
    setStage(n, p = 0) {
      const back = n < stage;
      stage = n;
      progress = clamp(p);
      retarget(back ? SPRING.back : SPRING.forward);
      gatherTarget = n === 4 ? 1 : 0;
      if (!back) gust();
    },
    setProgress(p) {
      p = clamp(p);
      if (Math.abs(p - progress) < 1e-3) return;
      progress = p;
      retarget(SPRING.micro);
    },
    rustle(amount) {
      wind = Math.min(1.5, wind + amount * motion);
    },
  };

  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  resize();
  requestAnimationFrame(frame);
})();
