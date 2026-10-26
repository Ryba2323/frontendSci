/*
 * ReLeaf — „Niby zwykły dzień.” (reels 1080 × 1920, 60 fps, 20 s)
 *
 * 0–4 s    Hook   „Dzisiaj?” / „Nic szczególnego.” — „Nic” rozchyla się na „coś”
 * 4–10 s   Story  małe chwile dnia lądują jak kartki na stosie
 * 10–15 s  Story  kamera się cofa: kartki to strona jednego dnia — „Może jednak coś się działo.”
 * 15–18 s  Story  strona układa się w ekran aplikacji „Co dziś miało znaczenie?”
 * 18–20 s  Brand  ekran zapada się w tułów motyla, skrzydła się otwierają, hasło
 */
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {C} from './theme';
import {HookBack, HookFront} from './scenes/Hook';
import {Story} from './scenes/Story';
import {Brand} from './scenes/Brand';

export const NibyZwyklyDzien: React.FC = () => {
  return (
    <AbsoluteFill style={{background: C.cream, overflow: 'hidden'}}>
      {/* ciepłe światło na „stole” + faktura papieru */}
      <AbsoluteFill style={{background: `radial-gradient(1200px 1300px at 50% 38%, rgba(255, 252, 245, .9), rgba(255, 252, 245, 0) 70%), linear-gradient(180deg, ${C.cream} 0%, ${C.creamDeep} 100%)`}} />
      <Img src={staticFile('texture/paper-screen.png')} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, mixBlendMode: 'multiply', opacity: 0.7}} />

      <HookBack />
      <Story />
      <HookFront />
      <Brand />

      <Audio src={staticFile('audio/niby-zwykly-dzien.wav')} />
    </AbsoluteFill>
  );
};
