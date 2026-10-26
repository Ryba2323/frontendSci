/*
 * „Nić” — jedna turkusowa linia, która prowadzi oko przez przewijanie:
 *   brzeg kubka (łuk) → zsuwa się i staje kablem słuchawek → kabel unosi się i prostuje w falę dźwięku →
 *   fala płynie na ścianę za cofającą się plamą słońca → owija się wokół plamy jak rama →
 *   ta rama staje się ramą okna tramwaju (otwór w ścianie, patrz portal.ts).
 * Punkty żyją w 3D (współrzędne warstwy + głębokość z) i są rzutowane kamerą na ekran.
 */
import React from 'react';
import {C} from '../theme';
import {T} from '../timeline';
import {E, mix, p} from '../lib/anim';
import {centroid, Pt, resample, roundRectPts, toSmoothPath} from '../lib/path';
import {Cam, CUP_POS, project, Z} from './camera';
import {CABLE_REST} from './Table';
import {holeAt, patchAt} from './portal';

const N = 160;
const CABLE = resample(CABLE_REST, N);
const RIM_U = 0.36; // ta część kabla „jest” łukiem kubka

type P3 = {x: number; y: number; z: number};

/** łuk przedniej krawędzi kubka, od lewej do prawej (tak samo biegnie kabel) */
const rimPoint = (u: number): Pt => {
  const th = Math.PI - Math.PI * (u / RIM_U);
  return {x: CUP_POS.x + 84 * Math.cos(th), y: CUP_POS.y + 21 * Math.sin(th)};
};

/** obrys plamy (zaokrąglony czworobok), zgodnie ze wskazówkami zegara od lewego górnego rogu */
const outline = (q: Pt[], n: number): Pt[] => {
  const c = centroid(q);
  const w = q[1].x - q[0].x;
  const h = q[3].y - q[0].y;
  const rr = roundRectPts(c.x - w / 2, c.y - h / 2, w, h, 16, n);
  // skos plamy: góra przesunięta względem dołu
  const skew = (q[0].x - q[3].x) / 2;
  const pts = rr.map((r) => ({x: r.x + skew * ((c.y - r.y) / (h / 2)), y: r.y}));
  // start w lewym górnym rogu
  let best = 0;
  pts.forEach((r, i) => {
    if (r.x + r.y < pts[best].x + pts[best].y) best = i;
  });
  return pts.map((_, i) => pts[(i + best) % n]);
};

export const threadVisible = (f: number) => f >= T.rimToCable && f < T.portal + 40;

export const threadPoints = (f: number, cam: Cam): {pts: P3[]; to: number; opacity: number; closed: boolean} => {
  const slide = p(f, T.rimToCable + 16, T.rimToCable + 48, E.inOut);
  const lift = p(f, 326, 360, E.inOut);
  const rise = p(f, 356, 398, E.inOut);
  // nawijanie: nić owija się wokół plamy jak sznurek wokół paczki (zgodnie ze wskazówkami zegara)
  const wrap = p(f, 398, 432, E.inOutSoft);

  const patch = patchAt(f).shape;
  const ring = outline(patch, N);
  let perim = 0;
  for (let i = 1; i < N; i++) perim += Math.hypot(ring[i].x - ring[i - 1].x, ring[i].y - ring[i - 1].y);

  // fala nad stołem → na ścianie jej lewy koniec trafia w lewy górny róg plamy, a fala się prostuje
  const span = mix(520, perim, rise);
  const x0 = mix(560 - 260, ring[0].x, rise);
  const y0 = mix(1392, ring[0].y, rise);
  const z0 = mix(Z.table, Z.wall, rise);
  const amp = 34 * Math.min(1, lift * 1.5) * (1 - rise * 0.75) * (1 - wrap);

  const hole = f >= T.portal ? holeAt(f, cam) : null;
  const holeRing = hole && hole.shape.length ? resample(hole.shape, N, true) : null;
  const attached = wrap * (N - 1);

  const pts: P3[] = CABLE.map((c, i) => {
    const u = i / (N - 1);
    let pt: P3 = {x: c.x, y: c.y, z: Z.table};
    if (u <= RIM_U && slide < 1) {
      const r = rimPoint(u);
      pt = {x: mix(r.x, c.x, slide), y: mix(r.y, c.y, slide), z: Z.table};
    }
    if (lift > 0) {
      let wave: P3 = {
        x: x0 + span * u,
        y: y0 + amp * Math.sin(u * Math.PI * 6 - f / 4.2) * Math.sin(Math.PI * u),
        z: z0,
      };
      if (wrap > 0) {
        if (i <= attached) {
          wave = {x: ring[i].x, y: ring[i].y, z: Z.wall};
        } else {
          // reszta nici biegnie prosto, stycznie od miejsca, gdzie kończy się owinięcie
          const j = Math.floor(attached);
          const a = ring[j];
          const b2 = ring[Math.min(N - 1, j + 1)];
          const len = Math.hypot(b2.x - a.x, b2.y - a.y) || 1;
          const step = perim / (N - 1);
          const dist = (i - attached) * step;
          wave = {x: a.x + ((b2.x - a.x) / len) * dist, y: a.y + ((b2.y - a.y) / len) * dist, z: Z.wall};
        }
      }
      // przy odrywaniu kabel przelatuje łukiem (wolny koniec pierwszy)
      const l = Math.min(1, Math.max(0, lift * 1.4 - (1 - u) * 0.4));
      const arc = Math.sin(l * Math.PI) * 50;
      pt = {x: mix(pt.x, wave.x, l), y: mix(pt.y, wave.y, l) - arc, z: mix(pt.z, wave.z, l)};
    }
    if (holeRing) {
      const m = p(f, T.portal, T.portal + 24, E.inOut);
      const r = holeRing[i];
      pt = {x: mix(pt.x, r.x, m), y: mix(pt.y, r.y, m), z: Z.wall};
    }
    return pt;
  });
  // najpierw widać tylko łuk kubka; gdy łuk spocznie na kablu, nić = cały kabel
  const to = slide < 1 ? RIM_U * p(f, T.rimToCable, T.rimToCable + 16, E.out) : 1;
  const opacity = 1 - p(f, T.portal + 16, T.portal + 36, E.inOut);
  return {pts, to, opacity, closed: wrap > 0.995};
};

export const Thread: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
  if (!threadVisible(f)) return null;
  const {pts, to, opacity, closed} = threadPoints(f, cam);
  const i1 = Math.max(2, Math.floor(to * (N - 1)));
  const seg = pts.slice(0, i1 + 1);
  const proj = seg.map((q) => project(cam, q.z, q.x, q.y));
  // grubość linii = grubość kabla w perspektywie (6.5 jednostki warstwy)
  const mid = seg[Math.floor(seg.length / 2)];
  const w = 6.5 * proj[Math.floor(proj.length / 2)].s * ((mid.z + 600) / 1000);
  const d = toSmoothPath(
    proj.map((q) => ({x: q.x, y: q.y})),
    closed,
  );
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={d} stroke={C.teal} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      <path d={d} stroke="#8FD0DA" strokeWidth={w * 0.26} fill="none" strokeLinecap="round" opacity={opacity * 0.7} transform={`translate(${-w * 0.12} ${-w * 0.22})`} />
    </svg>
  );
};
