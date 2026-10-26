/*
 * Położenie logo na ekranie. Warstwy logo (public/logo/*.png) mają wspólny kadr 895 × 880 px
 * wycięty z oficjalnego pliku; skrzydła i tułów rozdzielone tylko po to, żeby skrzydła mogły się otworzyć.
 */
export const LOGO_SRC = {w: 895, h: 880, hingeL: 418, hingeR: 514, bodyX: 468, bodyY0: 421, bodyY1: 759};
export const LOGO = {w: 600, top: 560};
export const LOGO_S = LOGO.w / LOGO_SRC.w;
export const LOGO_LEFT = 540 - (LOGO_SRC.w / 2) * LOGO_S;
/** tułów motyla — tu zapada się ekran aplikacji */
export const BODY = {
  x: LOGO_LEFT + LOGO_SRC.bodyX * LOGO_S,
  y: LOGO.top + ((LOGO_SRC.bodyY0 + LOGO_SRC.bodyY1) / 2) * LOGO_S,
  h: (LOGO_SRC.bodyY1 - LOGO_SRC.bodyY0) * LOGO_S,
};
