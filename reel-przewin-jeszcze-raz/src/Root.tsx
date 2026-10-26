import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
import './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="PrzewinJeszczeRaz" component={Film} durationInFrames={1200} fps={60} width={1080} height={1920} defaultProps={{withAudio: true}} />
      {/* podgląd bez dźwięku (szybsze próbne klatki) */}
      <Composition id="PrzewinPodglad" component={Film} durationInFrames={1200} fps={60} width={1080} height={1920} defaultProps={{withAudio: false}} />
      {/* kontrola: logo na jaskrawym tle — nie może być widać żadnego prostokąta wokół PNG */}
      <Composition id="LogoTest" component={Film} durationInFrames={1200} fps={60} width={1080} height={1920} defaultProps={{withAudio: false, testBg: '#5B2E8C'}} />
    </>
  );
};
