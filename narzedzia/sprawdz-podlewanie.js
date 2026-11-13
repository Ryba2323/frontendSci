/*
 * Test podlewania (Playwright): przebieg „Podlej roślinkę” na telefonie 375×812, małym telefonie 320×640 i komputerze 1280×800.
 * Uruchom: node narzedzia/sprawdz-podlewanie.js
 * Sprawdza to, co rada z 12.11.2026 kazała obejrzeć po skróceniu podlewania do nastroju:
 *   przyciski „Podlej roślinkę” i „Dodaj więcej” mieszczą się i mają co najmniej 44 px,
 *   bez wybranego nastroju jest prośba zamiast deszczu, z nastrojem pada deszcz i panel pokazuje „Podlane · N/10”,
 *   „Zmień” → „Dodaj więcej” → sen → co dziś było → notatka daje pełny wpis, plusy na Domu otwierają właściwe pytanie,
 *   przy nastroju 1–3 karta wsparcia (Asystent i 116 111) jest widoczna NAD przyklejonym przyciskiem, a skala suwaka nie jest zasłonięta.
 */
const { chromium } = require('playwright');
const URL = 'file://' + require('path').resolve(__dirname, '../Main_Front-End/aplikacja.html');
const out = []; const ok = (c, m) => out.push((c ? 'OK   ' : 'BŁĄD ') + m);
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[375, 812], [320, 640], [1280, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__ev = []; addEventListener('watered', () => __ev.push('watered')); addEventListener('entrychange', () => __ev.push('entrychange')); });
    await p.goto(URL + '?r=' + Math.random()); await p.waitForTimeout(1500);
    const T = `[${w}×${h}] `;
    // 1. rozmiary
    await p.click('#zy-water'); await p.waitForTimeout(900);
    const m = await p.evaluate(() => { const r = s => { const e = document.querySelector(s), b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, h: b.height, l: b.left, r: b.right, vis: getComputedStyle(e).display !== 'none' && b.width > 0 }; }; return { next: r('#ci-next'), more: r('#ci-more'), count: document.querySelector('#ci-count').textContent, label: document.querySelector('#ci-next-label').textContent, vh: innerHeight, vw: innerWidth, sw: document.querySelector('#checkin').scrollWidth, cw: document.querySelector('#checkin').clientWidth, ox: getComputedStyle(document.querySelector('#checkin')).overflowX }; });
    ok(m.next.vis && m.next.h >= 44 && m.next.b <= m.vh + 1 && m.next.l >= 0 && m.next.r <= m.vw + 1, T + `„Podlej roślinkę” widoczny, wys. ${m.next.h | 0} px (dół ${m.next.b | 0}/${m.vh})`);
    ok(m.more.vis && m.more.h >= 44 && m.more.b <= m.vh + 1 && m.more.l >= 0 && m.more.r <= m.vw + 1, T + `„Dodaj więcej” widoczny, wys. ${m.more.h | 0} px (dół ${m.more.b | 0}/${m.vh})`);
    ok(m.more.t >= m.next.b - 1, T + 'przyciski nie nachodzą na siebie');
    ok(m.count === '' && m.label === 'Podlej roślinkę', T + `brak licznika na 1. ekranie, etykieta „${m.label}”`);
    ok(m.sw <= m.cw + 1 || m.ox === 'hidden', T + 'pytań nie da się przewinąć w bok');
    // tekst „Dodaj więcej” nie ucięty
    const clip = await p.evaluate(() => { const e = document.querySelector('#ci-more'); return e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1; });
    ok(!clip, T + 'tekst „Dodaj więcej” mieści się w przycisku');
    // 3. bez nastroju
    await p.click('#ci-next'); await p.waitForTimeout(400);
    const a = await p.evaluate(() => ({ open: Checkin.isOpen, note: document.querySelector('#ci-mood-note').textContent, ev: __ev.slice(), entry: Podlewanie.entry }));
    ok(a.open && a.note === 'Przesuń łodygę, żeby podlać roślinkę.' && !a.ev.includes('watered') && !(a.entry && a.entry.mood), T + `bez nastroju: prośba zamiast deszczu („${a.note}”)`);
    // 2. nastrój → deszcz
    await p.focus('#ci-mood [role="slider"]');
    for (let i = 0; i < 7; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(300);
    const mv = await p.evaluate(() => document.querySelector('#ci-mood [role="slider"]').getAttribute('aria-valuenow'));
    await p.click('#ci-next'); await p.waitForTimeout(1600);
    const d = await p.evaluate(() => ({ open: Checkin.isOpen, ev: __ev.slice(), entry: Podlewanie.entry, state: document.querySelector('#zy-panel').dataset.state, text: document.querySelector('#zy-done-text').textContent, more: !document.querySelector('#du-more').hidden }));
    ok(!d.open && d.ev.includes('watered') && d.entry && String(d.entry.mood) === mv && d.state === 'done' && d.text.startsWith(`Podlane · ${mv}/10`), T + `nastrój ${mv} → deszcz, panel „${d.text}” (stan ${d.state})`);
    ok(d.more, T + 'po podlaniu widać plusy „Chcesz dodać więcej?”');
    // 4. Zmień → Dodaj więcej → sen → co było → notatka → Podlej
    await p.evaluate(() => document.querySelector('#zy-done [data-zy-open]').click()); await p.waitForTimeout(900);
    const z = await p.evaluate(() => ({ open: Checkin.isOpen, v: document.querySelector('#ci-mood [role="slider"]').getAttribute('aria-valuenow') }));
    ok(z.open && z.v === mv, T + `„Zmień” otwiera pytania z nastrojem ${z.v}`);
    await p.click('#ci-more'); await p.waitForTimeout(500);
    const s1 = await p.evaluate(() => ({ step: document.querySelector('.ci-step:not([hidden])').dataset.step, count: document.querySelector('#ci-count').textContent, label: document.querySelector('#ci-next-label').textContent, more: getComputedStyle(document.querySelector('#ci-more')).display }));
    ok(s1.step === 'sleep' && s1.count === '2 z 4' && s1.label === 'Pomiń' && s1.more === 'none', T + `„Dodaj więcej” → sen („${s1.count}”, „${s1.label}”, przycisk dodatku: ${s1.more})`);
    for (const g of ['sleepHours', 'bedtime', 'sleepQuality']) await p.click(`.ci-chips[data-group="${g}"] button:nth-child(2)`);
    const small = await p.evaluate(() => [...document.querySelectorAll('.ci-step:not([hidden]) button')].filter(x => x.getBoundingClientRect().height < 44).map(x => x.textContent.trim() + ' ' + (x.getBoundingClientRect().height | 0)));
    ok(!small.length, T + 'sen: przyciski ≥ 44 px' + (small.length ? ' → ' + small.join(', ') : ''));
    await p.click('#ci-next'); await p.waitForTimeout(500);
    await p.click('.ci-chips[data-multi="acts"] button:nth-child(1)');
    await p.click('.ci-seg[data-area="friends"] button[data-v="1"]');
    const small2 = await p.evaluate(() => [...document.querySelectorAll('.ci-step:not([hidden]) button')].filter(x => x.getBoundingClientRect().height < 44).map(x => x.textContent.trim() + ' ' + (x.getBoundingClientRect().width | 0) + '×' + (x.getBoundingClientRect().height | 0)));
    out.push('INFO ' + T + `„co dziś było”: przyciski < 44 px: ${small2.length} (np. ${small2.slice(0, 2).join(', ')}) — punkt 2 rady`);
    await p.click('#ci-next'); await p.waitForTimeout(500);
    await p.fill('#ci-note', 'Dobry trening.');
    const fin = await p.evaluate(() => ({ step: document.querySelector('.ci-step:not([hidden])').dataset.step, label: document.querySelector('#ci-next-label').textContent }));
    ok(fin.step === 'note' && fin.label === 'Podlej roślinkę', T + `ostatnie pytanie kończy „${fin.label}”`);
    await p.click('#ci-next'); await p.waitForTimeout(1500);
    const e = await p.evaluate(() => ({ open: Checkin.isOpen, entry: Podlewanie.entry, done: [...document.querySelectorAll('#du-more [data-step]')].map(c => c.classList.contains('is-done')) }));
    const en = e.entry || {};
    ok(!e.open && String(en.mood) === mv && en.sleepHours != null && en.bedtime != null && en.sleepQuality != null && Object.keys(en.acts || {}).length === 1 && en.areas && en.areas.friends === 1 && en.note === 'Dobry trening.', T + 'pełny wpis: ' + JSON.stringify(en));
    ok(e.done.every(Boolean), T + 'plusy na Domu zmieniły się w ✓');
    // 5. plusy otwierają właściwe pytanie
    for (const st of ['sleep', 'areas', 'note']) {
      await p.evaluate(s => document.querySelector(`#du-more [data-step="${s}"]`).click(), st); await p.waitForTimeout(900);
      const q = await p.evaluate(() => ({ open: Checkin.isOpen, step: document.querySelector('.ci-step:not([hidden])').dataset.step }));
      ok(q.open && q.step === st, T + `plus „${st}” otwiera pytanie ${q.step}`);
      await p.evaluate(() => Checkin.close()); await p.waitForTimeout(900);
    }
    ok(!errs.length, T + 'bez błędów JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await p.close();
  }

  // wsparcie przy niskim nastroju jest nad przyklejonym przyciskiem; skala suwaka nie chowa się pod nim
  for (const [w, h] of [[375, 812], [320, 640], [360, 640], [1280, 800], [1366, 768]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(URL + '?pora=dzien&r=' + Math.random()); await p.waitForTimeout(1500);
    await p.click('#zy-water'); await p.waitForTimeout(1200);
    const idle = await p.evaluate(() => { const c = document.querySelector('#checkin'); const lab = [...c.querySelectorAll('[class*="ms-"]')].filter(e => /^\d+$/.test(e.textContent.trim()) && e.children.length === 0).map(e => e.getBoundingClientRect().bottom); return { scale: Math.max(...lab), next: c.querySelector('#ci-next').getBoundingClientRect().top }; });
    ok(idle.scale <= idle.next, `[${w}×${h}] skala suwaka nie jest zasłonięta przez „Podlej roślinkę”`);
    await p.focus('#ci-mood [role="slider"]'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200);
    const low = await p.evaluate(() => { const c = document.querySelector('#checkin'); const B = s => c.querySelector(s).getBoundingClientRect(); return { call: B('#ci-support .support-call').bottom, assist: B('[data-assist]').top, foot: B('.ci-actions').top, sticky: getComputedStyle(c.querySelector('.ci-actions')).position === 'sticky' }; });
    ok(!low.sticky || (low.call <= low.foot + 1 && low.assist >= 0), `[${w}×${h}] nastrój 2: Asystent i „Zadzwoń: 116 111” widać nad przyciskiem`);
    await p.close();
  }
  await b.close();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('BŁĄD')).length;
  console.log(bad ? `\n${bad} sprawdzeń nie przeszło` : `\nOK — podlewanie działa (${out.length} sprawdzeń)`);
  process.exit(bad ? 1 : 0);
})();
