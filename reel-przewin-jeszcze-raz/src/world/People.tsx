/*
 * Sylwetki ludzi — płaskie, ciepło podświetlone z tyłu (jak pod światło z drzwi kawiarni).
 * Proporcje dorosłej osoby (głowa ≈ 1/7.5 wysokości), lekki chód z kołysaniem rąk i nóg.
 */
import React from 'react';

export const Person: React.FC<{
  x: number;
  /** linia stóp */
  y: number;
  h: number;
  /** 1 = patrzy w prawo, -1 = w lewo */
  facing: 1 | -1;
  /** faza chodu w radianach; 0 i ruch = 0 → stoi */
  walk: number;
  stride: number;
  lean?: number;
  color: string;
  rim: string;
  hair?: 'bun' | 'short';
  coat?: string;
  wave?: number;
}> = ({x, y, h, facing, walk, stride, lean = 0, color, rim, hair = 'short', coat, wave = 0}) => {
  const u = h / 100; // jednostka: 1/100 wysokości
  const legA = Math.sin(walk) * 22 * stride;
  const legB = -legA;
  const armA = -Math.sin(walk) * 18 * stride;
  const bob = Math.abs(Math.cos(walk)) * 1.2 * stride;
  const body = coat ?? color;
  return (
    <g transform={`translate(${x} ${y - bob * u}) scale(${facing} 1) rotate(${lean})`}>
      {/* cień pod stopami */}
      <ellipse cx={0} cy={bob * u} rx={18 * u} ry={2.6 * u} fill="#3B2E22" opacity={0.25} />
      {/* nogi */}
      <g transform={`translate(${-3 * u} ${-46 * u}) rotate(${legB})`}>
        <path d={`M ${-4.2 * u} 0 L ${4.2 * u} 0 L ${3.2 * u} ${44 * u} L ${-3 * u} ${44 * u} Z`} fill={color} />
        <path d={`M ${-3 * u} ${43 * u} L ${7 * u} ${43 * u} Q ${8.5 * u} ${46 * u} ${6 * u} ${46.5 * u} L ${-3.4 * u} ${46.5 * u} Z`} fill={color} />
      </g>
      <g transform={`translate(${3 * u} ${-46 * u}) rotate(${legA})`}>
        <path d={`M ${-4.2 * u} 0 L ${4.2 * u} 0 L ${3.2 * u} ${44 * u} L ${-3 * u} ${44 * u} Z`} fill={color} />
        <path d={`M ${-3 * u} ${43 * u} L ${7 * u} ${43 * u} Q ${8.5 * u} ${46 * u} ${6 * u} ${46.5 * u} L ${-3.4 * u} ${46.5 * u} Z`} fill={color} />
      </g>
      {/* tylna ręka */}
      <g transform={`translate(${-1 * u} ${-80 * u}) rotate(${-armA})`}>
        <rect x={-3 * u} y={0} width={6 * u} height={33 * u} rx={3 * u} fill={body} opacity={0.92} />
      </g>
      {/* płaszcz / tułów */}
      <path
        d={`M ${-9 * u} ${-82 * u} C ${-12 * u} ${-70 * u} ${-13 * u} ${-52 * u} ${-12 * u} ${-40 * u} L ${12 * u} ${-40 * u} C ${13 * u} ${-54 * u} ${12 * u} ${-72 * u} ${9 * u} ${-82 * u} Q 0 ${-86 * u} ${-9 * u} ${-82 * u} Z`}
        fill={body}
      />
      {/* szyja i głowa */}
      <rect x={-2.4 * u} y={-88 * u} width={4.8 * u} height={8 * u} fill={color} />
      <ellipse cx={1 * u} cy={-93.5 * u} rx={5.6 * u} ry={6.6 * u} fill={color} />
      <path d={`M ${6 * u} ${-95 * u} l ${1.6 * u} ${2.2 * u} l ${-1.6 * u} ${0.6 * u} Z`} fill={color} />
      {hair === 'bun' ? <circle cx={-4.6 * u} cy={-98 * u} r={3.4 * u} fill={color} /> : <path d={`M ${-4.6 * u} ${-97 * u} Q ${1 * u} ${-103 * u} ${6.4 * u} ${-96 * u} L ${-5 * u} ${-92 * u} Z`} fill={color} />}
      {/* przednia ręka (z opcjonalnym machnięciem) */}
      <g transform={`translate(${1 * u} ${-80 * u}) rotate(${armA - wave * 150})`}>
        <rect x={-3 * u} y={0} width={6 * u} height={33 * u} rx={3 * u} fill={body} />
      </g>
      {/* ciepła krawędź światła z drzwi */}
      <path d={`M ${6.6 * u} ${-98 * u} Q ${7.4 * u} ${-92 * u} ${5.4 * u} ${-88 * u}`} stroke={rim} strokeWidth={1.2 * u} fill="none" strokeLinecap="round" opacity={0.9} />
      <path d={`M ${9.4 * u} ${-80 * u} C ${12 * u} ${-70 * u} ${12.6 * u} ${-54 * u} ${12 * u} ${-42 * u}`} stroke={rim} strokeWidth={1.2 * u} fill="none" strokeLinecap="round" opacity={0.75} />
    </g>
  );
};

