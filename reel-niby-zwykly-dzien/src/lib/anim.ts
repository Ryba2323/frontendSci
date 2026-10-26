import {Easing, interpolate} from 'remotion';

// Krzywe ruchu: spokojne, z długim „dojazdem” (żadnych sprężyn z odbiciem poza lądowaniem kartek)
export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outSoft: Easing.bezier(0.25, 1, 0.5, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  inOutSoft: Easing.bezier(0.45, 0, 0.25, 1),
  in: Easing.bezier(0.5, 0, 0.75, 0),
  linear: Easing.linear,
};

/** interpolate() z obustronnym clampem — f od a do b daje from → to */
export const k = (f: number, a: number, b: number, from: number, to: number, easing = E.out) =>
  interpolate(f, [a, b], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

/** postęp 0..1 */
export const p = (f: number, a: number, b: number, easing = E.out) => k(f, a, b, 0, 1, easing);

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** liniowe mieszanie kolorów #RRGGBB */
export const mixColor = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(mix(v, pb[i], t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
