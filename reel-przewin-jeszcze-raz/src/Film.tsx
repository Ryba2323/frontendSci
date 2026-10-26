/*
 * ReLeaf — „Przewiń jeszcze raz.” (reels 1080 × 1920, 60 fps, 20 s)
 *
 * Jeden świat 2.5D i jedna kamera (src/world/camera.ts):
 *   0–3 s    stół w słońcu: kubek staje, kropla podskakuje… i czas staje. „Czekaj.”
 *   3–9 s    przewijanie: kropla wraca do herbaty, brzeg kubka przechodzi w kabel słuchawek,
 *            kabel unosi się jako fala dźwięku, wpada w plamę słońca na ścianie,
 *            a plama staje się oknem tramwaju
 *   9–15 s   pasażer ze słuchawkami, tramwaj odjeżdża, przy drzwiach kawiarni spotykają się dwie osoby;
 *            kamera cofa się przez okno pokoju — to wszystko działo się za oknem tego samego pokoju.
 *            „Czasem warto spojrzeć jeszcze raz.”
 *   15–18 s  notes ze stołu → prawdziwy ekran notatki z aplikacji („Chcesz coś dopisać?”)
 *   18–20 s  dwie strony notesu stają się skrzydłami, grzbiet tułowiem — oficjalne logo ReLeaf
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {staticFile} from 'remotion';
import {T} from './timeline';
import {E, k, mix, p} from './lib/anim';
import {cameraAt, tramDx, Z} from './world/camera';
import {Plane} from './world/Plane';
import {Cafe, City, Sky, Tram} from './world/Outside';
import {Wall} from './world/Wall';
import {Table} from './world/Table';
import {worldTime} from './world/time';
import {holeAt, patchAt} from './world/portal';
import {Thread} from './world/Thread';
import {SentenceText, WaitText} from './Texts';
import {Finale} from './ui/Finale';
import {Backdrop} from './ui/Backdrop';

export const Film: React.FC<{withAudio?: boolean; testBg?: string}> = ({withAudio = true, testBg}) => {
  const f = useCurrentFrame();
  const cam = cameraAt(f);
  const fEff = worldTime(f);

  // przechodzień idzie do drzwi kawiarni (przeszłość), w teraźniejszości już tam stoi
  const walkT = p(f, T.walker, T.meet, E.linear);
  const walking = f >= T.walker && f < T.meet + 10;
  const walkerX = f < T.walker - 200 || f >= T.meet ? 670 : mix(330, 670, E.outSoft(walkT));
  const walkPhase = walking ? (f - T.walker) / 5.2 : 0;
  const stride = walking ? 1 - p(f, T.meet - 24, T.meet + 6, E.inOut) : 0;
  const meet = p(f, T.meet - 6, T.meet + 30, E.inOut);
  const inJourney = f >= T.portal - 20 && f < T.pullBack + 60;

  const nod = Math.sin((f / 36) * Math.PI) * 2.2;

  const patch = patchAt(f);
  const hole = holeAt(f, cam);

  // głębia ostrości: ulica lekko rozmyta, gdy patrzymy na stół
  const outsideBlur = inJourney ? 0 : f < T.pullBack ? 3.5 : k(f, T.pullBackEnd - 40, T.pullBackEnd, 0, 1.2);

  // zatrzymanie czasu: świat lekko traci kolor (jakby ktoś zatrzymał kadr), przy przewijaniu kolor wraca
  const frozen = p(f, T.freeze, T.freeze + 8, E.out) * (1 - p(f, T.rewind, T.rewind + 30, E.inOut));

  return (
    <AbsoluteFill style={{background: '#F3E9DB', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: frozen > 0.001 ? `saturate(${1 - 0.22 * frozen}) brightness(${1 + 0.02 * frozen})` : undefined}}>
      <Plane cam={cam} z={Z.sky} name="sky">
        <Sky f={f} />
      </Plane>
      <Plane cam={cam} z={Z.city} name="city" blur={outsideBlur}>
        <City />
      </Plane>
      <Plane cam={cam} z={Z.cafe} name="cafe" blur={outsideBlur * 0.8}>
        <Cafe f={f} walkerX={walkerX} walkPhase={walkPhase} stride={stride} meet={meet} />
      </Plane>
      {inJourney && f < T.tramLeaves + 120 && (
        <Plane cam={cam} z={Z.tram} name="tram">
          <Tram f={f} dx={tramDx(f)} nod={nod} />
        </Plane>
      )}
      <Plane cam={cam} z={Z.wall} name="wall" near={24} opacity={Math.min(1, Math.max(0, (Z.wall - cam.z - 24) / 90))}>
        <Wall f={f} patch={patch.shape} patchLight={patch.light} hole={hole.amount} holeShape={hole.shape} curtainSway={Math.sin(f / 90) * 0.6} />
      </Plane>
      <Plane cam={cam} z={Z.table} name="table" near={60} opacity={Math.min(1, Math.max(0, (Z.table - cam.z - 130) / 240))}>
        <Table fEff={fEff} cableOpacity={f >= T.rimToCable + 48 && f < T.pullBack ? 0 : 1} sweep={0} />
      </Plane>
      </AbsoluteFill>
      <Thread f={f} cam={cam} />
      <WaitText f={f} cam={cam} />
      <SentenceText f={f} cam={cam} />
      <Backdrop f={f} />
      {/* test przezroczystości logo: jaskrawe tło zamiast kremowego (kompozycja LogoTest) */}
      {testBg && f >= T.fold && <AbsoluteFill style={{background: testBg}} />}
      <Finale f={f} cam={cam} />
      {withAudio && <Audio src={staticFile('audio/przewin-jeszcze-raz.wav')} />}
    </AbsoluteFill>
  );
};
