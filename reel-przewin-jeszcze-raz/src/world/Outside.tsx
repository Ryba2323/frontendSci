/*
 * Ulica za oknem — kilka warstw na różnych głębokościach:
 *   niebo (z = 30000), dachy miasta (4500), kamienica z kawiarnią i chodnik (2900), tramwaj (2300).
 * Ciepłe popołudniowe światło; drzwi i witryna kawiarni świecą od środka.
 */
import React from 'react';
import {C} from '../theme';
import {Passenger, Person} from './People';

const svgStyle: React.CSSProperties = {position: 'absolute', left: 0, top: 0, overflow: 'visible'};

export const Sky: React.FC<{f: number}> = ({f}) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={svgStyle}>
    <defs>
      <linearGradient id="o-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F3D9C4" />
        <stop offset="0.35" stopColor="#F8E6D6" />
        <stop offset="0.7" stopColor="#FBF0E4" />
        <stop offset="1" stopColor="#FCF4EA" />
      </linearGradient>
      <radialGradient id="o-sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFF7EA" />
        <stop offset="1" stopColor="#FFF7EA" stopOpacity={0} />
      </radialGradient>
      <filter id="o-cloud" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={10} />
      </filter>
    </defs>
    <rect x={-3000} y={-3000} width={7080} height={7920} fill="url(#o-sky)" />
    <circle cx={330} cy={300} r={320} fill="url(#o-sun)" opacity={0.8} />
    <g fill="#FFFAF3" opacity={0.75} filter="url(#o-cloud)">
      <ellipse cx={520 + f * 0.05} cy={262} rx={170} ry={22} />
      <ellipse cx={820 + f * 0.04} cy={330} rx={120} ry={16} />
    </g>
  </svg>
);

export const City: React.FC = () => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={svgStyle}>
    {/* dalszy rząd dachów — chłodniejszy, wtopiony w powietrze */}
    <path
      d="M -600 560 L -420 560 L -420 500 L -330 470 L -240 500 L -240 540 L -90 540 L -90 470 L 40 470 L 40 520 L 150 520 L 150 430 L 172 430 L 172 400 L 186 400 L 186 430 L 220 430 L 220 520 L 330 520 L 330 470 L 420 440 L 510 470 L 510 520 L 620 520 L 620 300 L 630 300 L 640 220 L 650 300 L 660 300 L 660 520 L 760 520 L 760 460 L 900 460 L 900 500 L 1040 500 L 1040 440 L 1160 440 L 1160 520 L 1300 520 L 1300 480 L 1700 480 L 1700 1400 L -600 1400 Z"
      fill="#D5DFD8"
    />
    {/* bliższy rząd */}
    <path
      d="M -600 640 L -380 640 L -380 590 L -260 560 L -140 590 L -140 610 L 0 610 L 0 560 L 22 560 L 22 540 L 40 540 L 40 560 L 120 560 L 120 600 L 260 600 L 260 570 L 380 540 L 500 570 L 500 610 L 600 610 L 600 560 L 760 560 L 760 590 L 880 590 L 880 540 L 900 540 L 900 520 L 918 520 L 918 540 L 1000 540 L 1000 600 L 1160 600 L 1160 560 L 1300 560 L 1300 620 L 1700 620 L 1700 1400 L -600 1400 Z"
      fill="#C5D4CD"
    />
  </svg>
);

