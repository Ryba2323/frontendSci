/*
 * Wejście do aplikacji po zalogowaniu (logowanie.html → aplikacja.html). Style: css/wejscie.css.
 *
 * Kwiat z odznaki powitania prowadzi przez całe przejście:
 *   1) logowanie — treść powitania gaśnie, karta zjeżdża, roślinka z logowania blednie, kwiat unosi się na środek;
 *   2) zmiana strony — oba końce wyglądają identycznie (zasłona + kwiat na środku), więc szwu nie widać;
 *   3) aplikacja — kwiat robi „oddech”, zasłona się rozsuwa, roślinka wyrasta, a kwiat przelatuje na jej czubek
 *      i w nim znika (kwiat na roślince rozbłyska); potem powitanie, górny pasek, kafel i pasek zakładek.
 * Całość trwa ok. 3 s; stuknięcie w zasłonę ją pomija. prefers-reduced-motion albo ?widok → bez animacji.
 *
 * Ładowany BEZ defer w <head> (po js/theme.js): na stronie aplikacji od razu ustawia <html data-wejscie>,
 * więc pierwsza narysowana klatka to już zasłona — bez mignięcia gotowej strony.
 *
 * window.Wejscie:
 *   leave(badgeEl, href)  logowanie: animacja wyjścia z odznaki badgeEl, potem przejście na href
 *   (na stronie aplikacji wejście rusza samo, jeśli logowanie zostawiło znacznik w sessionStorage)
 */
