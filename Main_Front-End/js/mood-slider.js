/*
 * Suwak nastroju „łodyga” (komponent, skala 1–10).
 *
 * Pasek suwaka JEST łodygą. Po lewej łodyga płynnie wyłania się z tła (nie wyrasta z niczego konkretnego)
 * i biegnie w prawo dokładnie do uchwytu, którym jest PĄK na czubku. Pąk rośnie i coraz bardziej pokazuje kolor, a przy 8–10 rozwija się
 * w kwiat (10 = pełny rozkwit z blaskiem i iskierkami). Po drodze wyrastają liście i wąsy.
 * Liście są rozmieszczone nieregularnie (skupiska i luki, czasem dwa po tej samej stronie, różne rozmiary,
 * kąty i wygięcia) — nigdy w lustrzanych parach.
 * Niski nastrój to nie „gorsza” roślinka: jest krótsza i ma spokojniejsze kolory. Niczego nie oceniamy.
 * Dalsza część ścieżki (kropki) pokazuje, dokąd łodyga może jeszcze urosnąć.
 * Przy przeciąganiu pąk przechyla się z bezwładnością, liście szumią.
 * Na każdej liczbie lekka wibracja (telefon), w górę skali — drobinki pyłku, na 8 i 10 — płatki.
 *
 * Ważny tekst (liczba, opis) jest w DOM, nie na canvasie. Suwak ma role="slider", klawiaturę i aria-valuetext.
 * Na telefonie pionowe przewijanie strony działa normalnie (touch-action: pan-y); przeciąganie zaczyna ruch w bok.
 * Kolory z motywu (--plant-*), płynna zmiana po 'themechange'. ?widok=… i prefers-reduced-motion — bez animacji.
 * W React Native: canvas → react-native-skia, przeciąganie → react-native-gesture-handler + Reanimated.
 *
 * API: MoodSlider.create(root, { value, label, onInput(v), onChange(v) }) → { value, set(v), focus() }
 *   root      pusty element — komponent sam wstawia znaczniki
 *   value     początkowa wartość 1–10 albo null (nic nie wybrane: krótka łodyga z pąkiem na 1)
 *   onInput   przy każdej zmianie liczby, także w trakcie przeciągania
 *   onChange  ostateczna wartość: po puszczeniu, stuknięciu albo zmianie z klawiatury
 * MoodSlider.WORDS — słowny opis wartości 1–10.
 * MoodSlider.debugAdvance(sec) — przewija animację wszystkich suwaków (testy, gdy karta jest w tle).
 */
