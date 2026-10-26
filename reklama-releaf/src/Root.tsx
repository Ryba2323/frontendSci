import React from "react";
import { Composition } from "remotion";
import { Reklama } from "./Reklama";
import { DLUGOSC, FPS, SZEROKOSC, WYSOKOSC } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ReLeaf-ToTezSieLiczy"
      component={Reklama}
      width={SZEROKOSC}
      height={WYSOKOSC}
      fps={FPS}
      durationInFrames={DLUGOSC}
    />
  );
};
