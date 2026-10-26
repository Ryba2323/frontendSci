// Świat 3D filmu: litery DZISIAJ?, 30 płyt dni i kamera. Wszystko jest funkcją czasu t (klatki 60 fps, ułamkowe).
import * as THREE from 'three';
import type { Font } from 'opentype.js';
import { C } from '../brand/palette';
import {
  clamp, glide, inCubic, inOutCubic, invLerp, lerp, outCubic, outQuint, rng, seg, smooth, spring, swift, bezier,
} from '../lib/math';
import { T, b, loopU } from '../timing';
import { Ana, H, Pose, SQUARE, Shape4, W, buildAnamorphic, makeStarCamera, STAR_FOV } from './layout';
import { buildLetters, DEPTH } from './letters';
import { flatMaterial, shared } from './materials';
import { makeLogoTile, makeNumberAtlas, makePoster, numRect } from './textures';
import { Tile } from './tile';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const qAxis = (x: number, y: number, z: number, a: number) => new THREE.Quaternion().setFromAxisAngle(V(x, y, z).normalize(), a);

// ---------------- Wymiary ----------------
export const TH = 0.07;          // grubość płyty (scena 1–2)
const GAP = 0.015;
const DELTA = TH + GAP;          // odstęp płyt w stosie
const P = 1.04;                  // rozstaw płyt w kolumnie
const STACK_FRONT = -1.1;        // przód liter i stosu-kropki (w układzie F)
const TILE01_Z0 = STACK_FRONT - TH / 2;
const DETACH_Z = 0;

// Układ F (sceny 1–2) → świat. Oś kolumny dni (−yF) biegnie w świecie wzdłuż −z: prosto w chmurę sceny 3.
const MF = new THREE.Matrix4().makeBasis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
MF.setPosition(0, -(0.5 + TH / 2), -6.6);
const QF = new THREE.Quaternion().setFromRotationMatrix(MF);
const fToWorld = (p: THREE.Vector3) => p.clone().applyMatrix4(MF);
const fDirToWorld = (d: THREE.Vector3) => d.clone().applyQuaternion(QF);

// ---------------- Kamera ----------------
export type Cam = { eye: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number };
const orbit = (pivot: THREE.Vector3, r: number, yaw: number, pitch: number) =>
  pivot.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(r));
const deg = Math.PI / 180;
const mixV = (a: THREE.Vector3, c: THREE.Vector3, t: number) => a.clone().lerp(c, t);
const rollUp = (eye: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3, roll: number) => {
  const f = target.clone().sub(eye).normalize();
  return up.clone().applyAxisAngle(f, roll);
};
// łagodne „uderzenie” kamery: tłumiona sinusoida
const kick = (t: number, at: number, amp: number, freq = 9, decay = 7) => {
  const x = t - at;
  if (x < 0 || x > 50) return 0;
  return amp * Math.exp(-x / decay) * Math.sin((x / 60) * freq * 2 * Math.PI);
};

const POSTER_D = 1920 / (2 * Math.tan((35 * deg) / 2)) / 880; // odległość, z której płyta 1 j. ma 880 px
const DOT_FRONT0 = V(0, 0, STACK_FRONT);
const DOT_FRONT1 = V(0, 0, DETACH_Z + TH / 2);
const LETTERS_C = V(-4.9, 5.4, STACK_FRONT - DEPTH / 2);

