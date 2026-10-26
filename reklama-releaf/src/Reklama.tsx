/*
 * ReLeaf — „To też się liczy.” (25 s, 1080×1920, 60 kl/s)
 * Kolejność: deszcz na szybie → małe chwile → przesłanie → prawdziwy ekran aplikacji → logo.
 * Rytm w src/timeline.ts.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import "./fonts";
import { Dzwiek } from "./Dzwiek";
import { Aplikacja } from "./sceny/Aplikacja";
import { Chwile } from "./sceny/Chwile";
import { Marka } from "./sceny/Marka";
import { Przeslanie } from "./sceny/Przeslanie";
import { APLIKACJA, CISZA, MARKA } from "./timeline";

export const Reklama: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#F4FAFB" }}>
      <Sequence name="1–2 Chwila i małe chwile" durationInFrames={CISZA.od}>
        <Chwile />
        <Winieta />
      </Sequence>
      <Sequence name="3 Przesłanie" from={CISZA.od} durationInFrames={CISZA.do - CISZA.od}>
        <Przeslanie />
        <Winieta />
      </Sequence>
      <Sequence name="4 Aplikacja" from={APLIKACJA.od} durationInFrames={APLIKACJA.do - APLIKACJA.od}>
        <Aplikacja />
      </Sequence>
      <Sequence name="5 Marka" from={MARKA.od} durationInFrames={MARKA.do - MARKA.od}>
        <Marka />
      </Sequence>
      <Dzwiek />
    </AbsoluteFill>
  );
};

// Bardzo lekka winieta na materiale filmowym (bez czarnych pasów i „kinowych” efektów)
const Winieta: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(ellipse 85% 70% at 50% 48%, rgba(0,0,0,0) 60%, rgba(8,14,18,.16) 100%)",
      pointerEvents: "none",
    }}
  />
);
