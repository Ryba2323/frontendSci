/*
 * 4–18 s — jeden ciągły „świat” oglądany przez kamerę:
 *   4–10 s   kamera blisko czyta stronę zygzakiem: kolejne chwile spadają na stół jak kartki
 *   10–15 s  kamera się cofa, luźne kartki wskakują w porządek strony dnia — „Może jednak coś się działo.”
 *   15–18 s  strona układa się w prawdziwy ekran aplikacji: kartki stają się wierszami
 *            pytania „Co dziś miało znaczenie?”, a odpowiedzi zaznaczają się na „Dobrze”.
 * Świat ma wymiary ekranu (1080 × 1920); przy przybliżeniu 1 to, co widać, to gotowa strona.
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, SANS, SERIF} from '../theme';
import {T} from '../timeline';
import {E, k, mix, mixColor, p} from '../lib/anim';
import {CARD_H, CARD_W, MomentCard, MomentId} from '../components/MomentCard';
import {AreaId, CheckinAreasScreen, rowRect, SCREEN_H, SCREEN_W} from '../components/CheckinAreasScreen';
import {windowRect, Z0} from './hookGeometry';
import {BODY} from './brandGeometry';

type Pose = {x: number; y: number; rot: number; lift: number};

// ekran aplikacji w świecie: skala 2 (390 px CSS → 780 px), wyśrodkowany
export const APP = {s: 2, x: 540 - SCREEN_W, y: 960 - SCREEN_H};

// każda kartka: gdzie ląduje luźno, gdy kamera jest blisko, i gdzie stoi na gotowej stronie dnia
const CARDS: Record<MomentId, {loose: Pose; cell: Pose; land: number; area: AreaId}> = {
  1: {loose: {x: 80, y: 498, rot: 0, lift: 0.25}, cell: {x: 80, y: 498, rot: -1.4, lift: 0}, land: T.m1, area: 'friends'},
  2: {loose: {x: 604, y: 500, rot: 4.5, lift: 0.25}, cell: {x: 572, y: 542, rot: 1.3, lift: 0}, land: T.m2Land, area: 'nature'},
  3: {loose: {x: 54, y: 1104, rot: -4, lift: 0.25}, cell: {x: 80, y: 1072, rot: 0.9, lift: 0}, land: T.m3Land, area: 'study'},
  4: {loose: {x: 594, y: 1142, rot: 3.2, lift: 0.25}, cell: {x: 572, y: 1116, rot: -1.0, lift: 0}, land: T.m4Land, area: 'food'},
};
const ORDER: MomentId[] = [1, 2, 3, 4];

const mixPose = (a: Pose, b: Pose, t: number): Pose => ({x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), rot: mix(a.rot, b.rot, t), lift: mix(a.lift, b.lift, t)});

type Cam = {cx: number; cy: number; z: number; rot: number};
const camOn = (id: MomentId): Omit<Cam, 'z'> => {
  const l = CARDS[id].loose;
  // kamera przechyla się razem z kartką, żeby podpis był prosty; po cofnięciu widać, że kartki leżą krzywo
  return {cx: l.x + CARD_W / 2, cy: l.y + CARD_H / 2, rot: -l.rot * 0.75};
};

/**
 * Kamera czyta stronę jak gazetę: A → B → C → D (zygzakiem), potem się cofa.
 * Przy przelocie lekko się oddala — jakby ktoś podnosił wzrok znad kartki.
 */
