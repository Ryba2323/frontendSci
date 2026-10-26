/*
 * Kamera 2.5D: płaskie warstwy świata ustawione na różnych głębokościach (prawdziwa perspektywa,
 * więc paralaksa wynika z ruchu kamery, a nie z ręcznie dobranych współczynników).
 *
 * Każda warstwa jest rysowana we „współrzędnych kadru końcowego” (R): przy kamerze R każda warstwa
 * ma skalę 1 i to, co narysowane w punkcie (x, y), widać dokładnie w (x, y) ekranu 1080 × 1920.
 * Kamera R stoi w (0, 0, -600), ogniskowa F = 1000.
 */
import {Easing} from 'remotion';
import {T} from '../timeline';
import {E, mix} from '../lib/anim';

export const F = 1000;
export const CZ_R = -600;

export const Z = {
  table: 1000,
  wall: 1400,
  tram: 2300,
  cafe: 2900,
  city: 4500,
  sky: 30000,
} as const;

export type Cam = {x: number; y: number; z: number};

/** punkt warstwy (współrzędne kadru R) → świat */
export const toWorld = (z: number, px: number, py: number) => ({
  x: ((px - 540) * (z - CZ_R)) / F,
  y: ((py - 960) * (z - CZ_R)) / F,
});

/** rzut punktu warstwy na ekran dla danej kamery */
export const project = (cam: Cam, z: number, px: number, py: number) => {
  const w = toWorld(z, px, py);
  const s = F / (z - cam.z);
  return {x: 540 + (w.x - cam.x) * s, y: 960 + (w.y - cam.y) * s, s};
};

/** skala warstwy i przesunięcie (ekran = k · P + b) */
export const planeTransform = (cam: Cam, z: number) => {
  const d = z - cam.z;
  const k = (z - CZ_R) / d;
  return {k, bx: 540 - 540 * k - (cam.x * F) / d, by: 960 - 960 * k - (cam.y * F) / d, d};
};

/** kamera, która ma punkt (px, py) warstwy z w środku kadru, a warstwa ma skalę k */
export const lookAt = (z: number, px: number, py: number, k: number): Cam => {
  const w = toWorld(z, px, py);
  return {x: w.x, y: w.y, z: z - (z - CZ_R) / k};
};

type Key = {f: number; cam: Cam; ease?: (t: number) => number; refZ?: number};

const CUP = {x: 392, y: 1372};

// klucze kamery (ruch między kluczami: xy z krzywą, głębokość w skali logarytmicznej odległości)
const KEYS: Key[] = [
  {f: 0, cam: lookAt(Z.table, 548, 1500, 1.62)},
  {f: T.cupDown, cam: lookAt(Z.table, 520, 1478, 1.74), ease: Easing.bezier(0.3, 0, 0.6, 1)},
  // kubek stanął, kropla podskakuje — kamera spokojnie dojeżdża bliżej
  {f: T.freeze, cam: lookAt(Z.table, 452, 1376, 2.3), ease: Easing.bezier(0.4, 0, 0.3, 1)},
  {f: T.rewind, cam: lookAt(Z.table, 448, 1370, 2.38), ease: E.linear},
  // nurkowanie za kroplą do kubka
  {f: T.diveEnd, cam: lookAt(Z.table, CUP.x + 20, CUP.y + 6, 3.9), ease: Easing.bezier(0.55, 0, 0.25, 1), refZ: Z.table},
  // wzdłuż krawędzi kubka i kabla
  {f: 330, cam: lookAt(Z.table, 610, 1440, 3.0), ease: E.inOut, refZ: Z.table},
  // fala unosi się nad stołem
  {f: 356, cam: lookAt(Z.table, 560, 1400, 2.5), ease: E.inOut, refZ: Z.table},
  // w górę za falą, na ścianę do plamy światła
  {f: 412, cam: lookAt(Z.wall, 124, 1104, 2.9), ease: E.inOut, refZ: Z.wall},
  {f: T.portal, cam: lookAt(Z.wall, 112, 1112, 3.25), ease: E.linear, refZ: Z.wall},
  // przez plamę światła — do okna tramwaju
  // kamera przelatuje przez płaszczyznę ściany (z > 1400) — jesteśmy na ulicy
  {f: T.tram, cam: lookAt(Z.tram, 245, 1065, 3.45), ease: Easing.bezier(0.5, 0, 0.2, 1), refZ: Z.tram},
  {f: T.tramLeaves + 16, cam: lookAt(Z.tram, 248, 1063, 3.58), ease: E.linear, refZ: Z.tram},
  // za przechodniem do drzwi kawiarni
  {f: T.meet, cam: lookAt(Z.cafe, 690, 826, 2.55), ease: E.inOut, refZ: Z.cafe},
  {f: T.pullBack, cam: lookAt(Z.cafe, 694, 824, 2.62), ease: E.linear, refZ: Z.cafe},
  // odjazd: przez okno pokoju z powrotem do kadru R
  {f: T.pullBackEnd, cam: {x: 0, y: 0, z: CZ_R}, ease: Easing.bezier(0.45, 0, 0.12, 1), refZ: Z.cafe},
  {f: T.toNotebook, cam: lookAt(Z.table, 540, 968, 1.012), ease: E.linear, refZ: Z.table},
  // do notesu na stole
  {f: 962, cam: lookAt(Z.table, 570, 1772, 3.3), ease: Easing.bezier(0.42, 0, 0.18, 1), refZ: Z.table},
];

