/*
 * Nagrywa prawdziwy ekran aplikacji (../Main_Front-End/aplikacja.html) klatka po klatce do public/ui/checkin/.
 *
 * Nie jest to nagrywanie ekranu w czasie rzeczywistym: strona dostaje wirtualny zegar (performance.now, Date,
 * requestAnimationFrame, setTimeout/setInterval) i przewijamy go dokładnie o 1/60 s na klatkę. Animacje CSS
 * i przejścia są pauzowane i ustawiane na ten sam czas, więc każda klatka jest ostra i powtarzalna.
 *
 * Interakcja (jedna): suwak „Jak się dziś czujesz?” przeciągnięty na 5 → „Zwyczajny dzień też się liczy.”
 * Pozycję palca zapisujemy do src/dotyk.json (mały plik w repo), żeby film mógł narysować delikatny ślad dotyku.
 * Klatki (public/ui/checkin/*.png, ok. 230 MB) nie są w repo — odtwarzasz je tym skryptem.
 *
 * Użycie: node scripts/nagraj-ui.cjs   (Playwright + Chromium; aplikacja otwierana z file://, kod aplikacji bez zmian)
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FPS = 60;
const SEKUNDY = 7.6;                 // ujęcie w filmie zaczyna się w trakcie ruchu (patrz UI_START w src/timeline.ts)
const KLATKI = Math.round(SEKUNDY * FPS);
const VIEW = { width: 360, height: 640, scale: 3 };   // 1080 × 1920
const APP = path.resolve(__dirname, '../../Main_Front-End/aplikacja.html');
const OUT = path.resolve(__dirname, '../public/ui/checkin');

// Plan ruchu palca (sekundy od początku nagrania)
const CHWYT = 0.5;                   // palec dotyka czubka łodygi
const PUSZCZENIE = 4.6;              // puszcza na „5”
const CEL = 5;

// Wirtualny zegar wstrzykiwany przed skryptami strony
const ZEGAR = `(() => {
  let vt = 0;
  const t0 = 1793030400000; // stała data, żeby nagranie było powtarzalne
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(t0 + vt); }
    static now() { return t0 + vt; }
  }
  window.Date = FakeDate;
  performance.now = () => vt;
  let rafs = new Map(), rid = 1;
  window.requestAnimationFrame = cb => { const id = rid++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { rafs.delete(id); };
  const timers = new Map(); let tid = 1;
  const add = (cb, ms, args, every) => { const id = tid++; timers.set(id, { at: vt + Math.max(0, +ms || 0), cb, args, every }); return id; };
  window.setTimeout = (cb, ms, ...a) => add(cb, ms, a, 0);
  window.setInterval = (cb, ms, ...a) => add(cb, ms, a, Math.max(1, +ms || 0));
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  const start = new WeakMap();
  function seek() {
    for (const an of document.getAnimations()) {
      if (!start.has(an)) { start.set(an, vt - (an.currentTime || 0)); an.pause(); }
      an.currentTime = vt - start.get(an);
    }
  }
  window.__krok = ms => {
    const end = vt + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      vt = Math.max(vt, t.at);
      if (t.every) t.at += t.every; else timers.delete(id);
      try { typeof t.cb === 'function' ? t.cb(...t.args) : eval(t.cb); } catch (e) { console.error(e); }
    }
    vt = end;
    const now = rafs; rafs = new Map();
    for (const cb of now.values()) { try { cb(vt); } catch (e) { console.error(e); } }
    seek();
  };
})();`;

// Kciuk: szybki ruch na początku i spokojne dojście do celu (ease-out)
const ease = t => 1 - Math.pow(1 - t, 3);

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: VIEW.width, height: VIEW.height },
    deviceScaleFactor: VIEW.scale,
    isMobile: true,
    hasTouch: true,
    locale: 'pl-PL',
  });
  page.on('pageerror', e => console.error('Błąd strony:', e.message));
  await page.addInitScript(ZEGAR);
  // Domyślny motyw „morski”, bez zapisanych danych
  await page.addInitScript(() => { try { localStorage.clear(); } catch (_) { /* file:// */ } });
  await page.goto('file://' + APP);
  await page.evaluate(() => document.fonts.ready);
  const krok = ms => page.evaluate(m => window.__krok(m), ms);

  // Przygotowanie (nie nagrywane): strona się układa, otwieramy podlewanie, czekamy aż wejdzie
  for (let i = 0; i < 90; i++) await krok(1000 / FPS);
  await page.click('#water-label');
  for (let i = 0; i < 120; i++) await krok(1000 / FPS);

  // Współrzędne: czubek łodygi (pierścień) i znacznik „5”
  const geo = await page.evaluate(cel => {
    const r = document.querySelector('#ci-mood .ms-ring').getBoundingClientRect();
    const t = document.querySelector(`#ci-mood .ms-scale [data-v="${cel}"]`).getBoundingClientRect();
    return { x0: r.left + r.width / 2, y0: r.top + r.height / 2, x1: t.left + t.width / 2 };
  }, CEL);

  const dotyk = [];
  let wcisniety = false;
  for (let f = 0; f < KLATKI; f++) {
    const s = f / FPS;
    let x = null, y = null;
    if (s >= CHWYT && s <= PUSZCZENIE) {
      const p = ease(Math.min(1, Math.max(0, s - CHWYT - 0.08) / (PUSZCZENIE - CHWYT - 0.25)));
      x = geo.x0 + (geo.x1 - geo.x0) * Math.max(0, p);
      y = geo.y0 + Math.sin(Math.max(0, p) * Math.PI) * -3;  // palec lekko łukiem, jak prawdziwy kciuk
      if (!wcisniety) { await page.mouse.move(x, y); await page.mouse.down(); wcisniety = true; }
      else await page.mouse.move(x, y);
    } else if (wcisniety) {
      await page.mouse.up();
      wcisniety = false;
    }
    dotyk.push(x == null ? null : { x: +(x * VIEW.scale).toFixed(1), y: +(y * VIEW.scale).toFixed(1) });
    await krok(1000 / FPS);
    if (process.env.LOG) console.log(f, await page.evaluate(() => [document.getElementById('ci-support').className, document.querySelector('#ci-mood .ms-num').textContent].join(' ')));
    if (process.env.BEZ_KLATEK) continue;
    await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(4, '0')}.png`), caret: 'initial' });
  }

  const wynik = await page.evaluate(() => ({
    value: document.querySelector('#ci-mood .ms-slider').getAttribute('aria-valuetext'),
    note: document.getElementById('ci-mood-note').textContent,
  }));
  if (!process.env.BEZ_KLATEK) fs.writeFileSync(path.resolve(__dirname, '../src/dotyk.json'), JSON.stringify({ fps: FPS, klatki: KLATKI, punkty: dotyk }));
  console.log('Zapisano', KLATKI, 'klatek →', OUT, wynik);
  await browser.close();
})();
