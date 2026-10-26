/*
 * Ściana pokoju (warstwa z = 1400) z dużym oknem na ulicę, lnianą firanką i plamą słońca.
 * Okno jest prawdziwym otworem w warstwie — za nim widać ulicę (kolejne warstwy).
 * Plama słońca na ścianie podczas przewijania przesuwa się jak w poklatkowym filmie,
 * a potem sama staje się otworem: w jej świetle pojawia się okno tramwaju.
 */
import React from 'react';
import {C} from '../theme';
import {Pt, toPath} from '../lib/path';

export const WINDOW = {x0: 222, y0: 180, x1: 968, y1: 1012, mullionX: 595, transomY: 441};

/** plama słońca w spoczynku (wielokąt), przesunięta o dx przy przewijaniu */
export const PATCH = {cx: 112, cy: 1112, w: 168, h: 140};
export const patchShape = (dx: number, skew: number): Pt[] => [
  {x: PATCH.cx - PATCH.w / 2 + 8 + dx + skew, y: PATCH.cy - PATCH.h / 2},
  {x: PATCH.cx + PATCH.w / 2 + 8 + dx + skew, y: PATCH.cy - PATCH.h / 2 - 4},
  {x: PATCH.cx + PATCH.w / 2 + dx, y: PATCH.cy + PATCH.h / 2 - 2},
  {x: PATCH.cx - PATCH.w / 2 + dx, y: PATCH.cy + PATCH.h / 2 + 2},
];

const Pane: React.FC<{x: number; y: number; w: number; h: number}> = ({x, y, w, h}) => (
  <g>
    {/* odbicia w szybie: dwa delikatne skośne pasy */}
    <path d={`M ${x + w * 0.1} ${y + h} L ${x + w * 0.38} ${y} L ${x + w * 0.52} ${y} L ${x + w * 0.24} ${y + h} Z`} fill="#FFFFFF" opacity={0.07} />
    <path d={`M ${x + w * 0.6} ${y + h} L ${x + w * 0.8} ${y} L ${x + w * 0.85} ${y} L ${x + w * 0.65} ${y + h} Z`} fill="#FFFFFF" opacity={0.05} />
  </g>
);

