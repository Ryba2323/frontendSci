/*
 * Geometria „szczeliny” w słowie „Nic” — wspólna dla tekstu (Hook) i pierwszej kartki (Story),
 * bo szczelina to okno, przez które widać kartkę leżącą pod spodem.
 * Wszystko we współrzędnych ekranu 1080 × 1920.
 */
import {T} from '../timeline';
import {E, k, mix, p} from '../lib/anim';
import {CARD_H, CARD_W} from '../components/MomentCard';

export const NIC = {x: 78, top: 770, size: 300, width: 560};
/** okno szczeliny = dokładnie szerokość liter „Nic” (zmierzone z renderu) */
export const NIC_GLYPHS = {x: 90, w: 446};
/** linia podziału „Nic” — mniej więcej w połowie wysokości małych liter */
export const SPLIT_Y = NIC.top + 192;

/** przybliżenie kamery, zanim zacznie się powolny najazd (świat → ekran) */
export const Z0 = 2.22;
export const PILE = {x: 540 - CARD_W / 2, y: 960 - CARD_H / 2};

export const cardScreenRect = () => ({
  x: 540 + (PILE.x - 540) * Z0,
  y: 960 + (PILE.y - 960) * Z0,
  w: CARD_W * Z0,
  h: CARD_H * Z0,
});

/** rozchylenie szczeliny w pikselach ekranu */
export const slitGap = (f: number) => k(f, T.slitOpen, T.cosFull + 6, 0, 196, E.inOutSoft);

/** prostokąt okna: najpierw wąska szczelina w „Nic”, potem rośnie do całej kartki */
export const windowRect = (f: number) => {
  const g = slitGap(f);
  const slit = {x: NIC_GLYPHS.x, y: SPLIT_Y - g / 2, w: NIC_GLYPHS.w, h: g};
  const card = cardScreenRect();
  const t = p(f, T.windowGrow, T.m1 + 6, E.inOut);
  return {
    x: mix(slit.x, card.x, t),
    y: mix(slit.y, card.y, t),
    w: mix(slit.w, card.w, t),
    h: mix(slit.h, card.h, t),
    r: mix(4, 12 * Z0, t),
    t,
  };
};
