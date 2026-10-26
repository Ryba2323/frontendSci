// Narzędzia do linii: krzywe Catmulla-Roma, równe próbkowanie, zamiana na ścieżkę SVG.
export type Pt = {x: number; y: number};

export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});

/** gładka krzywa przez punkty kontrolne (Catmull-Rom), próbkowana gęsto */
export const catmullRom = (pts: Pt[], perSeg = 24): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/** n punktów równo rozłożonych wzdłuż łamanej */
export const resample = (pts: Pt[], n: number, closed = false): Pt[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const d = [0];
  for (let i = 1; i < src.length; i++) d.push(d[i - 1] + Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y));
  const L = d[d.length - 1];
  const out: Pt[] = [];
  let j = 1;
  const count = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    const s = (L * i) / count;
    while (j < d.length - 1 && d[j] < s) j++;
    const t = (s - d[j - 1]) / Math.max(1e-9, d[j] - d[j - 1]);
    out.push(lerpPt(src[j - 1], src[j], Math.min(1, Math.max(0, t))));
  }
  return out;
};

export const toPath = (pts: Pt[], closed = false) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + (closed ? ' Z' : '');

/** gładka ścieżka (kwadratowe krzywe przez środki odcinków) — ładniejsza niż łamana */
export const toSmoothPath = (pts: Pt[], closed = false) => {
  if (pts.length < 3) return toPath(pts, closed);
  const P = closed ? [...pts, pts[0], pts[1]] : pts;
  let d = closed ? `M${((P[0].x + P[1].x) / 2).toFixed(2)} ${((P[0].y + P[1].y) / 2).toFixed(2)}` : `M${P[0].x.toFixed(2)} ${P[0].y.toFixed(2)}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i].x + P[i + 1].x) / 2;
    const my = (P[i].y + P[i + 1].y) / 2;
    d += ` Q${P[i].x.toFixed(2)} ${P[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  if (!closed) d += ` L${P[P.length - 1].x.toFixed(2)} ${P[P.length - 1].y.toFixed(2)}`;
  return d + (closed ? ' Z' : '');
};

/** prostokąt z zaokrągleniami jako wielokąt (do morfingu kształtów) */
export const roundRectPts = (x: number, y: number, w: number, h: number, r: number, n = 96): Pt[] => {
  const pts: Pt[] = [];
  const corners = [
    {cx: x + w - r, cy: y + r, a0: -Math.PI / 2},
    {cx: x + w - r, cy: y + h - r, a0: 0},
    {cx: x + r, cy: y + h - r, a0: Math.PI / 2},
    {cx: x + r, cy: y + r, a0: Math.PI},
  ];
  for (const c of corners) for (let i = 0; i <= 8; i++) {
    const a = c.a0 + (i / 8) * (Math.PI / 2);
    pts.push({x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a)});
  }
  return resample(pts, n, true);
};

/** dopasowanie startu dwóch zamkniętych wielokątów (ten sam kierunek), żeby morfing się nie skręcał */
export const alignClosed = (from: Pt[], to: Pt[]): Pt[] => {
  const n = to.length;
  let best = 0;
  let bestD = Infinity;
  const cf = centroid(from);
  const ct = centroid(to);
  for (let s = 0; s < n; s++) {
    let d = 0;
    for (let i = 0; i < n; i += 4) {
      const a = from[i];
      const b = to[(i + s) % n];
      d += (a.x - cf.x - (b.x - ct.x)) ** 2 + (a.y - cf.y - (b.y - ct.y)) ** 2;
    }
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return to.map((_, i) => to[(i + best) % n]);
};

export const centroid = (pts: Pt[]): Pt => ({x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length});

/** deterministyczny „szum” do drobnego, żywego ruchu */
export const wobble = (t: number, seed: number) => Math.sin(t * 1.3 + seed * 12.9898) * 0.6 + Math.sin(t * 2.7 + seed * 4.1414) * 0.4;
