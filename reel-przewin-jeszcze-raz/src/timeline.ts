/*
 * Oś czasu (klatki, 60 fps). Muzyka: 100 BPM → ćwierćnuta = 36 klatek, takt = 144 klatki (2.4 s).
 * Mocne momenty obrazu stoją na miarach taktu — patrz scripts/compose_music.py.
 */
export const FPS = 60;
export const DURATION = 1200;

export const T = {
  // 0–3 s: zwykła chwila
  cupIn: 34,
  cupDown: 108, // miara 3 — kubek dotyka stołu
  freeze: 144, // miara 4 (2.4 s) — czas staje
  wait: 152, // „Czekaj.”
  rewind: 198, // 3.3 s — świat zaczyna się cofać
  // 3–9 s: przewijanie
  diveEnd: 262,
  rimToCable: 246,
  cableLift: 318,
  wallSweep: 352,
  patchEdge: 404,
  portal: 440,
  tram: 520,
  // 9–15 s: podróż i odsłona
  tramLeaves: 584,
  walker: 600,
  meet: 692,
  pullBack: 720, // 12.0 s — miara 20
  pullBackEnd: 822,
  sentence: 806,
  // 15–18 s: aplikacja
  toNotebook: 900, // 15.0 s — miara 25
  pageToUi: 936,
  typing: 978,
  // 18–20 s: logo
  fold: 1062,
  logoDown: 1080, // 18.0 s — miara 30
  wingsSet: 1128,
  wordmark: 1124,
  tagline: 1140,
} as const;
