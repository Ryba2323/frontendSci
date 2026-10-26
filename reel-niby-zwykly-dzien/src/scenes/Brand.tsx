/*
 * 18–20 s — marka. Ekran aplikacji zapadł się w pionową kreskę (Story), z niej rodzi się tułów motyla,
 * a skrzydła otwierają się raz, spokojnie — lustrzane odbicie poziomej szczeliny w „Nic” z początku filmu.
 * Potem napis ReLeaf i hasło.
 */
import React from 'react';
import {Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, SANS} from '../theme';
import {T} from '../timeline';
import {E, mix, p} from '../lib/anim';
import {LOGO, LOGO_LEFT, LOGO_S, LOGO_SRC} from './brandGeometry';

const layer: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: '100%', height: '100%'};

export const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (f < T.collapse + 18) return null;

  const body = p(f, T.collapse + 20, T.collapse + 30, E.inOut);
  // jedno otwarcie skrzydeł, z leciutkim „dociągnięciem” na końcu
  const open = spring({frame: f - T.wings, fps, config: {damping: 15, stiffness: 70, mass: 0.9}, durationInFrames: 60});
  const angle = mix(88, 0, open);
  const wingsVisible = f >= T.wings ? 1 : 0;
  const word = p(f, T.wordmark, T.wordmark + 36, E.out);
  const tag1 = p(f, T.tagline, T.tagline + 40, E.out);
  const tag2 = p(f, T.tagline + 10, T.tagline + 50, E.out);
  const drift = mix(1, 1.025, p(f, T.wings, 1200, E.linear));

  const w = LOGO_SRC.w * LOGO_S;
  const h = LOGO_SRC.h * LOGO_S;
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: '540px 900px', scale: `${drift}`}}>
      <div style={{position: 'absolute', left: LOGO_LEFT, top: LOGO.top, width: w, height: h, perspective: 1600}}>
        <Img src={staticFile('logo/body.png')} style={{...layer, opacity: body}} />
        <Img
          src={staticFile('logo/wing-left.png')}
          style={{...layer, opacity: wingsVisible, transformOrigin: `${(LOGO_SRC.hingeL / LOGO_SRC.w) * 100}% 55%`, transform: `rotateY(${-angle}deg)`}}
        />
        <Img
          src={staticFile('logo/wing-right.png')}
          style={{...layer, opacity: wingsVisible, transformOrigin: `${(LOGO_SRC.hingeR / LOGO_SRC.w) * 100}% 55%`, transform: `rotateY(${angle}deg)`}}
        />
        <Img src={staticFile('logo/wordmark.png')} style={{...layer, opacity: word, translate: `0 ${mix(22, 0, word)}px`}} />
      </div>
      <div style={{position: 'absolute', left: 0, width: 1080, top: LOGO.top + h + 70, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 54, lineHeight: 1.22, letterSpacing: '-0.02em'}}>
        <div style={{opacity: tag1, translate: `0 ${mix(26, 0, tag1)}px`, color: C.text}}>Poznaj swój dzień.</div>
        <div style={{opacity: tag2, translate: `0 ${mix(26, 0, tag2)}px`, color: C.primaryDark}}>Poznaj siebie.</div>
      </div>
    </div>
  );
};
