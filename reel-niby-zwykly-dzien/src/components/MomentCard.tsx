/*
 * Kartka z jedną małą chwilą dnia: kolorowa ilustracja z prostych kształtów + podpis.
 * Każda ilustracja ma jeden mały ruch, który „opowiada” chwilę:
 *   1 rozmowa   — dwa koła zbliżają się i zachodzą na siebie (wspólna część w kolorze mięty)
 *   2 dla siebie — w łuku okna powoli zachodzi słońce
 *   3 coś nowego — uchylają się drzwi, wypada z nich ciepłe światło
 *   4 humor      — wschodzi słońce, a linia horyzontu wygina się w uśmiech
 * Wymiary w jednostkach świata (CARD_W × CARD_H); kamera skaluje całość.
 */
import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, SANS} from '../theme';
import {E, k, mix, p} from '../lib/anim';

export const CARD_W = 430;
export const CARD_H = 540;
const ART_H = 372;

export type MomentId = 1 | 2 | 3 | 4;

export const MOMENTS: Record<MomentId, {lines: string[]; time: string; bg: string}> = {
  1: {lines: ['Ta jedna dobra', 'rozmowa.'], time: '08:12', bg: C.peach},
  2: {lines: ['Chwila tylko', 'dla siebie.'], time: '13:40', bg: C.sageMist},
  3: {lines: ['Coś nowego.'], time: '16:05', bg: C.mist},
  4: {lines: ['Moment, który', 'poprawił humor.'], time: '19:30', bg: C.peachTip},
};

type ArtProps = {f: number; s: number};

const Conversation: React.FC<ArtProps> = ({f, s}) => {
  const t = p(f, s, s + 62, E.out);
  const ax = mix(-120, 166, t);
  const bx = mix(550, 264, t);
  return (
    <svg width={CARD_W} height={ART_H} viewBox={`0 0 ${CARD_W} ${ART_H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <clipPath id="m1-lens">
          <circle cx={bx} cy={188} r={104} />
        </clipPath>
      </defs>
      <circle cx={ax} cy={188} r={104} fill={C.primary} />
      <circle cx={bx} cy={188} r={104} fill={C.paper} />
      <circle cx={ax} cy={188} r={104} fill={C.mint} clipPath="url(#m1-lens)" />
    </svg>
  );
};

const ArchWindow: React.FC<ArtProps> = ({f, s}) => {
  const grow = p(f, s - 4, s + 40, E.out);
  const sunY = k(f, s + 6, s + 84, 70, 236, E.outSoft);
  const x0 = 120;
  const x1 = 310;
  const top = 64;
  const bottom = 372;
  const r = (x1 - x0) / 2;
  const arch = `M ${x0} ${bottom} L ${x0} ${top + r} A ${r} ${r} 0 0 1 ${x1} ${top + r} L ${x1} ${bottom} Z`;
  const reveal = mix(bottom, top - 2, grow);
  return (
    <svg width={CARD_W} height={ART_H} viewBox={`0 0 ${CARD_W} ${ART_H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <clipPath id="m2-arch">
          <path d={arch} />
        </clipPath>
        <clipPath id="m2-reveal">
          <rect x={0} y={reveal} width={CARD_W} height={ART_H} />
        </clipPath>
      </defs>
      <g clipPath="url(#m2-reveal)">
        <path d={arch} fill={C.paper} />
        <g clipPath="url(#m2-arch)">
          <circle cx={215} cy={sunY} r={40} fill={C.peach} />
          <rect x={0} y={268} width={CARD_W} height={ART_H} fill={C.sage} />
        </g>
      </g>
    </svg>
  );
};

const Door: React.FC<ArtProps> = ({f, s}) => {
  const open = p(f, s + 4, s + 70, E.inOutSoft);
  const x0 = 140;
  const w = 150;
  const top = 92;
  const floor = 340;
  const spill = open;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg width={CARD_W} height={ART_H} viewBox={`0 0 ${CARD_W} ${ART_H}`} style={{position: 'absolute', inset: 0}}>
        <rect x={0} y={floor} width={CARD_W} height={ART_H - floor} fill={C.primary} opacity={0.16} />
        <rect x={x0} y={top} width={w} height={floor - top} fill={C.peach} />
        <polygon
          points={`${x0},${floor} ${x0 + w},${floor} ${x0 + w + mix(0, 130, spill)},${ART_H} ${x0 - mix(0, 20, spill)},${ART_H}`}
          fill={C.peach}
          opacity={0.9 * spill}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: x0,
          top,
          width: w,
          height: floor - top,
          perspective: 700,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: C.primary,
            transformOrigin: 'left center',
            transform: `rotateY(${mix(0, -64, open)}deg)`,
          }}
        >
          <div style={{position: 'absolute', right: 20, top: 128, width: 14, height: 14, borderRadius: 7, background: C.paper}} />
        </div>
      </div>
    </div>
  );
};

