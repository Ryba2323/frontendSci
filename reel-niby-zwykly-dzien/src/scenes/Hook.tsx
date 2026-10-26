/*
 * 0–4 s — „Dzisiaj?” / „Nic szczególnego.”
 * Słowo „Nic” rozchyla się jak szczelina w papierze. Pod spodem leży już pierwsza kartka,
 * a w szczelinie stoi „coś” — przez chwilę czytamy „coś szczególnego.” Potem okno rośnie w kartkę.
 *
 * Dwie warstwy, bo rosnąca kartka ma przykryć „Dzisiaj?” i „szczególnego.”, ale nie połówki „Nic”:
 *   HookBack  — pod światem (kartkami)
 *   HookFront — nad światem
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, SANS, SERIF} from '../theme';
import {T} from '../timeline';
import {E, k, mix, p} from '../lib/anim';
import {NIC, NIC_GLYPHS, SPLIT_Y, slitGap, windowRect} from './hookGeometry';

/** linia tekstu, która wysuwa się spod niewidocznej krawędzi (maska) */
const Rise: React.FC<{f: number; at: number; children: React.ReactNode; style?: React.CSSProperties; dist?: number}> = ({f, at, children, style, dist = 1}) => {
  const t = p(f, at, at + 40, E.out);
  return (
    <div style={{position: 'absolute', overflow: 'hidden', paddingBottom: '0.12em', ...style}}>
      <div style={{translate: `0 ${mix(140 * dist, 0, t)}%`, opacity: mix(0, 1, Math.min(1, t * 1.5))}}>{children}</div>
    </div>
  );
};

export const HookBack: React.FC = () => {
  const f = useCurrentFrame();
  if (f > T.m1 + 20) return null;
  const g = slitGap(f) / 2;
  // „Dzisiaj?” najpierw sam na środku, potem robi miejsce odpowiedzi
  const up = k(f, T.answerIn - 12, T.answerIn + 26, 0, 1, E.inOut);
  const dzY = mix(900, NIC.top - 166, up) - g;
  const away = 1 - p(f, T.windowGrow, T.windowGrow + 16, E.inOut);
  return (
    <>
      <Rise f={f} at={T.dzisiajIn} style={{left: NIC.x + 6, top: dzY, opacity: away}}>
        <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 124, letterSpacing: '-0.035em', lineHeight: 1, color: up > 0 ? `rgba(30, 42, 50, ${mix(1, 0.42, up)})` : C.text}}>
          Dzisiaj?
        </div>
      </Rise>
      <Rise f={f} at={T.answerIn + 30} style={{left: NIC.x + 8, top: NIC.top + NIC.size + 18 + g}}>
        <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 112, letterSpacing: '-0.035em', lineHeight: 1, color: C.text}}>szczególnego.</div>
      </Rise>
    </>
  );
};

const NicWord: React.FC = () => (
  <div style={{fontFamily: SANS, fontWeight: 800, fontSize: NIC.size, letterSpacing: '-0.05em', lineHeight: 1, color: C.text, whiteSpace: 'nowrap'}}>Nic</div>
);

export const HookFront: React.FC = () => {
  const f = useCurrentFrame();
  if (f > T.m1 + 20) return null;
  const w = windowRect(f);
  const split = SPLIT_Y - NIC.top;
  // połówki jadą na krawędziach okna, a gdy okno rośnie w kartkę — znikają
  const topDy = w.y - SPLIT_Y;
  const botDy = w.y + w.h - SPLIT_Y;
  const halvesOut = 1 - p(f, T.windowGrow, T.windowGrow + 14, E.inOut);
  const cosIn = p(f, T.slitOpen + 10, T.cosFull + 4, E.out);
  const cosOut = 1 - p(f, T.windowGrow, T.windowGrow + 18, E.inOut);
  const nicIn = p(f, T.answerIn + 16, T.answerIn + 54, E.out);
  return (
    <>
      {/* „coś” w szczelinie — przycięte do okna */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${w.y}px ${1080 - w.x - w.w}px ${1920 - w.y - w.h}px ${w.x}px round ${w.r}px)`}}>
        <div
          style={{
            position: 'absolute',
            left: NIC_GLYPHS.x,
            width: NIC_GLYPHS.w,
            textAlign: 'center',
            top: SPLIT_Y - 168,
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 232,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: C.text,
            opacity: cosIn * cosOut,
            scale: `${mix(0.94, 1, cosIn) * mix(1.05, 1, cosOut)}`,
            transformOrigin: '50% 70%',
          }}
        >
          coś
        </div>
      </div>
      {/* „Nic”: górna i dolna połówka */}
      <div style={{position: 'absolute', left: NIC.x, top: NIC.top, overflow: nicIn < 1 ? 'hidden' : 'visible', height: NIC.size * 1.1}}>
        <div style={{translate: `0 ${mix(104, 0, nicIn)}%`}}>
          <div style={{position: 'relative'}}>
            <div style={{clipPath: `inset(-20px -20px ${NIC.size - split}px -20px)`, translate: `0 ${topDy}px`, opacity: halvesOut}}>
              <NicWord />
            </div>
            <div style={{position: 'absolute', left: 0, top: 0, clipPath: `inset(${split}px -20px -20px -20px)`, translate: `0 ${botDy}px`, opacity: halvesOut}}>
              <NicWord />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