export const cameraAt = (f: number): Cam => {
  const creep = f < T.m1 ? Z0 : mix(Z0, 2.34, Math.min(1, (f - T.m1) / (T.pullBack - T.m1)));
  if (f < T.pullBack) {
    let c = camOn(1);
    let dip = 0;
    ([2, 3, 4] as MomentId[]).forEach((id) => {
      const n = camOn(id);
      const dist = Math.hypot(n.cx - c.cx, n.cy - c.cy);
      // dłuższy przelot = trochę więcej czasu i mocniejsze „podniesienie wzroku”, żeby ruch był spokojny
      const dur = id === 3 ? 46 : 36;
      const t = p(f, CARDS[id].land - dur, CARDS[id].land, E.inOut);
      if (t > 0) {
        dip = Math.max(dip, Math.sin(Math.PI * t) * (0.05 + 0.00014 * dist));
        c = {cx: mix(c.cx, n.cx, t), cy: mix(c.cy, n.cy, t), rot: mix(c.rot, n.rot, t)};
      }
    });
    return {...c, z: creep * (1 - dip)};
  }
  const d = camOn(4);
  const t = p(f, T.pullBack, T.pullBack + 96, E.inOutSoft);
  // dojazd zoomu w skali logarytmicznej — oddalanie wygląda równo
  const z = Math.exp(mix(Math.log(2.34), 0, t));
  let zz = z;
  if (f >= T.pullBack + 96) zz = f < T.toApp ? k(f, T.pullBack + 96, T.toApp, 1, 1.03, E.inOutSoft) : k(f, T.toApp, T.toApp + 60, 1.03, 1, E.inOutSoft);
  // oddalanie „zakotwiczone” w jednym punkcie ekranu: kartka D zjeżdża prosto na swoje miejsce w rogu strony
  const tc = Math.min(1, Math.max(0, (2.34 / z - 1) / (2.34 - 1)));
  return {cx: mix(d.cx, 540, tc), cy: mix(d.cy, 960, tc), rot: mix(d.rot, 0, t), z: zz};
};

const Masthead: React.FC<{f: number; o: number}> = ({f, o}) => {
  const t = p(f, T.headline - 18, T.headline + 22);
  const rule = p(f, T.headline - 22, T.headline + 30, E.inOut);
  return (
    <div style={{position: 'absolute', left: 80, top: 96, width: 920, opacity: o}}>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontWeight: 700, fontSize: 21, letterSpacing: '0.14em', opacity: t, translate: `0 ${mix(14, 0, t)}px`}}>
        <span style={{color: C.primaryDark}}>PONIEDZIAŁEK, 26 PAŹDZIERNIKA</span>
        <span style={{color: C.textMuted}}>WYDANIE SPECJALNE</span>
      </div>
      <div style={{marginTop: 18, height: 2, background: C.text, opacity: 0.85, width: `${rule * 100}%`}} />
    </div>
  );
};

const Headline: React.FC<{f: number; o: number}> = ({f, o}) => {
  const line = (at: number, children: React.ReactNode, top: number) => {
    const t = p(f, at, at + 46, E.out);
    return (
      <div style={{position: 'absolute', left: 74, top, overflow: 'hidden', paddingBottom: 18}}>
        <div style={{translate: `0 ${mix(110, 0, t)}%`, fontFamily: SANS, fontWeight: 800, fontSize: 110, lineHeight: 1, letterSpacing: '-0.04em', color: C.text, whiteSpace: 'nowrap'}}>{children}</div>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      {line(T.headline, 'Może jednak', 168)}
      {line(
        T.headline + 12,
        <>
          <span style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 124, letterSpacing: '-0.02em', color: C.primaryDark}}>coś </span>
          się działo.
        </>,
        282,
      )}
    </div>
  );
};

// drobne chwile, których nie widzieliśmy z bliska — przyklejone jak karteczki
const TAGS = [
  {text: 'ciepła herbata', x: 344, y: 1000, rot: -4, at: 0},
  {text: 'piosenka w autobusie', x: 640, y: 470, rot: 3, at: 8},
  {text: 'słońce na schodach', x: 120, y: 1660, rot: -2.5, at: 16},
];

const Tags: React.FC<{f: number; o: number}> = ({f, o}) => (
  <>
    {TAGS.map((tg) => {
      const s0 = T.pullBack + 104 + tg.at;
      const t = p(f, s0, s0 + 34, E.out);
      return (
        <div
          key={tg.text}
          style={{
            position: 'absolute',
            left: tg.x,
            top: tg.y,
            padding: '12px 22px',
            borderRadius: 999,
            background: C.paper,
            boxShadow: `0 ${mix(18, 6, t)}px ${mix(30, 14, t)}px -10px rgba(30, 42, 50, .22)`,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '-0.01em',
            color: C.text,
            whiteSpace: 'nowrap',
            rotate: `${tg.rot + mix(6, 0, t)}deg`,
            scale: `${mix(1.12, 1, t)}`,
            opacity: Math.min(1, t * 2) * o,
          }}
        >
          {tg.text}
        </div>
      );
    })}
  </>
);

