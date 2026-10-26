/*
 * Scena 5 — Marka. Ekran aplikacji rozpływa się w jasne tło z jej palety (bg, mięta, brzoskwinia),
 * a na nim oficjalne logo ReLeaf z przezroczystością (bez karty, ramki i cienia; znak słowny jest w logo).
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT } from "../fonts";
import { KOLOR } from "../kolory";
import { HASLO_WEJSCIE, LOGO_WEJSCIE, MARKA } from "../timeline";

// Wymiary przyciętego pliku public/marka/releaf-logo.png
const LOGO_W = 917;
const LOGO_H = 898;
const SZER = 560;

export const Marka: React.FC = () => {
  const f = useCurrentFrame();
  const t = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;
  const tt = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) } as const;
  const logo = LOGO_WEJSCIE - MARKA.od;
  const haslo = HASLO_WEJSCIE - MARKA.od;

  return (
    <AbsoluteFill>
      {/* Tło: kolory aplikacji, bardzo miękkie światło za skrzydłami */}
      <AbsoluteFill
        style={{
          opacity: interpolate(f, [0, 54], [0, 1], tt),
          background: [
            `radial-gradient(ellipse 520px 620px at 34% 40%, rgba(${KOLOR.mintRgb}, .42), rgba(${KOLOR.mintRgb}, 0) 70%)`,
            `radial-gradient(ellipse 520px 620px at 68% 42%, rgba(${KOLOR.peachRgb}, .26), rgba(${KOLOR.peachRgb}, 0) 70%)`,
            `linear-gradient(180deg, ${KOLOR.bg} 0%, #EFF7F6 55%, #F8F3EF 100%)`,
          ].join(","),
        }}
      />

      <AbsoluteFill style={{ alignItems: "center" }}>
        <Img
          src={staticFile("marka/releaf-logo.png")}
          style={{
            position: "absolute",
            top: 548,
            width: SZER,
            height: (SZER * LOGO_H) / LOGO_W,
            opacity: interpolate(f, [logo, logo + 42], [0, 1], tt),
            translate: interpolate(f, [logo, logo + 70], ["0px 26px", "0px 0px"], t),
            scale: interpolate(f, [logo, MARKA.do - MARKA.od], [0.985, 1.012], tt),
            filter: `blur(${interpolate(f, [logo, logo + 48], [10, 0], t)}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 1172,
            fontFamily: FONT,
            fontSize: 46,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: KOLOR.tekst,
            opacity: interpolate(f, [haslo, haslo + 40], [0, 0.88], tt),
            translate: interpolate(f, [haslo, haslo + 60], ["0px 16px", "0px 0px"], t),
          }}
        >
          Poznaj swój dzień. Poznaj siebie.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
