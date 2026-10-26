// Wykończenie obrazu: delikatna winieta i ziarno (deterministyczne — numer kafla z klatki).
import { staticFile } from 'remotion';
import { useT } from '../lib/time';

export const Finish = () => {
  const t = useT();
  const f = Math.floor(t);
  const g = f % 8;
  const ox = (f * 137) % 512, oy = (f * 251) % 512;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.32) 100%)', pointerEvents: 'none' }} />
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.075, mixBlendMode: 'overlay',
          backgroundImage: `url(${staticFile(`grain/g${g}.png`)})`, backgroundSize: '512px 512px', backgroundPosition: `${ox}px ${oy}px`,
        }}
      />
    </>
  );
};
