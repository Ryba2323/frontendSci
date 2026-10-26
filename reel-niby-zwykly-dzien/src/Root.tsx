import React from 'react';
import {Composition} from 'remotion';
import {NibyZwyklyDzien} from './NibyZwyklyDzien';
import './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NibyZwyklyDzien"
      component={NibyZwyklyDzien}
      durationInFrames={1200}
      fps={60}
      width={1080}
      height={1920}
    />
  );
};