/** pasażer w tramwaju: profil (patrzy w lewo) ze słuchawkami, lekko kiwa głową w rytm */
export const Passenger: React.FC<{x: number; y: number; s: number; nod: number}> = ({x, y, s, nod}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {/* ramiona i tułów (sweter) */}
    <path d="M -64 76 C -62 42 -36 26 -2 24 C 30 24 58 40 64 76 Z" fill="#3F5D66" />
    <path d="M -14 26 C -6 34 10 34 16 26" stroke="#35505A" strokeWidth={4} fill="none" />
    <g transform={`rotate(${nod} 4 20)`}>
      {/* szyja */}
      <path d="M -10 6 L 14 6 L 16 28 L -8 28 Z" fill="#344B53" />
      {/* głowa z profilem: czoło, nos, usta, broda */}
      <path
        d="M 18 4 C 32 -6 34 -30 30 -44 C 26 -60 12 -68 -4 -68 C -20 -68 -28 -58 -30 -46 C -31 -40 -31 -37 -32 -34 L -39 -24 C -40 -22 -38 -21 -34 -21 C -34 -18 -36 -16 -34 -14 C -35 -12 -34 -9 -31 -8 C -28 -6 -28 -2 -24 2 C -16 8 4 10 18 4 Z"
        fill="#344B53"
      />
      {/* włosy */}
      <path d="M -29 -48 C -28 -66 -10 -74 8 -70 C 28 -66 38 -48 32 -26 C 30 -18 26 -10 20 -4 C 22 -18 18 -34 6 -44 C -6 -52 -18 -52 -29 -48 Z" fill="#283C43" />
      {/* słuchawki: pałąk przez czubek głowy i muszla na uchu */}
      <path d="M 6 -44 C 4 -66 -8 -78 -22 -72" stroke={'#3A8D9E'} strokeWidth={7} fill="none" strokeLinecap="round" />
      <ellipse cx={8} cy={-32} rx={13} ry={17} fill="#3A8D9E" />
      <ellipse cx={6} cy={-34} rx={7} ry={10} fill="#5FAEBB" />
      <ellipse cx={4} cy={-38} rx={2.5} ry={4} fill="#FFFFFF" opacity={0.6} />
      {/* ciepłe światło z ulicy na profilu */}
      <path d="M -31 -40 C -31 -37 -32 -34 -32 -34 L -39 -24" stroke="#F4C59A" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.9} />
      <path d="M -31 -8 C -28 -6 -28 -2 -24 2" stroke="#F4C59A" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  </g>
);
