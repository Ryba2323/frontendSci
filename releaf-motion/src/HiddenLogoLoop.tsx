import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import {
  CONTENT_CENTER_Y,
  CONTENT_TOP,
  LOGO_PX,
  PERSPECTIVE,
  PIVOT_Z,
  SLAT_COUNT,
  SLAT_SRC,
  camera,
  LOGO_SCALE,
  slatDepth,
  slatLift,
  solidLogo,
  surface,
} from "./motion";

// Kolory z tokens.css (motyw „morski”) — tło spokojne, jasne, logo leży na nim bez żadnej karty
const BG_TOP = "#E8F3F5"; // między --bg-2 a --mist
const BG_BOTTOM = "#F7EFEA"; // brzoskwiniowa mgiełka (--peach rozjaśnione)
const SHADOW_RGB = "24, 58, 68"; // ciemny morski, nie czarny

const W = 1080;
const H = 1920;
const IMG = LOGO_PX * LOGO_SCALE; // wyświetlany rozmiar całego pliku
const CX = W / 2;
const CY = 900; // środek znaku, odrobinę nad środkiem kadru
const LANDED_Z = 4; // logo „leży” na powierzchni jak cienki papier — stąd miękki cień kontaktowy
const LIGHT = { x: 0.15, y: 0.24 }; // przesunięcie cienia na 1 px wysokości
const SEAM = 1.2; // paseczki zachodzą na siebie, żeby złożone logo nie miało włosowatych szczelin
const FOCUS_BLUR = 0.007; // głębia ostrości: rozmycie na 1 px odległości od płaszczyzny ostrości

const logoUrl = staticFile("releaf-logo.png");

// Paseczki liczymy raz: która część pliku, gdzie leży, jak głęboko się chowa
const SLATS = Array.from({ length: SLAT_COUNT }, (_, i) => {
  const srcTop = CONTENT_TOP + i * SLAT_SRC;
  return {
    i,
    srcTop,
    cy: (srcTop + SLAT_SRC / 2 - CONTENT_CENTER_Y) * LOGO_SCALE,
    h: SLAT_SRC * LOGO_SCALE,
    depth: slatDepth(i),
  };
});

const useLogoReady = () => {
  const [handle] = useState(() => delayRender("logo"));
  useEffect(() => {
    const img = new Image();
    img.src = logoUrl;
    img
      .decode()
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }, [handle]);
};