// Scena 1 (u ∈ [−45, 113]) i 2 (113…283) — w układzie F
const camF = (t: number, u: number): Cam => {
  if (u < 113 && (t < T.s2 || t >= T.loop)) {
    // ujemne u: końcówka filmu (kafel z logo odjeżdża), potem napis-ściana i zjazd do kropki
    const a = seg(u, -40, 24, bezier(0.6, 0, 0.2, 1));     // odjazd i obrót na bok ściany liter
    const h = seg(u, 24, 50, (x) => x);                    // krótki dryf: napis czytelny
    const d = seg(u, 50, 85, bezier(0.66, 0, 0.1, 1));     // zjazd wzdłuż liter do kropki
    // na plakacie kafel stoi nad środkiem kadru (POSTER_CY = 840 px) — przesunięcie znika przy odjeździe
    const posterShift = V(0, -(960 - 840) / 880, 0).multiplyScalar(1 - smooth(seg(u, -40, -10)));
    const pivot0 = mixV(DOT_FRONT0, V(1.1, 7.6, STACK_FRONT), smooth(seg(u, -34, 24))).add(posterShift);
    const r0 = lerp(POSTER_D, 14.2, a) - h * 1.2;
    const yaw0 = lerp(0, -50 * deg, a) + h * 5 * deg, pitch0 = lerp(0, -7 * deg, a), roll0 = lerp(0, -7 * deg, a) + h * 2 * deg;
    const pivot1 = DOT_FRONT1.clone();
    const r1 = lerp(2.75, 2.45, seg(u, 85, 113, outCubic));
    const yaw1 = 10 * deg, pitch1 = -3 * deg;
    const pivot = mixV(pivot0, pivot1, d);
    const r = lerp(r0, r1, d);
    const yaw = lerp(yaw0, yaw1, d), pitch = lerp(pitch0, pitch1, d);
    const eye = orbit(pivot, r, yaw, pitch);
    // przelot tuż przy twarzach liter
    eye.add(V(0.4, 1.4, -2.2).multiplyScalar(Math.sin(Math.PI * d)));
    const shake = kick(u, T.impact01, 0.05) + kick(u, 0, 0.035) + kick(u, T.landStep * 7, 0.03);
    eye.add(V(shake * 0.6, shake, 0));
    const roll = lerp(roll0, 0, d) + Math.sin(Math.PI * d) * 16 * deg;
    const up = rollUp(eye, pivot, V(0, 1, 0), roll);
    const fov = lerp(lerp(35, 63, a), 40, d);
    return { eye, target: pivot, up, fov };
  }
  // Scena 2: kamera zjeżdża wzdłuż kolumny razem z otwierającymi się zawiasami, potem odjazd w kontrplan od dołu
  const col = V(0, -3.12, -0.5);
  const follow = seg(t, T.s2, T.fold0 + 4, glide);
  const near = seg(t, T.s2, T.s2 + 60, outCubic);                       // blisko, za zawiasami
  const out = seg(t, T.s2 + 52, T.fold0 + 8, bezier(0.5, 0, 0.2, 1));   // odjazd: cały tydzień
  const o = seg(t, T.fold0 - 4, T.cap29 + 2, bezier(0.45, 0, 0.3, 1));   // obrót wokół kolumny
  const e = seg(t, T.cap29 - 6, T.cap30, bezier(0.6, 0, 0.1, 1));         // na oś: widok od czoła
  const pivotA = mixV(DOT_FRONT1, V(0, -3.4, -0.3), follow);
  let r = lerp(lerp(2.45, 4.6, near), 10.2, out) - o * 1.2;
  let yaw = lerp(10 * deg, 33 * deg, follow) + lerp(0, 88 * deg, o);
  let pitch = lerp(-3 * deg, 9 * deg, near) + lerp(0, -24 * deg, out) + lerp(0, 34 * deg, o);
  const top = V(0, 0.5 + TH, -0.5 - TH / 2);
  const pivot = mixV(pivotA, top, e);
  r = lerp(r, 4.6, e);
  pitch = lerp(pitch, 89.9 * deg, e);
  yaw = lerp(yaw, 180 * deg, e);
  const eye = orbit(pivot, r, yaw, pitch);
  const shake = kick(t, T.cap29, 0.025) + kick(t, T.cap30, 0.03);
  eye.add(V(shake, shake * 0.5, 0));
  const up = mixV(V(0, 1, 0), V(0, 0, -1), smooth(seg(t, T.cap29 - 6, T.cap30 - 2))).normalize();
  const fov = lerp(lerp(40, 48, out), 50, e);
  return { eye, target: pivot, up: rollUp(eye, pivot, up, Math.sin(Math.PI * o) * 8 * deg - Math.sin(Math.PI * near) * 5 * deg), fov };
};