export const Wall: React.FC<{
  f: number;
  patch: Pt[];
  /** 0 = plama światła, 1 = otwór w ścianie */
  hole: number;
  /** kształt otworu (gdy hole > 0) */
  holeShape: Pt[];
  curtainSway: number;
  patchLight: number;
}> = ({f, patch, hole, holeShape, curtainSway, patchLight}) => {
  const W = WINDOW;
  const sway = curtainSway;
  // fałdy firanki: pionowe pasy, delikatnie falujące
  const folds = [...Array(7)].map((_, i) => {
    const x = 186 + i * 26;
    const s = Math.sin(f / 46 + i * 0.9) * 3 * sway + sway * 10 * (i / 6);
    return `M ${x} 150 C ${x + 4} 420 ${x - 6 + s} 760 ${x + s * 1.4} 1090`;
  });
  const curtainEdge = 186 + 6 * 26 + sway * 14;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id="w-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3EBDD" />
          <stop offset="0.55" stopColor={C.wall} />
          <stop offset="1" stopColor="#E3D4BE" />
        </linearGradient>
        <linearGradient id="w-low" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9B69A" stopOpacity={0} />
          <stop offset="0.45" stopColor="#C9B69A" stopOpacity={0.16} />
          <stop offset="1" stopColor="#C9B69A" stopOpacity={0.22} />
        </linearGradient>
        <radialGradient id="w-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF8EA" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FFF8EA" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="w-frame" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A9C5B0" />
          <stop offset="1" stopColor={C.sageFrame} />
        </linearGradient>
        <filter id="w-blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2} />
        </filter>
        <filter id="w-blur5" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={5} />
        </filter>
        <filter id="w-blur12" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={12} />
        </filter>
        <mask id="w-mask" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={5200} height={6000}>
          <rect x={-2000} y={-2000} width={5200} height={6000} fill="#FFFFFF" />
          <rect x={W.x0} y={W.y0} width={W.x1 - W.x0} height={W.y1 - W.y0} fill="#000000" />
          {hole > 0 && <path d={toPath(holeShape, true)} fill="#000000" opacity={hole} />}
        </mask>
      </defs>

      <g mask="url(#w-mask)">
        <rect x={-2000} y={-2000} width={5200} height={6000} fill="url(#w-wall)" />
        {/* ściana ciemnieje z dala od okna — światło ma się od czego odbić */}
        <rect x={-2000} y={1000} width={5200} height={700} fill="url(#w-low)" />
        {/* jaśniejsza poświata wokół okna */}
        <ellipse cx={595} cy={640} rx={720} ry={760} fill="url(#w-glow)" opacity={0.55} />
        {/* plama słońca z cieniem szprosów */}
        <g opacity={patchLight * (1 - hole)}>
          <path d={toPath(patch.map((q) => ({x: q.x + (q.x < patch[2].x - 40 ? -18 : 18), y: q.y + (q.y < PATCH.cy ? -18 : 18)})), true)} fill="#FFF6E2" filter="url(#w-blur12)" opacity={0.7} />
          <path d={toPath(patch, true)} fill="#FFE7BC" filter="url(#w-blur2)" />
          <path d={toPath(patch.map((q) => ({x: q.x + (q.x < patch[2].x - 40 ? 10 : -10), y: q.y + (q.y < PATCH.cy ? 10 : -10)})), true)} fill="#FFF3DC" filter="url(#w-blur5)" opacity={0.7} />
          <path
            d={`M ${(patch[0].x + patch[1].x) / 2 - 3} ${(patch[0].y + patch[1].y) / 2} L ${(patch[0].x + patch[1].x) / 2 + 3} ${(patch[0].y + patch[1].y) / 2} L ${(patch[3].x + patch[2].x) / 2 + 3} ${(patch[3].y + patch[2].y) / 2} L ${(patch[3].x + patch[2].x) / 2 - 3} ${(patch[3].y + patch[2].y) / 2} Z`}
            fill="#EAD9BF"
            filter="url(#w-blur2)"
          />
          <path
            d={`M ${patch[0].x + (patch[3].x - patch[0].x) * 0.38} ${patch[0].y + (patch[3].y - patch[0].y) * 0.38 - 3} L ${patch[1].x + (patch[2].x - patch[1].x) * 0.38} ${patch[1].y + (patch[2].y - patch[1].y) * 0.38 - 3} l 0 6 L ${patch[0].x + (patch[3].x - patch[0].x) * 0.38} ${patch[0].y + (patch[3].y - patch[0].y) * 0.38 + 3} Z`}
            fill="#EAD9BF"
            filter="url(#w-blur2)"
          />
        </g>
        {/* cień pod parapetem */}
        <rect x={200} y={1052} width={790} height={36} fill="#8E7556" opacity={0.18} filter="url(#w-blur12)" />
      </g>

      {/* rama okna (malowane drewno w kolorze szałwii) */}
      <g>
        <rect x={W.x0 - 6} y={W.y0 - 6} width={W.x1 - W.x0 + 12} height={W.y1 - W.y0 + 12} fill="none" stroke="#B9A78C" strokeWidth={4} opacity={0.45} />
        <path
          d={`M ${W.x0} ${W.y0} H ${W.x1} V ${W.y1} H ${W.x0} Z M ${W.x0 + 26} ${W.y0 + 26} V ${W.y1 - 26} H ${W.x1 - 26} V ${W.y0 + 26} Z`}
          fill="url(#w-frame)"
          fillRule="evenodd"
        />
        <rect x={W.mullionX - 12} y={W.y0 + 20} width={24} height={W.y1 - W.y0 - 40} fill={C.sageFrame} />
        <rect x={W.x0 + 20} y={W.transomY - 11} width={W.x1 - W.x0 - 40} height={22} fill={C.sageFrame} />
        {/* krawędzie światła i cienia na ramie */}
        <rect x={W.x0} y={W.y0} width={W.x1 - W.x0} height={4} fill="#FFFFFF" opacity={0.3} />
        <rect x={W.mullionX + 8} y={W.y0 + 20} width={4} height={W.y1 - W.y0 - 40} fill={C.sageFrameDark} opacity={0.6} />
        <rect x={W.x0 + 20} y={W.transomY + 7} width={W.x1 - W.x0 - 40} height={4} fill={C.sageFrameDark} opacity={0.6} />
        {/* klamka */}
        <rect x={W.mullionX - 5} y={700} width={10} height={44} rx={5} fill="#D8C9A8" />
        <Pane x={W.x0 + 26} y={W.y0 + 26} w={W.mullionX - 12 - W.x0 - 26} h={W.transomY - 11 - W.y0 - 26} />
        <Pane x={W.mullionX + 12} y={W.y0 + 26} w={W.x1 - 26 - W.mullionX - 12} h={W.transomY - 11 - W.y0 - 26} />
        <Pane x={W.x0 + 26} y={W.transomY + 11} w={W.mullionX - 12 - W.x0 - 26} h={W.y1 - 26 - W.transomY - 11} />
        <Pane x={W.mullionX + 12} y={W.transomY + 11} w={W.x1 - 26 - W.mullionX - 12} h={W.y1 - 26 - W.transomY - 11} />
      </g>

      {/* parapet */}
      <rect x={200} y={1010} width={790} height={30} rx={3} fill="#F6F0E6" />
      <rect x={200} y={1010} width={790} height={5} rx={2} fill="#FFFFFF" opacity={0.8} />
      <rect x={204} y={1040} width={782} height={12} fill="#DCCFBA" />

      {/* karnisz i lniana firanka po lewej */}
      <rect x={150} y={146} width={880} height={6} rx={3} fill="#B79E7A" />
      <circle cx={150} cy={149} r={9} fill="#B79E7A" />
      <circle cx={1030} cy={149} r={9} fill="#B79E7A" />
      <path d={`M 176 150 L ${curtainEdge + 18} 150 C ${curtainEdge + 10} 500 ${curtainEdge + 4 + sway * 6} 820 ${curtainEdge + 12 + sway * 16} 1090 L ${172 + sway * 4} 1090 Z`} fill="#FBF6EC" opacity={0.62} />
      <g stroke="#E9DFCC" strokeWidth={9} fill="none" opacity={0.55}>
        {folds.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
};
