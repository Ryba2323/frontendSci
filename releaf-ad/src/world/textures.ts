// Tekstury rysowane w canvasie fontem aplikacji: kartki dni, plakat miesiąca, kafel z logo.
import * as THREE from 'three';
import { C } from '../brand/palette';
import { FAMILY } from '../lib/fonts';
import { GRID, H, W, cellRect } from './layout';

const tex = (canvas: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace; // kolory 1:1 jak w CSS (bez konwersji)
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
const font = (w: number, px: number) => `${w} ${px}px "${FAMILY}"`;
export const pad2 = (n: number) => String(n).padStart(2, '0');

// ---------- Kartki dni (atlas 6 × 5) ----------
export const NUM_CELL = 512;
export const numRect = (i: number) => {
  const c = i % 6, r = Math.floor(i / 6);
  // uv: (0,0) = lewy dół atlasu (flipY)
  return new THREE.Vector4(c / 6, 1 - (r + 1) / 5, 1 / 6, 1 / 5);
};
export const makeNumberAtlas = () => {
  const cv = document.createElement('canvas');
  cv.width = NUM_CELL * 6;
  cv.height = NUM_CELL * 5;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 30; i++) {
    const x = (i % 6) * NUM_CELL, y = Math.floor(i / 6) * NUM_CELL, s = NUM_CELL;
    g.fillStyle = i === 29 ? C.peach : C.ivory;
    g.fillRect(x, y, s, s);
    g.fillStyle = C.ink;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = font(800, 300);
    (g as any).letterSpacing = '-12px';
    g.fillText(pad2(i + 1), x + s / 2 - 4, y + s / 2 + 108);
    (g as any).letterSpacing = '7px';
    g.font = font(800, 34);
    g.textAlign = 'left';
    g.fillStyle = i === 29 ? C.ink : C.primary;
    g.fillText('DZIEŃ', x + 46, y + 82);
    g.textAlign = 'right';
    (g as any).letterSpacing = '2px';
    g.fillStyle = i === 29 ? 'rgba(14,24,27,.55)' : 'rgba(14,24,27,.38)';
    g.fillText('/30', x + s - 40, y + s - 46);
    // cienka linia jak w kalendarzu
    g.fillStyle = i === 29 ? 'rgba(14,24,27,.25)' : 'rgba(58,141,158,.35)';
    g.fillRect(x + 46, y + 104, s - 92, 3);
  }
  return tex(cv);
};

// ---------- Plakat miesiąca (widok z C*) ----------
export const POSTER_SCALE = 2;
export const makePoster = () => {
  const k = POSTER_SCALE;
  const cv = document.createElement('canvas');
  cv.width = W * k;
  cv.height = H * k;
  const g = cv.getContext('2d')!;
  g.scale(k, k);
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    const r = cellRect(i);
    g.fillStyle = i === 29 ? C.peach : C.ivory;
    g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); // lekki zapas na krawędziach
  }
  // Wielki napis przecina siatkę: ZOBACZ / WIĘCEJ.
  const left = GRID.mx + 6;
  const row = (n: number) => cellRect(n * 5);
  const size = 214;
  g.fillStyle = C.ink;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(800, size);
  (g as any).letterSpacing = `${-0.045 * size}px`;
  const r2 = row(2), r3 = row(3);
  g.fillText('ZOBACZ', left - 4, r2.y + r2.h - 18);
  g.fillText('WIĘCEJ', left - 4, r3.y + r3.h - 30);
  const wW = g.measureText('WIĘCEJ').width;
  // kropka w kolorze brzoskwini — tak jak dzień 30
  const dot = size * 0.17;
  g.fillStyle = C.peach;
  g.fillRect(left - 4 + wW + 4, r3.y + r3.h - 30 - dot, dot, dot);
  // numery dni w rogach komórek
  (g as any).letterSpacing = '1px';
  g.font = font(800, 21);
  for (let i = 0; i < 30; i++) {
    const r = cellRect(i);
    g.fillStyle = i === 29 ? 'rgba(14,24,27,.7)' : C.primary;
    g.fillText(pad2(i + 1), r.x + 14, r.y + 30);
  }
  return tex(cv);
};

// ---------- Kafel z logo (ten sam układ co plakat HTML) ----------
// Logo to oryginalny PNG — tylko skalowany i wyśrodkowany na treści.
export const LOGO_CONTENT = { x0: 194, y0: 225, x1: 1060, y1: 1072 }; // bbox treści w PNG 1254 × 1254
export const logoPlacement = (tile: number) => {
  const k = (0.62 * tile) / (LOGO_CONTENT.x1 - LOGO_CONTENT.x0);
  const cx = (LOGO_CONTENT.x0 + LOGO_CONTENT.x1) / 2, cy = (LOGO_CONTENT.y0 + LOGO_CONTENT.y1) / 2;
  return { k, x: tile / 2 - cx * k, y: tile / 2 - cy * k + tile * 0.01, size: 1254 * k };
};
export const makeLogoTile = (logo: HTMLImageElement) => {
  const s = 2048;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.ivory;
  g.fillRect(0, 0, s, s);
  const p = logoPlacement(s);
  g.imageSmoothingQuality = 'high';
  g.drawImage(logo, p.x, p.y, p.size, p.size);
  return tex(cv);
};
