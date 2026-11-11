/*
 * Test kontrastu tekstu na ekranach logowania i rejestracji (Playwright):
 * 6 motywów × 4 pory dnia (rano, dzień = jasny ekran; wieczór, noc = ciemny) × telefon / komputer,
 * wszystkie ekrany rejestracji (też z błędami i zaznaczonymi odpowiedziami), logowanie, reset hasła, powitanie i arkusz SOS.
 * Liczy tak samo jak sprawdz-kontrast.js: każdy widoczny tekst z tłem składanym warstwa po warstwie.
 * Próg WCAG AA: 4,5:1, duży tekst (od 24 px albo od 18,7 px pogrubiony) 3:1.
 * Tło pod spodem rysuje canvas (js/plant-scene.js), więc bierzemy kolory, które scena zapisuje do <html>:
 *   • telefon: formularz leży na gruncie planety (--planet),
 *   • komputer: tytuł i postęp leżą na niebie, reszta w pełnej karcie (.panel),
 *   • górny pasek i podpis nad rośliną zawsze na niebie.
 * Niebo to gradient, więc tekst na nim sprawdzamy na obu jego końcach (--sky-top i --ground) i liczy się gorszy wynik.
 * Uruchom: node narzedzia/sprawdz-kontrast-auth.js   (ok. 7 min)
 */
const { chromium } = require('playwright');
const DIR = 'file://' + require('path').resolve(__dirname, '../Main_Front-End') + '/';
const THEMES = ['morski', 'zielony', 'niebieski', 'lawenda', 'rozowy', 'morelowy'];
const PORY = ['rano', 'dzien', 'wieczor', 'noc'];
const SIZES = [{ name: 'telefon', width: 375, height: 812 }, { name: 'komputer', width: 1280, height: 800 }];

