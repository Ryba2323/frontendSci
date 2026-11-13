#!/usr/bin/env node
/*
 * Render promo „Puść z wiatrem” (Main_Front-End/promo-wiatr.html) do MP4 na story: 1080×1920, 30 kl./s, H.264.
 *
 * Jak działa: otwiera stronę w Chromium (Playwright), dla każdej klatki woła PromoWiatr.klatka(i, fps, proby)
 * — strona rysuje kilka pod-klatek i uśrednia je (rozmycie ruchu) — i przesyła PNG prosto do ffmpeg.
 *
 * Wymaga: node, pakietu playwright (z Chromium) i ffmpeg w PATH.
 *
 * Użycie (z katalogu głównego repo):
 *   node narzedzia/render-promo.js
 *   node narzedzia/render-promo.js --tryb=dark --out=promo/releaf-wiatr-noc.mp4
 *   node narzedzia/render-promo.js --motyw=lawenda --fps=60 --proby=4
 *
 * Opcje: --motyw=<id>  --tryb=light|dark  --fps=30  --proby=8 (pod-klatki na klatkę)  --crf=16  --out=<plik.mp4>
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const fps = +args.fps || 30;
const proby = +args.proby || 8;
const crf = +args.crf || 16;
const tryb = args.tryb === 'dark' ? 'dark' : 'light';
const motyw = typeof args.motyw === 'string' ? args.motyw : 'morski';
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, typeof args.out === 'string' ? args.out : `promo/releaf-pusc-z-wiatrem${tryb === 'dark' ? '-noc' : ''}${motyw !== 'morski' ? '-' + motyw : ''}.mp4`);

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const page_url = pathToFileURL(path.join(root, 'Main_Front-End', 'promo-wiatr.html')).href
    + `?widok=czysty&motyw=${encodeURIComponent(motyw)}&tryb=${tryb}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('Błąd na stronie:', e.message); process.exitCode = 1; });
  await page.goto(page_url);
  await page.evaluate(() => window.PromoWiatr.gotowe);
  const czas = await page.evaluate(() => window.PromoWiatr.czas);
  const total = Math.round(czas * fps);

  const ff = spawn('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    // kolory: sRGB z canvasu → BT.709 (tak, jak oczekują telefony i Instagram)
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-level', '4.2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', code => (code ? rej(new Error(`ffmpeg zakończył się kodem ${code}`)) : res())));

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const url = await page.evaluate(([i, fps, proby]) => {
      window.PromoWiatr.klatka(i, fps, proby);
      return document.getElementById('promo').toDataURL('image/png');
    }, [i, fps, proby]);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0 || i === total - 1) process.stdout.write(`\rklatka ${i + 1}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`\nGotowe: ${path.relative(root, out)}  (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
})().catch(e => { console.error(e); process.exit(1); });
