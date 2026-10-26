/*
 * Dźwięk: muzyka (licencjonowana, public/audio/muzyka.wav) + ciche tła z prawdziwych nagrań.
 * Źródła i licencje: ASSET_SOURCES.md. Komponent dodaje tylko pliki przygotowane przez `npm run ujecia`.
 * Bez „whooshów” na przejściach.
 */
import { Audio } from "@remotion/media";
import React from "react";
import { Easing, interpolate, Sequence, staticFile } from "remotion";
import dostepne from "./dostepne.json";
import { DLUGOSC, OKNO, SMIECH, SWIATLO } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Dzwiek: React.FC = () => {
  const a = dostepne.audio;
  return (
    <>
      {a.muzyka ? (
        <Audio
          name="Muzyka"
          src={staticFile("audio/muzyka.wav")}
          // Utwór sam się otwiera w 16,71 s (patrz src/timeline.ts) — tu tylko łagodne wejście i spokojne wyciszenie na logo
          volume={(f) => interpolate(f, [0, 50], [0, 0.85], c) * interpolate(f, [DLUGOSC - 90, DLUGOSC], [1, 0], { ...c, easing: Easing.bezier(0.4, 0, 0.6, 1) })}
        />
      ) : null}
      {a.deszcz ? (
        <Audio
          name="Deszcz"
          src={staticFile("audio/deszcz.wav")}
          volume={(f) => interpolate(f, [0, 24, OKNO.do - 40, SWIATLO.od + 50], [0, 0.5, 0.45, 0], c)}
        />
      ) : null}
      {a.miasto ? (
        <Audio
          name="Miasto"
          src={staticFile("audio/miasto.wav")}
          volume={(f) => interpolate(f, [0, 30, OKNO.do, OKNO.do + 90], [0, 0.2, 0.16, 0], c)}
        />
      ) : null}
      {a.smiech ? (
        <Sequence name="Śmiech (tło)" from={SMIECH.od - 12} durationInFrames={SMIECH.do - SMIECH.od + 30}>
          <Audio
            src={staticFile("audio/smiech.wav")}
            volume={(f) => interpolate(f, [0, 10, SMIECH.do - SMIECH.od, SMIECH.do - SMIECH.od + 30], [0, 0.22, 0.2, 0], c)}
          />
        </Sequence>
      ) : null}
    </>
  );
};
