/*
 * Dźwięk: muzyka (licencjonowana, public/audio/muzyka.wav) + ciche tła z prawdziwych nagrań.
 * Plików jeszcze nie ma (patrz ASSET_SOURCES.md) — komponent dodaje tylko te, które przygotował `npm run ujecia`.
 * Bez „whooshów” na przejściach.
 */
import { Audio } from "@remotion/media";
import React from "react";
import { interpolate, Sequence, staticFile } from "remotion";
import dostepne from "./dostepne.json";
import { DLUGOSC, OKNO, SMIECH, SWIATLO, ZDANIE_2 } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Dzwiek: React.FC = () => {
  const a = dostepne.audio;
  return (
    <>
      {a.muzyka ? (
        <Audio
          name="Muzyka"
          src={staticFile("audio/muzyka.wav")}
          volume={(f) =>
            interpolate(f, [0, 40], [0, 0.8], c) *
            // drugie zdanie: muzyka lekko się otwiera
            interpolate(f, [ZDANIE_2 - 30, ZDANIE_2 + 30], [0.9, 1], c) *
            interpolate(f, [DLUGOSC - 48, DLUGOSC], [1, 0], c)
          }
        />
      ) : null}
      {a.deszcz ? (
        <Audio
          name="Deszcz"
          src={staticFile("audio/deszcz.wav")}
          volume={(f) => interpolate(f, [0, 20, OKNO.do - 30, SWIATLO.od + 40], [0.35, 0.55, 0.5, 0], c)}
        />
      ) : null}
      {a.miasto ? (
        <Audio
          name="Miasto"
          src={staticFile("audio/miasto.wav")}
          volume={(f) => interpolate(f, [0, 30, OKNO.do, OKNO.do + 120], [0, 0.22, 0.18, 0], c)}
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