(function () {
  'use strict';

  const KEY = 'sci.wejscie';
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('widok');

  const SEAM_Y = .43;     // wysokość kwiatu na zasłonie (część ekranu) — ta sama w css/wejscie.css (--wj-y)
  const SEAM_S = 1.25;    // skala odznaki na zasłonie
  const T_LEAVE = 1000;   // logowanie: czas wyjścia (ms)

  // Znacznik z logowania jest jednorazowy (odświeżenie strony nie powtarza wejścia)
  let pending = false;
  try { pending = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (_) { /* tryb prywatny */ }
  if (pending && !reduceMotion) root.setAttribute('data-wejscie', '');

  // ================================================================
  //  Pomocnicze
  // ================================================================
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seam = () => ({ x: window.innerWidth / 2, y: window.innerHeight * SEAM_Y });
  const place = (el, x, y, s) => { el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`; };

  // Pętla na requestAnimationFrame: fn(t) dostaje czas od startu (ms); zwraca stop()
  function loop(fn) {
    const t0 = performance.now();
    let id = 0, on = true;
    const tick = now => { if (!on) return; fn(now - t0); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => { on = false; cancelAnimationFrame(id); };
  }

  // Ta sama odznaka co na powitaniu (auth.css .badge), w wersji niezależnej od arkusza logowania
  function buildOverlay(svgSource) {
    let ov = document.querySelector('.wejscie');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'wejscie';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="wejscie-bg"></div><div class="wj-badge"><span class="wj-halo"><i></i></span><span class="wj-disc"></span><span class="wj-fly"></span></div>';
    const svg = svgSource.cloneNode(true);
    svg.setAttribute('class', 'wj-flower');
    ov.querySelector('.wj-fly').appendChild(svg);
    document.body.appendChild(ov);
    return ov;
  }

  const PULSE = [{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(1.35)', opacity: 0 }];

  // ================================================================
  //  1) Logowanie: wyjście
  // ================================================================
  let leaving = false;
  function leave(badgeEl, href) {
    if (leaving) return;
    leaving = true;
    const go = () => {
      try { sessionStorage.setItem(KEY, '1'); } catch (_) { /* bez znacznika aplikacja po prostu się otworzy */ }
      location.href = href;
    };
    if (reduceMotion || !badgeEl) { location.href = href; return; }

    const ov = buildOverlay(badgeEl.querySelector('svg'));
    const bg = ov.querySelector('.wejscie-bg');
    const badge = ov.querySelector('.wj-badge');
    const ring = ov.querySelector('.wj-halo i');
    const wide = window.matchMedia('(min-width: 900px)').matches;

    // kopia odznaki dokładnie w miejscu oryginału; pierścień pulsuje dalej w tej samej fazie
    const r = badgeEl.getBoundingClientRect();
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const to = seam();
    const orig = badgeEl.getAnimations({ subtree: true }).find(a => a.effect && a.effect.pseudoElement === '::before');
    const pulse = ring.animate(PULSE, { duration: 3000, iterations: Infinity, easing: 'ease-out' });
    pulse.currentTime = orig ? orig.currentTime % 3000 : 0;
    bg.style.opacity = '0';
    place(badge, from.x, from.y, 1);
    root.setAttribute('data-wejscie', '');      // zasłona łapie stuknięcia — nic nie kliknie się drugi raz
    badgeEl.style.visibility = 'hidden';

    const opt = (duration, delay, easing = 'ease') => ({ duration, delay, easing, fill: 'forwards' });
    // treść powitania gaśnie od góry
    [...badgeEl.parentElement.children].filter(el => el !== badgeEl).forEach((el, i) =>
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], opt(320, i * 50, 'cubic-bezier(.4, 0, 1, 1)')));
    // karta zjeżdża (komputer: tylko gaśnie i lekko opada)
    const card = badgeEl.closest('.card');
    if (card) {
      card.animate(wide
        ? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }]
        : [{ transform: 'none' }, { transform: 'translateY(calc(100% + 60px))' }], opt(700, 120, 'cubic-bezier(.65, 0, .35, 1)'));
    }
    // roślinka z logowania i podpis bledną, scena lekko „przybliża się”
    const scene = document.getElementById('scene');
    if (scene) scene.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], opt(700, 150));
    document.querySelectorAll('.scene-copy').forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], opt(400, 100)));
    // zasłona i poświata wokół kwiatu; pierścień cichnie przed zmianą strony
    bg.animate([{ opacity: 0 }, { opacity: 1 }], opt(600, 350));
    ov.querySelector('.wj-halo').animate([{ opacity: 1 }, { opacity: 0 }], opt(450, 350));

    // kwiat unosi się na środek i lekko rośnie
    const stop = loop(t => {
      const e = easeInOut(clamp((t - 100) / 850));
      place(badge, lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(1, SEAM_S, e));
    });
    setTimeout(() => { stop(); go(); }, T_LEAVE);
  }

  // ================================================================
  //  3) Aplikacja: wejście
  // ================================================================
  function enter() {
    const ov = document.querySelector('.wejscie');
    const Scene = window.Home2Scene || {};
    if (!ov) { root.removeAttribute('data-wejscie'); return; }
    const bg = ov.querySelector('.wejscie-bg');
    const badge = ov.querySelector('.wj-badge');
    const disc = ov.querySelector('.wj-disc');
    const fly = ov.querySelector('.wj-fly');
    const flower = ov.querySelector('.wj-flower');
    const ring = ov.querySelector('.wj-halo i');

    // kafel: sekcje wjeżdżają po kolei (css/wejscie.css)
    document.querySelectorAll('#view-dom > .sec').forEach((s, i) => s.style.setProperty('--wj-i', i));

    const from = seam();
    place(badge, from.x, from.y, SEAM_S);
    const opt = (duration, delay, easing = 'ease') => ({ duration, delay, easing, fill: 'forwards' });
    const anims = [
      // „oddech”: pierścień rozchodzi się raz, płatki powoli się obracają
      ring.animate([{ transform: 'scale(1)', opacity: 0 }, { transform: 'scale(1.08)', opacity: .9, offset: .2 }, { transform: 'scale(1.45)', opacity: 0 }], opt(900, 0, 'ease-out')),
      flower.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(40deg)' }], opt(1500, 0, 'cubic-bezier(.65, 0, .35, 1)')),
      // zasłona się rozsuwa, tarcza odznaki rozpływa się w poświatę
      bg.animate([{ opacity: 1 }, { opacity: 0 }], opt(650, 450)),
      disc.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.3)' }], opt(380, 330, 'ease-out')),
    ];

    // roślinka wyrasta od nowa pod zasłoną (łodyga jest gotowa ok. 1 s później, kwiat rozwija się od ok. 1,25 s)
    if (Scene.restart) Scene.restart();

    // przelot kwiatu na czubek roślinki (cel śledzony co klatkę — łodyga rośnie i lekko się kołysze).
    // Tarcza i pierścień zostają na środku i się rozpływają; leci sam kwiat (.wj-fly, w układzie odznaki).
    const T_FLY = 350, D_FLY = 900, T_LAND = T_FLY + D_FLY;
    let landed = false;
    const stop = loop(t => {
      const breath = 1 + .09 * Math.sin(Math.PI * clamp(t / 650));
      const bs = SEAM_S * breath;
      place(badge, from.x, from.y, bs);
      if (t < T_FLY || !Scene.flowerAt) return;
      const tip = Scene.flowerAt();
      const e = easeInOut(clamp((t - T_FLY) / D_FLY));
      // łuk: najpierw w górę, potem w bok do czubka
      const cx = lerp(from.x, tip.x, .15), cy = lerp(from.y, tip.y, .85);
      const u = 1 - e;
      const x = u * u * from.x + 2 * u * e * cx + e * e * tip.x;
      const y = u * u * from.y + 2 * u * e * cy + e * e * tip.y;
      const sTip = (tip.r * .95) / 20.25;           // promień płatków odznaki w skali 1 ≈ 20 px
      place(fly, (x - from.x) / bs, (y - from.y) / bs, lerp(SEAM_S, sTip, e) / bs);
      if (!landed && t >= T_LAND) {
        landed = true;
        if (Scene.bloomFlash) Scene.bloomFlash();
        anims.push(fly.animate([{ opacity: 1 }, { opacity: 0 }], opt(500, 0, 'ease-in-out')));
      }
    });

    // Koniec: znika tylko zasłona. <html data-wejscie> zostaje do końca tej wizyty na stronie —
    // zdjęcie go podmieniłoby animacje treści z powrotem na zwykłe i odpaliło je drugi raz.
    let done = false;
    function finish(skip) {
      if (done) return;
      done = true;
      stop();
      clearTimeout(tEnd);
      anims.forEach(a => a.cancel());
      ov.remove();
      // pominięcie: reszta wejścia od razu w stanie końcowym
      if (skip === true) {
        document.getAnimations().forEach(a => {
          try { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (_) { /* animacja bez końca */ }
        });
      }
    }
    const tEnd = setTimeout(finish, 1900);
    ov.addEventListener('pointerdown', () => finish(true), { once: true });
  }

  if (root.hasAttribute('data-wejscie')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter, { once: true });
    else enter();
  }

  window.Wejscie = { leave };
})();
