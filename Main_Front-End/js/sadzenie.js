/*
 * Sadzenie po rejestracji (rejestracja.html → aplikacja.html). Style: css/sadzenie.css.
 *
 *   1) rejestracja: treść gaśnie, karta zjeżdża; z kwiatu rozkwitniętej roślinki wylatuje nasionko
 *      i powoli opada („Teraz zasadźmy ją w Twoim ogrodzie.”), a scena rejestracji blednie;
 *   2) zmiana strony w locie — oba końce liczą położenie nasionka z tej samej osi czasu (od stuknięcia,
 *      sessionStorage), więc lot trwa dalej bez szwu;
 *   3) aplikacja: tło się rozsuwa i widać ziemię w ogrodzie; nasionko ląduje, wsiąka (grudki ziemi),
 *      spada na nie kropla wody — i dopiero wtedy wyrasta prawdziwa roślinka (js/home2-scene.js: hold/grow).
 *      Potem powitanie, górny pasek, kafel i pasek zakładek. Na końcu zdarzenie 'sadzeniekoniec' na window.
 * Ok. 4,5 s; stuknięcie pomija. prefers-reduced-motion albo ?widok → bez animacji.
 *
 * Ładowany BEZ defer w <head> na stronie aplikacji (ustawia <html data-sadzenie> przed pierwszą klatką,
 * a za znacznikiem zasłony stoi <script>Sadzenie.mount()</script>); na rejestracji z defer.
 *
 * window.Sadzenie: leave(href) — rejestracja; mount() — aplikacja
 */
