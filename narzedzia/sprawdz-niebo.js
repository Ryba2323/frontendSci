/*
 * Kontrast napisów na niebie (Playwright): powitanie i data stoją na canvasie z niebem, którego zwykły test kontrastu
 * nie widzi. Dla 4 pór dnia × 6 motywów × jasny/nocny × telefon/komputer bierze piksele nieba pod linijkami tekstu
 * i liczy najgorszy kontrast (bez poświaty text-shadow, którą nocą dostaje tekst — to zapas).
 * Uruchom: node narzedzia/sprawdz-niebo.js   (próg 4,5:1, nagłówek od 24 px — 3:1)
 */
const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, '../Main_Front-End/aplikacja.html');
(async () => {
  const b = await chromium.launch(); const bad = [];
  for (const scheme of ['light', 'dark']) for (const theme of ['morski', 'zielony', 'niebieski', 'lawenda', 'rozowy', 'morelowy']) for (const pora of ['rano', 'dzien', 'wieczor', 'noc']) for (const w of [375, 1280]) {
    const p = await b.newPage({ viewport: { width: w, height: w < 700 ? 812 : 860 }, colorScheme: scheme, reducedMotion: 'reduce' });
    // listki przelatujące po niebie mają losowe położenie — błąd liczy się tylko wtedy, gdy powtórzy się po ponownym wczytaniu
    let r = null;
    for (let tryN = 0; tryN < 2 && (r == null || r.length); tryN++) {
    await p.goto(`${URL}?motyw=${theme}&pora=${pora}&r=${Math.random()}#/dom`); await p.waitForTimeout(700);
    r = await p.evaluate(() => {
      const cv = document.getElementById('plant'), ctx = cv.getContext('2d'), cr = cv.getBoundingClientRect(), k = cv.width / cr.width;
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const pageBg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return ['#greet-title', '#greet-date'].map(sel => {
        const el = document.querySelector(sel), st = getComputedStyle(el), fg = st.color.match(/[\d.]+/g).map(Number);
        // tylko linijki tekstu (Range), nie całe pole elementu
        const rg = document.createRange(); rg.selectNodeContents(el);
        const rects = [...rg.getClientRects()].filter(q => q.width > 2); let min = 99;
        for (const er of rects) for (let i = 0; i < 16; i++) {
          const x = (er.left + (i % 8 + .5) / 8 * er.width - cr.left) * k, y = (er.top + (Math.floor(i / 8) + .5) / 2 * er.height - cr.top) * k;
          const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          const a = d[3] / 255, bg = [0, 1, 2].map(j => d[j] * a + pageBg[j] * (1 - a));
          min = Math.min(min, ratio(fg, bg));
        }
        const need = parseFloat(st.fontSize) >= 24 ? 3 : 4.5;
        return min < need ? `${sel} ${min.toFixed(2)} < ${need}` : null;
      }).filter(Boolean);
    });
    }
    r.forEach(x => bad.push(`✗ ${theme}/${scheme}/${pora}/${w}: ${x}`));
    await p.close();
  }
  await b.close();
  console.log(bad.length ? bad.join('\n') : 'OK — napisy na niebie czytelne o każdej porze');
})();
