/*
 * Scena 3 — Przesłanie. Jedno spokojne ujęcie, dwa zdania, na końcu jasne rozświetlenie,
 * z którego wyłania się ekran aplikacji (scena 4).
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Linia } from "../components/Linia";
import { Ujecie } from "../components/Ujecie";
import { FONT } from "../fonts";
import { KOLOR } from "../kolory";
import { CISZA, PRZEJSCIE_DO_APLIKACJI, ZDANIA_ZNIKAJA, ZDANIE_1, ZDANIE_2 } from "../timeline";

const rel = (f: number) => f - CISZA.od;

export const Przeslanie: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) } as const;
  const rozswietlenie = interpolate(f, [durationInFrames - PRZEJSCIE_DO_APLIKACJI - 12, durationInFrames], [0, 1], t);

  const tekst: React.CSSProperties = {
    fontFamily: FONT,
    color: "#FFFFFF",
    fontSize: 78,
    lineHeight: 1.13,
    letterSpacing: "-0.025em",
    textShadow: "0 1px 2px rgba(10, 18, 22, .22), 0 2px 30px rgba(10, 18, 22, .38)",
  };

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter: `brightness(${1 + rozswietlenie * 0.9}) blur(${rozswietlenie * 14}px)`,
        }}
      >
        <Ujecie id="05-cisza" skala={[1.0, 1.05]} dryf={[0, -14]} srodek="50% 40%" />
      </AbsoluteFill>

      {/* Światło, z którego wyłania się aplikacja (kolor tła aplikacji) — przejście jest jasne niezależnie od ekspozycji ujęcia */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% 45%, ${KOLOR.bg}, rgba(${KOLOR.mintRgb}, .9))`,
          opacity: interpolate(rozswietlenie, [0.15, 1], [0, 0.92], t),
        }}
      />

      {/* Miękkie przyciemnienie dołu kadru pod napisami — gradient, nie prostokąt */}
      <AbsoluteFill
        style={{
          background: [
            // miękki cień za samym blokiem tekstu (jasny sweter i okno za nim)
            "radial-gradient(ellipse 620px 360px at 34% 62%, rgba(12,20,24,.34), rgba(12,20,24,0) 100%)",
            "linear-gradient(180deg, rgba(12,20,24,0) 40%, rgba(12,20,24,.34) 74%, rgba(12,20,24,.42) 100%)",
          ].join(","),
          opacity: interpolate(f, [rel(ZDANIE_1) - 30, rel(ZDANIE_1) + 20, rel(ZDANIA_ZNIKAJA), rel(ZDANIA_ZNIKAJA) + 30], [0, 1, 1, 0], t),
        }}
      />

      {/* Napisy w bezpiecznej strefie Instagrama (z dala od górnych 250 px, dolnych ~420 px i prawej kolumny ikon) */}
      <AbsoluteFill style={{ top: 1060, left: 96, right: 150, bottom: "auto", translate: `0px ${interpolate(f, [rel(ZDANIE_1), durationInFrames], [0, -16])}px` }}>
        <Linia od={rel(ZDANIE_1)} znika={rel(ZDANIA_ZNIKAJA)} style={{ ...tekst, fontWeight: 500 }}>
          Nie każdy dzień
        </Linia>
        <Linia od={rel(ZDANIE_1) + 8} znika={rel(ZDANIA_ZNIKAJA)} style={{ ...tekst, fontWeight: 500 }}>
          musi być wyjątkowy.
        </Linia>
        <div style={{ height: 34 }} />
        <Linia od={rel(ZDANIE_2)} znika={rel(ZDANIA_ZNIKAJA) + 6} czas={66} style={{ ...tekst, fontWeight: 800 }}>
          Żeby był ważny.
        </Linia>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