const Background: React.FC<{ rotY: number; rotX: number }> = ({
  rotY,
  rotX,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${BG_TOP} 0%, #F1F6F5 52%, ${BG_BOTTOM} 100%)`,
    }}
  >
    {/* miękkie światło za znakiem; przesuwa się lekko z kamerą, więc tło ma głębię bez efekciarstwa */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${CX - rotY * 5}px ${CY - 120 + rotX * 5}px, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.45) 26%, rgba(255,255,255,0) 58%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(${SHADOW_RGB},0.10) 100%)`,
      }}
    />
  </AbsoluteFill>
);

// Stałe ziarno (nie migocze, więc pętla jest czysta), jak faktura papieru
const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "multiply" }}>
    <svg width={W} height={H}>
      <filter id="grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={2}
          seed={7}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={W} height={H} filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

/** Odległość punktu od płaszczyzny ostrości (przechodzi przez środek rzeźby) po obrocie kamery. */
const viewDepth = (
  cam: { rotY: number; rotX: number },
  y: number,
  z: number,
) => {
  const ry = (cam.rotY * Math.PI) / 180;
  const rx = (cam.rotX * Math.PI) / 180;
  const z1 = (z - PIVOT_Z) * Math.cos(ry);
  return y * Math.sin(rx) + z1 * Math.cos(rx);
};

const slatZ = (s: (typeof SLATS)[number], frame: number) =>
  LANDED_Z + (s.depth - LANDED_Z) * slatLift(s.i, frame);

const sliceStyle = (srcTop: number, h: number): React.CSSProperties => ({
  position: "absolute",
  left: -IMG / 2,
  top: -h / 2,
  width: IMG,
  height: h,
});

export const HiddenLogoLoop: React.FC = () => {
  useLogoReady();
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const surf = surface(cam);
  const solid = solidLogo(frame);

  const world = `translateZ(${PIVOT_Z}px) rotateZ(${cam.roll}deg) rotateX(${cam.rotX}deg) rotateY(${cam.rotY}deg) translateZ(${-PIVOT_Z}px)`;

  return (
    <AbsoluteFill>
      <Background rotY={cam.rotY} rotX={cam.rotX} />

      <AbsoluteFill
        style={{
          transform: `scale(${cam.zoom})`,
          transformOrigin: `${CX}px ${CY}px`,
        }}
      >
        {/*
          Cień na powierzchni. Widać go tylko przy kącie bliskim frontu, więc liczymy go płasko (to ten sam rzut
          co w 3D przy obrocie 0) — dzięki temu nie skacze, gdy kamera dochodzi dokładnie do zera,
          i ciągnie się bez szwu pod pełnym logo.
        */}
        {surf > 0.002 ? (
          <div
            style={{
              position: "absolute",
              left: CX,
              top: CY,
              opacity: 0.22 * surf,
            }}
          >
            {SLATS.map((s) => {
              const z = slatZ(s, frame);
              const k = (PERSPECTIVE - z) / PERSPECTIVE;
              const lift = Math.max(0, z); // paseczek schowany za powierzchnią nie rzuca na nią cienia
              if (z < 0) return null;
              return (
                <div
                  key={s.i}
                  style={{
                    ...sliceStyle(s.srcTop, s.h),
                    transform: `translate(${LIGHT.x * lift}px, ${s.cy * k + LIGHT.y * lift}px) scale(${k})`,
                    filter: `blur(${2.2 + lift * 0.034}px)`,
                    opacity: 1 - 0.62 * Math.min(1, lift / 1700),
                    backgroundColor: `rgb(${SHADOW_RGB})`,
                    maskImage: `url(${logoUrl})`,
                    maskSize: `${IMG}px ${IMG}px`,
                    maskPosition: `0px ${-s.srcTop * LOGO_SCALE}px`,
                    maskRepeat: "no-repeat",
                  }}
                />
              );
            })}
          </div>
        ) : null}

        <AbsoluteFill
          style={{
            perspective: PERSPECTIVE,
            perspectiveOrigin: `${CX}px ${CY}px`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: CX,
              top: CY,
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
              transform: world,
              // paseczki zostają pod pełnym logo — bez przełączania warstw, więc nic nie mignie
            }}
          >
            {SLATS.map((s) => {
              const z = slatZ(s, frame);
              // skala kompensuje perspektywę: z jednego jedynego kąta paseczek trafia idealnie na swoje miejsce
              const k = (PERSPECTIVE - z) / PERSPECTIVE;
              const dof =
                Math.min(
                  6,
                  Math.abs(viewDepth(cam, s.cy * k, z)) * FOCUS_BLUR,
                ) *
                (1 - surf) *
                slatLift(s.i, frame);
              return (
                <div
                  key={s.i}
                  style={{
                    ...sliceStyle(s.srcTop, s.h + 2 * SEAM),
                    transform: `translate3d(0px, ${s.cy * k}px, ${z}px) scale(${k})`,
                    // eslint-disable-next-line @remotion/no-background-image -- obraz jest wczytany wcześniej (useLogoReady)
                    backgroundImage: `url(${logoUrl})`,
                    backgroundSize: `${IMG}px ${IMG}px`,
                    backgroundPosition: `0px ${-s.srcTop * LOGO_SCALE + SEAM}px`,
                    backgroundRepeat: "no-repeat",
                    filter: dof > 0.25 ? `blur(${dof}px)` : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Po wylądowaniu: dokładnie ten sam obraz w jednym kawałku (przezroczysty PNG, bez tła) */}
          {solid > 0 ? (
            <Img
              src={logoUrl}
              style={{
                position: "absolute",
                left: CX - IMG / 2,
                top: CY - CONTENT_CENTER_Y * LOGO_SCALE,
                width: IMG,
                height: IMG,
                opacity: solid,
              }}
            />
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>

      <Grain />
      <Audio src={staticFile("releaf-sound.wav")} />
    </AbsoluteFill>
  );
};