const Footer: React.FC<{f: number; o: number}> = ({f, o}) => {
  const t = p(f, T.pullBack + 120, T.pullBack + 160);
  return (
    <div style={{position: 'absolute', left: 80, top: 1770, width: 920, opacity: t * o}}>
      <div style={{height: 1.5, background: C.text, opacity: 0.35}} />
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16}}>
        <span style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 38, color: C.text}}>Niby zwykły dzień.</span>
        <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 20, letterSpacing: '0.14em', color: C.textMuted}}>S. 1</span>
      </div>
    </div>
  );
};

export const Story: React.FC = () => {
  const f = useCurrentFrame();
  const cam = cameraAt(f);
  const Z = cam.z;
  const rad = (cam.rot * Math.PI) / 180;

  // --- kartki ---
  const pageOut = 1 - p(f, T.toApp - 4, T.toApp + 14, E.inOut); // elementy strony gasną przy przejściu w aplikację
  const morphT = (id: MomentId) => p(f, T.toApp + (id - 1) * 4, T.toApp + 50 + (id - 1) * 4, E.inOutSoft);

  const cardEls = ORDER.map((id) => {
    const c = CARDS[id];
    if (id !== 1 && f < c.land - 30) return null;
    // kartka spada na stół tuż przed kamerą: z góry, lekko obrócona, cień maleje przy zetknięciu
    const drop = id === 1 ? 1 : p(f, c.land - 30, c.land + 2, E.out);
    let pose: Pose = {
      x: c.loose.x + mix(-14, 0, drop),
      y: c.loose.y + mix(-60, 0, drop),
      rot: c.loose.rot + mix(5, 0, drop),
      lift: mix(1, c.loose.lift, p(f, c.land - 10, c.land + 6)),
    };
    const dropScale = mix(1.07, 1, drop);
    const dropOpacity = id === 1 ? 1 : Math.min(1, drop * 3);
    // kamera się cofa → kartki „wskakują” w porządek strony (ostatnia rusza ostatnia)
    const settle = p(f, T.pullBack + 10 + (id - 1) * 6, T.pullBack + 86 + (id - 1) * 4, E.inOutSoft);
    if (settle > 0) pose = {...mixPose(pose, c.cell, settle), lift: mix(pose.lift, 0, settle) + 0.45 * Math.sin(settle * Math.PI)};
    if (id === 1 && f < T.pullBack) pose = {...pose, rot: 0};
    // morf: kartka → wiersz ekranu aplikacji
    const m = morphT(id);
    const r = rowRect(c.area);
    const row = {x: APP.x + r.x * APP.s, y: APP.y + r.y * APP.s, w: r.w * APP.s, h: r.h * APP.s};
    const w = mix(CARD_W, row.w, m);
    const h = mix(CARD_H, row.h, m);
    const x = mix(pose.x, row.x, m);
    const y = mix(pose.y, row.y, m);
    const rot = mix(pose.rot, 0, m);
    const lift = mix(pose.lift, 0, m) + 0.35 * Math.sin(m * Math.PI);

    // pierwsza kartka do 4 s jest widoczna tylko przez szczelinę w „Nic”
    let clip: string | undefined;
    if (id === 1 && f < T.m1 + 6) {
      const wr = windowRect(f);
      const lx = (sx: number) => (sx - 540) / Z + cam.cx - pose.x;
      const ly = (sy: number) => (sy - 960) / Z + cam.cy - pose.y;
      clip = `inset(${ly(wr.y)}px ${CARD_W - lx(wr.x + wr.w)}px ${CARD_H - ly(wr.y + wr.h)}px ${lx(wr.x)}px round ${wr.r / Z}px)`;
    }
    return (
      <MomentCard
        key={id}
        id={id}
        f={f}
        start={id === 1 ? T.m1 - 8 : c.land - 12}
        captionStart={id === 1 ? T.m1 + 4 : c.land - 2}
        lift={lift}
        shadowAlpha={(id === 1 ? p(f, T.m1 + 6, T.m1 + 30) : 1) * (1 - m)}
        contentOpacity={1 - p(f, T.toApp - 2 + (id - 1) * 4, T.toApp + 16 + (id - 1) * 4, E.inOut)}
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          rotate: `${rot}deg`,
          scale: `${m > 0 ? 1 : dropScale}`,
          opacity: dropOpacity,
          clipPath: clip,
          borderRadius: mix(12, 18 * APP.s, m),
          background: mixColor(C.paper, C.surface, m),
          border: m > 0 ? `${1.5 * APP.s * m}px solid ${C.line}` : undefined,
          boxSizing: 'border-box',
        }}
      />
    );
  });

  // --- ekran aplikacji ---
  const appT = p(f, T.toApp + 2, T.toApp + 50, E.inOutSoft);
  const appIn = p(f, T.toApp + 2, T.toApp + 24, E.inOut);
  const headIn = p(f, T.toApp + 26, T.toApp + 62, E.out);
  const otherRows = p(f, T.toApp + 32, T.toApp + 66, E.out);
  // zawartość wiersza pojawia się dopiero, gdy kartka prawie do niego dojedzie
  const mappedIn: Partial<Record<AreaId, number>> = {};
  ORDER.forEach((id) => {
    const m = morphT(id);
    mappedIn[CARDS[id].area] = k(m, 0.72, 1, 0, 1, E.linear);
  });
  const picks: Partial<Record<AreaId, number>> = {};
  (['food', 'friends', 'nature', 'study'] as AreaId[]).forEach((a, i) => {
    picks[a] = p(f, T.picks[i], T.picks[i] + 12, E.out);
  });
  const answered = p(f, T.picks[0] + 2, T.picks[0] + 16, E.out);
  const frame = {
    x: mix(0, APP.x, appT),
    y: mix(0, APP.y, appT),
    w: mix(1080, SCREEN_W * APP.s, appT),
    h: mix(1920, SCREEN_H * APP.s, appT),
    r: mix(0, 64, appT),
  };

  // 18 s: ekran zapada się w pionową kreskę — tułów motyla z logo
  // najpierw zwęża się w pionową wstęgę (echo szczeliny z początku), potem skraca do wysokości tułowia
  const cx = p(f, T.collapse, T.collapse + 18, E.inOut);
  const cy = p(f, T.collapse + 8, T.collapse + 27, E.inOut);
  const teal = p(f, T.collapse + 4, T.collapse + 16, E.inOut);
  if (f >= T.collapse + 30) return null;
  const gone = 1 - p(f, T.collapse + 22, T.collapse + 30, E.linear);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        transformOrigin: '0 0',
        translate: `${540 - Z * (cam.cx * Math.cos(rad) - cam.cy * Math.sin(rad))}px ${960 - Z * (cam.cx * Math.sin(rad) + cam.cy * Math.cos(rad))}px`,
        rotate: `${cam.rot}deg`,
        scale: `${Z}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '540px 960px',
          translate: `${(BODY.x - 540) * cx}px ${(BODY.y - 960) * cy}px`,
          scale: `${mix(1, 0.006, cx)} ${mix(1, BODY.h / (SCREEN_H * APP.s), cy)}`,
          opacity: gone,
        }}
      >
      {f >= T.toApp && (
        <div
          style={{
            position: 'absolute',
            left: frame.x,
            top: frame.y,
            width: frame.w,
            height: frame.h,
            borderRadius: frame.r,
            overflow: 'hidden',
            background: C.bg,
            opacity: appIn,
            boxShadow: `0 50px 90px -50px rgba(30, 42, 50, ${0.45 * appT}), 0 2px 6px rgba(30, 42, 50, ${0.06 * appT})`,
          }}
        >
          <div style={{position: 'absolute', left: APP.x - frame.x, top: APP.y - frame.y, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', scale: `${APP.s}`}}>
            <CheckinAreasScreen layer="base" mapped={['friends', 'nature', 'study', 'food']} picks={picks} answered={answered} headOpacity={headIn} contentOpacity={otherRows} />
          </div>
        </div>
      )}

      {f >= T.pullBack - 10 && (
        <>
          <Masthead f={f} o={pageOut} />
          <Headline f={f} o={pageOut} />
          <Footer f={f} o={pageOut} />
        </>
      )}

      {cardEls}

      {f >= T.pullBack && <Tags f={f} o={pageOut} />}

      {f >= T.toApp + 20 && (
        <div style={{position: 'absolute', left: APP.x, top: APP.y, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', scale: `${APP.s}`}}>
          <CheckinAreasScreen layer="mapped" mapped={['friends', 'nature', 'study', 'food']} picks={picks} answered={answered} rowOpacity={mappedIn} />
        </div>
      )}
      {teal > 0 && <div style={{position: 'absolute', left: APP.x, top: APP.y, width: SCREEN_W * APP.s, height: SCREEN_H * APP.s, borderRadius: 64, background: C.primary, opacity: teal}} />}
      </div>
    </div>
  );
};