/** okno kamienicy: rama, szyba z odbiciem, parapet, czasem firanka */
const HouseWindow: React.FC<{x: number; y: number; w: number; h: number; warm?: boolean}> = ({x, y, w, h, warm}) => (
  <g>
    <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={3} fill="#E9CDB4" />
    <rect x={x} y={y} width={w} height={h} rx={2} fill={warm ? '#F4D3A4' : '#93AFB2'} />
    {!warm && <path d={`M ${x} ${y + h * 0.75} L ${x + w * 0.7} ${y} L ${x + w} ${y} L ${x + w} ${y + h * 0.1} L ${x + w * 0.15} ${y + h} L ${x} ${y + h} Z`} fill="#FFFFFF" opacity={0.16} />}
    {warm && <rect x={x} y={y} width={w} height={h * 0.5} fill="#FBF1DF" opacity={0.6} />}
    <rect x={x + w / 2 - 2.5} y={y} width={5} height={h} fill="#E9CDB4" />
    <rect x={x} y={y + h * 0.36} width={w} height={5} fill="#E9CDB4" />
    <rect x={x - 12} y={y + h + 4} width={w + 24} height={9} rx={2} fill="#E2C2A6" />
  </g>
);

export const Cafe: React.FC<{f: number; walkerX: number; walkPhase: number; stride: number; meet: number}> = ({f, walkerX, walkPhase, stride, meet}) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={svgStyle}>
    <defs>
      <linearGradient id="c-facade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4E0CC" />
        <stop offset="1" stopColor="#EFD5BE" />
      </linearGradient>
      <linearGradient id="c-inside" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FBE6C2" />
        <stop offset="1" stopColor="#F3C98F" />
      </linearGradient>
      <linearGradient id="c-door" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF1D8" />
        <stop offset="1" stopColor="#F8D7A2" />
      </linearGradient>
      <radialGradient id="c-spill" cx="0.5" cy="0" r="0.8">
        <stop offset="0" stopColor="#FFE6BC" stopOpacity={0.9} />
        <stop offset="1" stopColor="#FFE6BC" stopOpacity={0} />
      </radialGradient>
      <pattern id="c-stripes" width="44" height="60" patternUnits="userSpaceOnUse">
        <rect width="22" height="60" fill={C.teal} />
        <rect x="22" width="22" height="60" fill="#F7F1E6" />
      </pattern>
      <linearGradient id="c-street" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#D7CBBB" />
        <stop offset="1" stopColor="#C6B8A6" />
      </linearGradient>
    </defs>

    {/* sąsiednie kamienice */}
    <rect x={-1400} y={330} width={1740} height={600} fill="#D9E2D6" />
    {[...Array(6)].map((_, i) => (
      <HouseWindow key={`l${i}`} x={-560 + (i % 3) * 140} y={400 + Math.floor(i / 3) * 190} w={70} h={110} />
    ))}
    <rect x={900} y={290} width={1300} height={640} fill="#EFCDB9" />
    {[...Array(4)].map((_, i) => (
      <HouseWindow key={`r${i}`} x={960 + (i % 2) * 150} y={360 + Math.floor(i / 2) * 190} w={74} h={112} />
    ))}

    {/* kamienica z kawiarnią */}
    <path d="M 320 236 L 920 236 L 920 930 L 320 930 Z" fill="url(#c-facade)" />
    <rect x={306} y={220} width={628} height={22} fill="#E6C9AE" />
    <rect x={312} y={212} width={616} height={10} fill="#F6E6D4" />
    <rect x={320} y={652} width={600} height={14} fill="#E6C9AE" />
    <HouseWindow x={390} y={300} w={92} h={130} />
    <HouseWindow x={574} y={300} w={92} h={130} warm />
    <HouseWindow x={758} y={300} w={92} h={130} />
    <HouseWindow x={390} y={486} w={92} h={130} />
    <HouseWindow x={574} y={486} w={92} h={130} />
    <HouseWindow x={758} y={486} w={92} h={130} warm />

    {/* parter: markiza w paski, witryna i drzwi, które świecą */}
    <rect x={320} y={666} width={600} height={264} fill="#E9CFB6" />
    <path d="M 336 690 L 904 690 L 918 744 L 322 744 Z" fill="url(#c-stripes)" />
    <path d={`M 322 744 ${'q 21.4 18 42.8 0 '.repeat(14)}`} fill="url(#c-stripes)" />
    <rect x={336} y={684} width={568} height={8} fill="#2F7F8F" />
    {/* witryna */}
    <rect x={352} y={774} width={220} height={128} rx={3} fill="url(#c-inside)" />
    <g opacity={0.5}>
      <line x1={400} y1={774} x2={400} y2={800} stroke="#9B7A55" strokeWidth={2} />
      <path d="M 388 800 L 412 800 L 406 810 L 394 810 Z" fill="#9B7A55" />
      <line x1={510} y1={774} x2={510} y2={806} stroke="#9B7A55" strokeWidth={2} />
      <path d="M 498 806 L 522 806 L 516 816 L 504 816 Z" fill="#9B7A55" />
      <rect x={380} y={860} width={60} height={6} fill="#B48D63" />
      <rect x={480} y={856} width={64} height={6} fill="#B48D63" />
    </g>
    <path d="M 352 902 L 572 902 L 588 916 L 336 916 Z" fill="#D8BC9F" />
    {/* drzwi */}
    <rect x={662} y={760} width={96} height={146} rx={3} fill="#D9BC9F" />
    <rect x={670} y={768} width={80} height={138} rx={2} fill="url(#c-door)" />
    <rect x={600} y={774} width={52} height={128} rx={3} fill="url(#c-inside)" opacity={0.95} />
    <rect x={766} y={774} width={138} height={128} rx={3} fill="url(#c-inside)" opacity={0.95} />
    {/* szyld z filiżanką */}
    <rect x={836} y={740} width={4} height={18} fill="#8E7556" />
    <circle cx={838} cy={772} r={18} fill="#F7F1E6" stroke={C.teal} strokeWidth={3} />
    <path d="M 830 768 h 14 v 6 a 7 7 0 0 1 -14 0 z M 844 770 a 4 4 0 0 1 0 6" fill={C.teal} stroke={C.teal} strokeWidth={1.5} />

    {/* latarnia */}
    <rect x={286} y={600} width={7} height={306} fill="#5E6F78" />
    <path d="M 274 600 L 305 600 L 300 576 L 279 576 Z" fill="#5E6F78" />
    <ellipse cx={289.5} cy={598} rx={9} ry={4} fill="#FFF0D0" />

    {/* chodnik, krawężnik, jezdnia z torami */}
    <rect x={-1400} y={906} width={3600} height={56} fill="#E3D6C4" />
    <path d="M 702 906 L 752 906 L 912 962 L 692 962 Z" fill="url(#c-spill)" opacity={0.7} />
    <rect x={-1400} y={960} width={3600} height={6} fill="#CDBEAA" />
    <rect x={-1400} y={966} width={3600} height={700} fill="url(#c-street)" />
    <rect x={-1400} y={1040} width={3600} height={4} fill="#B4A693" />
    <rect x={-1400} y={1074} width={3600} height={4} fill="#B4A693" />

    {/* ludzie: jedna osoba czeka w drzwiach, druga właśnie przychodzi */}
    <Person x={732} y={908} h={124} facing={-1} walk={0} stride={0} lean={-meet * 3} color="#2F434B" coat="#35505A" rim="#FFDDB0" hair="bun" wave={meet * 0.0} />
    <Person x={walkerX} y={910} h={130} facing={1} walk={walkPhase} stride={stride} lean={meet * 3} color="#2B3D45" coat="#3F5E54" rim="#FFDDB0" />
    {/* lekki „oddech” światła w drzwiach */}
    <rect x={670} y={768} width={80} height={138} fill="#FFF6E4" opacity={0.08 + 0.05 * Math.sin(f / 30)} />
  </svg>
);

