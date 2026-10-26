/*
 * Sceny 1–2 — deszcz na szybie, potem małe chwile. Cięcia są proste; jedyne przejście to krótkie
 * rozjaśnienie między deszczem a porannym światłem (match cut na świetle). Ruch kamery w każdym ujęciu
 * idzie w tę samą stronę, żeby ujęcia „przechodziły” w siebie.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Ujecie } from "../components/Ujecie";
import { OKNO, PRZENIKANIE_SWIATLO, SMIECH, SPACER, SWIATLO } from "../timeline";

export const Chwile: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence name="01 Okno — deszcz" from={OKNO.od} durationInFrames={OKNO.do - OKNO.od}>
        <Ujecie id="01-okno-deszcz" skala={[1.0, 1.045]} dryf={[-10, 0]} />
      </Sequence>
      <Sequence name="02 Poranne światło" from={SWIATLO.od} durationInFrames={SWIATLO.do - SWIATLO.od}>
        <WejscieSwiatlem>
          <Ujecie id="02-poranne-swiatlo" skala={[1.02, 1.05]} dryf={[-14, 0]} />
        </WejscieSwiatlem>
      </Sequence>
      <Sequence name="03 Spacer" from={SPACER.od} durationInFrames={SPACER.do - SPACER.od}>
        <Ujecie id="03-spacer" skala={[1.02, 1.04]} dryf={[-12, 0]} />
      </Sequence>
      <Sequence name="04 Śmiech" from={SMIECH.od} durationInFrames={SMIECH.do - SMIECH.od}>
        <Ujecie id="04-smiech" skala={[1.0, 1.03]} dryf={[-8, 0]} srodek="50% 42%" />
      </Sequence>
    </AbsoluteFill>
  );
};

// Krople → słońce: obraz wchodzi przez krótkie prześwietlenie, jak światło łapane przez obiektyw
const WejscieSwiatlem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const t = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;
  const p = interpolate(f, [0, PRZENIKANIE_SWIATLO + 14], [0, 1], t);
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(f, [0, PRZENIKANIE_SWIATLO], [0, 1], t),
        filter: `brightness(${1 + (1 - p) * 0.55})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
