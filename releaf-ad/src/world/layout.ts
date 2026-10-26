// Układ przestrzeni: siatka miesiąca (plakat) i anamorficzne płyty dni.
import * as THREE from 'three';
import { rng } from '../lib/math';

export const W = 1080;
export const H = 1920;

// ---------- Plakat widziany z jednego punktu: 30 dni = siatka 5 × 6 ----------
export const GRID = (() => {
  const cols = 5, rows = 6, gap = 14, mx = 60;
  const cell = (W - 2 * mx - (cols - 1) * gap) / cols;
  const gh = rows * cell + (rows - 1) * gap;
  const top = (H - gh) / 2;
  return { cols, rows, gap, mx, cell, top, gh };
})();
export const cellRect = (i: number) => {
  const c = i % GRID.cols, r = Math.floor(i / GRID.cols);
  return { x: GRID.mx + c * (GRID.cell + GRID.gap), y: GRID.top + r * (GRID.cell + GRID.gap), w: GRID.cell, h: GRID.cell };
};

// ---------- Kamera „jedynego punktu” (C*) ----------
export const STAR_FOV = 40;
export const makeStarCamera = () => {
  const cam = new THREE.PerspectiveCamera(STAR_FOV, W / H, 0.05, 400);
  cam.position.set(0, 0, 0);
  cam.lookAt(0, 0, -1);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

const pxToRay = (cam: THREE.PerspectiveCamera, x: number, y: number) => {
  const v = new THREE.Vector3((x / W) * 2 - 1, 1 - (y / H) * 2, 0.5).unproject(cam);
  return v.sub(cam.position).normalize();
};

export type Shape4 = [number, number][]; // 4 narożniki w płaszczyźnie płyty: lewy-dół, prawy-dół, prawy-góra, lewy-góra
export type Pose = { pos: THREE.Vector3; quat: THREE.Quaternion; shape: Shape4; th: number };
export const SQUARE: Shape4 = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

export type Ana = {
  final: Pose;              // płyta zgrana z plakatem (z C* wygląda jak idealny kwadrat siatki)
  frontWorld: THREE.Vector3[]; // narożniki przedniej ściany w świecie (do mapowania projekcyjnego)
  size: number;             // przybliżony rozmiar fizyczny
  depth: number;
  scatterAxis: THREE.Vector3;
  scatterAngle: number;
  scatterOffset: THREE.Vector3;
  order: number;            // kolejność zatrzaskiwania
};

// Każda płyta leży na innej głębokości i pod innym kątem. Jej kształt to rzut komórki siatki na tę płaszczyznę —
// nieregularny czworokąt, który tylko z punktu C* staje się prostokątem.
export const buildAnamorphic = (cam: THREE.PerspectiveCamera): Ana[] => {
  const r = rng(30);
  const out: Ana[] = [];
  for (let i = 0; i < 30; i++) {
    const rc = cellRect(i);
    // głębokość: rozkład logarytmiczny 7…34, z lekką strukturą (dni z tego samego tygodnia nie leżą obok siebie)
    const q = Math.pow((i * 0.618034 + 0.11 + r() * 0.08) % 1, 0.8);
    const depth = 6.5 * Math.exp(q * Math.log(40 / 6.5));
    const center = pxToRay(cam, rc.x + rc.w / 2, rc.y + rc.h / 2);
    const pc = center.clone().multiplyScalar(depth / -center.z);
    // nachylenie płaszczyzny
    let n = new THREE.Vector3();
    for (let k = 0; k < 20; k++) {
      const yaw = (r() * 2 - 1) * 0.95, pitch = (r() * 2 - 1) * 0.75;
      n.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
      if (n.dot(center.clone().negate()) > 0.5) break;
    }
    const corners = [
      [rc.x, rc.y + rc.h], [rc.x + rc.w, rc.y + rc.h], [rc.x + rc.w, rc.y], [rc.x, rc.y],
    ].map(([x, y]) => {
      const d = pxToRay(cam, x, y);
      return d.multiplyScalar(pc.dot(n) / d.dot(n));
    });
    const xAxis = new THREE.Vector3(1, 0, 0).sub(n.clone().multiplyScalar(n.x)).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, n);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    const shape = corners.map((q) => {
      const d = q.clone().sub(pc);
      return [d.dot(xAxis), d.dot(yAxis)] as [number, number];
    });
    const size = corners[0].distanceTo(corners[2]) / Math.SQRT2;
    const th = size * 0.07;
    const axis = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    const off = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, (r() * 2 - 1) * 0.6).normalize().multiplyScalar(size * (0.6 + r() * 1.4));
    out.push({
      final: { pos: pc.clone().sub(n.clone().multiplyScalar(th / 2)), quat, shape, th },
      frontWorld: corners,
      size,
      depth,
      scatterAxis: axis,
      scatterAngle: (0.5 + r() * 0.8) * (r() < 0.5 ? -1 : 1),
      scatterOffset: off,
      order: i,
    });
  }
  return out;
};