/** tramwaj: kremowe pudło z pasem szałwii, ciepłe wnętrze, w jednym oknie pasażer ze słuchawkami */
export const TRAM_WINDOW = {cx: 245, cy: 1065, w: 224, h: 184, r: 26};

export const Tram: React.FC<{f: number; dx: number; nod: number}> = ({dx, nod}) => {
  const W = TRAM_WINDOW;
  const windows = [...Array(12)].map((_, i) => i - 5);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={svgStyle}>
      <defs>
        <linearGradient id="tr-inside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF1D8" />
          <stop offset="1" stopColor="#F6D3A0" />
        </linearGradient>
        <linearGradient id="tr-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FAF5EC" />
          <stop offset="1" stopColor="#EEE6D8" />
        </linearGradient>
        <filter id="tr-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={8} />
        </filter>
      </defs>
      <g transform={`translate(${dx} 0)`}>
        <ellipse cx={500} cy={1322} rx={1900} ry={18} fill="#3B2E22" opacity={0.2} filter="url(#tr-blur)" />
        {/* dach i odbierak prądu */}
        <rect x={-1500} y={918} width={3700} height={28} rx={12} fill="#DCD7CD" />
        <path d="M 420 920 L 480 862 L 580 862 L 530 920" stroke="#7C8A8E" strokeWidth={4} fill="none" />
        {/* pudło */}
        <rect x={-1510} y={936} width={3720} height={354} rx={26} fill="url(#tr-body)" />
        <rect x={-1510} y={1212} width={3720} height={50} fill={C.sageFrame} />
        <rect x={-1510} y={1208} width={3720} height={6} fill={C.teal} />
        <rect x={-1510} y={1262} width={3720} height={28} fill="#6E8F80" />
        {/* okna */}
        {windows.map((j) => {
          const x = W.cx + j * 290 - W.w / 2;
          const isDoor = j === 2 || j === -3;
          if (isDoor) {
            return (
              <g key={j}>
                <rect x={x - 6} y={964} width={W.w + 12} height={316} rx={12} fill="#E3DCCF" />
                <rect x={x} y={972} width={W.w / 2 - 3} height={300} rx={10} fill="url(#tr-inside)" opacity={0.9} />
                <rect x={x + W.w / 2 + 3} y={972} width={W.w / 2 - 3} height={300} rx={10} fill="url(#tr-inside)" opacity={0.9} />
              </g>
            );
          }
          return (
            <g key={j}>
              <rect x={x - 5} y={W.cy - W.h / 2 - 5} width={W.w + 10} height={W.h + 10} rx={W.r + 4} fill="#E0D8CA" />
              <rect x={x} y={W.cy - W.h / 2} width={W.w} height={W.h} rx={W.r} fill="url(#tr-inside)" />
              {/* oparcia siedzeń i poręcze */}
              <rect x={x + 24} y={W.cy + 34} width={66} height={60} rx={14} fill="#C99F73" opacity={0.55} />
              <rect x={x + 134} y={W.cy + 34} width={66} height={60} rx={14} fill="#C99F73" opacity={0.55} />
              <rect x={x + W.w - 30} y={W.cy - W.h / 2} width={4} height={W.h} fill="#B9A58A" opacity={0.6} />
            </g>
          );
        })}
        <Passenger x={W.cx - 6} y={W.cy + 44} s={1.22} nod={nod} />
        {/* szyba okna z pasażerem: delikatne odbicie */}
        <path d={`M ${W.cx - 50} ${W.cy + W.h / 2} L ${W.cx + 10} ${W.cy - W.h / 2} L ${W.cx + 34} ${W.cy - W.h / 2} L ${W.cx - 26} ${W.cy + W.h / 2} Z`} fill="#FFFFFF" opacity={0.12} />
        {/* koła */}
        {[-900, -300, 800, 1400].map((wx) => (
          <g key={wx}>
            <rect x={wx - 90} y={1284} width={180} height={26} rx={10} fill="#4C5A5E" />
            <circle cx={wx - 46} cy={1308} r={18} fill="#3A464A" />
            <circle cx={wx + 46} cy={1308} r={18} fill="#3A464A" />
          </g>
        ))}
      </g>
    </svg>
  );
};
