import { Composition } from 'remotion';
import { Film } from './Film';
import { DURATION, FPS } from './timing';
import { SUB } from './lib/time';

export const RemotionRoot = () => (
  <>
    {/* Podgląd i render bez motion bluru */}
    <Composition id="ReLeaf30" component={Film} width={1080} height={1920} fps={FPS} durationInFrames={DURATION} />
    {/* Render końcowy: 8 podklatek na klatkę → uśrednione w FFmpeg (migawka 180°) */}
    <Composition id="ReLeaf30-subframes" component={Film} width={1080} height={1920} fps={FPS * SUB} durationInFrames={DURATION * SUB} />
  </>
);
