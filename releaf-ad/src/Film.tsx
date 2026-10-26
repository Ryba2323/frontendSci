import { AbsoluteFill, Audio, staticFile, useVideoConfig } from 'remotion';
import { C } from './brand/palette';
import { Finish } from './overlays/Finish';
import { Product } from './overlays/Product';
import { Scene3D } from './world/Scene3D';

export const Film = ({ audio = true }: { audio?: boolean }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <Scene3D />
      <Product />
      <Finish />
      {audio && fps === 60 && <Audio src={staticFile('audio/soundtrack.wav')} />}
    </AbsoluteFill>
  );
};