function audit() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; const f = k => (top[k] * top.a + bot[k] * bot.a * (1 - top.a)) / a; return { r: f('r'), g: f('g'), b: f('b'), a }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const cv = document.createElement('canvas').getContext('2d');
  const toRgb = v => { cv.fillStyle = '#000'; cv.fillStyle = v; const s = cv.fillStyle; if (s[0] === '#') return { r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16), a: 1 }; return parse(s); };
  const srgb = c => { const m = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/); return m ? { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] == null ? 1 : +m[4] } : null; };
  const norm = c => (!c ? null : c.startsWith('color(srgb') ? srgb(c) : /^rgba?\(/.test(c) ? parse(c) : toRgb(c)) || { r: 0, g: 0, b: 0, a: 0 };
  const token = name => toRgb(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  const sky = [token('--sky-top'), token('--ground')], planet = [token('--planet')];
  const desktop = window.matchMedia('(min-width: 900px)').matches;
  const out = [];
  const visible = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; if (e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.'); const p = el.parentElement; if (p && p.classList.length) s = '.' + p.classList[0] + ' > ' + s; return s; };
  const sosOpen = !!document.querySelector('dialog[open]');
  document.querySelectorAll('body *').forEach(el => {
    if (['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'IMG'].includes(el.tagName) || el.closest('svg')) return;
    if (el.closest('[role="img"]')) return;                        // napis ReLeaf to logo (ten sam co w aplikacji): WCAG nie stawia mu progu
    if (sosOpen && !el.closest('dialog[open]')) return;            // pod otwartym arkuszem reszta jest zasłonięta
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const ph = el.tagName === 'INPUT' && !el.value && el.placeholder;
    if (!text && !ph) return;
    if (!visible(el)) return;
    const st = getComputedStyle(el);
    const fg0 = norm(ph ? getComputedStyle(el, '::placeholder').color : st.color);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
    // co jest pod elementem na canvasie: niebo czy grunt planety
    const bases = el.closest('.auth-top, .scene-copy') || desktop ? sky : planet;
    const size = parseFloat(st.fontSize), bold = +st.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    let worst = 99;
    for (const base of bases) {
      let bg = base;
      for (const e of chain) { const c = norm(getComputedStyle(e).backgroundColor); if (c && c.a > 0) bg = over(c, bg); }
      worst = Math.min(worst, ratio(over(fg0, bg), bg));
    }
    if (worst < need) out.push(`${label(el)} „${(text || ph).slice(0, 28)}” ${worst.toFixed(2)} < ${need}`);
  });
  return out;
}

(async () => {
  const b = await chromium.launch(); const found = new Map();
  for (const size of SIZES) for (const pora of PORY) for (const theme of THEMES) {
    const desktop = size.width >= 900;
    const p = await b.newPage({ viewport: { width: size.width, height: size.height }, colorScheme: 'light', reducedMotion: 'reduce' });
    const at = `${theme}/${pora}/${size.name}`;
    const note = async where => (await p.evaluate(audit)).forEach(l => { const k = `${where}: ${l.replace(/ [\d.]+ < .*/, '')}`; const v = found.get(k) || { min: 99, at: [] }; v.min = Math.min(v.min, +l.match(/ ([\d.]+) </)[1]); v.at.push(at); found.set(k, v); });
    const wait = (ms = 250) => p.waitForTimeout(ms);
    const next = async () => { await p.locator('form.step:not([hidden]) button[type=submit]').click(); await wait(); };
    const q = `?pora=${pora}&motyw=${theme}`;

    // ---------- rejestracja ----------
    await p.goto(DIR + 'rejestracja.html' + q); await wait(500);
    await note('rejestracja: start');
    await next(); await note('rejestracja: konto, błędy');
    await p.fill('#nick', 'Ola'); if (!desktop) await next();
    await p.fill('#email', 'ola@gmial.com');
    if (!desktop) { await next(); await note('rejestracja: e-mail, podpowiedź'); await next(); }
    await p.fill('#password', 'haslo12');
    await note('rejestracja: hasło za krótkie');
    await p.fill('#password', 'tajnehaslo1A'); await next();
    if (desktop) { await note('rejestracja: konto, podpowiedź'); await next(); }
    await note('rejestracja: wiek');
    if (!desktop) { await next(); await note('rejestracja: wiek, błąd'); }
    await p.locator('label.chip:has(input[name=age][value="14"])').click(); await wait(desktop ? 100 : 700);
    await note('rejestracja: forma');
    await p.locator('label.choice:has(input[value="f"])').click(); await wait(desktop ? 100 : 700);
    await p.locator('label.chip:has(input[value="Sen"])').click();
    await note('rejestracja: tematy');
    await next();
    await p.click('#dice'); await note('rejestracja: imię roślinki');
    if (!desktop) { await next(); await note('rejestracja: kolor'); await next(); await note('rejestracja: przypomnienia'); await next(); }
    await next(); await note('rejestracja: zgody, błędy');
    await p.locator('#terms').check(); await p.locator('#parent').check();
    await note('rejestracja: zgody');
    await next(); await wait(500); await note('rejestracja: gotowe');

    // ---------- logowanie ----------
    await p.goto(DIR + 'logowanie.html' + q); await wait(500);
    await note('logowanie');
    await p.fill('#email', ''); await p.locator('#login button[type=submit]').click(); await wait();
    await note('logowanie: błędy');
    await p.click('#forgot-open'); await wait(); await note('reset hasła');
    await p.fill('#femail', 'ola@gmail.com'); await p.locator('#forgot button[type=submit]').click(); await wait(600);
    await note('reset hasła: wysłane');
    await p.locator('#forgot button[type=submit]').click(); await wait();
    await p.fill('#email', 'ola@gmail.com'); await p.fill('#password', 'tajnehaslo1A');
    await p.locator('#login button[type=submit]').click(); await wait(700);
    await note('logowanie: powitanie');
    await p.click('[data-sos]'); await wait(); await note('SOS');
    await p.close();
  }
  await b.close();
  if (!found.size) { console.log('OK — kontrast wszędzie co najmniej 4,5:1 (duży tekst 3:1)'); return; }
  [...found].sort((a, b) => a[1].min - b[1].min).forEach(([k, v]) => console.log(`✗ ${k} — min ${v.min.toFixed(2)} (${v.at.length}×: ${[...new Set(v.at)].slice(0, 4).join(', ')}${v.at.length > 4 ? '…' : ''})`));
  process.exitCode = 1;
})();
