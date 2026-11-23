/*
 * Wejście do aplikacji po zalogowaniu — WARIANT „POLE” (logowanie.html → aplikacja.html). Style: css/wejscie.css.
 *
 *   1) logowanie: treść powitania gaśnie, karta zjeżdża, a kamera „unosi się” — roślinka z logowania maleje
 *      i ginie w polu pełnym roślinek (każdy ma swoją), widzianym z daleka;
 *   2) zmiana strony — pole rysuje ten sam kod na obu stronach, a czas liczymy od stuknięcia (sessionStorage),
 *      więc ruch trwa dalej bez szwu;
 *   3) aplikacja: świetlik szuka po polu, zatrzymuje się na Twojej roślince — ta rozkwita, pojawia się jej imię;
 *      kamera zbliża się do niej i w połowie drogi roślinka z pola przechodzi w prawdziwą roślinkę ze strony głównej;
 *      potem powitanie, górny pasek, kafel i pasek zakładek.
 * Ok. 4 s; stuknięcie pomija. prefers-reduced-motion albo ?widok → bez animacji. Kolory tylko z tokenów motywów.
 *
 * Ładowany BEZ defer w <head> (po js/theme.js). Na stronie aplikacji zaraz za znacznikiem zasłony stoi
 * <script>Wejscie.mount()</script>, żeby pole było narysowane już w pierwszej klatce.
 *
 * window.Wejscie:
 *   leave(badgeEl, href)  logowanie: animacja wyjścia, potem przejście na href
 *   mount()               aplikacja: rysuje pole od razu (wywoływane w HTML)
 */
