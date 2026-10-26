/*
 * Plama słońca na ścianie → otwór w ścianie → okno tramwaju.
 * Otwór jest rysowany w warstwie ściany, ale jego kształt w każdej klatce to okno tramwaju
 * przeniesione przez kamerę na płaszczyznę ściany — więc krawędź światła „staje się” ramą okna.
 */
import {T} from '../timeline';
import {E, k, mix, p} from '../lib/anim';
import {alignClosed, centroid, lerpPt, Pt, resample, roundRectPts} from '../lib/path';
import {Cam, planeTransform, Z} from './camera';
import {TRAM_WINDOW} from './Outside';
import {patchShape} from './Wall';

const N = 96;

export const patchAt = (f: number) => {
  // przewijanie: słońce „cofa się” po ścianie — plama wjeżdża z prawej i zatrzymuje się przy oknie
  const t = p(f, T.wallSweep, T.patchEdge + 6, E.inOutSoft);
  const dx = f < T.wallSweep || f > T.pullBack ? 0 : mix(780, 0, t);
  const skew = f < T.wallSweep || f > T.pullBack ? 0 : mix(-70, 0, t);
  return {shape: patchShape(dx, skew), light: 1};
};

const tramWindowInWall = (cam: Cam): Pt[] => {
  const W = TRAM_WINDOW;
  const rr = roundRectPts(W.cx - W.w / 2, W.cy - W.h / 2, W.w, W.h, W.r, N);
  const a = planeTransform(cam, Z.tram);
  const b = planeTransform(cam, Z.wall);
  return rr.map((q) => {
    const sx = a.k * q.x + a.bx;
    const sy = a.k * q.y + a.by;
    return {x: (sx - b.bx) / b.k, y: (sy - b.by) / b.k};
  });
};

export const holeAt = (f: number, cam: Cam) => {
  const amount = f > T.pullBack ? 0 : p(f, T.portal + 4, T.portal + 34, E.inOut);
  if (amount <= 0) return {amount: 0, shape: [] as Pt[]};
  const patch = resample(patchShape(0, 0), N, true);
  const win = alignClosed(patch, tramWindowInWall(cam));
  const m = p(f, T.portal, T.portal + 30, E.inOut);
  let shape = patch.map((q, i) => lerpPt(q, win[i], m));
  // otwór rośnie poza okno — widać cały tramwaj i ulicę
  const grow = k(f, T.portal + 22, T.portal + 50, 1, 10, E.inOut);
  if (grow > 1) {
    const c = centroid(shape);
    shape = shape.map((q) => ({x: c.x + (q.x - c.x) * grow, y: c.y + (q.y - c.y) * grow}));
  }
  return {amount, shape};
};
