/*
 * Montaż: wszystkie cięcia w klatkach (60 kl/s, 1500 klatek = 25 s).
 * Zmieniasz rytm tutaj — sceny czytają tylko te stałe.
 * Muzyka („A Special Feeling”, 99,4 BPM, takt 2,415 s) zaczyna się od 21,7 s utworu, więc:
 * perkusja wchodzi w 7,10 s filmu (cięcie na spacer), takty co 2,41 s (9,53 / 11,91 / 14,31 / 16,71),
 * utwór otwiera się w 16,71 s — tuż po tym, jak drugie zdanie wybrzmi.
 */
export const FPS = 60;
export const SZEROKOSC = 1080;
export const WYSOKOSC = 1920;
export const DLUGOSC = 1500;

const s = (sek: number) => Math.round(sek * FPS);

// Scena 1 — Chwila: deszcz na szybie
export const OKNO = { od: 0, do: s(4.9) };

// Scena 2 — Małe chwile. Okno → światło: krótkie „rozjaśnienie” (match cut na świetle), dalej czyste cięcia.
export const PRZENIKANIE_SWIATLO = s(0.3);
export const SWIATLO = { od: OKNO.do - PRZENIKANIE_SWIATLO, do: s(7.1) };
export const SPACER = { od: s(7.1), do: s(9.53) }; // cięcie dokładnie na pierwsze uderzenie perkusji
export const SMIECH = { od: s(9.53), do: s(12.51) }; // na „raz” następnego taktu

// Scena 3 — Przesłanie: jedno spokojne ujęcie + dwa zdania
export const CISZA = { od: s(12.51), do: s(18.8) };
export const ZDANIE_1 = s(13.3);
export const ZDANIE_2 = s(15.9); // muzyka otwiera się chwilę później (16,71 s)
export const ZDANIA_ZNIKAJA = s(17.8);

// Scena 4 — Aplikacja: jasne przejście z ujęcia w prawdziwy ekran podlewania
export const APLIKACJA = { od: s(18.2), do: s(22.4) };
export const PRZEJSCIE_DO_APLIKACJI = s(0.6);
// Klatka nagrania (public/ui/checkin), od której zaczyna się ujęcie: łodyga jest już w ruchu, na „4”
export const UI_START = 128;

// Scena 5 — Marka
export const MARKA = { od: s(21.8), do: DLUGOSC };
export const LOGO_WEJSCIE = s(22.1);
export const HASLO_WEJSCIE = s(22.8);