/**
 * Tramwaj: w portalu stoi (okno musi trafić w plamę światła), potem rusza w prawo, a kamera jedzie razem z nim —
 * ulica przesuwa się w tle. Od T.tramLeaves kamera zostaje, a tramwaj przyspiesza i odsłania kawiarnię.
 */
const RIDE_START = T.portal + 48;
const rideDx = (f: number) => {
  const t = Math.max(0, Math.min(f, T.tramLeaves + 6) - RIDE_START);
  // łagodny start (pierwsze 40 klatek), potem stała prędkość
  return t < 40 ? (3.2 * t * t) / 80 : 3.2 * (t - 20);
};
export const tramDx = (f: number) => rideDx(f) + (f > T.tramLeaves + 6 ? 3200 * E.in(Math.min(1, (f - T.tramLeaves - 6) / 100)) : 0);

/** kamera jedzie z tramwajem, potem przesunięcie płynnie znika (kamera przejmuje klucze do kawiarni) */
const rideOffset = (f: number) => {
  const dx = rideDx(f) * ((Z.tram - CZ_R) / F);
  const release = f <= T.tramLeaves + 16 ? 0 : E.inOut(Math.min(1, (f - T.tramLeaves - 16) / (T.meet - T.tramLeaves - 16)));
  return dx * (1 - release);
};

export const cameraAt = (f: number): Cam => {
  const c = cameraKeys(f);
  return f > RIDE_START ? {...c, x: c.x + rideOffset(f)} : c;
};

const cameraKeys = (f: number): Cam => {
  if (f <= KEYS[0].f) return KEYS[0].cam;
  for (let i = 1; i < KEYS.length; i++) {
    const a = KEYS[i - 1];
    const b = KEYS[i];
    if (f <= b.f) {
      const t = (b.ease ?? E.inOut)((f - a.f) / (b.f - a.f));
      const rz = Math.max(b.refZ ?? Z.table, a.cam.z + 50, b.cam.z + 50);
      // głębokość: interpolacja logarytmu odległości od warstwy odniesienia → równe tempo „zoomu”
      const da = Math.log(rz - a.cam.z);
      const db = Math.log(rz - b.cam.z);
      return {x: mix(a.cam.x, b.cam.x, t), y: mix(a.cam.y, b.cam.y, t), z: rz - Math.exp(mix(da, db, t))};
    }
  }
  return KEYS[KEYS.length - 1].cam;
};

export const CUP_POS = CUP;
