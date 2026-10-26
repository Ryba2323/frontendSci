/*
 * Jedno ujęcie z prawdziwego materiału (public/footage/<id>.mp4, przygotowane przez `npm run ujecia`:
 * kadr 1080×1920, 60 kl/s, wspólny grading). Ruch kamery w montażu tylko delikatny (powolny najazd/dryf).
 *
 * Gdy materiału jeszcze nie ma, rysujemy wyraźną planszę „brak ujęcia” — NIE zastępczą ilustrację.
 * Render finalny (`npm run final`) nie ruszy, dopóki brakuje któregokolwiek ujęcia.
 */
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import dostepne from "../dostepne.json";
import ujecia from "../../ujecia.json";
import { FONT } from "../fonts";

export type UjecieId = keyof typeof dostepne.ujecia;

type Props = {
  id: UjecieId;
  // Najazd: skala na początku i końcu ujęcia (1 = bez zmian)
  skala?: [number, number];
  // Dryf kadru w px (x, y) od początku do końca
  dryf?: [number, number];
  // Punkt, wokół którego kamera „najeżdża” (CSS transform-origin)
  srodek?: string;
  // Od której sekundy przygotowanego pliku zaczynamy
  start?: number;
  style?: React.CSSProperties;
};

export const Ujecie: React.FC<Props> = ({ id, skala = [1, 1.035], dryf = [0, 0], srodek = "50% 50%", start = 0, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.67, 1) } as const;

  const ruch: React.CSSProperties = {
    scale: interpolate(frame, [0, durationInFrames], skala, t),
    translate: interpolate(frame, [0, durationInFrames], [`0px 0px`, `${dryf[0]}px ${dryf[1]}px`], t),
    transformOrigin: srodek,
  };

  if (!dostepne.ujecia[id]) return <BrakUjecia id={id} />;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#11181c", ...style }}>
      <AbsoluteFill style={ruch}>
        <Video
          src={staticFile(`footage/${id}.mp4`)}
          trimBefore={Math.round(start * fps)}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Plansza robocza w podglądzie (animatik). Celowo surowa, żeby nikt jej nie wziął za materiał filmu.
const BrakUjecia: React.FC<{ id: UjecieId }> = ({ id }) => {
  const u = ujecia.ujecia.find((x) => x.id === id);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a2125",
        color: "rgba(255,255,255,.62)",
        fontFamily: FONT,
        justifyContent: "flex-start",
        padding: "300px 110px 0",
        gap: 26,
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,.4)" }}>
        PODGLĄD · BRAK UJĘCIA
      </div>
      <div style={{ fontSize: 46, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>{id}</div>
      <div style={{ fontSize: 32, lineHeight: 1.4, fontWeight: 500 }}>{u?.opis}</div>
      <div style={{ fontSize: 24, lineHeight: 1.5, color: "rgba(255,255,255,.4)" }}>
        Wrzuć licencjonowany materiał do surowe/{id}.mp4 i uruchom npm run ujecia.
      </div>
    </AbsoluteFill>
  );
};