// Scena 3+ — w świecie
const FLIGHT = [
  { t: T.explode, p: V(0, 0, -2) },
  { t: T.s3, p: V(0.45, -0.3, -7.5) },
  { t: b(14), p: V(-0.95, 0.65, -11.8) },
  { t: b(16), p: V(0.75, -0.5, -16.4) },
  { t: T.pullback - 8, p: V(-0.15, 0.2, -20.6) },
  { t: T.pullback, p: V(0, 0, -21.2) },
];
const catmull = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, s: number) => {
  const s2 = s * s, s3 = s2 * s;
  return V(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * s + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * s2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * s3),
  );
};
const flightAt = (t: number) => {
  const k = FLIGHT.findIndex((w, i) => i < FLIGHT.length - 1 && t >= w.t && t < FLIGHT[i + 1].t);
  if (k < 0) return t < FLIGHT[0].t ? FLIGHT[0].p.clone() : FLIGHT[FLIGHT.length - 1].p.clone();
  const p0 = FLIGHT[Math.max(0, k - 1)].p, p1 = FLIGHT[k].p, p2 = FLIGHT[k + 1].p, p3 = FLIGHT[Math.min(FLIGHT.length - 1, k + 2)].p;
  // ruszenie z miejsca jest powolne, potem stała prędkość
  let s = invLerp(FLIGHT[k].t, FLIGHT[k + 1].t, t);
  if (k === 0) s = s * s * (2 - s);
  return catmull(p0, p1, p2, p3, s);
};
const PULL = bezier(0.5, 0, 0.06, 1);

const camWorld = (t: number, s2end: Cam): Cam => {
  if (t < T.pullback) {
    const eye = flightAt(t);
    const ahead = flightAt(t + 14);
    const fwd = ahead.clone().sub(eye).normalize().lerp(V(0, 0, -1), 0.45).normalize();
    // wejście: płynnie od widoku z końca sceny 2
    const blend = smooth(seg(t, T.explode, T.explode + 30));
    const eye2 = mixV(s2end.eye, eye, blend);
    const target = mixV(s2end.target, eye2.clone().add(fwd.multiplyScalar(6)), blend);
    const roll = Math.sin((t - T.explode) / 38) * 11 * deg * blend;
    const up = rollUp(eye2, target, V(0, 1, 0), roll);
    const fov = lerp(s2end.fov, 74, smooth(seg(t, T.explode, T.s3)));
    return { eye: eye2, target, up, fov };
  }
  if (t < T.still + 2) {
    // gwałtowny odjazd do punktu C* z dolly-zoomem
    const p = seg(t, T.pullback, T.lock, PULL);
    const start = flightAt(T.pullback);
    const eye = mixV(start, V(0, 0, 0), p);
    const target = eye.clone().add(V(0, 0, -6));
    const fov = lerp(74, STAR_FOV, seg(t, T.pullback, T.lock, bezier(0.3, 0, 0.1, 1)));
    const breath = kick(t, T.lock, 0.004, 3, 10);
    eye.z += breath;
    return { eye, target, up: V(0, 1, 0), fov };
  }
  // Scena 4–5: iluzja się rozpada — kamera odpływa po łuku (paralaksa)
  const p = seg(t, T.still, T.morph + 60, bezier(0.5, 0, 0.35, 1));
  const pivot = V(0, 0, -15);
  const eye = orbit(pivot, 15, lerp(0, -24 * deg, p), lerp(0, 7 * deg, p));
  eye.x += lerp(0, -1.2, p);
  const target = mixV(pivot, V(-2.5, 0.5, -15), p);
  return { eye, target, up: rollUp(eye, target, V(0, 1, 0), lerp(0, 3 * deg, p)), fov: lerp(STAR_FOV, 46, p) };
};

