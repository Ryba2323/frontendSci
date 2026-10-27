// Cała choreografia pętli w jednym miejscu: kamera, rozwarstwienie paseczków, cień.
// Czyste funkcje od numeru klatki — używa ich animacja i skrypt dźwięku (scripts/export-motion.ts).

export const FPS = 60;
export const DURATION = 660; // 11 s, 16 ćwierćnut w tempie 87,27 BPM
export const BEAT = DURATION / 16; // 41,25 klatki

// Najważniejsze chwile (klatki)
export const SNAP = 8 * BEAT; // 330: kamera przechodzi przez jedyny kąt, z którego paseczki składają się w logo
export const LOCK = SNAP + 30; // sprężyna kamery całkiem wygasła
export const LAND_START = LOCK + 2; // paseczki opadają na powierzchnię (góra → dół)
export const LAND_SPREAD = 34; // opóźnienie między pierwszym a ostatnim paseczkiem
export const LAND_LEN = 34;
export const HOLD_END = 500; // logo leży płasko, potem się unosi i rozplata
export const LIFT_SPREAD = 30;
export const LIFT_LEN = 84;

// ---------------------------------------------------------------
// Logo i paseczki
// ---------------------------------------------------------------
export const LOGO_PX = 1254; // oryginalny plik jest kwadratem
export const CONTENT_TOP = 224; // obrys znaku w pliku (alfa > 8)
export const CONTENT_BOTTOM = 1074;
export const CONTENT_CENTER_Y = (CONTENT_TOP + CONTENT_BOTTOM) / 2;
export const SLAT_SRC = 9;
export const TEXT_TOP = 908; // poniżej tej linii w pliku jest już tylko napis „ReLeaf” // wysokość paseczka w pikselach pliku
export const SLAT_COUNT = Math.ceil((CONTENT_BOTTOM - CONTENT_TOP) / SLAT_SRC);

export const PERSPECTIVE = 2800;
export const PIVOT_Z = 760; // kamera krąży wokół środka rzeźby, nie wokół ściany

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Głębokość paseczka, gdy rzeźba jest rozwinięta.
 * Parzyste i nieparzyste paseczki leżą na dwóch lustrzanych falach — z boku wyglądają jak
 * dwie splecione łodygi (podwójna spirala), z przodu jak jedno, całe logo.
 */
export const slatDepth = (i: number) => {
  const s = i / (SLAT_COUNT - 1);
  const wave = Math.sin(Math.PI * 2 * (0.82 * s) + 0.35);
  const drift = 0.35 * Math.sin(Math.PI * 2 * (1.9 * s) + 1.1);
  const amp = 380 + 200 * s; // napis na dole rozsypany mocniej — składa się jako ostatni
  const strand = i % 2 === 0 ? 1 : -1;
  // paseczki napisu rozrzucamy mocniej i nieregularnie (złoty kąt), żeby z ukosa nie dało się odczytać liter
  const isText = CONTENT_TOP + i * SLAT_SRC > TEXT_TOP;
  const jitter = isText
    ? 300 * Math.sin(i * 2.399 + 0.7)
    : 40 * Math.sin(i * 2.399);
  return PIVOT_Z + strand * amp * (wave + drift * 0.5) + jitter;
};

// ---------------------------------------------------------------
// Kamera: obrót Y, obrót X, przechył (stopnie) i przybliżenie
// ---------------------------------------------------------------
type Key = { f: number; v: number[]; hold?: boolean };

// Klucze w obrębie pętli (klatki), czytane cyklicznie
const CAMERA_KEYS: Key[] = [
  { f: 60, v: [-34, 66, -8, 0.8] },
  { f: 140, v: [10, 72, 0, 0.79] },
  { f: 210, v: [38, 48, 8, 0.83] },
  { f: 262, v: [30, 18, 6, 0.9] },
  { f: 302, v: [18, 8, 3, 0.94] },
  // APPROACH_FROM → LOCK: sprężyna (dojazd), patrz camera()
  { f: LOCK, v: [0, 0, 0, 1], hold: true },
  { f: HOLD_END + 18, v: [0, 0, 0, 1.035], hold: true }, // kamera rusza chwilę po tym, jak napis się uniesie
  { f: 588, v: [6, 26, 2, 0.97] },
  { f: 650, v: [-16, 54, -4, 0.85] },
];

const hermite = (
  p0: number,
  m0: number,
  p1: number,
  m1: number,
  t: number,
  len: number,
) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * m0 * len +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * m1 * len
  );
};

