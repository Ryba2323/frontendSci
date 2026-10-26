/*
 * Jedyne dwa zdania w świecie filmu. Krój aplikacji (Plus Jakarta Sans), mały i spokojny —
 * film ma działać także bez nich.
 *   „Czekaj.”  — pojawia się przy zatrzymanej kropli; przy przewijaniu litery cofają się od końca
 *   „Czasem warto spojrzeć jeszcze raz.” — na ścianie pokoju, pod oknem
 */
import React from 'react';
import {C, SANS} from './theme';
import {T} from './timeline';
import {E, mix, p} from './lib/anim';
import {Cam, planeTransform, project, Z} from './world/camera';
import {dropletPos} from './world/Table';

export const WaitText: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
  if (f < T.wait || f > T.rewind + 30) return null;
  const d = dropletPos(T.freeze, 0);
  const at = project(cam, Z.table, d.x + 22, d.y - 6);
  const letters = 'Czekaj.'.split('');
  return (
    <div style={{position: 'absolute', left: at.x, top: at.y - 30, display: 'flex', fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: '-0.01em', color: C.ink}}>
      {letters.map((ch, i) => {
        const tin = p(f, T.wait + i * 3, T.wait + i * 3 + 16, E.out);
        // przewijanie: od ostatniej litery
        const tout = p(f, T.rewind + (letters.length - 1 - i) * 2.5, T.rewind + (letters.length - 1 - i) * 2.5 + 10, E.in);
        const o = tin * (1 - tout);
        return (
          <span key={i} style={{display: 'inline-block', opacity: o, translate: `${mix(-6, 0, tin) + tout * 10}px ${mix(10, 0, tin)}px`}}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

export const SentenceText: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
  if (f < T.sentence || f > T.toNotebook + 70) return null;
  const t = planeTransform(cam, Z.wall);
  const lines = ['Czasem warto spojrzeć', 'jeszcze raz.'];
  const out = p(f, T.toNotebook + 4, T.toNotebook + 34, E.inOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1080,
        transformOrigin: '0 0',
        transform: `translate(${t.bx}px, ${t.by}px) scale(${t.k})`,
        opacity: 1 - out,
      }}
    >
      {lines.map((line, i) => {
        const a = T.sentence + i * 14;
        const tin = p(f, a, a + 50, E.out);
        return (
          <div key={line} style={{position: 'absolute', left: 0, width: 1080, top: 1112 + i * 74, textAlign: 'center', overflow: 'hidden', paddingBottom: 10}}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 60,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                color: C.ink,
                translate: `0 ${mix(70, 0, tin)}px`,
                opacity: Math.min(1, tin * 1.4),
                filter: `blur(${mix(6, 0, tin)}px)`,
                paddingLeft: 160,
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
    </div>
  );
};