export const cameraAt = (t: number): Cam => {
  const u = loopU(t);
  if (t < T.explode || t >= T.loop) {
    const c = camF(t, u);
    return { eye: fToWorld(c.eye), target: fToWorld(c.target), up: fDirToWorld(c.up), fov: c.fov };
  }
  const e = camF(T.explode, T.explode);
  const s2end = { eye: fToWorld(e.eye), target: fToWorld(e.target), up: fDirToWorld(e.up), fov: e.fov };
  return camWorld(t, s2end);
};

// ---------------- Choreografia płyt ----------------
const poseLerp = (a: Pose, c: Pose, t: number, path?: THREE.Vector3): Pose => {
  let pos: THREE.Vector3;
  if (path) {
    // kwadratowa Béziera przez punkt kontrolny
    const u = 1 - t;
    pos = a.pos.clone().multiplyScalar(u * u).add(path.clone().multiplyScalar(2 * u * t)).add(c.pos.clone().multiplyScalar(t * t));
  } else pos = a.pos.clone().lerp(c.pos, t);
  return {
    pos,
    quat: a.quat.clone().slerp(c.quat, t),
    shape: a.shape.map((p, k) => [lerp(p[0], c.shape[k][0], t), lerp(p[1], c.shape[k][1], t)]) as Shape4,
    th: lerp(a.th, c.th, t),
  };
};
const matToPose = (m: THREE.Matrix4, shape: Shape4 = SQUARE, th = TH): Pose => {
  const pos = V(), quat = Q(), sc = V();
  m.decompose(pos, quat, sc);
  return { pos, quat, shape, th };
};
const T3 = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = (a: number) => new THREE.Matrix4().makeRotationX(a);
const RY = (a: number) => new THREE.Matrix4().makeRotationY(a);

// Stan sceny 1–2 dla wszystkich płyt (układ F). Zwraca macierze.
const scene12 = (t: number, u: number) => {
  // płyta 01: oderwanie i obrót
  const det = seg(u, T.detach, T.detach + 16, swift);
  const spinP = seg(u, T.detach + 10, T.impact01, bezier(0.5, 0, 0.0, 1.0));
  const spin = spinP * Math.PI * 2 + (u > T.impact01 ? Math.sin((u - T.impact01) / 3) * Math.exp(-(u - T.impact01) / 6) * 0.05 : 0);
  const tilt = Math.sin(Math.PI * det) * 0.25;
  const base = T3(0, 0, lerp(TILE01_Z0, DETACH_Z, det)).multiply(RX(-tilt)).multiply(RY(spin));
  const M: THREE.Matrix4[] = [base];
  // harmonijka: 6 zawiasów
  for (let j = 1; j < 7; j++) {
    const s = j % 2 === 1 ? -1 : 1;
    const hz = (s * DELTA) / 2;
    const at = T.hinge0 + (j - 1) * T.hingeStep;
    const open = u >= at ? spring(u - at, 2.4, 0.62) : 0;
    const theta = -s * Math.PI * (1 - open);
    M.push(M[j - 1].clone().multiply(T3(0, -P / 2, hz)).multiply(RX(theta)).multiply(T3(0, -P / 2, -hz)));
  }
  // tygodnie 2–4: płyty odklejają się i zaginają w pudełko (zawias na prawej krawędzi poprzedniego rzędu)
  const rows: THREE.Matrix4[][] = [M];
  const foldP: number[] = [];
  for (let r = 1; r < 4; r++) {
    const at = T.fold0 + (r - 1) * T.foldStep;
    const row: THREE.Matrix4[] = [];
    for (let j = 0; j < 7; j++) {
      const tj = u - at - j * 1.1;
      const f = tj > 0 ? spring(tj, 2.1, 0.7) : 0;
      if (j === 0) foldP.push(f);
      const phi = -Math.PI / 2 * f;
      const h = V(0.5 + GAP / 2, 0, -TH / 2);
      row.push(rows[r - 1][j].clone()
        .multiply(T3(h.x, h.y, h.z)).multiply(RY(phi)).multiply(T3(-h.x, -h.y, -h.z))
        .multiply(T3(0, 0, -TH - GAP * 0.5)).multiply(RY(Math.PI)));
    }
    rows.push(row);
  }
  // wieczka: 29 od dołu, 30 z boku
  const cap = (at: number, final: THREE.Matrix4, from: THREE.Vector3, spinAxis: THREE.Vector3, spinA: number) => {
    const p = seg(u, at - 22, at, bezier(0.35, 0, 0.12, 1));
    const settle = u > at ? kick(u, at, 0.05, 6, 5) : 0;
    const fp = V(), fq = Q(), fs = V();
    final.decompose(fp, fq, fs);
    const pos = from.clone().lerp(fp, p).add(V(0, 0, 0).addScaledVector(fp.clone().sub(from).normalize(), settle));
    const q = new THREE.Quaternion().setFromAxisAngle(spinAxis, spinA * (1 - p)).multiply(fq);
    return new THREE.Matrix4().compose(pos, q, V(1, 1, 1));
  };
  const zc = -0.5 - TH / 2 - GAP;
  const cap29F = new THREE.Matrix4().compose(V(0, -6 * P - 0.5 - TH / 2 - GAP, zc), qAxis(1, 0, 0, Math.PI / 2), V(1, 1, 1));
  const cap30F = new THREE.Matrix4().compose(V(0, 0.5 + TH / 2 + GAP, zc), qAxis(1, 0, 0, -Math.PI / 2), V(1, 1, 1));
  const m29 = cap(T.cap29, cap29F, V(0.4, -20, zc - 1), V(0, 1, 0), 3.4);
  const m30 = cap(T.cap30, cap30F, V(11, 3.5, zc + 1), V(0.3, 0, 1).normalize(), -2.6);
  return { rows, m29, m30, foldP };
};

