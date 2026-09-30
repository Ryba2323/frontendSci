/*
 * Strona główna — treść i interakcje.
 *
 * Komponenty (funkcje, jak przyszłe komponenty React): kształt liścia, bilans tygodnia, słupki dni.
 * „Podlewanie” to codzienny wpis o samopoczuciu. Na razie tylko przycisk z animacją — pytania dojdą później.
 * Bilans tygodnia jest na razie LOSOWY (dane demonstracyjne), do podmiany na dane z API.
 * Tło z gałęzią: js/home-scene.js (window.HomeScene).
 */
(function () {
  'use strict';

  const Scene = window.HomeScene || { start() {}, relayout() {}, water() {} };
  const { toast, haptic, account } = window.AuthCommon;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('widok');
  if (reduceMotion) document.documentElement.classList.add('is-static');

  const fmt = v => v.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ================================================================
  //  Profil (z rejestracji w tej przeglądarce albo demonstracyjny)
  // ================================================================
  // W podglądzie (?widok=…) zawsze dane demonstracyjne, nie konto zapisane w tej przeglądarce
  const saved = new URLSearchParams(location.search).has('widok') ? null : account.load();
  const nick = (saved && saved.nick) || 'Ola';
  const plant = saved ? saved.plant || '' : 'Mięta';

  // ================================================================
  //  Powitanie
  // ================================================================
  const now = new Date();
  const h = now.getHours();
  const greet = h >= 5 && h < 12 ? 'Dzień dobry' : h >= 12 && h < 18 ? 'Cześć' : 'Dobry wieczór';
  const weekday = now.toLocaleDateString('pl-PL', { weekday: 'long' });
  $('#greet-date').textContent = `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`;
  $('#greet-title').textContent = `${greet}, ${nick}!`;
  const sub = $('#greet-sub');
  if (plant) {
    sub.append(document.createTextNode('Twoja roślinka, '));
    const b = document.createElement('b');
    b.textContent = plant;
    sub.append(b, document.createTextNode(', czeka na dzisiejsze podlewanie.'));
  } else {
    sub.textContent = 'Twoja roślinka czeka na dzisiejsze podlewanie.';
  }
  $('#plant-name').textContent = plant || 'Twoja roślinka';
  $('#plant-days').textContent = 'rośnie z Tobą od 24 dni · każde podlewanie to nowy listek';

  // ================================================================
  //  Komponent: kształt liścia (SVG liczony pod rozmiar karty)
  //  Nasada w (0, h/2) przy gałęzi, szeroki środek na treść, zwężający się czubek.
  // ================================================================
  function leafPath(w, h) {
    const X = f => (f * w).toFixed(1), Y = f => (f * h).toFixed(1);
    return `M0 ${Y(.5)} C${X(.05)} ${Y(.16)} ${X(.2)} 0 ${X(.42)} 0`
      + ` C${X(.64)} 0 ${X(.8)} ${Y(.08)} ${X(.9)} ${Y(.25)}`
      + ` C${X(.95)} ${Y(.33)} ${X(.98)} ${Y(.4)} ${w} ${Y(.45)}`
      + ` C${X(.98)} ${Y(.51)} ${X(.94)} ${Y(.62)} ${X(.88)} ${Y(.72)}`
      + ` C${X(.78)} ${Y(.9)} ${X(.64)} ${h} ${X(.44)} ${h}`
      + ` C${X(.2)} ${h} ${X(.05)} ${Y(.84)} 0 ${Y(.5)} Z`;
  }
  function leafVeins(w, h) {
    const mid = x => h * (.5 - .05 * (x / w));
    let d = `M0 ${h * .5} Q${w * .5} ${h * .49} ${w} ${h * .45}`;
    [.18, .34, .5, .66].forEach(f => {
      const x = w * f, y = mid(x), dx = w * (.1 + f * .05), dy = h * (.3 - f * .18);
      d += ` M${x} ${y} Q${x + dx * .45} ${y - dy * .55} ${x + dx} ${y - dy}`;
      d += ` M${x} ${y} Q${x + dx * .45} ${y + dy * .55} ${x + dx} ${y + dy}`;
    });
    return d;
  }
  const GRADIENTS = {
    hero: `<linearGradient id="lg-hero" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--plant-stem)"/>
        <stop offset=".6" style="stop-color:var(--primary)"/>
        <stop offset="1" style="stop-color:var(--plant-leaf-1)"/>
      </linearGradient>`,
    stat: `<linearGradient id="lg-stat" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:color-mix(in srgb, var(--plant-leaf-2) 30%, #fff)"/>
        <stop offset="1" style="stop-color:color-mix(in srgb, var(--plant-leaf-1) 42%, #fff)"/>
      </linearGradient>`,
  };
  function shapeLeaves() {
    $$('.leaf-card').forEach(card => {
      const kind = card.classList.contains('leaf-card--hero') ? 'hero' : 'stat';
      const w = card.offsetWidth, hh = card.offsetHeight;
      const svg = $('.leaf-bg', card);
      svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
      const light = kind === 'stat';
      svg.innerHTML = `<defs>${GRADIENTS[kind]}
          <radialGradient id="lg-gloss-${kind}" cx=".28" cy=".18" r=".7">
            <stop offset="0" stop-color="#fff" stop-opacity="${light ? .5 : .2}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
          </radialGradient></defs>
        <path d="${leafPath(w, hh)}" fill="url(#lg-${kind})" ${light ? 'stroke="var(--plant-leaf-1)" stroke-opacity=".5" stroke-width="1.5"' : ''}/>
        <path d="${leafPath(w, hh)}" fill="url(#lg-gloss-${kind})"/>
        <path d="${leafVeins(w, hh)}" fill="none" stroke="${light ? 'var(--plant-leaf-1)' : '#fff'}" stroke-opacity="${light ? .28 : .13}" stroke-width="1.6" stroke-linecap="round"/>`;
    });
  }

  // ================================================================
  //  Komponent: bilans tygodnia (na razie losowy)
  // ================================================================
  const WORDS = [[8.5, 'Świetny tydzień'], [7, 'Całkiem dobrze'], [5.5, 'Nieźle'], [4, 'Tak sobie'], [0, 'Trudniejszy czas']];
  const DAY_LETTER = ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'];
  const score = Math.round(rand(5.8, 8.7) * 10) / 10;
  const prev = Math.round(clamp(score + rand(-1.2, .9), 3, 9.6) * 10) / 10;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - 6 + i);
    return { letter: i === 6 ? 'dziś' : DAY_LETTER[d.getDay()], v: Math.round(clamp(score + rand(-1.8, 1.6), 2, 10)) };
  });

  $('#score-word').textContent = WORDS.find(([min]) => score >= min)[1];
  $('#meter').setAttribute('aria-label', `Ogólny bilans tygodnia: ${fmt(score)} na 10. Poprzedni tydzień: ${fmt(prev)}.`);
  $('#meter-prev').style.left = `${prev * 10}%`;
  const diff = score - prev;
  $('#trend').innerHTML = `<b>${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}</b> od zeszłego tygodnia`;
  const cols = $('#cols');
  cols.setAttribute('aria-label', 'Samopoczucie w ostatnich dniach: ' + days.map(d => `${d.letter} ${d.v}`).join(', '));
  cols.innerHTML = days.map((d, i) =>
    `<span class="col${i === 6 ? ' is-today' : ''}" style="--v:${d.v / 10};--k:${i}"><i></i><span>${d.letter}</span></span>`).join('');

  // Liczby i słupek ruszają, gdy liść się rozwinie (zdarzenie z js/home-scene.js)
  const scoreNum = $('#score-num');
  function countUp() {
    $('#meter-fill').style.width = `${score * 10}%`;
    if (reduceMotion) { scoreNum.textContent = fmt(score); return; }
    const t0 = performance.now() + 250, dur = 1300;
    const step = t => {
      const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      scoreNum.textContent = fmt(score * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const statCard = $('.leaf-card--stat');
  statCard.addEventListener('leafopen', countUp, { once: true });
  scoreNum.textContent = fmt(0);

  // ================================================================
  //  Myśl na dziś
  // ================================================================
  $('#quote').textContent = 'Nie musisz mieć dziś wszystkiego poukładanego. Wystarczy jeden mały krok.';

  // ================================================================
  //  Podlewanie (sam przycisk — pytania dojdą później)
  // ================================================================
  const waterBtn = $('#water-btn');
  let toastTimer;
  waterBtn.addEventListener('click', () => {
    const r = $('.drop', waterBtn).getBoundingClientRect();
    Scene.water(r.left + r.width / 2, r.top + r.height / 2);
    waterBtn.classList.remove('is-pouring');
    void waterBtn.offsetWidth;
    waterBtn.classList.add('is-pouring');
    haptic([10, 30, 10]);
    clearTimeout(toastTimer);
    // TODO: tu otworzy się ekran z pytaniami o samopoczucie
    toastTimer = setTimeout(() => toast('Tu otworzą się pytania o Twój dzień.'), 900);
  });

  // ================================================================
  //  SOS
  // ================================================================
  const backdrop = $('#sheet-backdrop');
  const sosSheet = $('#sos-sheet');
  let lastFocus = null;
  function openSos() {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    sosSheet.hidden = false;
    void sosSheet.offsetWidth;
    backdrop.classList.add('is-open');
    sosSheet.classList.add('is-open');
    document.body.classList.add('sheet-open');
    setTimeout(() => $('a, button', sosSheet).focus({ preventScroll: true }), 60);
  }
  function closeSos() {
    if (sosSheet.hidden) return;
    sosSheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { sosSheet.hidden = true; backdrop.hidden = true; }, 380);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $('#sos-open').addEventListener('click', openSos);
  backdrop.addEventListener('click', closeSos);
  $('[data-close]', sosSheet).addEventListener('click', closeSos);
  document.addEventListener('keydown', e => {
    if (sosSheet.hidden) return;
    if (e.key === 'Escape') { closeSos(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a, button', sosSheet);
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ================================================================
  //  Start
  // ================================================================
  shapeLeaves();
  Scene.start();
  let shapeTimer;
  const reshape = () => { clearTimeout(shapeTimer); shapeTimer = setTimeout(() => { shapeLeaves(); Scene.relayout(); }, 80); };
  window.addEventListener('resize', reshape);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reshape);
})();