const SmileHorizon: React.FC<ArtProps> = ({f, s}) => {
  const rise = p(f, s + 2, s + 76, E.outSoft);
  const bend = mix(0, 52, p(f, s + 18, s + 80, E.inOutSoft));
  const sunY = mix(330, 168, rise);
  const y = 262;
  const curve = `M 46 ${y} Q 215 ${y + bend * 2} 384 ${y}`;
  const above = `M -10 -10 L 440 -10 L 440 ${y} L 384 ${y} Q 215 ${y + bend * 2} 46 ${y} L -10 ${y} Z`;
  return (
    <svg width={CARD_W} height={ART_H} viewBox={`0 0 ${CARD_W} ${ART_H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <clipPath id="m4-sky">
          <path d={above} />
        </clipPath>
      </defs>
      <circle cx={215} cy={sunY} r={74} fill={C.apricot} clipPath="url(#m4-sky)" />
      <path d={curve} stroke={C.primary} strokeWidth={8} strokeLinecap="round" fill="none" />
    </svg>
  );
};

const ARTS: Record<MomentId, React.FC<ArtProps>> = {1: Conversation, 2: ArchWindow, 3: Door, 4: SmileHorizon};

export const MomentCard: React.FC<{
  id: MomentId;
  f: number;
  /** klatka, od której startuje ruch ilustracji */
  start: number;
  /** klatka, od której wjeżdża podpis */
  captionStart?: number;
  /** cień kartki zależny od „wysokości” nad stołem (0..1) */
  lift?: number;
  style?: React.CSSProperties;
  contentOpacity?: number;
  /** mnożnik cienia (pierwsza kartka dostaje cień dopiero, gdy wyjdzie ze szczeliny) */
  shadowAlpha?: number;
}> = ({id, f, start, captionStart, lift = 0, style, contentOpacity = 1, shadowAlpha = 1}) => {
  const m = MOMENTS[id];
  const Art = ARTS[id];
  const cs = captionStart ?? start + 8;
  const shadow = `0 ${mix(3, 26, lift)}px ${mix(8, 54, lift)}px -${mix(2, 20, lift)}px rgba(30, 42, 50, ${mix(0.16, 0.26, lift) * shadowAlpha}), 0 1px 2px rgba(30, 42, 50, ${0.08 * shadowAlpha})`;
  return (
    <div
      style={{
        position: 'absolute',
        width: CARD_W,
        height: CARD_H,
        borderRadius: 12,
        background: C.paper,
        boxShadow: shadow,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{position: 'absolute', inset: 0, opacity: contentOpacity}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: CARD_W, height: ART_H, background: m.bg, overflow: 'hidden'}}>
          <Art f={f} s={start} />
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 20,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.14em',
              color: C.text,
              opacity: 0.55 * p(f, cs, cs + 30),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {m.time}
          </div>
        </div>
        <div style={{position: 'absolute', left: 26, top: ART_H + 26, right: 22}}>
          {m.lines.map((line, i) => {
            const t = p(f, cs + i * 6, cs + i * 6 + 34, E.out);
            return (
              <div key={line} style={{overflow: 'hidden', paddingBottom: 4, marginBottom: -4}}>
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 36,
                    lineHeight: 1.12,
                    letterSpacing: '-0.025em',
                    color: C.text,
                    translate: `0 ${mix(46, 0, t)}px`,
                    opacity: mix(0, 1, Math.min(1, t * 1.6)),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {line}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Img
        src={staticFile('texture/paper-card.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.55 * (0.25 + 0.75 * contentOpacity), pointerEvents: 'none'}}
      />
    </div>
  );
};
