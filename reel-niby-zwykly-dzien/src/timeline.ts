/*
 * Oś czasu filmu (klatki przy 60 fps). Rytm muzyki: 120 BPM → ćwierćnuta = 30 klatek, takt = 120.
 * Najważniejsze przejścia stoją na mocnych miejscach taktu (patrz scripts/compose_music.py).
 */
export const FPS = 60;
export const DURATION = 1200; // 20 s

export const T = {
  // 0–4 s: „Dzisiaj?” → „Nic szczególnego.” → „Nic” otwiera się na „coś”
  dzisiajIn: 10,
  answerIn: 84,
  slitOpen: 152, // szczelina w „Nic”
  cosFull: 180, // 3.0 s — dzwoneczek
  windowGrow: 206, // szczelina rośnie w pierwszą kartkę
  // 4–10 s: chwile
  m1: 240, // 4.0 s — wchodzi rytm
  m2Land: 330, // 5.5 s
  m3Land: 420, // 7.0 s
  m4Land: 510, // 8.5 s
  // 10–15 s: kamera się cofa, kartki układają się w stronę dnia
  pullBack: 600, // 10.0 s
  headline: 652,
  // 15–18 s: strona → ekran aplikacji
  toApp: 900, // 15.0 s
  picks: [990, 1005, 1020, 1035], // 16.5–17.25 s — „Dobrze”
  // 18–20 s: marka
  collapse: 1068,
  wings: 1093,
  wordmark: 1112,
  tagline: 1124,
} as const;
