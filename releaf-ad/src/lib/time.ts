// Czas filmu w klatkach 60 fps. Przy renderze z motion blurem kompozycja ma 4× więcej klatek
// (podklatki migawki 180°), a cały ruch liczony jest z ułamkowego t — dlatego nic nie zależy od fps kompozycji.
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { DURATION } from '../timing';

export const SUB = 8;                 // podklatki na klatkę
export const SHUTTER = 0.5;           // migawka 180°
export const useT = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = durationInFrames / DURATION;
  if (k === 1) return f;
  const frame = Math.floor(f / k), s = f % k;
  return frame + (s / k) * SHUTTER;
};
