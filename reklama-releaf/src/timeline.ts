/*
 * Montaż: wszystkie cięcia w klatkach (60 kl/s, 1500 klatek = 25 s).
 * Zmieniasz rytm tutaj — sceny czytają tylko te stałe.
 */
export const FPS = 60;
export const SZEROKOSC = 1080;
export const WYSOKOSC = 1920;
export const DLUGOSC = 1500;

const s = (sek: number) => Math.round(sek * FPS);

// Scena 1 — Chwila: deszcz na szybie
export const OKNO = { od: 0, do: s(5.2) };

// Scena 2 — Małe chwile. Okno → światło: krótkie „rozjaśnienie” (match cut na świetle), dalej czyste cięcia.
export const PRZENIKANIE_SWIATLO = s(0.3);
export const SWIATLO = { od: OKNO.do - PRZENIKANIE_SWIATLO, do: s(8.0) };
export const SPACER = { od: s(8.0), do: s(10.6) };
export const SMIECH = { od: s(10.6), do: s(13.2) };

// Scena 3 — Przesłanie: jedno spokojne ujęcie + dwa zdania
export const CISZA = { od: s(13.2), do: s(18.2) };
export const ZDANIE_1 = s(13.9);
export const ZDANIE_2 = s(15.6);
export const ZDANIA_ZNIKAJA = s(17.15);

// Scena 4 — Aplikacja: jasne przejście z ujęcia w prawdziwy ekran podlewania
export const APLIKACJA = { od: s(17.7), do: s(22.4) };
export const PRZEJSCIE_DO_APLIKACJI = s(0.6);
// Klatka nagrania (public/ui/checkin), od której zaczyna się ujęcie: łodyga jest już w ruchu, na „4”
export const UI_START = 128;

// Scena 5 — Marka
export const MARKA = { od: s(21.6), do: DLUGOSC };
export const LOGO_WEJSCIE = s(22.0);
export const HASLO_WEJSCIE = s(22.7);
