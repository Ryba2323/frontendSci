// Ładowanie fontu aplikacji (Plus Jakarta Sans, OFL) — raz, przed pierwszą klatką.
import { continueRender, delayRender, staticFile } from 'remotion';
import { parse, Font } from 'opentype.js';

export const FAMILY = 'Plus Jakarta Sans';
const WEIGHTS: [string, number][] = [
  ['PlusJakartaSans-Medium.ttf', 500],
  ['PlusJakartaSans-SemiBold.ttf', 600],
  ['PlusJakartaSans-Bold.ttf', 700],
  ['PlusJakartaSans-ExtraBold.ttf', 800],
];

let cssPromise: Promise<void> | null = null;
export const loadCssFonts = () => {
  if (!cssPromise) {
    cssPromise = Promise.all(
      WEIGHTS.map(async ([file, weight]) => {
        const face = new FontFace(FAMILY, `url(${staticFile(`fonts/${file}`)})`, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return cssPromise;
};

let outlinePromise: Promise<Font> | null = null;
// Kontury liter do brył 3D (ExtraBold)
export const loadOutlineFont = () => {
  if (!outlinePromise) {
    outlinePromise = fetch(staticFile('fonts/PlusJakartaSans-ExtraBold.ttf'))
      .then((r) => r.arrayBuffer())
      .then((buf) => parse(buf));
  }
  return outlinePromise;
};

// Wszystkie zasoby filmu gotowe przed renderem (fonty + obraz logo)
let allPromise: Promise<{ outline: Font; logo: HTMLImageElement }> | null = null;
export const loadAssets = () => {
  if (!allPromise) {
    const handle = delayRender('Fonty i logo');
    allPromise = Promise.all([
      loadCssFonts(),
      loadOutlineFont(),
      new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = staticFile('brand/releaf-logo.png');
      }),
    ]).then(([, outline, logo]) => {
      continueRender(handle);
      return { outline, logo };
    });
  }
  return allPromise;
};