(function () {
  'use strict';

  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;
  const motion = reduceMotion ? 0 : 1;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const TAU = Math.PI * 2;

  const WORDS = ['Bardzo ciężko', 'Ciężko', 'Słabo', 'Tak sobie', 'Średnio', 'Nieźle', 'Dobrze', 'Bardzo dobrze', 'Świetnie', 'Wspaniale'];

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const rand = (a, b) => a + Math.random() * (b - a);
  const flipScale = phi => { const c = Math.cos(phi); return (c < 0 ? -1 : 1) * Math.max(.2, Math.abs(c)); };
  const valid = v => Number.isInteger(v) && v >= 1 && v <= 10;

  function haptic(pattern) {
    // tylko po prawdziwym dotknięciu (inaczej przeglądarka blokuje wibrację)
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (!finePointer && touched && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) { /* brak wsparcia */ } }
  }

  // ================================================================
  //  Kolory z motywu (wspólne dla wszystkich suwaków na stronie)
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
  const grey = c => { const l = c[0] * .3 + c[1] * .59 + c[2] * .11; return [l, l, l]; };
  // Spokojniejszy (mniej nasycony, jaśniejszy) kolor dla niższych wartości — nie „smutny”, tylko cichszy
  const calm = (c, vivid) => mixC(tint(mixC(c, grey(c), .55), .2), c, vivid);

  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => hex(cs.getPropertyValue(name));
    return {
      stem: v('--plant-stem'), l1: v('--plant-leaf-1'), l2: v('--plant-leaf-2'), l3: v('--plant-leaf-3'),
      flower: v('--plant-flower'), tip: v('--plant-flower-tip'), core: v('--plant-core'),
      ground: v('--plant-ground'), glow: v('--plant-glow'),
      lineStrong: v('--line-strong'),
    };
  }
  function lerpPalette(a, b, t) { const o = {}; for (const k in a) o[k] = mixC(a[k], b[k], t); return o; }

  let pal = readPalette(), palFrom = pal, palTo = pal, palStart = 0;
  const redrawAll = new Set();
  const debugAll = new Set();
  window.addEventListener('themechange', () => {
    palFrom = pal;
    palTo = readPalette();
    palStart = performance.now();
    if (reduceMotion) pal = palTo;
    redrawAll.forEach(fn => fn());
  });
  function updatePalette(now) {
    if (pal === palTo) return;
    const t = clamp((now - palStart) / 600);
    pal = t >= 1 ? palTo : lerpPalette(palFrom, palTo, t);
  }

  // Liść: ton (0 = młody/jasny … 1 = starszy/ciemniejszy), żywość koloru z wartości suwaka
  function leafColors(tone, vivid) {
    const base = calm(mixC(mixC(pal.l3, pal.l2, clamp(tone * 1.6)), pal.l1, clamp(tone * 1.4 - .4)), vivid);
    return {
      mid: rgba(base),
      dark: rgba(mixC(base, pal.stem, .22)),
      vein: rgba(tint(base, .5), .45),
    };
  }

  // ================================================================
  //  Geometria
  // ================================================================
  // Liście na łodydze — celowo NIEregularnie, jak na prawdziwym pnączu:
  // skupiska i luki, czasem dwa liście po tej samej stronie, mocno różne rozmiary, kąty, kształty i odcienie.
  // v = miejsce na skali (gdzie wyrasta), side: -1 nad łodygą / 1 pod nią, size (px przy U = 1),
  // ang = odchylenie od łodygi, wr = szerokość blaszki, bend = wygięcie blaszki, tone = odcień (0 jasny … 1 ciemny).
  // Nigdy dwa liście w tym samym miejscu po przeciwnych stronach (żadnych lustrzanych par).
  const LEAVES = [
    { v: 1.35, side: -1, size: 15, ang: 1.3,  wr: .44, bend: .25,  tone: .35 },
    { v: 1.95, side: 1,  size: 12, ang: .5,   wr: .42, bend: -.15, tone: .2 },
    { v: 2.7,  side: -1, size: 34, ang: .78,  wr: .35, bend: .2,   tone: .85 },
    { v: 2.98, side: -1, size: 19, ang: 1.42, wr: .41, bend: -.25, tone: .45 },
    { v: 4.0,  side: 1,  size: 25, ang: .6,   wr: .34, bend: .12,  tone: .7 },
    { v: 4.45, side: -1, size: 40, ang: 1.02, wr: .37, bend: -.22, tone: .95 },
    { v: 5.75, side: 1,  size: 19, ang: .42,  wr: .38, bend: .2,   tone: .55 },
    { v: 5.98, side: 1,  size: 12, ang: 1.0,  wr: .45, bend: -.1,  tone: .25 },
    { v: 6.4,  side: -1, size: 27, ang: 1.25, wr: .39, bend: .28,  tone: .6 },
    { v: 7.5,  side: -1, size: 43, ang: .74,  wr: .36, bend: -.18, tone: .9 },
    { v: 7.82, side: 1,  size: 22, ang: .62,  wr: .36, bend: .15,  tone: .5 },
    { v: 8.95, side: -1, size: 23, ang: 1.15, wr: .41, bend: .22,  tone: .4 },
    { v: 9.2,  side: 1,  size: 14, ang: .72,  wr: .42, bend: -.2,  tone: .3 },
  ];
  // Wąsy (spiralki) w lukach między liśćmi
  const TENDRILS = [
    { v: 3.45, side: 1,  len: 21 },
    { v: 5.2,  side: -1, len: 25 },
    { v: 8.45, side: 1,  len: 17 },
  ];
  const FADE = 40;           // odcinek (px przy U = 1), na którym łodyga wyłania się z tła
  const FLOWER_R = 22;       // promień otwartego kwiatu (px przy U = 1)
  // Canvas wystaje poza pole suwaka (px), żeby kwiat, poświata i płatki nie były ucinane
  const BLEED_TOP = 80, BLEED_X = 44;

  // ================================================================
  //  Znaczniki komponentu
  // ================================================================
  function markup(label) {
    const nums = WORDS.map((_, i) => `<span data-v="${i + 1}">${i + 1}</span>`).join('');
    return `
      <div class="ms-readout" aria-hidden="true">
        <p class="ms-value is-empty"><b class="ms-num">–</b><span>/10</span></p>
        <p class="ms-word">Przeciągnij w prawo</p>
      </div>
      <div class="ms-slider" role="slider" tabindex="0" aria-label="${label}"
           aria-valuemin="1" aria-valuemax="10" aria-valuetext="Nie wybrano">
        <canvas class="ms-canvas" aria-hidden="true"></canvas>
        <span class="ms-ring" aria-hidden="true"></span>
        <span class="ms-hint" aria-hidden="true">
          przeciągnij
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
        </span>
      </div>
      <div class="ms-scale" aria-hidden="true">${nums}</div>`;
  }

  // ================================================================
  //  Komponent
  // ================================================================
  function create(root, opts = {}) {
    root.classList.add('ms');
    root.innerHTML = markup(opts.label || 'Jak się dziś czujesz? Skala od 1 do 10');

    const slider = root.querySelector('.ms-slider');
    const canvas = root.querySelector('.ms-canvas');
    const ctx = canvas.getContext('2d');
    const ring = root.querySelector('.ms-ring');
    const hint = root.querySelector('.ms-hint');
    const valueEl = root.querySelector('.ms-value');
    const numEl = root.querySelector('.ms-num');
    const wordEl = root.querySelector('.ms-word');
    const ticks = [...root.querySelectorAll('.ms-scale span')];

    // ---------- Stan ----------
    let W = 0, H = 0, U = 1, left = 0, right = 0, stemY = 0, bleedL = BLEED_X, bleedR = BLEED_X;
    let value = valid(opts.value) ? opts.value : null;   // ostatnia zatwierdzona wartość
    let touched = value != null;                          // czy ktoś już wybrał
    let pos = value != null ? value : 1, posV = 0, target = pos;
    let g = touched ? (pos - 1) / 9 : 0, gV = 0;          // „dojrzałość” 0–1 (sprężyście, z lekkim opóźnieniem)
    let lean = 0, leanV = 0, flutter = 0;
    let dragging = false, pending = null, grabOffset = 0;
    let shown = null;                                     // liczba pokazana w odczycie
    let clock = 0, lastMs = performance.now(), popAt = -10;
    let tipCache = null;
    const parts = [];

    const xOf = v => left + (v - 1) / 9 * (right - left);
    const vOf = x => clamp(1 + (x - left) / (right - left) * 9, 1, 10);
    const localX = e => e.clientX - slider.getBoundingClientRect().left;

    // ---------- Odczyt (DOM) ----------
    function showValue(v) {
      const prev = shown;
      if (v === prev) return prev;
      shown = v;
      if (v == null) {
        numEl.textContent = '–';
        wordEl.textContent = 'Przeciągnij w prawo';
        valueEl.classList.add('is-empty');
        slider.removeAttribute('aria-valuenow');
        slider.setAttribute('aria-valuetext', 'Nie wybrano');
      } else {
        numEl.textContent = v;
        wordEl.textContent = WORDS[v - 1];
        valueEl.classList.remove('is-empty');
        slider.setAttribute('aria-valuenow', v);
        slider.setAttribute('aria-valuetext', `${v} z 10 — ${WORDS[v - 1]}`);
        if (!reduceMotion) { numEl.classList.remove('is-bump'); void numEl.offsetWidth; numEl.classList.add('is-bump'); }
      }
      ticks.forEach((t, i) => t.classList.toggle('is-on', v === i + 1));
      hint.classList.toggle('is-hidden', v != null);
      return prev;
    }

    function commit(v) {
      touched = true;
      value = v;
      target = v;
      if (reduceMotion) { pos = v; g = (v - 1) / 9; }
      onTickCheck();
      if (opts.onChange) opts.onChange(v);
      if (reduceMotion) draw();
    }

    // Każda nowa liczba: wibracja, podskok pączka, drobinki w górę skali
    function onTickCheck() {
      if (!touched) return;
      const cur = clamp(Math.round(pos), 1, 10);
      const prev = showValue(cur);
      if (prev === cur) return;
      if (opts.onInput) opts.onInput(cur);
      if (prev == null || reduceMotion) return;
      popAt = clock;
      haptic(cur === 10 ? [12, 40, 12] : 7);
      if (cur > prev) {
        emitPollen(cur >= 8 ? 4 : 2);
        if (cur === 10) emitPetals(9);
        else if (cur === 8) emitPetals(3);
      }
    }

    // ---------- Drobinki ----------
    function emitPollen(n) {
      const x = tipCache ? tipCache.X : xOf(clamp(pos, 1, 10)), y = tipCache ? tipCache.Y : stemY - 12 * U;
      for (let i = 0; i < n; i++) {
        parts.push({ type: 'pollen', x: x + rand(-7, 7), y: y + rand(-3, 3), vx: rand(-14, 14), vy: rand(-46, -24), life: 0, max: rand(.8, 1.3), r: rand(1.3, 2.4) });
      }
    }
    function emitPetals(n) {
      const t = tipCache || { X: xOf(clamp(pos, 1, 10)), Y: stemY - 10 * U };
      for (let i = 0; i < n; i++) {
        parts.push({ type: 'petal', x: t.X + rand(-6, 6), y: t.Y + rand(-6, 6), vx: rand(-70, 70), vy: rand(-90, -30), life: 0, max: rand(1.6, 2.4), rot: rand(0, TAU), vr: rand(-5, 5), phi: rand(0, TAU), vphi: rand(4, 8), s: rand(3.5, 6) });
      }
    }
    function updateParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.type === 'pollen') { p.vx *= 1 - 1.2 * dt; p.vy *= 1 - .9 * dt; }
        else { p.vy += 70 * dt; p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.2 * dt; p.vx += Math.sin(clock * 3 + p.phi) * 30 * dt; p.rot += p.vr * dt; p.phi += p.vphi * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life > p.max) parts.splice(i, 1);
      }
    }

    // ---------- Fizyka ----------
    function step(dt) {
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      const wP = dragging ? 38 : 15, zP = dragging ? 1 : .72;      // pozycja: przy przeciąganiu ściśle za palcem
      const gT = touched ? (clamp(pos, 1, 10) - 1) / 9 : 0;
      for (let i = 0; i < n; i++) {
        posV += (wP * wP * (target - pos) - 2 * zP * wP * posV) * h;
        pos += posV * h;
        gV += (8 * 8 * (gT - g) - 2 * .62 * 8 * gV) * h;             // dojrzałość: lekko sprężyście
        g += gV * h;
        const leanT = clamp(-posV * .07, -.6, .6) * motion;           // bezwładność: przechył przeciwny do ruchu
        leanV += (10 * 10 * (leanT - lean) - 2 * .3 * 10 * leanV) * h;
        lean += leanV * h;
      }
      flutter = approach(flutter, Math.min(1, Math.abs(posV) * .08), 6, dt);
    }

    // ---------- Kształt łodygi ----------
    // Z lewej łodyga wyłania się z tła lekkim łukiem od dołu; od liczby 1 biegnie wzdłuż suwaka.
    // Delikatna fala, czubek lekko uniesiony, kołysanie rośnie ku czubkowi.
    function baseY(x) {
      const d = x - left;
      return stemY
        + 2.2 * U * Math.sin(d * .045 / U + .6) * smooth(0, 30 * U, d)
        - 5 * U * (d / Math.max(1, right - left))
        + (d < 0 ? d * d / (FADE * U) * .14 : 0);
    }
    function yAt(x, tipX) {
      const d = x - left, span = Math.max(1, tipX - left);
      const lift = -4 * U * smooth(tipX - 46 * U, tipX, x) * clamp(span / (40 * U));
      const sway = motion * U * clamp(d / span) * (Math.sin(clock * 1.3 + x * .018) * 1.1 + flutter * Math.sin(clock * 6 + x * .05) * 1.6);
      return baseY(x) + lift + sway;
    }
    const angAt = (x, tipX) => Math.atan2(yAt(x + 1, tipX) - yAt(x - 1, tipX), 2);

    // ---------- Rysowanie: elementy ----------
    // Liść z ogonkiem; bend wygina blaszkę w bok (-…+), żeby liście nie były identyczne
    function drawLeaf(x, y, a, len, wr, col, bend = 0) {
      if (len < .5) return;
      const w = len * wr, stalk = len * .12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.strokeStyle = col.dark;
      ctx.lineWidth = Math.max(1, len * .05);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(stalk, 0); ctx.stroke();
      ctx.translate(stalk, 0);
      const L = len - stalk, d = bend * L * .28;   // przesunięcie czubka w bok
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(L * .25, -w * 1.1 + d * .15, L * .7, -w * .85 + d * .7, L, d);
      ctx.bezierCurveTo(L * .7, w * .85 + d * .7, L * .25, w * 1.1 + d * .15, 0, 0);
      ctx.fillStyle = col.mid;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(L * .5, d * .55, L, d);
      ctx.bezierCurveTo(L * .7, w * .85 + d * .7, L * .25, w * 1.1 + d * .15, 0, 0);
      ctx.fillStyle = col.dark;
      ctx.fill();
      ctx.strokeStyle = col.vein;
      ctx.lineWidth = Math.max(.7, L * .03);
      ctx.beginPath();
      ctx.moveTo(L * .05, 0);
      ctx.quadraticCurveTo(L * .5, d * .55 - w * .06, L * .88, d * .85);
      ctx.stroke();
      ctx.restore();
    }

    // Spiralka (wąs albo zwinięty czubek): krzywizna rośnie ku końcowi; k = ile już wyrosło
    function curl(x, y, ang, len, sign, k) {
      const n = 24, step = len * k / n;
      let px = x, py = y, a = ang;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let i = 1; i <= n; i++) {
        const s = i / n * k;
        a += sign * (.02 + s * s * 1.1);
        px += Math.cos(a) * step;
        py += Math.sin(a) * step;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Dalsza ścieżka: kropki tam, dokąd łodyga może jeszcze urosnąć, i kółka na liczbach
    function drawPath(tipX, rN) {
      ctx.fillStyle = rgba(pal.lineStrong);
      for (let x = tipX + rN + 6; x < right + 4; x += 8) {
        ctx.beginPath(); ctx.arc(x, baseY(x), 1.4, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.lineStrong);
      ctx.lineWidth = 1.6;
      for (let k = 1; k <= 10; k++) {
        const x = xOf(k);
        if (x <= tipX + rN + 2) continue;
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(x, baseY(x), 3.2, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }

    function drawStem(tipX, gd, vivid) {
      const col = calm(pal.stem, vivid);
      const wB = lerp(3.6, 6.8, gd) * U, wT = 2.6 * U;
      const x0 = left - FADE * U;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';

      // początek: jedna ścieżka z przejściem od przezroczystości (bez nakładających się końcówek)
      const fade = (a, c) => { const gr = ctx.createLinearGradient(x0, 0, left, 0); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, a)); return gr; };
      ctx.beginPath();
      for (let x = x0; x <= left; x += 3) { const y = yAt(x, tipX); if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.lineTo(left, yAt(left, tipX));
      ctx.strokeStyle = fade(1, col);
      ctx.lineWidth = wB;
      ctx.stroke();
      ctx.strokeStyle = fade(.2, WHITE);
      ctx.lineWidth = wB * .3;
      ctx.stroke();

      // dalej: od liczby 1 do czubka, coraz cieńsza
      const len = tipX - left;
      if (len < .5) return;
      const n = Math.max(1, Math.ceil(len / 4));
      const pts = [];
      for (let i = 0; i <= n; i++) { const x = left + len * i / n; pts.push([x, yAt(x, tipX)]); }
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(255,255,255,.2)' : rgba(col);
        for (let i = 1; i <= n; i++) {
          const w = lerp(wB, wT, i / n);
          ctx.lineWidth = w * (pass ? .3 : 1);
          ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1] - (pass ? w * .18 : 0));
          ctx.lineTo(pts[i][0], pts[i][1] - (pass ? w * .18 : 0));
          ctx.stroke();
        }
      }
      // liczby, które łodyga już minęła — drobne kolanka na łodydze
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 1; k <= 10; k++) {
        const x = xOf(k);
        if (x >= tipX - 12 * U) break;
        ctx.beginPath(); ctx.arc(x, yAt(x, tipX), 1.6 * U, 0, TAU); ctx.fill();
      }
    }

    // ---------- Pąk na czubku łodygi = uchwyt suwaka (przy 8–10 rozwija się w kwiat) ----------
    // Działki kielicha (różne, nie lustrzane): kąt w zamkniętym pąku → po rozkwicie, długość i szerokość
    // (ułamki pąka), front = zakrywa dół pąka, póki jest zamknięty.
    const SEPALS = [
      { a0: -.5,  a1: -2.85, l: .52, w: .62, front: false },
      { a0: -.12, a1: -1.7,  l: .8,  w: .95, front: true },
      { a0: .36,  a1: 2.1,   l: .7,  w: .78, front: true },
    ];
    // Płatki otwartego kwiatu: drobne różnice długości i kąta, żeby kwiat nie był „z linijki”
    const PETAL_LEN = [1, .92, 1.06, .95, 1.03, .9];
    const PETAL_ROT = [0, .06, -.05, .04, -.03, .05];

    const budGrow = gd => smooth(0, .75, gd);                        // wielkość i kolor pąka
    const budOpen = gd => smooth(.66, 1, gd);                         // rozkwit (od ok. 7): 8 = kielich, 9–10 = otwarty
    const budLen = (gd, sc) => lerp(19, 29, budGrow(gd)) * U * sc;

    function sepalPath(l, w) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(w, -l * .28, w * .72, -l * .76, w * .08, -l);
      ctx.bezierCurveTo(-w * .55, -l * .74, -w * .95, -l * .3, 0, 0);
      ctx.closePath();
    }
    function drawSepal(S, b, grow, Lb, Wb, R, green, alpha) {
      if (alpha <= .01) return;
      const l = lerp(Lb * S.l * lerp(1, .72, grow), R * .62, b);
      const w = lerp(Wb * S.w, R * .2, b);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.rotate(lerp(S.a0, S.a1, b));
      const gr = ctx.createLinearGradient(0, 0, 0, -l);
      gr.addColorStop(0, rgba(mixC(green, pal.stem, .3)));
      gr.addColorStop(1, rgba(tint(green, .18)));
      ctx.fillStyle = gr;
      sepalPath(l, w);
      ctx.fill();
      ctx.strokeStyle = rgba(tint(green, .45), .5);
      ctx.lineWidth = Math.max(.6, l * .04);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -l * .08); ctx.quadraticCurveTo(w * .12, -l * .5, w * .06, -l * .9); ctx.stroke();
      ctx.restore();
    }

    // x, y = koniec łodygi; dir = kierunek pąka; sc = skala (podskok, przeciąganie)
    function drawBud(x, y, dir, gd, vivid, sc) {
      const grow = budGrow(gd), b = budOpen(gd);
      const Lb = budLen(gd, sc);
      const Wb = Lb * lerp(.3, .36, grow);
      const R = FLOWER_R * U * sc * lerp(.75, 1, b) * (1 + .03 * smooth(.92, 1, gd) * Math.sin(clock * 2) * motion);
      const green = calm(mixC(pal.l1, pal.stem, .15), vivid);
      const flower = calm(pal.flower, vivid), petalTip = calm(pal.tip, vivid), core = calm(pal.core, vivid);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lerp(dir, -Math.PI / 2, .8 * b) + Math.PI / 2);   // lokalnie -y = kierunek pąka

      // dno kwiatowe — zgrubienie na końcu łodygi
      ctx.fillStyle = rgba(mixC(green, pal.stem, .3));
      ctx.beginPath(); ctx.ellipse(0, -Lb * .04, Wb * .5, Lb * .1, 0, 0, TAU); ctx.fill();

      // działki: tylne zawsze z tyłu; przednie, póki pąk jest zamknięty, z przodu — potem odchylają się za płatki
      const frontBehind = b > .22;
      SEPALS.forEach(S => { if (!S.front || frontBehind) drawSepal(S, b, grow, Lb, Wb, R, green, 1); });

      // płatki rozwijającego się kwiatu
      if (b > .02) {
        const n = 6, spread = lerp(.05, 1, b);
        const pl = lerp(Lb * .92, R, b), pw = lerp(Wb * .62, R * .42, b);
        const base = mixC(flower, green, .22 * (1 - b));   // nasada płatka lekko zielona, dopóki kwiat się otwiera
        for (let k = 0; k < n; k++) {
          const L = pl * lerp(1, PETAL_LEN[k], b);
          ctx.save();
          ctx.rotate((k - (n - 1) / 2) * (TAU / n) * spread + PETAL_ROT[k] * b);
          const gr = ctx.createLinearGradient(0, 0, 0, -L);
          // naprzemienne odcienie + delikatna krawędź — płatki nie zlewają się w jedną plamę
          gr.addColorStop(0, rgba(k % 2 ? tint(base, .1) : base));
          gr.addColorStop(1, rgba(k % 2 ? tint(petalTip, .12) : petalTip));
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.ellipse(0, -L * .52, pw, L * .52, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = rgba(mixC(flower, pal.stem, .2), .22);
          ctx.lineWidth = Math.max(.7, pw * .07);
          ctx.stroke();
          ctx.restore();
        }
        if (b > .35) {
          ctx.globalAlpha = smooth(.35, .8, b);
          for (let k = 0; k < n; k++) {
            ctx.save();
            ctx.rotate(k * TAU / n + TAU / 12 + PETAL_ROT[(k + 3) % n]);
            ctx.fillStyle = rgba(tint(flower, .35));
            ctx.beginPath(); ctx.ellipse(0, -pl * .34, pw * .62, pl * .34, 0, 0, TAU); ctx.fill();
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
        const c = smooth(.2, .7, b);
        if (c > 0) {
          ctx.fillStyle = rgba(core);
          ctx.beginPath(); ctx.arc(0, 0, R * .24 * c, 0, TAU); ctx.fill();
          ctx.fillStyle = rgba(mixC(core, pal.stem, .25));
          for (let k = 0; k < 7; k++) {
            const a = k * TAU / 7 + clock * .2 * motion;
            ctx.beginPath(); ctx.arc(Math.cos(a) * R * .15 * c, Math.sin(a) * R * .15 * c, R * .035, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          ctx.beginPath(); ctx.arc(-R * .07, -R * .07, R * .07 * c, 0, TAU); ctx.fill();
        }
      }

      // zamknięty pąk: płatki zwinięte spiralnie, czubek lekko skręcony w bok (nie idealnie symetryczny)
      const bodyA = 1 - smooth(.04, .24, b);
      if (bodyA > 0) {
        ctx.globalAlpha = bodyA;
        const tx = Wb * .14;
        const gr = ctx.createLinearGradient(0, 0, tx, -Lb);
        gr.addColorStop(0, rgba(mixC(green, flower, .3)));
        gr.addColorStop(.55, rgba(flower));
        gr.addColorStop(1, rgba(tint(petalTip, .1)));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(tx, -Lb);
        ctx.bezierCurveTo(Wb * .62, -Lb * .86, Wb * 1.08, -Lb * .5, Wb * .86, -Lb * .2);
        ctx.bezierCurveTo(Wb * .66, -Lb * .03, -Wb * .66, -Lb * .03, -Wb * .86, -Lb * .2);
        ctx.bezierCurveTo(-Wb * 1.06, -Lb * .52, -Wb * .5, -Lb * .88, tx, -Lb);
        ctx.fill();
        ctx.strokeStyle = rgba(mixC(flower, pal.stem, .25), .45);
        ctx.lineWidth = Math.max(.8, Lb * .035);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-Wb * .78, -Lb * .3); ctx.quadraticCurveTo(-Wb * .05, -Lb * .5, tx * .6, -Lb * .96); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(Wb * .85, -Lb * .42); ctx.quadraticCurveTo(Wb * .3, -Lb * .62, Wb * .18, -Lb * .82); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.ellipse(-Wb * .4, -Lb * .55, Wb * .16, Lb * .2, -.15, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // przednie działki zakrywają dół zamkniętego pąka
      if (!frontBehind) SEPALS.forEach(S => { if (S.front) drawSepal(S, b, grow, Lb, Wb, R, green, 1); });
      ctx.restore();
    }

    // Miękka poświata pod pąkiem — podpowiada, że to uchwyt; póki nic nie wybrano, pulsuje
    function drawHalo(x, y, r) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.8)');
      gr.addColorStop(.6, 'rgba(255,255,255,.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (!touched) {
        const p = .5 + .5 * Math.sin(clock * 3);
        ctx.strokeStyle = rgba(pal.l1, .4 * (1 - p) * (motion || 1));
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * .72 + 6 * p * motion, 0, TAU); ctx.stroke();
      }
    }

    function drawGlow(tip, gd) {
      const k = smooth(.8, 1, gd);
      if (k <= 0) return;
      const r = Math.min(FLOWER_R * U * 2.6, BLEED_TOP);
      const a = .45 * k * (.85 + .15 * Math.sin(clock * 1.8) * motion);
      const gr = ctx.createRadialGradient(tip.X, tip.Y, 0, tip.X, tip.Y, r);
      gr.addColorStop(0, rgba(tint(pal.glow, .2), a));
      gr.addColorStop(.45, rgba(tint(pal.flower, .55), a * .35));
      gr.addColorStop(1, rgba(tint(pal.flower, .55), 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(tip.X, tip.Y, r, 0, TAU); ctx.fill();
    }

    // Iskierki wokół kwiatu przy 9–10
    function drawSparkles(tip, gd) {
      const k = smooth(.88, 1, gd);
      if (k <= 0) return;
      const R = FLOWER_R * U;
      for (let i = 0; i < 5; i++) {
        const a = clock * .6 * (motion || .0001) + i * TAU / 5 + i * .4;
        const r = R * (1.7 + .25 * Math.sin(clock * 1.3 + i));
        const x = tip.X + Math.cos(a) * r, y = tip.Y + Math.sin(a) * r * .8;
        const tw = .5 + .5 * Math.sin(clock * 3.2 + i * 1.7);
        const s = (1.6 + 1.6 * tw) * k;
        ctx.fillStyle = `rgba(255,255,255,${.85 * k * (.4 + .6 * tw)})`;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * .5, y - s * .5); ctx.lineTo(x + s * 2, y);
        ctx.lineTo(x + s * .5, y + s * .5); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * .5, y + s * .5);
        ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * .5, y - s * .5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(pal.core, .35 * k * tw);
        ctx.beginPath(); ctx.arc(x, y, s * 1.6, 0, TAU); ctx.fill();
      }
    }

    function drawParts() {
      for (const p of parts) {
        const a = 1 - p.life / p.max;
        if (p.type === 'pollen') {
          ctx.fillStyle = rgba(tint(pal.core, .2), a);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, flipScale(p.phi));
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = rgba(pal.flower);
          ctx.beginPath(); ctx.ellipse(0, 0, p.s * .55, p.s, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
    }

    // ---------- Rysowanie: całość ----------
    function draw() {
      if (!W) return;
      ctx.clearRect(-bleedL, -BLEED_TOP, W + bleedL + bleedR, H + BLEED_TOP);
      const gd = clamp(g);
      const vivid = lerp(.32, 1, smooth(0, .75, gd));
      const tipX = xOf(clamp(pos, 1, 10));
      const tipY = yAt(tipX, tipX);
      const pop = 1 + .14 * Math.exp(-(clock - popAt) * 8) * Math.sin((clock - popAt) * 20) * motion;
      const sc = pop * (dragging ? 1.07 : 1);

      // pąk patrzy w górę i do przodu; przy przeciąganiu odchyla się z bezwładnością
      const dir = angAt(tipX, tipX) - .55 + lean * .8 + motion * Math.sin(clock * 1.3) * .04;
      const reach = budLen(gd, sc) * .45 * (1 - budOpen(gd));      // środek pąka (otwarty kwiat: koniec łodygi)
      const cx = tipX + Math.cos(dir) * reach, cy = tipY + Math.sin(dir) * reach;
      tipCache = { X: cx, Y: cy };

      if (touched) drawGlow(tipCache, gd);
      drawPath(tipX, 12 * U);
      drawStem(tipX, gd, vivid);

      // wąsy
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.5 * U;
      ctx.strokeStyle = rgba(calm(pal.l1, vivid), .9);
      TENDRILS.forEach(T => {
        const age = pos - T.v;
        const x = xOf(T.v);
        if (age <= 0 || x > tipX - 14 * U) return;
        const up = T.side < 0;
        curl(x, yAt(x, tipX), angAt(x, tipX) + (up ? -1.05 : .95), T.len * U, up ? -1 : 1, easeOutCubic(clamp(age / .8)));
      });

      // liście (wyrastają, gdy łodyga je minie)
      LEAVES.forEach((L, i) => {
        const age = pos - L.v;
        const x = xOf(L.v);
        if (age <= 0 || x > tipX - 10 * U) return;
        const grown = easeOutBack(clamp(age / .55)) * lerp(.72, 1, clamp(age / 2.2));
        const up = L.side < 0;
        const flut = motion * Math.sin(clock * 2.6 + i * 1.9) * .05 * (1 + flutter * 4);
        drawLeaf(x, yAt(x, tipX), angAt(x, tipX) + (up ? -L.ang : L.ang) + flut,
          L.size * U * grown, L.wr, leafColors(L.tone, vivid), L.bend * (up ? 1 : -1));
      });

      drawHalo(cx, cy, 22 * U);

      // najmłodszy listek tuż za pąkiem (tylko z jednej strony) — wędruje razem z czubkiem
      if (touched) {
        const lx = tipX - 9 * U;
        const flut = motion * Math.sin(clock * 3.1) * .06 * (1 + flutter * 3);
        drawLeaf(lx, yAt(lx, tipX), angAt(lx, tipX) - 1.3 + lean * .5 + flut,
          lerp(9, 15, budGrow(gd)) * U, .42, leafColors(.25, vivid), .3);
      }

      drawBud(tipX, tipY, dir, gd, vivid, sc);
      drawSparkles(tipCache, gd);
      drawParts();

      ring.style.transform = `translate(${cx}px, ${cy}px)`;
      hint.style.left = `${xOf(1) + 82}px`;
      hint.style.top = `${stemY - 58}px`;
    }

    // ---------- Pętla ----------
    function tick(dt) {
      clock += dt;
      updatePalette(performance.now());
      step(dt);
      if (touched && (dragging || Math.abs(posV) > .01)) onTickCheck();
      updateParts(dt);
    }
    function frame(ms) {
      tick(Math.min(.05, Math.max(0, (ms - lastMs) / 1000)));
      lastMs = ms;
      draw();
      requestAnimationFrame(frame);
    }
    // Do testów, gdy karta jest w tle (przeglądarka wtedy nie odpala klatek): przewija animację o sec sekund
    function debugAdvance(sec) {
      for (let t = 0; t < sec; t += 1 / 60) { tick(1 / 60); draw(); }
    }
    debugAll.add(debugAdvance);

    function layout() {
      const r = slider.getBoundingClientRect();
      if (!r.width) return;
      W = r.width;
      H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // canvas wystaje poza pole tylko tyle, ile zostało do krawędzi ekranu — inaczej na telefonie strona przewija się w bok
      bleedL = clamp(Math.floor(r.left), 0, BLEED_X);
      bleedR = clamp(Math.floor(document.documentElement.clientWidth - r.right), 0, BLEED_X);
      const cw = W + bleedL + bleedR, ch = H + BLEED_TOP;
      Object.assign(canvas.style, { left: `${-bleedL}px`, top: `${-BLEED_TOP}px`, width: `${cw}px`, height: `${ch}px` });
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      // rysujemy we współrzędnych pola suwaka (0,0 = jego lewy górny róg)
      ctx.setTransform(dpr, 0, 0, dpr, bleedL * dpr, BLEED_TOP * dpr);
      U = clamp(W / 340, .9, 1.3);
      // z lewej miejsce na odcinek, na którym łodyga wyłania się z tła
      left = clamp(W * .12, 44, 60);
      right = W - clamp(W * .11, 42, 58);
      stemY = H - 30;
      ticks.forEach((t, i) => { t.style.left = `${xOf(i + 1)}px`; });
      draw();
    }

    // ---------- Wejście: dotyk / mysz ----------
    function beginDrag(e) {
      const x = localX(e);
      const onTip = Math.abs(x - xOf(clamp(pos, 1, 10))) < 34;
      grabOffset = onTip ? pos - vOf(x) : 0;        // złapany czubek nie przeskakuje pod palec
      dragging = true;
      touched = true;
      pending = null;
      try { slider.setPointerCapture(e.pointerId); } catch (_) { /* brak wsparcia */ }
      slider.classList.add('is-dragging');
      target = clamp(vOf(x) + grabOffset, 1, 10);
      if (reduceMotion) { pos = target; g = (pos - 1) / 9; onTickCheck(); draw(); }
    }
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      slider.classList.remove('is-dragging');
      commit(clamp(Math.round(target), 1, 10));
    }

    slider.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pending = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      if (e.pointerType === 'mouse') beginDrag(e);  // mysz: od razu; palec: dopiero po ruchu w bok
    });
    slider.addEventListener('pointermove', e => {
      if (pending && e.pointerId === pending.id) {
        const dx = e.clientX - pending.x0, dy = e.clientY - pending.y0;
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) beginDrag(e);
        return;
      }
      if (!dragging) return;
      target = clamp(vOf(localX(e)) + grabOffset, 1, 10);
      if (reduceMotion) { pos = target; g = (pos - 1) / 9; onTickCheck(); draw(); }
    });
    slider.addEventListener('pointerup', e => {
      if (pending && e.pointerId === pending.id) {
        // krótkie stuknięcie bez przesuwania = wybór miejsca na ścieżce
        const moved = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0);
        pending = null;
        if (moved < 10) commit(Math.round(vOf(localX(e))));
        return;
      }
      endDrag();
    });
    slider.addEventListener('pointercancel', () => { pending = null; endDrag(); });
    slider.addEventListener('lostpointercapture', endDrag);

    // Liczby pod suwakiem też da się stuknąć
    ticks.forEach(t => t.addEventListener('click', () => commit(Number(t.dataset.v))));

    // ---------- Klawiatura ----------
    slider.addEventListener('keydown', e => {
      const map = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 2, PageDown: -2 };
      let v = null;
      if (e.key in map) v = value != null ? value + map[e.key] : (map[e.key] > 0 ? 1 + map[e.key] : 1);
      else if (e.key === 'Home') v = 1;
      else if (e.key === 'End') v = 10;
      if (v == null) return;
      e.preventDefault();
      commit(clamp(Math.round(v), 1, 10));
    });

    // ---------- Start ----------
    showValue(touched ? value : null);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(slider);
    // okno też: przy stałej szerokości pola zmienia się tylko miejsce do krawędzi ekranu (wystawanie canvasu)
    window.addEventListener('resize', layout);
    layout();
    redrawAll.add(draw);
    if (!reduceMotion) requestAnimationFrame(frame);

    return {
      get value() { return value; },
      set(v) { if (valid(v)) commit(v); },
      focus() { slider.focus(); },
    };
  }

  window.MoodSlider = {
    create,
    WORDS,
    debugAdvance(sec) { debugAll.forEach(fn => fn(sec)); },
  };
})();
