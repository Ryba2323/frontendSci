/*
 * Scena 4 — ReLeaf. Prawdziwy ekran podlewania z Main_Front-End (nagrany klatka po klatce przez
 * scripts/nagraj-ui.cjs), bez makiety telefonu: pionowy kadr filmu sam staje się ekranem.
 * Jedna interakcja: łodyga dochodzi do 5 → „Zwyczajny dzień też się liczy.” (tekst z aplikacji).
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import dotyk from "../dotyk.json";
import { KOLOR } from "../kolory";
import { APLIKACJA, MARKA, PRZEJSCIE_DO_APLIKACJI, UI_START } from "../timeline";

const plik = (i: number) => staticFile(`ui/checkin/f${String(i).padStart(4, "0")}.png`);
const ostatnia = dotyk.klatki - 1;

export const Aplikacja: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const i = Math.min(UI_START + f, ostatnia);
  const t = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;
  const tt = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) } as const;

  const wejscie = interpolate(f, [0, PRZEJSCIE_DO_APLIKACJI], [0, 1], t);
  const wyjscie = interpolate(f, [MARKA.od - APLIKACJA.od, durationInFrames], [0, 1], tt);

  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(f, [0, PRZEJSCIE_DO_APLIKACJI * 0.7], [0, 1], tt),
        filter: `brightness(${1 + (1 - wejscie) * 0.35 + wyjscie * 0.12}) blur(${(1 - wejscie) * 16 + wyjscie * 28}px)`,
        backgroundColor: KOLOR.bg,
      }}
    >
      {/* Kamera spokojnie odjeżdża od łodygi do całego ekranu */}
      <AbsoluteFill
        style={{
          scale: interpolate(f, [0, durationInFrames], [1.05, 1.0], t),
          transformOrigin: "50% 58%",
        }}
      >
        <Img src={plik(i)} style={{ width: "100%", height: "100%" }} />
        <SladDotyku i={i} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Delikatny ślad kciuka (jak „pokaż dotknięcia” w nagraniu ekranu); po puszczeniu rozpływa się
const SladDotyku: React.FC<{ i: number }> = ({ i }) => {
  const pkt = dotyk.punkty as ({ x: number; y: number } | null)[];
  let p = pkt[i];
  let zanik = 0;
  if (!p) {
    for (let k = 1; k <= 14 && i - k >= 0; k++) {
      if (pkt[i - k]) {
        p = pkt[i - k];
        zanik = k / 14;
        break;
      }
    }
  }
  if (!p) return null;
  const r = 46 + zanik * 18;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x - r,
        top: p.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,.28) 60%, rgba(255,255,255,0) 72%)",
        boxShadow: `0 0 0 2px rgba(${KOLOR.primaryRgb}, .16)`,
        opacity: 0.85 * (1 - zanik),
      }}
    />
  );
};
