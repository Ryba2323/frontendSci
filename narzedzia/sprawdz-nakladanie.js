/*
 * Test nakładania elementów (Playwright): 5 szerokości × jasny/ciemny × 4 zakładki × Asystent zamknięty/otwarty.
 * Sprawdza: poziomy scroll, roślinkę szerszą niż scena, elementy pod panelem Asystenta, nachodzące przyciski, ucięte zakładki.
 * Uruchom: node narzedzia/sprawdz-nakladanie.js [folder-na-zrzuty]   (zrzuty komputerowe tylko gdy podasz folder)
 */
const { chromium } = require('playwright'); const D = process.argv[2];
const URL = 'file://' + require('path').resolve(__dirname, '../Main_Front-End/aplikacja.html');
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const w of [375, 820, 1024, 1280, 1440]) for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: w, height: w < 700 ? 812 : 860 }, colorScheme: scheme });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    for (const tab of ['dom', 'skrytka', 'tracker', 'blog']) for (const open of [false, true]) {
      await p.goto(`${URL}?motyw=lawenda&r=${Math.random()}#/${tab}`); await p.waitForTimeout(1300);
      if (open) { await p.click('#as-fab'); await p.waitForTimeout(1600); }
      const r = await p.evaluate(({ open }) => {
        const vis = el => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        const R = el => el.getBoundingClientRect();
        const hit = (a, b) => { const x = R(a), y = R(b); return x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1; };
        const bad = [];
        if (document.scrollingElement.scrollWidth > innerWidth + 1) bad.push('poziomy scroll strony');
        const as = document.getElementById('as'), wide = innerWidth >= 1024;
        const q = s => document.querySelector(s);
        const stage = q('#stage'), canvas = q('#plant');
        if (wide && vis(stage) && canvas && R(canvas).width > R(stage).width + 1) bad.push(`roślinka szersza niż scena (${R(canvas).width|0} > ${R(stage).width|0})`);
        if (open && wide) {
          const L = R(as).left;
          for (const s of ['.app-top .top-actions', '.stage-greet', '#stage', '#plant', '.view:not([hidden])', '.tabbar', '.toast'])
            { const el = q(s); if (vis(el) && R(el).right > L + 1 && R(el).width) bad.push(`${s} wchodzi pod panel (${R(el).right|0} > ${L|0})`); }
        }
        const pairs = [['.app-top .top-actions', '.stage-greet'], ['.app-top .logo-ph', '.stage-greet'], ['#as-fab', '.tabbar'], ['#as-fab', '.fab'], ['#as-fab', '.app-top .top-actions'], ['.as-top .sos', '.as-who']];
        for (const [a, b] of pairs) { const x = q(a), y = q(b); if (vis(x) && vis(y) && hit(x, y) && getComputedStyle(y).opacity > .05) bad.push(`${a} nachodzi na ${b}`); }
        if (wide && !open) for (const s of ['.view:not([hidden])', '.fab', '.tabbar']) { const el = q(s); if (vis(el) && vis(q('#as-fab')) && hit(q('#as-fab'), el)) bad.push('#as-fab nachodzi na ' + s); }
        if (!open && !vis(q('#as-fab'))) bad.push('brak przycisku Asystenta');
        // podpisy w pasku zakładek nie mogą być ucięte
        document.querySelectorAll('.tab').forEach(t => { if (vis(t) && t.scrollWidth > t.clientWidth + 1) bad.push('ucięta zakładka: ' + t.textContent.trim()); });
        return bad;
      }, { open });
      const tag = `${w} ${scheme} ${tab} ${open ? 'otwarty' : 'zamknięty'}`;
      // komputer: w trakcie otwierania roślinka ma cały czas szerokość swojej sceny (bez rozjeżdżania)
      if (open && w >= 1024) {
        await p.click('[data-as-close]'); await p.waitForTimeout(900); await p.click('#as-fab');
        for (const t of [120, 250, 400]) {
          await p.waitForTimeout(t === 120 ? 120 : 140);
          const d = await p.evaluate(() => Math.abs(document.getElementById('plant').getBoundingClientRect().width - document.getElementById('stage').getBoundingClientRect().width));
          if (d > 3) r.push(`w trakcie otwierania roślinka nie pasuje do sceny o ${d | 0}px (${t} ms)`);
        }
        await p.waitForTimeout(800);
      }
      if (r.length && !out.includes(`✗ ${tag}: ${r.join('; ')}`)) out.push(`✗ ${tag}: ${r.join('; ')}`);
      if (D && w >= 1024 && tab === 'dom') await p.screenshot({ path: `${D}/ov-${w}-${scheme}-${open ? 1 : 0}.png` });
    }
    if (errs.length) out.push(`✗ ${w} ${scheme}: błędy JS ${errs.join(' | ')}`);
    await p.close();
  }
  console.log(out.length ? out.join('\n') : 'OK — brak nakładania');
  await b.close();
})();
