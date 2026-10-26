/*
 * Linia tekstu odsłaniana spod maski: wysuwa się z dołu, wyostrza i zostaje.
 * Bez latających liter i bez tła — tekst jest częścią kadru.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

type Props = {
  children: React.ReactNode;
  od: number; // klatka wejścia (względem sceny)
  znika?: number; // klatka początku wyjścia
  czas?: number; // długość wejścia w klatkach
  style?: React.CSSProperties;
};

export const Linia: React.FC<Props> = ({ children, od, znika, czas = 54, style }) => {
  const f = useCurrentFrame();
  const wej = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) } as const;
  const wyj = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) } as const;
  const out = znika == null ? 0 : interpolate(f, [znika, znika + 24], [0, 1], wyj);

  return (
    // Maska ma zapas na ogonki (ą, ę, y) i akcenty (Ż, ś)
    <div style={{ overflow: "hidden", padding: "0.14em 0 0.2em", margin: "-0.14em 0 -0.2em" }}>
      <div
        style={{
          translate: interpolate(f, [od, od + czas], ["0px 105%", "0px 0%"], wej),
          opacity: interpolate(f, [od, od + czas * 0.6], [0, 1], wej) * (1 - out),
          filter: `blur(${interpolate(f, [od, od + czas * 0.7], [8, 0], wej) + out * 6}px)`,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};
