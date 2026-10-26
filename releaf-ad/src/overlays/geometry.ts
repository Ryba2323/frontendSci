// Geometria nakładek: karta z aplikacji (wymiary zmierzone w prawdziwym Main_Front-End, tryb nocny, szer. 375)
// i plakat końcowy z logo.
import { CARD_RECT, CARD_SCALE } from '../world/World';
import { LOGO_PATHS } from '../brand/logo-paths';
import { logoPlacement } from '../world/textures';

export { CARD_RECT, CARD_SCALE };

// Karta „Sen poprawia Ci dzień” (aplikacja.html#/tracker, .insight-card nr 2) — px CSS względem karty
export const CARD_EL = {
  w: 335,
  h: 207.921875,
  radius: 22,
  tagSvg: { x: 19, y: 20.91, w: 15, h: 15 },
  tag: { x: 40, y: 17, h: 22.81 },
  h3: { x: 19, y: 47.81, w: 297, h: 23.3 },
  rows: [
    { small: { x: 19, y: 83.61, w: 96, h: 16 }, bar: { x: 125, y: 85.61, w: 88.44, h: 12 }, val: { x: 286, y: 83.11, w: 30, h: 17 }, label: 'mniej niż 7 h', value: '5,9' },
    { small: { x: 19, y: 108.61, w: 96, h: 16 }, bar: { x: 125, y: 110.61, w: 109.05, h: 12 }, val: { x: 286, y: 108.11, w: 30, h: 17 }, label: '7 h i więcej', value: '7,2' },
  ],
  p: { x: 19, y: 135.11, w: 297, h: 22.81 },
  summary: { x: 19, y: 165.92, w: 165.8, h: 29 },
};
// Ikona „Sen” z js/tracker.js (viewBox 24)
export const MOON_PATH = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z';

export const cardX = (x: number) => CARD_RECT.x + x * CARD_SCALE;
export const cardY = (y: number) => CARD_RECT.y + y * CARD_SCALE;

// Plakat: kwadratowy kafel (jak płyta dnia), na nim oryginalne logo PNG
export const POSTER = { x: 100, y: 400, size: 880 };
export const POSTER_CY = POSTER.y + POSTER.size / 2;
export const LOGO = (() => {
  const p = logoPlacement(POSTER.size);
  return { k: p.k, x: POSTER.x + p.x, y: POSTER.y + p.y, size: p.size };
})();

// Obrys logo przeniesiony do pikseli kadru (wszystkie komendy potrace są bezwzględne i w parach x,y)
const mapPath = (d: string) => {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = parseFloat(n);
    const out = i % 2 === 0 ? LOGO.x + v * LOGO.k : LOGO.y + v * LOGO.k;
    i++;
    return out.toFixed(2);
  });
};
export const LOGO_FRAME = {
  wingL: mapPath(LOGO_PATHS.wingL),
  body: mapPath(LOGO_PATHS.body),
  wingR: mapPath(LOGO_PATHS.wingR),
};
// Napis „ReLeaf” w PNG (bbox ciemnych pikseli)
export const WORDMARK_PNG = { x0: 316, y0: 926, x1: 951, y1: 1072 };
export const WORDMARK = {
  x: LOGO.x + WORDMARK_PNG.x0 * LOGO.k,
  y: LOGO.y + WORDMARK_PNG.y0 * LOGO.k,
  w: (WORDMARK_PNG.x1 - WORDMARK_PNG.x0) * LOGO.k,
  h: (WORDMARK_PNG.y1 - WORDMARK_PNG.y0) * LOGO.k,
};

export const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
};
