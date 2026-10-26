/*
 * Jedna płaska warstwa świata na głębokości z. Zawartość rysujemy we współrzędnych kadru R
 * (1080 × 1920, może wychodzić poza), a kamera skaluje i przesuwa całość (patrz camera.ts).
 */
import React from 'react';
import {Cam, planeTransform} from './camera';

export const Plane: React.FC<{
  cam: Cam;
  z: number;
  children: React.ReactNode;
  opacity?: number;
  /** rozmycie głębi ostrości w pikselach EKRANU */
  blur?: number;
  /** poniżej tej odległości od kamery warstwa znika (kamera przez nią przelatuje) */
  near?: number;
  name?: string;
}> = ({cam, z, children, opacity = 1, blur = 0, near = 40, name}) => {
  const t = planeTransform(cam, z);
  if (t.d < near || opacity <= 0.001) return null;
  return (
    <div
      data-plane={name}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        transformOrigin: '0 0',
        transform: `translate(${t.bx}px, ${t.by}px) scale(${t.k})`,
        opacity,
        filter: blur > 0.05 ? `blur(${blur / t.k}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** SVG na całą warstwę z widocznym nadmiarem poza kadrem */
export const PlaneSvg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}>
    {children}
  </svg>
);