(function () {
  'use strict';

  const KEY = 'sci.wejscie';
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('widok');

  // Oś czasu (ms od stuknięcia „Przejdź do aplikacji”)
  const T_NAV = 1000;                    // zmiana strony
  const T_SEEK0 = 1050, T_FOUND = 2050;  // świetlik szuka → znajduje
  const T_ZOOM0 = 2350, T_ZOOM1 = 3400;  // zbliżenie
  const T_END = 3800;                    // zasłona znika (pod nią strona główna już się pokazuje)

  // Znacznik z logowania: czas stuknięcia. Jednorazowy (odświeżenie nie powtarza wejścia).
  let startedAt = 0;
  try { startedAt = +sessionStorage.getItem(KEY) || 0; sessionStorage.removeItem(KEY); } catch (_) { /* tryb prywatny */ }
  if (startedAt && Date.now() - startedAt < 15000 && !reduceMotion) root.setAttribute('data-wejscie', 'pole');

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hex = h => { h = (h || '').trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16) || 0x888888; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const WHITE = [255, 255, 255];

  // Palety wszystkich motywów (css/tokens.css) — każda roślinka na polu ma kolor czyjejś roślinki
  const THEMES = ['morski', 'zielony', 'niebieski', 'lawenda', 'rozowy', 'morelowy'];
  function readPal(el) {
    const cs = getComputedStyle(el);
    const v = n => hex(cs.getPropertyValue(n));
    return { stem: v('--plant-stem'), l1: v('--plant-leaf-1'), l2: v('--plant-leaf-2'), l3: v('--plant-leaf-3'),
      flower: v('--plant-flower'), tip: v('--plant-flower-tip'), core: v('--plant-core'), ground: v('--plant-ground'), glow: v('--plant-glow') };
  }
  function readPalettes() {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    THEMES.forEach(id => { const d = document.createElement('i'); d.dataset.palette = id; box.appendChild(d); });
    document.body.appendChild(box);
    const out = [...box.children].map(readPal);
    box.remove();
    return out;
  }

  // ================================================================
  //  Pole roślinek (canvas) — ten sam rysunek na obu stronach
  // ================================================================
  function Field(canvas) {
    const g = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, yh = 0;
    let plants = [], you = null, flies = [];
    const cs = getComputedStyle(root);
    const tok = n => hex(cs.getPropertyValue(n));
    const own = readPal(root);
    const pals = readPalettes();
    const sky = { top: mixC(tok('--bg'), tok('--mist'), .45), low: mixC(tok('--mint'), tok('--bg'), .35), bg: tok('--bg') };
    const fireflySprite = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(.12, 'rgba(255,216,135,1)');
      gr.addColorStop(.3, 'rgba(246,184,106,.55)'); gr.addColorStop(1, 'rgba(246,184,106,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      return c;
    })();

    function layout() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      // pole w perspektywie: im wyżej (bliżej horyzontu), tym mniejsze i bledsze roślinki
      const rnd = seeded(31);
      yh = H * .3;
      const sOf = y => .08 + 1.05 * Math.pow(clamp((y - yh) / (H * .8), 0, 1.6), 1.15);
      plants = [];
      const unit = Math.min(W, 560) / 390;                     // na szerokim ekranie roślinki trochę większe
      for (let y = yh + 10; y < H * 1.25;) {
        const s = sOf(y) * unit;
        let x = -W * .3 + rnd() * 120 * s;
        while (x < W * 1.3) {
          if (rnd() < .3 + .48 * clamp(s * 2.5)) {             // przy horyzoncie rzadziej (bez „grzebienia”)
            const k = rnd();
            const py = y + (rnd() - .5) * (62 * s + 9) * 1.1;          // bez równych rzędów
            plants.push({
              x: x + (rnd() - .5) * 60 * s, y: py, s: sOf(py) * unit * (.8 + rnd() * .35),
              pal: k < .25 ? own : pals[Math.floor(rnd() * pals.length)],
              lean: (rnd() - .5) * 18, side: rnd() < .5 ? -1 : 1, lc: Math.floor(rnd() * 3),
              ph: rnd() * TAU, bloom: rnd() < .65 ? 1 : .3, leafK: .9 + rnd() * .3,
            });
          }
          x += Math.max(38, (120 + rnd() * 110) * s);
        }
        y += 62 * s + 9;
      }
      // Twoja roślinka: ta najbliżej punktu w środku pola; wokół niej trochę wolnego miejsca
      const tx = W * .6, ty = H * .68;
      you = plants.reduce((b, p) => (Math.hypot(p.x - tx, p.y - ty) < Math.hypot(b.x - tx, b.y - ty) ? p : b), plants[0]);
      Object.assign(you, { pal: own, bloom: .3, lean: 6, side: -1, leafK: 1.05, you: true });
      const yH = 100 * you.s;
      plants = plants.filter(p => {
        if (p === you) return true;
        const dx = Math.abs(p.x - you.x), ph = 100 * p.s;
        if (p.y >= you.y) return dx > (yH + ph) * .42 || p.y - ph > you.y + 4;   // z przodu: nie zasłania
        return dx > yH * .75 || p.y < you.y - yH * .45;                          // z tyłu: nie wyrasta z niej
      });
      plants.sort((a, b) => a.y - b.y);
      flies = Array.from({ length: 16 }, () => ({ x: rnd() * W * 1.4 - W * .2, y: yh + rnd() * H * .6, r: 6 + rnd() * 16, sp: .3 + rnd() * .5, ph: rnd() * TAU, size: 10 + rnd() * 12 }));
    }

    // jedna roślinka: u podstawy (0, 0), wysokość h px, y w górę ujemne
    function plant(p, h, haze, alpha, glow, t) {
      const pal = p.pal, base = mixC(sky.low, sky.bg, .3);
      const c = (col, k = 0) => rgba(mixC(col, base, clamp(haze + k)), alpha);
      const u = h / 100;
      if (glow > .01) {
        const gr = g.createRadialGradient(0, -h * .55, 0, 0, -h * .55, h * .9);
        gr.addColorStop(0, rgba(pal.glow, .75 * glow * alpha)); gr.addColorStop(1, rgba(pal.glow, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, -h * .55, h * .9, 0, TAU); g.fill();
      }
      g.fillStyle = c(pal.ground, .1);
      g.beginPath(); g.ellipse(0, 0, 24 * u, 4.5 * u, 0, 0, TAU); g.fill();
      // łodyga: łagodny łuk
      const lx = p.lean * u, cx = lx * .15 + p.side * 3 * u;
      const at = s => [2 * (1 - s) * s * cx + s * s * lx, -(2 * (1 - s) * s * 52 + s * s * 100) * u];
      g.strokeStyle = c(pal.stem); g.lineCap = 'round'; g.lineWidth = Math.max(.7, 3.1 * u);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(cx, -52 * u, lx, -100 * u); g.stroke();
      // liście (na małych roślinkach mniej)
      const n = h < 12 ? 2 : h < 30 ? 4 : 6;
      const L = [p.pal.l1, p.pal.l2, p.pal.l3];
      for (let i = 0; i < n; i++) {
        const s = .2 + i * (.62 / n);
        const [x, y] = at(s), [x2, y2] = at(s + .02);
        const up = Math.atan2(y2 - y, x2 - x);
        const sd = (i % 2 ? 1 : -1) * p.side;
        const ang = up + sd * (1.15 - i * .07);
        const len = (30 - i * 3.2) * u * p.leafK, wid = len * .36;
        g.save(); g.translate(x, y); g.rotate(ang);
        g.fillStyle = c(L[(i + p.lc) % 3]);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .45, -wid, len, 0); g.quadraticCurveTo(len * .45, wid, 0, 0); g.fill();
        if (h > 24) {
          g.fillStyle = c(mixC(L[(i + p.lc) % 3], pal.stem, .28));
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .45, wid * sd, len, 0); g.quadraticCurveTo(len * .5, 0, 0, 0); g.fill();
        }
        g.restore();
      }
      // kwiat (pąk, gdy bloom małe)
      const b = p.bloom;
      g.save(); g.translate(lx, -100 * u - 2 * u);
      if (b < .6) {
        g.fillStyle = c(mixC(pal.flower, pal.l2, .35));
        g.beginPath(); g.ellipse(0, 0, 3.6 * u, 5.6 * u, p.lean * .02, 0, TAU); g.fill();
      }
      if (b > .3) {
        const e = (b - .3) / .7, R = (5 + 6 * e) * u;
        g.rotate(t * .0002 + p.ph);
        g.fillStyle = c(pal.flower);
        for (let k = 0; k < 5; k++) {
          g.beginPath(); g.ellipse(Math.cos(k * TAU / 5) * R * .62, Math.sin(k * TAU / 5) * R * .62, R * .58, R * .38, k * TAU / 5, 0, TAU); g.fill();
        }
        g.fillStyle = c(mixC(pal.tip, WHITE, .2), .05);
        for (let k = 0; k < 5; k++) {
          g.beginPath(); g.ellipse(Math.cos(k * TAU / 5 + .6) * R * .3, Math.sin(k * TAU / 5 + .6) * R * .3, R * .3, R * .2, k * TAU / 5 + .6, 0, TAU); g.fill();
        }
        g.fillStyle = c(pal.core);
        g.beginPath(); g.arc(0, 0, R * .3, 0, TAU); g.fill();
      }
      g.restore();
    }

    // cam: { cx, cy, z } — punkt świata w środku ekranu i powiększenie
    function draw(t, cam, fx) {
      const toS = (x, y) => [(x - cam.cx) * cam.z + W / 2, (y - cam.cy) * cam.z + H / 2];
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      // niebo (w ekranie) z horyzontem tam, gdzie wypada w kamerze
      const hy = toS(0, yh)[1];
      const ez = fx.zoom || 0, toBg = c => mixC(c, sky.bg, .8 * easeInOut(ez));
      const sk = g.createLinearGradient(0, 0, 0, Math.max(hy, 1));
      sk.addColorStop(0, rgba(toBg(sky.top))); sk.addColorStop(1, rgba(toBg(sky.low)));
      g.fillStyle = sk; g.fillRect(0, 0, W, H);

      g.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.cx * cam.z), dpr * (H / 2 - cam.cy * cam.z));
      // poświata nad horyzontem
      const sun = g.createRadialGradient(W * .68, yh, 0, W * .68, yh, W * .9);
      sun.addColorStop(0, rgba(own.glow, .8)); sun.addColorStop(1, rgba(own.glow, 0));
      g.fillStyle = sun; g.fillRect(-W, yh - H, W * 3, H * 1.2);
      // wzgórza i łąka
      const hill = (off, amp, col) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(-W, H * 1.4);
        for (let x = -W; x <= W * 2; x += 12) g.lineTo(x, yh + off - amp * (.6 + .4 * Math.sin(x * .011 + off)) - amp * .4 * Math.sin(x * .027 + 1.7));
        g.lineTo(W * 2, H * 1.4); g.closePath(); g.fill();
      };
      hill(-6, 16, rgba(toBg(mixC(own.ground, sky.low, .62))));
      hill(4, 10, rgba(toBg(mixC(own.ground, sky.low, .45))));
      const gr = g.createLinearGradient(0, yh, 0, H * 1.2);
      gr.addColorStop(0, rgba(toBg(mixC(own.ground, sky.low, .35)))); gr.addColorStop(1, rgba(toBg(mixC(own.ground, sky.bg, .05))));
      g.fillStyle = gr; g.fillRect(-W, yh + 8, W * 3, H * 1.4);

      // roślinki od najdalszych
      const e = fx.zoom || 0;
      for (const p of plants) {
        const h = 100 * p.s;
        const [sx, sy] = toS(p.x, p.y);
        const hs = h * cam.z;
        if (sx < -hs || sx > W + hs || sy < -10 || sy - hs > H + 10) continue;
        let alpha = 1, haze = clamp(.7 - p.s * .6, .2, .72) + .18 * (fx.spot || 0);   // po znalezieniu inne lekko bledną
        if (p.you) alpha = fx.youAlpha == null ? 1 : fx.youAlpha;
        else if (e > 0) {
          // głębia ostrości: przednie przelatują obok kamery, dalsze toną we mgle
          const front = p.y > you.y + 2;
          alpha *= front ? 1 - span(e, .05, .45) : 1 - .9 * span(e, .2, .75);
          haze = clamp(haze + e * .45, 0, .85);
        }
        if (alpha <= .01) continue;
        const sw = Math.sin(t * .0011 + p.ph) * .04 + Math.sin(t * .0029 + p.ph * 2) * .015;
        let glow = 0;
        if (fx.orb) { const d = Math.hypot(fx.orb[0] - p.x, fx.orb[1] - (p.y - h * .5)); glow = clamp(1 - d / (70 * Math.max(p.s, .3))) * .8; }
        if (p.you) glow = Math.max(glow, fx.youGlow || 0);
        const img = p.you ? fx.youImg || 0 : 0;      // 0 = rysunek z pola, 1 = prawdziwa roślinka ze strony głównej
        if (img < 1) {
          g.save(); g.translate(p.x, p.y); g.rotate(sw * (1 - img));
          const bl = p.bloom;
          if (p.you && fx.youBloom != null) p.bloom = fx.youBloom;
          plant(p, h, p.you ? .04 : haze, alpha * (1 - img), glow, t);
          p.bloom = bl;
          g.restore();
        }
        if (img > 0 && fx.home) homeImage(fx.home, p.x, p.y, h, alpha * img);
      }
      // pierścień „to Twoja” wokół kwiatu
      if (fx.ring > 0 && fx.ring < 1) {
        const [fx0, fy0] = youFlower();
        g.strokeStyle = rgba(own.l2, .9 * (1 - fx.ring)); g.lineWidth = 2 / cam.z;
        g.beginPath(); g.arc(fx0, fy0, (6 + 26 * easeOut(fx.ring)) * Math.max(you.s, .4), 0, TAU); g.stroke();
      }
      // świetliki i świetlik-przewodnik
      for (const f of flies) {
        const x = f.x + Math.cos(t * .001 * f.sp + f.ph) * f.r, y = f.y + Math.sin(t * .0013 * f.sp + f.ph) * f.r * .6;
        g.globalAlpha = (.25 + .45 * Math.pow(.5 + .5 * Math.sin(t * .002 * f.sp + f.ph), 2)) * (1 - e);
        g.drawImage(fireflySprite, x - f.size / 2, y - f.size / 2, f.size, f.size);
      }
      if (fx.orb && fx.orbA > 0) {
        const r = 34 * (fx.orbS || 1);
        g.globalAlpha = fx.orbA;
        g.drawImage(fireflySprite, fx.orb[0] - r, fx.orb[1] - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
    }

    // Wycinek prawdziwej sceny strony głównej (js/home2-scene.js) wokół roślinki, z miękką maską —
    // na końcu zbliżenia leży dokładnie na prawdziwej roślince, więc podmiana jest niewidoczna.
    const off = document.createElement('canvas'), og = off.getContext('2d');
    function homeImage(home, x, y, h, alpha) {
      const src = home.canvas, cw = src.clientWidth || 1, d = src.width / cw;
      // wycinek nie wychodzi poza canvas (inaczej widać jego krawędź); maska: miękka elipsa wokół roślinki
      const rx = Math.max(20, Math.min(home.h * .75, home.lx, cw - home.lx));
      const top = home.h * 1.22, bot = home.h * .14;
      const sx = home.lx - rx, sy = home.ly - top, sw = rx * 2, sh = top + bot;
      const ow = Math.max(2, Math.round(Math.min(sw * d, 1400))), oh = Math.max(2, Math.round(ow * sh / sw));
      if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
      og.globalCompositeOperation = 'source-over';
      og.clearRect(0, 0, ow, oh);
      og.drawImage(src, sx * d, sy * d, sw * d, sh * d, 0, 0, ow, oh);
      og.globalCompositeOperation = 'destination-in';
      const k0 = ow / sw, cx = ow / 2, cy = (top - home.h * .55) * k0, ry = home.h * .68 * k0;
      const m = og.createRadialGradient(0, 0, .6, 0, 0, 1);
      m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
      og.save(); og.translate(cx, cy); og.scale(ow / 2, ry); og.fillStyle = m; og.fillRect(-1, -oh / ry, 2, 2 * oh / ry); og.restore();
      const k = h / home.h;
      g.globalAlpha = alpha;
      g.drawImage(off, x - rx * k, y - top * k, sw * k, sh * k);
      g.globalAlpha = 1;
    }

    const youH = () => 100 * you.s;
    function youFlower() { return [you.x + you.lean * you.s, you.y - youH() - 2 * you.s]; }
    layout();
    return { draw, layout, get you() { return you; }, youH, youFlower, size: () => [W, H] };
  }

  // Kamera z szerokiego ujęcia: powolny przelot nad polem
  function wideCam(t, W, H) {
    const k = easeInOut(clamp(t / T_ZOOM0));
    return { cx: W / 2 - 16 + 26 * k, cy: H / 2 + 6 - 10 * k, z: 1 + .06 * k };
  }

  function buildOverlay() {
    let ov = document.querySelector('.wejscie');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'wejscie';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<canvas class="wj-field"></canvas><div class="wj-copy"><span class="wj-eyebrow"></span><p class="wj-line"></p></div><span class="wj-tag"></span>';
    document.body.appendChild(ov);
    return ov;
  }
  function plantName() {
    try { const a = JSON.parse(localStorage.getItem('sci.account')); return (a && a.plant) || ''; } catch (_) { return ''; }
  }
  const LINES = { field: 'Wśród wielu roślinek…', found: '…jest ta jedna Twoja.' };

  // ================================================================
  //  1) Logowanie: wyjście
  // ================================================================
  let leaving = false;
  function leave(badgeEl, href) {
    if (leaving) return;
    leaving = true;
    if (reduceMotion) { location.href = href; return; }
    const t0 = Date.now();
    const go = () => {
      try { sessionStorage.setItem(KEY, String(t0)); } catch (_) { /* bez znacznika aplikacja po prostu się otworzy */ }
      location.href = href;
    };
    const ov = buildOverlay();
    ov.classList.add('is-leaving');
    const canvas = ov.querySelector('canvas');
    root.setAttribute('data-wejscie', 'pole');              // zasłona łapie stuknięcia
    const field = Field(canvas);
    const [W, H] = field.size();
    const copy = ov.querySelector('.wj-copy');
    ov.querySelector('.wj-eyebrow').textContent = plantName() || 'Twoja roślinka';
    ov.querySelector('.wj-line').textContent = LINES.field;
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const opt = (duration, delay, easing = 'ease') => ({ duration, delay, easing, fill: 'forwards' });

    // treść powitania gaśnie, karta zjeżdża (komputer: gaśnie)
    const step = badgeEl.closest('.step') || badgeEl.parentElement;
    [...step.children].forEach((el, i) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], opt(320, i * 50, 'cubic-bezier(.4, 0, 1, 1)')));
    const card = badgeEl.closest('.card');
    if (card) card.animate(wide ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none' }, { transform: 'translateY(calc(100% + 60px))' }], opt(700, 100, 'cubic-bezier(.65, 0, .35, 1)'));
    document.querySelectorAll('.scene-copy p').forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], opt(300, 0)));

    // roślinka z logowania maleje i odpływa w pole — w miejsce Twojej roślinki
    const scene = document.getElementById('scene');
    if (scene) {
      const layoutEl = document.querySelector('.layout');
      const bx = wide ? Math.max(260, (card ? card.getBoundingClientRect().left : W / 2) - 20) / 2 + 10 : W / 2;
      const by = wide ? H - Math.max(36, H * .075) : (parseFloat(getComputedStyle(layoutEl).paddingTop) || 220) - 16;
      const loginH = wide ? H * .6 : by - 70;
      const cam = wideCam(700, W, H), y = field.you;
      const tx = (y.x - cam.cx) * cam.z + W / 2, ty = (y.y - cam.cy) * cam.z + H / 2;
      const k = (field.youH() * cam.z) / loginH;
      scene.style.transformOrigin = `${bx}px ${by}px`;
      scene.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${tx - bx}px, ${ty - by}px) scale(${k})`, opacity: 0 }], opt(850, 150, 'cubic-bezier(.55, 0, .3, 1)'));
    }
    // pole wyłania się spod spodu, podpis zmienia się na „Wśród wielu roślinek…”
    canvas.animate([{ opacity: 0 }, { opacity: 1 }], opt(650, 250));
    copy.querySelector('.wj-line').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], opt(500, 450));

    const perf0 = performance.now();
    const tick = () => {
      const t = performance.now() - perf0;
      field.draw(t, wideCam(t, W, H), {});
      if (t < T_NAV + 400) requestAnimationFrame(tick);
    };
    tick();
    setTimeout(go, T_NAV);
  }

  // ================================================================
  //  3) Aplikacja: wejście
  // ================================================================
  let mounted = false;
  function mount() {
    if (mounted || !root.hasAttribute('data-wejscie')) return;
    mounted = true;
    const ov = document.querySelector('.wejscie');
    if (!ov) { root.removeAttribute('data-wejscie'); return; }
    const canvas = ov.querySelector('canvas');
    const field = Field(canvas);
    const [W, H] = field.size();
    const tag = ov.querySelector('.wj-tag');
    const line = ov.querySelector('.wj-line');
    const name = plantName();
    ov.querySelector('.wj-eyebrow').textContent = name || 'Twoja roślinka';
    tag.textContent = name || 'Twoja roślinka';
    line.textContent = LINES.field;
    // kafel: sekcje wjeżdżają po kolei (css/wejscie.css) — treść strony jest jeszcze niewczytana
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('#view-dom > .sec').forEach((s, i) => s.style.setProperty('--wj-i', i));
    }, { once: true });

    // czas od stuknięcia (krótkie ładowanie strony nie przeskakuje szukania)
    const tStart = clamp(Date.now() - startedAt, T_NAV, T_NAV + 250);
    const perf0 = performance.now();
    const you = field.you;
    let home = null, landed = false, found = false, done = false, id = 0;

    // ścieżka świetlika: z lewej, zakosami przez pole, do kwiatu Twojej roślinki
    const [fxY, fyY] = field.youFlower();
    const P0 = [W * -.05, H * .42], P1 = [W * .45, H * .36], P2 = [W * .2, H * .62], P3 = [fxY, fyY];
    const bez = (e) => { const u = 1 - e; return [0, 1].map(i => u * u * u * P0[i] + 3 * u * u * e * P1[i] + 3 * u * e * e * P2[i] + e * e * e * P3[i]); };

    function frame() {
      const t = tStart + performance.now() - perf0;
      const fx = {};
      // świetlik szuka
      const es = easeInOut(span(t, T_SEEK0, T_FOUND));
      if (t < T_FOUND + 300) {
        fx.orb = bez(es);
        fx.orbA = span(t, T_SEEK0 - 50, T_SEEK0 + 300) * (1 - span(t, T_FOUND, T_FOUND + 300));
        fx.orbS = 1 - .5 * span(t, T_FOUND - 200, T_FOUND + 300);
      }
      // znaleziona: rozkwita, pierścień, poświata, imię
      const ef = span(t, T_FOUND, T_FOUND + 700);
      fx.youBloom = lerp(.3, 1, easeOut(ef));
      fx.youGlow = .9 * easeOut(span(t, T_FOUND - 250, T_FOUND + 250));
      fx.ring = span(t, T_FOUND, T_FOUND + 900);
      fx.spot = easeInOut(span(t, T_FOUND - 200, T_FOUND + 400));
      if (!found && t >= T_FOUND) {
        found = true;
        line.animate([{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
        setTimeout(() => { line.textContent = LINES.found; }, 350);
      }

      // prawdziwa roślinka ze strony głównej: od razu dorosła, a w polu zastępuje rysunek, gdy świetlik ją znajdzie
      // (położenie czytamy co klatkę, dopóki kamera nie ruszy — scena układa się dopiero po starcie)
      if (window.Home2Scene && Home2Scene.plantAt && (!home || t < T_ZOOM0)) {
        if (Home2Scene.skipIntro) Home2Scene.skipIntro();
        const cv = document.getElementById('plant'), a = Home2Scene.plantAt(), r = cv.getBoundingClientRect();
        if (a.y > 0 && a.h > 0) home = Object.assign(a, { canvas: cv, lx: a.x - r.left, ly: a.y - r.top });
      }
      if (home) { fx.home = home; fx.youImg = easeInOut(span(t, T_FOUND - 150, T_FOUND + 350)); }

      // kamera: szeroko → zbliżenie na Twoją roślinkę, aż stanie dokładnie tam, gdzie na stronie głównej
      let cam = wideCam(t, W, H);
      const e = easeInOut(span(t, T_ZOOM0, T_ZOOM1));
      fx.zoom = e;
      if (e > 0 && home) {
        const c0 = wideCam(T_ZOOM0, W, H);
        const s0 = [(you.x - c0.cx) * c0.z + W / 2, (you.y - c0.cy) * c0.z + H / 2];
        const z1 = home.h / field.youH();
        const z = c0.z * Math.pow(z1 / c0.z, e);
        const sb = [lerp(s0[0], home.x, e), lerp(s0[1], home.y, e)];
        cam = { cx: you.x - (sb[0] - W / 2) / z, cy: you.y - (sb[1] - H / 2) / z, z };
        if (!landed && e >= .85) { landed = true; if (Home2Scene.bloomFlash) Home2Scene.bloomFlash(); }
      }
      // imię nad kwiatem (prawdziwy tekst), znika przy zbliżaniu
      const [fx0, fy0] = field.youFlower();
      const tx = (fx0 - cam.cx) * cam.z + W / 2, ty = (fy0 - cam.cy) * cam.z + H / 2;
      tag.style.transform = `translate(${tx.toFixed(1)}px, ${(ty - 20 - 6 * cam.z).toFixed(1)}px) translate(-50%, -100%)`;
      tag.style.opacity = (easeOut(span(t, T_FOUND + 150, T_FOUND + 500)) * (1 - span(t, T_ZOOM0 + 50, T_ZOOM0 + 350))).toFixed(3);
      ov.querySelector('.wj-copy').style.opacity = (1 - span(t, T_ZOOM0, T_ZOOM0 + 350)).toFixed(3);
      // zasłona gaśnie pod koniec zbliżenia — pod spodem jest już ta sama roślinka na stronie głównej
      ov.style.opacity = (1 - span(t, T_ZOOM1 - 100, T_ZOOM1 + 350)).toFixed(3);

      field.draw(t, cam, fx);
      if (t >= T_END) { finish(); return; }
      id = requestAnimationFrame(frame);
    }

    // Koniec: znika zasłona, scena wraca do zwykłego stanu. <html data-wejscie> zostaje do końca wizyty
    // (zdjęcie go odpaliłoby zwykłe animacje treści drugi raz).
    function finish(skip) {
      if (done) return;
      done = true;
      cancelAnimationFrame(id);
      ov.remove();
      if (window.Home2Scene && Home2Scene.skipIntro && !home) Home2Scene.skipIntro();
      if (skip === true) {
        document.getAnimations().forEach(a => {
          try { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (_) { /* animacja bez końca */ }
        });
      }
    }
    ov.addEventListener('pointerdown', () => finish(true), { once: true });
    frame();
  }

  window.Wejscie = { leave, mount };
})();
