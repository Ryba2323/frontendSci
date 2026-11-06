/*
 * Test kontrastu tekstu (Playwright): 6 motywów × jasny/nocny × zakładki Dom/Skrytka/Tracker/Testy/Blog
 * + arkusz SOS, rozmowa z Asystentem i pierwsze pytanie podlewania (też przy niskim nastroju).
 * Dla każdego widocznego tekstu liczy kontrast z tłem (półprzezroczyste tła są składane warstwa po warstwie,
 * aż do tła strony --bg). Próg WCAG AA: 4,5:1, duży tekst (od 24 px albo od 18,7 px pogrubiony) 3:1.
 * Gradienty tła pomija (liczy kolor pod nimi). Uruchom: node narzedzia/sprawdz-kontrast.js
 * Wersja strony głównej: UKLAD=a|b|c node narzedzia/sprawdz-kontrast.js
 */
const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, '../Main_Front-End/aplikacja.html') + (process.env.UKLAD ? `?uklad=${process.env.UKLAD}&` : '?') + 'pora=dzien&';   // stała pora: wynik nie zależy od godziny (napisy na niebie sprawdza sprawdz-niebo.js)
const THEMES = ['morski', 'zielony', 'niebieski', 'lawenda', 'rozowy', 'morelowy'];

function audit() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; const f = k => (top[k] * top.a + bot[k] * bot.a * (1 - top.a)) / a; return { r: f('r'), g: f('g'), b: f('b'), a }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  // kolor CSS (np. color-mix) → rgb przez canvas
  const cv = document.createElement('canvas').getContext('2d');
  const toRgb = v => { cv.fillStyle = '#000'; cv.fillStyle = v; const s = cv.fillStyle; if (s[0] === '#') return { r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16), a: 1 }; return parse(s); };
  // color-mix daje „color(srgb r g b / a)” z wartościami 0–1
  const srgb = c => { const m = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/); return m ? { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] == null ? 1 : +m[4] } : null; };
  const norm = c => (!c ? null : c.startsWith('color(srgb') ? srgb(c) : /^rgba?\(/.test(c) ? parse(c) : toRgb(c)) || { r: 0, g: 0, b: 0, a: 0 };
  const pageBg = toRgb(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  const out = [];
  const visible = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; if (e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.'); const p = el.parentElement; if (p && p.classList.length) s = '.' + p.classList[0] + ' > ' + s; return s; };
  document.querySelectorAll('body *').forEach(el => {
    if (['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'IMG'].includes(el.tagName) || el.closest('svg')) return;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const ph = (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && !el.value && el.placeholder;
    if (!text && !ph) return;
    if (!visible(el)) return;
    const st = getComputedStyle(el);
    let fg = norm(ph ? getComputedStyle(el, '::placeholder').color : st.color);
    // tło: od góry drzewa w dół
    const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
    let bg = pageBg;
    for (const e of chain) { const c = norm(getComputedStyle(e).backgroundColor); if (c && c.a > 0) bg = over(c, bg); }
    fg = over(fg, bg);
    const size = parseFloat(st.fontSize), bold = +st.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const r = ratio(fg, bg);
    if (r < need) out.push(`${label(el)} „${(text || ph).slice(0, 28)}” ${r.toFixed(2)} < ${need}`);
  });
  return out;
}

(async () => {
  const b = await chromium.launch(); const found = new Map();
  for (const scheme of ['light', 'dark']) for (const theme of THEMES) {
    const p = await b.newPage({ viewport: { width: 375, height: 812 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const note = (where, list) => list.forEach(l => { const k = `${where}: ${l.replace(/ [\d.]+ < .*/, '')}`; const v = found.get(k) || { min: 99, at: [] }; const r = +l.match(/ ([\d.]+) </)[1]; v.min = Math.min(v.min, r); v.at.push(`${theme}/${scheme}`); found.set(k, v); });
    for (const tab of ['dom', 'skrytka', 'tracker', 'testy', 'blog']) {
      await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/${tab}`); await p.waitForTimeout(500);
      note(tab, await p.evaluate(audit));
      if (tab === 'blog') { await p.click('.post-open'); await p.waitForTimeout(200); note('blog rozwinięty', await p.evaluate(audit)); }
      if (tab === 'skrytka') { await p.click('[data-pane="sloik"]'); await p.waitForTimeout(200); note('słoik', await p.evaluate(audit)); }
    }
    await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/dom`); await p.waitForTimeout(400);
    await p.click('#sos-open'); await p.waitForTimeout(300); note('SOS', await p.evaluate(audit));
    await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/dom`); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('#color-open').click()); await p.waitForTimeout(300);   /* na telefonie otwiera się z końca Domu */ note('kolor', await p.evaluate(audit));
    await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/dom`); await p.waitForTimeout(400);
    await p.click('#as-fab'); await p.waitForTimeout(1500); note('Asystent', await p.evaluate(audit));
    await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/dom`); await p.waitForTimeout(400);
    await p.evaluate(() => window.Podlewanie.open()); await p.waitForTimeout(800); note('podlewanie', await p.evaluate(audit));
    await p.keyboard.press('Tab').catch(() => {});
    await p.evaluate(() => { const s = document.querySelector('.ms-slider'); if (s) { s.focus(); } });
    for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(400); note('podlewanie, niski nastrój', await p.evaluate(audit));
    // Żywa planeta: stany panelu na Domu (wybór liczby, po podlaniu, wsparcie przy niskim nastroju)
    if (!process.env.UKLAD || process.env.UKLAD === 'd') {
      await p.goto(`${URL}motyw=${theme}&r=${Math.random()}#/dom`); await p.waitForTimeout(400);
      await p.click('#zy-water'); await p.waitForTimeout(300); note('panel: wybór', await p.evaluate(audit));
      await p.click('.zy-moods .du-mood[data-v="8"]'); await p.waitForTimeout(300); note('panel: podlane', await p.evaluate(audit));
      await p.click('#zy-done [data-zy-open]'); await p.waitForTimeout(300);
      await p.click('.zy-moods .du-mood[data-v="2"]'); await p.waitForTimeout(300); note('panel: niski nastrój', await p.evaluate(audit));
    }
    await p.close();
  }
  await b.close();
  if (!found.size) { console.log('OK — kontrast wszędzie co najmniej 4,5:1 (duży tekst 3:1)'); return; }
  [...found].sort((a, b) => a[1].min - b[1].min).forEach(([k, v]) => console.log(`✗ ${k} — min ${v.min.toFixed(2)} (${v.at.length}×: ${[...new Set(v.at)].slice(0, 4).join(', ')}${v.at.length > 4 ? '…' : ''})`));
})();