const keyAt = (k: number): Key => {
  const n = CAMERA_KEYS.length;
  const wrap = Math.floor(k / n);
  const key = CAMERA_KEYS[((k % n) + n) % n];
  return { ...key, f: key.f + wrap * DURATION };
};

const tangent = (k: number, c: number) => {
  const cur = keyAt(k);
  if (cur.hold) return 0;
  const prev = keyAt(k - 1);
  const next = keyAt(k + 1);
  return (next.v[c] - prev.v[c]) / (next.f - prev.f);
};

const splineValue = (frame: number, c: number) => {
  const n = CAMERA_KEYS.length;
  // znajdź segment zawierający klatkę (cyklicznie)
  for (let k = -1; k < n; k++) {
    const a = keyAt(k);
    const b = keyAt(k + 1);
    if (frame >= a.f && frame < b.f) {
      const len = b.f - a.f;
      return hermite(
        a.v[c],
        tangent(k, c),
        b.v[c],
        tangent(k + 1, c),
        (frame - a.f) / len,
        len,
      );
    }
  }
  return CAMERA_KEYS[0].v[c];
};

const APPROACH_FROM = 302;

/** Dojazd do logo: tłumiona sprężyna z lekkim przestrzeleniem — paseczki „klikają” na miejsce. */
const approach = (frame: number, c: number) => {
  const k = CAMERA_KEYS.findIndex((key) => key.f === APPROACH_FROM);
  const x0 = CAMERA_KEYS[k].v[c];
  const v0 = tangent(k, c); // ta sama prędkość co splajn — bez szarpnięcia
  const tau = frame - APPROACH_FROM;
  const zeta = 0.62;
  const omega = 0.105;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const x =
    Math.exp(-zeta * omega * tau) *
    (x0 * Math.cos(wd * tau) +
      ((v0 + zeta * omega * x0) / wd) * Math.sin(wd * tau));
  // resztka sprężyny gaśnie do zera dokładnie w LOCK
  return x * (1 - smooth((frame - (LOCK - 14)) / 14));
};

export type Camera = { rotY: number; rotX: number; roll: number; zoom: number };

export const camera = (rawFrame: number): Camera => {
  const frame = ((rawFrame % DURATION) + DURATION) % DURATION;
  const at = (c: number) => {
    if (c < 3 && frame >= APPROACH_FROM && frame < LOCK)
      return approach(frame, c);
    return splineValue(frame < CAMERA_KEYS[0].f ? frame + DURATION : frame, c);
  };
  return { rotY: at(0), rotX: at(1), roll: at(2), zoom: at(3) };
};

// ---------------------------------------------------------------
// Rozwarstwienie: 1 = paseczki na swoich głębokościach, 0 = leżą płasko na powierzchni
// ---------------------------------------------------------------
export const slatLift = (i: number, rawFrame: number) => {
  const frame = ((rawFrame % DURATION) + DURATION) % DURATION;
  const s = i / (SLAT_COUNT - 1);
  const landAt = LAND_START + s * LAND_SPREAD;
  if (frame < landAt) return 1;
  // unoszą się od dołu: napis odrywa się pierwszy
  const liftAt = HOLD_END + (1 - s) * LIFT_SPREAD;
  if (frame < liftAt) {
    const t = clamp01((frame - landAt) / LAND_LEN);
    // lądowanie: szybko, z miękkim dosiadem
    return 1 - (1 - Math.pow(1 - t, 3));
  }
  return easeInOutCubic((frame - liftAt) / LIFT_LEN);
};

/** Jak bardzo widać powierzchnię i cień: tylko blisko kąta, z którego logo się składa. */
export const surface = (cam: Camera) => {
  const off = Math.hypot(cam.rotY, cam.rotX);
  return Math.pow(1 - smooth(off / 16), 1.5);
};

/** Pełne logo (jeden obraz) podmienia paseczki, gdy wszystkie leżą płasko — zero szwów. */
export const solidLogo = (rawFrame: number) => {
  const frame = ((rawFrame % DURATION) + DURATION) % DURATION;
  const landed = LAND_START + LAND_SPREAD + LAND_LEN;
  // długie przenikanie: obraz w jednym kawałku przykrywa paseczki, różnica krawędzi (< 1 px) jest niezauważalna
  return (
    smooth((frame - landed) / 24) * (1 - smooth((frame - (HOLD_END - 24)) / 24))
  );
};

export const LOGO_SCALE = 0.9; // 868 px znaku w pliku → ~780 px w kadrze