(function () {
  'use strict';

  const KEY = 'sci.sadzenie';
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('widok');

  // Oś czasu (ms od stuknięcia „Przejdź do aplikacji”)
  const T_SEED = 150;      // nasionko wylatuje z kwiatu
  const T_NAV = 1500;      // zmiana strony (nasionko jeszcze leci)
  const T_LAND = 1950;     // ląduje w ziemi
  const T_DROP = 2200;     // kropla zaczyna spadać
  const T_WET = 2580;      // kropla dotyka ziemi
  const T_GROW = 2620;     // roślinka zaczyna rosnąć
  const T_END = 4450;      // zasłona znika

  let startedAt = 0;
  try { startedAt = +sessionStorage.getItem(KEY) || 0; sessionStorage.removeItem(KEY); } catch (_) { /* tryb prywatny */ }
  if (startedAt && Date.now() - startedAt < 15000 && !reduceMotion) root.setAttribute('data-sadzenie', '');

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const sineInOut = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const TAU = Math.PI * 2;

  // Miejsce w ogrodzie: podstawa roślinki na stronie głównej (ten sam układ co js/home2-scene.js + css/app.css).
  // Na stronie aplikacji zastępuje je dokładne Home2Scene.plantAt().
  function garden() {
    const W = window.innerWidth, H = window.innerHeight;
    if (W >= 1024) return { x: W / 4, y: H * .9 };
    const stage = clamp(H * .54, 340, 540);
    return { x: W * .57, y: stage - 22 };
  }
  // Czubek rozkwitniętej roślinki w scenie rejestracji (układ jak w js/plant-scene.js)
  function regFlower() {
    const W = window.innerWidth, H = window.innerHeight;
    if (W >= 900) {
      const card = document.querySelector('.card');
      const area = Math.max(260, (card ? card.getBoundingClientRect().left : W / 2) - 20);
      return { x: area / 2 + 10, y: H - Math.max(36, H * .075) - Math.min(H * .7, area * 1.05) * .95 };
    }
    const layout = document.querySelector('.layout');
    const hero = layout ? parseFloat(getComputedStyle(layout).paddingTop) || 220 : 220;
    const copy = document.querySelector('.scene-copy');
    const top = copy && copy.offsetHeight ? copy.getBoundingClientRect().bottom + 6 : 16;
    return { x: W / 2, y: top + 14 };
  }

  // Lot nasionka: z kwiatu, z lekkim kołysaniem, do ziemi w ogrodzie
  function seedAt(t, from, to) {
    const u = span(t, T_SEED + 250, T_LAND);
    const e = sineInOut(u);
    const sway = Math.sin(u * TAU * 1.25) * 22 * (1 - u) * (u > 0 ? 1 : 0);
    const x = lerp(from.x, to.x, easeInOut(u)) + sway;
    const y = lerp(from.y, to.y, e) - 10 * Math.sin(Math.PI * clamp(u * 2.2));   // na starcie lekko w górę
    const rot = Math.sin(u * TAU * 1.25) * .45 * (1 - u) - .35;
    const born = easeOut(span(t, T_SEED, T_SEED + 350));
    return { x, y, rot, s: born };
  }

  function buildOverlay() {
    let ov = document.querySelector('.sadzenie');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'sadzenie';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = MARKUP;
    document.body.appendChild(ov);
    return ov;
  }
  const MARKUP = `<div class="sd-bg"></div>
    <div class="sd-copy"><span class="sd-eyebrow"></span><p class="sd-line"></p></div>
    <span class="sd-ring"></span>
    <span class="sd-dirt">${'<i></i>'.repeat(7)}</span>
    <div class="sd-seed"><i class="sd-glow"></i><svg class="sd-shape" viewBox="-12 -9 24 18"><ellipse class="sd-body" rx="9" ry="6"/><ellipse cx="-2.6" cy="-1.9" rx="2.6" ry="1.5" fill="#fff" opacity=".45"/></svg></div>
    <div class="sd-drop"><svg viewBox="0 0 24 24"><path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z"/></svg></div>`;

  function plantName() {
    try { const a = JSON.parse(localStorage.getItem('sci.account')); return (a && a.plant) || ''; } catch (_) { return ''; }
  }
  const LINES = { plant: 'Teraz zasadźmy ją w Twoim ogrodzie.', grow: 'Od dziś rośnie tutaj — razem z Tobą.' };

  // Rysuje stan zasłony dla czasu t (wspólne dla obu stron)
  function painter(ov, from, getTo) {
    const seed = ov.querySelector('.sd-seed'), shape = ov.querySelector('.sd-shape'), glow = ov.querySelector('.sd-glow');
    const drop = ov.querySelector('.sd-drop'), ring = ov.querySelector('.sd-ring');
    const dirt = [...ov.querySelectorAll('.sd-dirt i')].map((el, k) => ({ el, a: -Math.PI * (.15 + .7 * k / 6), v: 26 + (k % 3) * 9 }));
    return t => {
      const to = getTo();
      const p = seedAt(t, from, to);
      // wsiąkanie: lekko się spłaszcza i znika w ziemi
      const press = span(t, T_LAND, T_LAND + 320);
      const sink = 4 * easeOut(press);
      seed.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + sink).toFixed(1)}px)`;
      shape.style.transform = `rotate(${p.rot.toFixed(3)}rad) scale(${(p.s * (1 + .12 * press)).toFixed(3)}, ${(p.s * (1 - .35 * press)).toFixed(3)})`;
      seed.style.opacity = (1 - span(t, T_LAND + 120, T_LAND + 380)).toFixed(3);
      glow.style.opacity = (p.s * (.55 + .45 * Math.sin(t * .006) ** 2) * (1 - press)).toFixed(3);
      glow.style.transform = `scale(${(.6 + .6 * p.s + .5 * (1 - span(t, T_SEED, T_SEED + 500))).toFixed(3)})`;
      // grudki ziemi przy lądowaniu
      const d = span(t, T_LAND, T_LAND + 520);
      dirt.forEach(g => {
        const r = g.v * easeOut(d);
        const x = to.x + Math.cos(g.a) * r, y = to.y + Math.sin(g.a) * r * .55 + 40 * d * d;
        g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 - .5 * d).toFixed(3)})`;
        g.el.style.opacity = d > 0 && d < 1 ? (.75 * (1 - d)).toFixed(3) : '0';
      });
      // kropla wody i krąg
      const f = span(t, T_DROP, T_WET);
      const splash = span(t, T_WET, T_WET + 160);
      drop.style.opacity = (span(t, T_DROP, T_DROP + 120) * (1 - splash)).toFixed(3);
      drop.style.transform = `translate(${to.x.toFixed(1)}px, ${lerp(to.y - 170, to.y - 2, easeIn(f)).toFixed(1)}px) scale(${(1 + .3 * splash).toFixed(3)}, ${(1 - .5 * splash).toFixed(3)})`;
      const rg = span(t, T_WET, T_WET + 700);
      ring.style.opacity = rg > 0 && rg < 1 ? (.9 * (1 - rg)).toFixed(3) : '0';
      ring.style.transform = `translate(${to.x.toFixed(1)}px, ${(to.y + 2).toFixed(1)}px) scale(${(.4 + 2.4 * easeOut(rg)).toFixed(3)})`;
    };
  }

  // ================================================================
  //  1) Rejestracja: wyjście
  // ================================================================
  let leaving = false;
  function leave(href) {
    if (leaving) return;
    leaving = true;
    if (reduceMotion) { location.href = href; return; }
    const t0 = Date.now();
    const ov = buildOverlay();
    const bg = ov.querySelector('.sd-bg');
    root.setAttribute('data-sadzenie', '');
    bg.style.opacity = '0';
    ov.querySelector('.sd-eyebrow').textContent = plantName() || 'Twoja roślinka';
    const line = ov.querySelector('.sd-line');
    line.textContent = LINES.plant;
    const opt = (duration, delay, easing = 'ease') => ({ duration, delay, easing, fill: 'forwards' });
    const wide = window.matchMedia('(min-width: 900px)').matches;

    // treść „Witaj!” gaśnie, karta zjeżdża
    const done = document.getElementById('step4');
    if (done) [...done.children].forEach((el, i) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], opt(320, i * 50, 'cubic-bezier(.4, 0, 1, 1)')));
    const card = document.querySelector('.card');
    if (card) card.animate(wide ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none' }, { transform: 'translateY(calc(100% + 60px))' }], opt(750, 120, 'cubic-bezier(.65, 0, .35, 1)'));
    // podpis: „Teraz zasadźmy ją w Twoim ogrodzie.”
    document.querySelectorAll('.scene-copy p').forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], opt(280, 0)));
    line.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], opt(500, 300));
    // kwiat wypuszcza nasionko (powiew wiatru), scena rejestracji blednie, tło ogrodu się rozjaśnia
    if (window.PlantScene && PlantScene.rustle) setTimeout(() => PlantScene.rustle(.6), T_SEED);
    const scene = document.getElementById('scene');
    if (scene) scene.animate([{ opacity: 1 }, { opacity: 0 }], opt(700, 750));
    bg.animate([{ opacity: 0 }, { opacity: 1 }], opt(650, 700));

    const from = regFlower(), to = garden();
    const paint = painter(ov, from, () => to);
    const perf0 = performance.now();
    const tick = () => { const t = performance.now() - perf0; paint(t); if (t < T_NAV + 400) requestAnimationFrame(tick); };
    tick();
    setTimeout(() => {
      try { sessionStorage.setItem(KEY, String(t0)); sessionStorage.setItem(KEY + '.z', JSON.stringify(from)); } catch (_) { /* bez znacznika aplikacja po prostu się otworzy */ }
      location.href = href;
    }, T_NAV);
  }

  // ================================================================
  //  3) Aplikacja: lądowanie, podlanie, wzrost
  // ================================================================
  let mounted = false;
  function mount() {
    if (mounted || !root.hasAttribute('data-sadzenie')) return;
    mounted = true;
    const ov = document.querySelector('.sadzenie');
    if (!ov) { root.removeAttribute('data-sadzenie'); return; }
    ov.querySelector('.sd-eyebrow').textContent = plantName() || 'Twoja roślinka';
    const line = ov.querySelector('.sd-line'), copy = ov.querySelector('.sd-copy'), bg = ov.querySelector('.sd-bg');
    line.textContent = LINES.plant;
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('#view-dom > .sec').forEach((s, i) => s.style.setProperty('--sd-i', i));
    }, { once: true });

    // ten sam punkt startu co na rejestracji (kwiat rośliny, której tu nie ma — liczony z tych samych wzorów)
    const W = window.innerWidth;
    const from = W >= 900 ? { x: W * .25, y: window.innerHeight * .2 } : { x: W / 2, y: 70 };
    const approx = garden();
    let exact = null;
    const to = () => {
      if (!exact && window.Home2Scene && Home2Scene.plantAt) { const a = Home2Scene.plantAt(); if (a.y > 0) exact = a; }
      return exact ? { x: exact.x, y: exact.y - 2 } : approx;
    };
    const paint = painter(ov, regFrom(from), to);
    const tStart = clamp(Date.now() - startedAt, T_NAV, T_NAV + 250);
    const perf0 = performance.now();
    let grown = false, swapped = false, done = false, id = 0;

    function frame() {
      const t = tStart + performance.now() - perf0;
      paint(t);
      bg.style.opacity = (1 - easeInOut(span(t, T_NAV + 60, T_LAND - 50))).toFixed(3);
      if (!grown && t >= T_GROW && window.Home2Scene && Home2Scene.grow) { grown = true; Home2Scene.grow(); }
      if (!swapped && t >= T_GROW + 450) {
        swapped = true;
        line.animate([{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
        setTimeout(() => { line.textContent = LINES.grow; }, 350);
      }
      copy.style.opacity = (1 - span(t, T_END - 950, T_END - 550)).toFixed(3);   // znika, zanim pojawi się górny pasek
      if (t >= T_END) { finish(); return; }
      id = requestAnimationFrame(frame);
    }
    function finish(skip) {
      if (done) return;
      done = true;
      cancelAnimationFrame(id);
      ov.remove();
      if (window.Home2Scene && Home2Scene.grow) Home2Scene.grow();
      if (skip === true) {
        document.getAnimations().forEach(a => {
          try { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (_) { /* animacja bez końca */ }
        });
      }
      window.dispatchEvent(new CustomEvent('sadzeniekoniec'));
    }
    ov.addEventListener('pointerdown', () => finish(true), { once: true });
    frame();
  }
  // punkt startu lotu na stronie aplikacji = ten sam co na rejestracji (zapamiętany przy wyjściu)
  function regFrom(fallback) {
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY + '.z'));
      sessionStorage.removeItem(KEY + '.z');
      if (v && isFinite(v.x)) return v;
    } catch (_) { /* brak */ }
    return fallback;
  }

  window.Sadzenie = { leave, mount };
})();