// ---------------- Świat ----------------
export class World {
  scene = new THREE.Scene();
  tiles: Tile[] = [];
  ana: Ana[];
  letters: { mesh: THREE.Mesh; final: THREE.Vector3; order: number; start: THREE.Vector3; axis: THREE.Vector3; angle: number }[] = [];
  starCam = makeStarCamera();
  private letterFace = flatMaterial(C.ivory, 0.18, 0.86, 0.3);
  private letterSide = flatMaterial('#2A6874', 0.35, 0.55, 0.6);

  constructor(font: Font, logo: HTMLImageElement) {
    const numTex = makeNumberAtlas();
    const poster = makePoster();
    const logoTex = makeLogoTile(logo);
    shared.uStarVP.value.multiplyMatrices(this.starCam.projectionMatrix, this.starCam.matrixWorldInverse);
    this.ana = buildAnamorphic(this.starCam);
    this.clearFlightPath();
    for (let i = 0; i < 30; i++) {
      const tile = new Tile(numTex, numRect(i), poster, logoTex, this.ana[i].frontWorld);
      this.tiles.push(tile);
      this.scene.add(tile.mesh);
    }
    // litery
    const { defs } = buildLetters(font);
    const order = ['?', 'J', 'A', 'I2', 'S', 'I1', 'Z', 'D'];
    let iCount = 0;
    const r = rng(7);
    defs.forEach((d) => {
      const key = d.ch === 'I' ? `I${++iCount}` : d.ch;
      const mesh = new THREE.Mesh(d.geo, [this.letterFace, this.letterSide]);
      mesh.frustumCulled = false;
      const final = fToWorld(V(d.center.x, d.center.y, STACK_FRONT - DEPTH + d.center.z));
      const k = order.indexOf(key);
      // start: rozsadzony pierścień wokół ściany liter — litery zbiegają się z krawędzi kadru, nie przez obiektyw
      const dir = V(d.center.x - 1.1, d.center.y - 7.4, 0);
      if (dir.lengthSq() < 0.5) dir.set(1, 0.4, 0);
      dir.normalize();
      const startF = V(d.center.x + dir.x * (9 + r() * 3), d.center.y + dir.y * (8 + r() * 3), 5.5 + k * 0.9 + r() * 1.5);
      this.letters.push({ mesh, final, order: k, start: fToWorld(startF), axis: V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), angle: (1.2 + r()) * (r() < 0.5 ? -1 : 1) });
      this.scene.add(mesh);
    });
  }

  // Rozproszenie: każdy dzień dostaje chwilę, w której kamera przelatuje obok niego — płyty mijają kamerę
  // co ~5 klatek, tuż obok trasy (a nie w całej piramidzie widoku), więc przelot jest gęsty jak architektura.
  private clearFlightPath() {
    const r = rng(11);
    // czas, w którym kamera mija daną głębokość
    const tauAt = (z: number) => {
      let best = T.s3, bd = Infinity;
      for (let t = T.explode + 10; t <= T.pullback; t += 1) { const d = Math.abs(flightAt(t).z - z); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    this.ana.forEach((a, k) => {
      if (a.depth > 22) {
        // daleka „ściana”: duże płyty ściśnięte do osi przelotu; przy zatrzaskiwaniu rozjeżdżają się na swoje miejsca
        const fp = a.final.pos;
        a.scatterOffset = V(-fp.x * 0.62, -fp.y * 0.62, 0).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(a.size * 0.5));
        (a as any).grow = 1;
        return;
      }
      const tau = tauAt(-a.depth + 1.2);
      const p = flightAt(tau);
      const dir = flightAt(tau + 4).sub(flightAt(tau - 4)).normalize();
      const side = V(1, 0, 0).sub(dir.clone().multiplyScalar(dir.x)).normalize();
      const up = V().crossVectors(dir, side).normalize();
      const ang = k * 2.39996 + r() * 0.6;
      const rad = 1.0 + r() * 1.0;
      const target = p.clone().add(side.multiplyScalar(Math.cos(ang) * rad)).add(up.multiplyScalar(Math.sin(ang) * rad * 1.3)).add(dir.multiplyScalar(-0.6 - r()));
      a.scatterOffset = target.sub(a.final.pos);
      (a as any).grow = Math.max(1, (0.9 + r() * 0.45) / a.size);
    });
  }

  // rozproszona płyta: pozycja końcowa + obrót wokół własnego środka, malejący do zera przy zatrzaśnięciu
  private scatterPose(i: number, t: number): Pose {
    const a = this.ana[i];
    const lockStart = T.pullback - 4 + i * 0.35;
    const lockEnd = T.lock - (29 - i) * 0.95;
    const l = seg(t, lockStart, lockEnd, bezier(0.6, 0, 0.15, 1));
    const k = 1 - l;
    // rytm: na każde uderzenie lekki „kopniak” obrotu
    let beatKick = 0;
    for (let n = 12; n < 18; n++) beatKick += kick(t, b(n), 0.09, 2.5, 9) * (i % 2 ? 1 : -1);
    const drift = Math.sin(t / 47 + i * 1.7) * 0.25;
    const ang = (a.scatterAngle + drift + beatKick) * k;
    const rot = new THREE.Quaternion().setFromAxisAngle(a.scatterAxis, ang);
    const e = k * k * (3 - 2 * k);
    const pos = a.final.pos.clone().add(a.scatterOffset.clone().multiplyScalar(e));
    const g = lerp(1, (a as any).grow ?? 1, e);
    const shape = a.final.shape.map(([x, y]) => [x * g, y * g]) as Shape4;
    return { pos, quat: rot.multiply(a.final.quat.clone()), shape, th: a.final.th * g };
  }

  // poza płyty dnia i w czasie t (w świecie) + parametry wyglądu
  tileState(i: number, t: number) {
    const u = loopU(t);
    const inS12 = t < T.explode + 60 || t >= T.loop;
    let pose: Pose | null = null;
    let visible = true;
    let logo = 0, posterMix = 0, lit = 1, tintMix = 0;
    if (inS12) {
      const { rows, m29, m30 } = scene12(t, u);
      const row = Math.floor(i / 7), j = i % 7;
      const m = i < 28 ? rows[row][j] : i === 28 ? m29 : m30;
      pose = matToPose(MF.clone().multiply(m));
      if (i === 0) logo = u < T.detach + 10 + (T.impact01 - T.detach - 10) * 0.5 ? 1 : 0;
      if (i >= 7 && i < 28) visible = u > T.fold0 + (row - 1) * T.foldStep - 2 && t < T.loop;
      if (i >= 28) visible = u > (i === 28 ? T.cap29 : T.cap30) - 24 && t < T.loop;
      // na pętli: płyta 01 to kafel z logo, w pełni płaski kolor (zgodny z HTML)
      if (t >= T.loop) lit = i === 0 ? lerp(0, 1, seg(u, -40, -10, smooth)) : 1;
      if (t >= T.loop && i > 6) visible = false;
    }
    if (t >= T.explode && t < T.loop) {
      // wybuch: od dołu kolumny (najbliżej kamery) w głąb
      const rank = i === 29 ? 0 : i === 28 ? 29 : Math.floor(i / 7) * 0.4 + (i % 7) * 3.6 + 1;
      const e0 = T.explode + rank * 0.85;
      const p = seg(t, e0, e0 + 48, bezier(0.3, 0.0, 0.1, 1));
      const sc = this.scatterPose(i, t);
      if (p >= 1 || t > T.explode + 60) pose = sc;
      else {
        const a = pose!;
        const out = a.pos.clone().sub(V(0, 0, a.pos.z)).normalize().multiplyScalar(3 + rank * 0.05);
        const ctrl = a.pos.clone().add(out).add(V(0, 0, -2.5));
        pose = poseLerp(a, sc, p, ctrl);
      }
      posterMix = seg(t, e0 + 6, e0 + 34, smooth);
      lit = lerp(1, 0.9, posterMix);
      // przy zatrzaśnięciu płyty prawie płaskie — iluzja ma być bez szwów
      lit = lerp(lit, 0.12, seg(t, T.lock - 30, T.lock, smooth));
      lit = lerp(lit, 0.7, seg(t, T.still, T.still + 60, smooth));
      // Scena 4: dzień 30 wylatuje do kamery i odwraca się — jego tył staje się kartą
      if (i === 29 && t >= T.lift30) {
        const p2 = seg(t, T.lift30, T.card, bezier(0.55, 0, 0.12, 1));
        const card = this.cardPose(t);
        const from = this.scatterPose(29, t);
        const ctrl = from.pos.clone().lerp(card.pos, 0.5).add(V(3.2, 1.5, 0));
        pose = poseLerp(from, card, p2, ctrl);
        lit = lerp(0.7, 0, seg(t, T.card - 18, T.card - 2, smooth));
        visible = t < T.card + 1;
      }
    }
    return { pose: pose!, visible, logo, posterMix, lit, tintMix };
  }

  // prostokąt karty (HTML) odwrócony do kamery — w tym miejscu tył płyty 30 zamienia się w kartę
  cardPose(t: number): Pose {
    const c = cameraAt(t);
    const cam = new THREE.PerspectiveCamera(c.fov, W / H, 0.05, 400);
    cam.position.copy(c.eye);
    cam.up.copy(c.up);
    cam.lookAt(c.target);
    cam.updateMatrixWorld(true);
    const D = 4;
    const unit = (2 * D * Math.tan((c.fov * deg) / 2)) / H; // jednostki świata na piksel
    const r = CARD_RECT;
    const cx = (r.x + r.w / 2 - W / 2) * unit, cy = -(r.y + r.h / 2 - H / 2) * unit;
    const pos = V(cx, cy, -D).applyMatrix4(cam.matrixWorld);
    const quat = cam.quaternion.clone().multiply(qAxis(0, 1, 0, Math.PI));
    const hw = (r.w / 2) * unit, hh = (r.h / 2) * unit;
    // płyta odwrócona: lokalne x jest lustrzane względem ekranu
    const shape: Shape4 = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    return { pos: pos.add(V(0, 0, 0)), quat, shape, th: 0.02 };
  }

  update(t: number, camera: THREE.PerspectiveCamera) {
    const u = loopU(t);
    const c = cameraAt(t);
    camera.position.copy(c.eye);
    camera.up.copy(c.up);
    camera.lookAt(c.target);
    camera.fov = c.fov;
    camera.near = 0.05;
    camera.far = 400;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    shared.uCamPos.value.copy(c.eye);
    // światło związane z kamerą: z lewej, z góry, od przodu
    const e = camera.matrixWorld.elements;
    const right = V(e[0], e[1], e[2]), up = V(e[4], e[5], e[6]), back = V(e[8], e[9], e[10]);
    shared.uLightDir.value.copy(right.clone().multiplyScalar(-0.5).add(up.clone().multiplyScalar(0.75)).add(back.clone().multiplyScalar(0.55)).normalize());
    shared.uFillDir.value.copy(right.clone().multiplyScalar(0.7).add(up.clone().multiplyScalar(-0.35)).add(back.clone().multiplyScalar(-0.2)).normalize());
    // mgła: głębia sceny, przy odsłonięciu całkiem wyłączona
    const fogA = t < T.explode || t >= T.loop ? [16, 48] : [20, 60];
    const off = seg(t, T.pullback, T.lock - 10, smooth) * (1 - seg(t, T.still + 30, T.lift30 + 30, smooth) * 0.5);
    shared.uFog.value.set(lerp(fogA[0], 80, off), lerp(fogA[1], 200, off));
    // przyciemnienie świata pod kartą i logo
    shared.uGlobalDim.value = t >= T.loop ? 0 : clamp(seg(t, T.card - 30, T.card + 20, smooth) * 0.72 + seg(t, T.morph, T.morph + 40, smooth) * 0.28);

    for (let i = 0; i < 30; i++) {
      const s = this.tileState(i, t);
      const tile = this.tiles[i];
      tile.mesh.visible = s.visible;
      if (!s.visible) continue;
      tile.mesh.position.copy(s.pose.pos);
      tile.mesh.quaternion.copy(s.pose.quat);
      tile.setShape(s.pose.shape, s.pose.th);
      tile.face.uniforms.uLogo.value = s.logo;
      tile.face.uniforms.uPosterMix.value = s.posterMix;
      tile.face.uniforms.uTintMix.value = s.tintMix;
      tile.setLit(s.lit, i === 29 && t > T.lift30 ? s.lit : Math.max(s.lit, 0.6));
      // dzień 30 leci do kamery ponad przyciemnionym światem — on sam nie gaśnie (jego tył staje się kartą)
      tile.setDim(i === 29 && t > T.lift30 ? -shared.uGlobalDim.value : 0);
    }
    // litery: przylot zza kamery (u < 60), potem odpływają w przeszłość
    for (const L of this.letters) {
      const land = T.landFirst + L.order * T.landStep;
      const p = seg(u, land - 22, land, bezier(0.3, 0.05, 0.3, 1));
      const settle = kick(u, land, 0.12, 5, 6);
      const away = seg(u, T.impact01 + 20, T.s2 + 160, inCubic);
      const vis = u > land - 22 && u < 300;
      L.mesh.visible = vis;
      if (!vis) continue;
      const pos = L.start.clone().lerp(L.final, p);
      pos.add(fDirToWorld(V(0, 0, -settle)));
      pos.add(fDirToWorld(V(0, -away * 8, -away * 40)));
      L.mesh.position.copy(pos);
      L.mesh.quaternion.copy(QF).multiply(new THREE.Quaternion().setFromAxisAngle(L.axis, L.angle * (1 - p) * (1 - p)));
    }
    this.letterFace.uniforms.uLit.value = 1;
  }
}

// Prostokąt karty w kadrze (px) — wspólny dla 3D i nakładki HTML
export const CARD_SCALE = 988 / 335;
export const CARD_RECT = { x: 46, y: 780, w: 988, h: 207.921875 * CARD_SCALE };
