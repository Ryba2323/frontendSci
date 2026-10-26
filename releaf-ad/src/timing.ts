// Oś czasu filmu: 17 s × 60 fps = 1020 klatek = 36 uderzeń = 9 taktów 4/4 (127,06 BPM).
// Dzięki temu muzyka zapętla się idealnie razem z obrazem.
export const FPS = 60;
export const DURATION = 1020;
export const BEATS = 36;
export const BEAT = DURATION / BEATS; // 28,333 klatki
export const BPM = (60 * FPS) / BEAT;
export const b = (n: number) => n * BEAT; // klatka n-tego uderzenia (ułamkowa)

// Najważniejsze zdarzenia (wspólne dla obrazu i dźwięku — scripts/music.py czyta je z timeline.json)
export const T = {
  // Scena 1 — DZISIAJ?
  landFirst: 0,          // pierwsza litera ląduje dokładnie na pętli
  landStep: b(0.125),    // kolejne litery co 1/32 (werbel liter)
  detach: b(2),          // kropka „?” odrywa się
  impact01: b(3),        // obrót: „01” + uderzenie
  // Scena 2 — czas staje się fizyczny
  s2: b(4),
  hinge0: b(4),          // 6 zawiasów harmonijki co 1/8
  hingeStep: b(0.5),
  fold0: b(7),           // 3 zagięcia tygodni w pudełko co 3/4 uderzenia
  foldStep: b(0.75),
  cap29: b(9.25),
  cap30: b(9.75),
  explode: b(10),
  // Scena 3 — niemożliwe odsłonięcie
  s3: b(12),
  pullback: b(18),
  lock: b(20),           // wszystko zgrane: ZOBACZ WIĘCEJ.
  still: b(21.2),        // koniec bezruchu
  // Scena 4 — produkt
  lift30: b(22.5),
  card: b(24.5),
  // Scena 5 — logo i pętla
  morph: b(28.25),
  logo: b(31),           // logo kompletne — ostatnie uderzenie
  outro: b(34.25),       // wyjście napisów
  loop: b(34.5),         // kafel z logo wraca w 3D i odjeżdża w kropkę „?”
};

// Czas sceny 1 liczony „przez pętlę”: końcówka filmu to ujemne u tej samej sceny
export const loopU = (t: number) => (t >= T.loop ? t - DURATION : t);
