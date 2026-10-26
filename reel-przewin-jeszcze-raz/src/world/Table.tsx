/*
 * Stół przy ścianie (warstwa z = 1000): drewniany blat w świetle okna, a na nim
 * kubek z ręcznie szkliwionej ceramiki, słuchawki z kablem i otwarty notes z ołówkiem.
 * Światło pada z lewej z góry, cienie leżą w prawo i w dół.
 */
import React from 'react';
import {C} from '../theme';
import {T} from '../timeline';
import {E, k, mix} from '../lib/anim';
import {catmullRom, Pt, toSmoothPath} from '../lib/path';
import {CUP_POS} from './camera';

export const TABLE_EDGE = 1330;

// --- kabel słuchawek (spoczynek) — przechodzi łukiem wokół podstawy kubka, jak przedłużenie jego krawędzi
const CABLE_CTRL: Pt[] = [
  {x: 286, y: 1531}, // wtyczka
  {x: 330, y: 1548},
  {x: 392, y: 1556}, // pod kubkiem: ten sam łuk co dno
  {x: 452, y: 1546},
  {x: 500, y: 1528},
  {x: 548, y: 1546},
  {x: 568, y: 1592},
  {x: 604, y: 1604},
  {x: 636, y: 1574},
  {x: 650, y: 1540}, // wejście do lewej muszli
];
export const CABLE_REST = catmullRom(CABLE_CTRL, 16);

/** kabel w danej klatce: na początku jeszcze się układa (był przed chwilą odłożony) */
export const cableAt = (f: number): Pt[] => {
  const settle = Math.exp(-f / 26) * (f < 90 ? 1 : 0);
  return CABLE_REST.map((pt, i) => {
    const u = i / (CABLE_REST.length - 1);
    const amp = settle * 26 * Math.sin(u * Math.PI) * (1 - u * 0.3);
    return {x: pt.x + amp * 0.35 * Math.sin(f / 7 + u * 3), y: pt.y - amp * Math.cos(f / 6.5 + u * 4)};
  });
};

// --- kubek: wysokość opuszczania i drganie herbaty
const cupDrop = (f: number) => {
  if (f >= T.cupDown) return 0;
  return k(f, T.cupIn, T.cupDown, -760, 0, E.outSoft);
};
/** fala na herbacie po postawieniu (zamrożona razem ze światem) */
export const teaSlosh = (fEff: number) => (fEff < T.cupDown ? 0 : Math.exp(-(fEff - T.cupDown) / 22) * Math.sin((fEff - T.cupDown) / 3.2));

const Cup: React.FC<{fEff: number}> = ({fEff}) => {
  const dy = cupDrop(fEff);
  const tilt = fEff < T.cupDown ? k(fEff, T.cupIn, T.cupDown, 3.5, 0, E.outSoft) : 0;
  const slosh = teaSlosh(fEff);
  const lift = Math.min(1, -dy / 300);
  const {x: cx, y: cy} = CUP_POS;
  // szkliwo kończy się nierówną linią z zaciekami, niżej surowa glina
  const drip = 'M -82 104 C -70 108 -64 118 -58 112 C -50 104 -40 110 -30 107 C -22 105 -18 122 -10 120 C -2 118 4 106 14 108 C 26 110 30 116 40 112 C 50 108 56 118 66 114 C 74 111 78 106 84 104 L 84 0 L -84 0 Z';
  const body = 'M -84 0 C -86 58 -82 118 -72 146 Q 0 166 72 146 C 82 118 86 58 84 0 Z';
  return (
    <g>
      {/* cień rzucony na blat — rośnie i ostrzeje, gdy kubek zbliża się do stołu */}
      <g opacity={1 - lift * 0.85}>
        <ellipse cx={cx + 6} cy={cy + 150} rx={mix(78, 96, lift)} ry={mix(15, 22, lift)} fill={C.shadow} opacity={0.32} filter="url(#t-blur6)" />
        <path
          d={`M ${cx - 40} ${cy + 152} Q ${cx + 70} ${cy + 176} ${cx + 230} ${cy + 168} Q ${cx + 250} ${cy + 140} ${cx + 160} ${cy + 118} Q ${cx + 60} ${cy + 108} ${cx + 30} ${cy + 130} Z`}
          fill={C.shadow}
          opacity={0.14}
          filter="url(#t-blur14)"
        />
      </g>
      <g transform={`translate(${cx} ${cy + dy}) rotate(${tilt})`}>
        {/* ucho */}
        <path d="M 80 34 C 128 30 134 108 78 118" stroke="#6F9C83" strokeWidth={20} fill="none" strokeLinecap="round" />
        <path d="M 82 38 C 120 36 124 102 80 112" stroke="#8DB59B" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.9} />
        {/* korpus: glina pod spodem, szkliwo na górze */}
        <path d={body} fill="url(#t-clay)" />
        <clipPath id="t-cupclip">
          <path d={body} />
        </clipPath>
        <g clipPath="url(#t-cupclip)">
          <path d={drip} fill="url(#t-glaze)" />
          {/* miękki refleks okna na szkliwie */}
          <rect x={-58} y={8} width={18} height={96} rx={9} fill="#FFFFFF" opacity={0.28} filter="url(#t-blur4)" />
          <rect x={-46} y={14} width={5} height={70} rx={2.5} fill="#FFFFFF" opacity={0.35} />
          {/* cień własny po prawej */}
          <rect x={40} y={-10} width={60} height={190} fill="#2F4A3D" opacity={0.18} filter="url(#t-blur14)" />
          {/* kropki w glinie — rzemieślnicza faktura */}
          {[...Array(16)].map((_, i) => (
            <circle key={i} cx={-70 + ((i * 37) % 140)} cy={118 + ((i * 13) % 28)} r={0.9 + (i % 3) * 0.4} fill="#B9A487" opacity={0.6} />
          ))}
        </g>
        {/* brzeg: wewnętrzna ścianka, herbata, krawędź */}
        <ellipse cx={0} cy={0} rx={84} ry={21} fill="#7FA88F" />
        <ellipse cx={0} cy={1.5} rx={78} ry={18} fill="#5E8B72" />
        <ellipse cx={0} cy={5 + slosh * 1.2} rx={74} ry={mix(15.5, 15.5 + slosh * 2.4, 1)} fill="url(#t-tea)" />
        <ellipse cx={-26 + slosh * 6} cy={1 + slosh} rx={18} ry={3.2} fill={C.sunlight} opacity={0.55} transform={`rotate(-6 ${-26 + slosh * 6} 1)`} />
        <ellipse cx={0} cy={0} rx={84} ry={21} fill="none" stroke="#F1E6D4" strokeWidth={3.2} />
        <path d="M -84 0 A 84 21 0 0 0 84 0" fill="none" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.5} />
      </g>
    </g>
  );
};


// --- rozprysk po postawieniu kubka: kropla główna + drobna „korona” (zatrzymują się w powietrzu)
const SPLASH = [
  {h: 172, dx: 6, r: 11},
  {h: 74, dx: -30, r: 4.6},
  {h: 92, dx: 24, r: 5.2},
  {h: 56, dx: -52, r: 3.4},
  {h: 62, dx: 48, r: 3.6},
  {h: 40, dx: -12, r: 2.8},
];
export const SPLASH_START = T.cupDown + 2;
export const dropletPos = (fEff: number, i = 0) => {
  const d = SPLASH[i];
  const u = Math.min(1, Math.max(0, (fEff - SPLASH_START) / (T.freeze - SPLASH_START)));
  // wznoszenie z wyhamowaniem — przy zatrzymaniu kropla jest prawie na szczycie
  const rise = 1 - (1 - u) ** 2.2;
  const vel = 2.2 * (1 - u) ** 1.2;
  return {x: CUP_POS.x + d.dx * rise, y: CUP_POS.y + 4 - d.h * rise * (i ? 1 : 1), r: d.r, stretch: 1 + vel * 0.9, visible: fEff > SPLASH_START};
};

const Splash: React.FC<{fEff: number}> = ({fEff}) => {
  // po powrocie do pokoju (czas świata > freeze) kropla dawno spadła
  if (fEff <= SPLASH_START || fEff > T.freeze + 0.5) return null;
  const ring = Math.max(0, fEff - T.cupDown);
  return (
    <g>
      {/* fala na herbacie */}
      <clipPath id="t-teaclip">
        <ellipse cx={CUP_POS.x} cy={CUP_POS.y + 5} rx={74} ry={15.5} />
      </clipPath>
      <g clipPath="url(#t-teaclip)" fill="none" stroke="#E2B37A" strokeWidth={1.6}>
        <ellipse cx={CUP_POS.x + 6} cy={CUP_POS.y + 5} rx={ring * 1.6} ry={ring * 0.34} opacity={Math.max(0, 0.8 - ring / 60)} />
        <ellipse cx={CUP_POS.x + 6} cy={CUP_POS.y + 5} rx={ring * 0.9} ry={ring * 0.2} opacity={Math.max(0, 0.6 - ring / 70)} />
      </g>
      {SPLASH.map((_, i) => {
        const d = dropletPos(fEff, i);
        return (
          <g key={i} transform={`translate(${d.x} ${d.y}) scale(${1 / Math.sqrt(d.stretch)} ${d.stretch})`}>
            <circle r={d.r} fill="url(#t-drop)" />
            <circle cx={-d.r * 0.35} cy={-d.r * 0.35} r={d.r * 0.32} fill="#FFFFFF" opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
};

/** para nad herbatą — trzy miękkie smugi */
const Steam: React.FC<{fEff: number; amount: number}> = ({fEff, amount}) => (
  <g opacity={amount} fill="none" stroke="#FFFFFF" strokeLinecap="round" filter="url(#t-blur6)">
    {[0, 1, 2].map((i) => {
      const t = fEff / 60 + i * 0.37;
      const ph = (t % 1 + 1) % 1;
      const x0 = CUP_POS.x - 28 + i * 26;
      const y0 = CUP_POS.y - 10 - ph * 60;
      const o = Math.sin(ph * Math.PI) * 0.5;
      return <path key={i} d={`M ${x0} ${y0} c -14 -24 18 -40 4 -66 s 16 -40 2 -62`} strokeWidth={7} opacity={o} />;
    })}
  </g>
);

const Headphones: React.FC = () => {
  const x = 738;
  const y = 1494;
  return (
    <g>
      <ellipse cx={x + 40} cy={y + 86} rx={190} ry={44} fill={C.shadow} opacity={0.2} filter="url(#t-blur14)" />
      <g transform={`translate(${x} ${y}) scale(0.92)`}>
        {/* pałąk: miękka poduszka od spodu i jasna obudowa */}
        <path d="M -104 -6 C -112 -96 -40 -128 4 -128 C 52 -128 118 -96 106 -6" stroke="#2E6672" strokeWidth={30} fill="none" strokeLinecap="round" />
        <path d="M -104 -10 C -110 -100 -40 -134 4 -134 C 52 -134 116 -100 106 -10" stroke="#EFE8DC" strokeWidth={22} fill="none" strokeLinecap="round" />
        <path d="M -98 -40 C -98 -100 -40 -128 4 -128" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
        {/* suwaki regulacji */}
        <rect x={-114} y={-24} width={20} height={34} rx={5} fill="#C9C3B8" />
        <rect x={96} y={-24} width={20} height={34} rx={5} fill="#B8B1A5" />
        {/* lewa muszla */}
        <g transform="translate(-100 48) rotate(-14)">
          <ellipse cx={4} cy={8} rx={60} ry={68} fill="#2E6672" />
          <ellipse cx={0} cy={0} rx={58} ry={66} fill="url(#t-shell)" />
          <ellipse cx={-2} cy={-2} rx={40} ry={47} fill="none" stroke="#D9D0C2" strokeWidth={2.5} />
          <ellipse cx={-16} cy={-22} rx={14} ry={22} fill="#FFFFFF" opacity={0.45} filter="url(#t-blur4)" />
        </g>
        {/* prawa muszla */}
        <g transform="translate(104 46) rotate(12)">
          <ellipse cx={4} cy={8} rx={60} ry={68} fill="#2E6672" />
          <ellipse cx={0} cy={0} rx={58} ry={66} fill="url(#t-shell)" />
          <ellipse cx={-2} cy={-2} rx={40} ry={47} fill="none" stroke="#D9D0C2" strokeWidth={2.5} />
          <ellipse cx={-18} cy={-22} rx={13} ry={20} fill="#FFFFFF" opacity={0.4} filter="url(#t-blur4)" />
        </g>
      </g>
    </g>
  );
};

export const Cable: React.FC<{pts: Pt[]; opacity?: number}> = ({pts, opacity = 1}) => (
  <g opacity={opacity}>
    <path d={toSmoothPath(pts.map((q) => ({x: q.x + 4, y: q.y + 7})))} stroke={C.shadow} strokeWidth={7} fill="none" opacity={0.16} filter="url(#t-blur4)" strokeLinecap="round" />
    <path d={toSmoothPath(pts)} stroke={C.teal} strokeWidth={6.5} fill="none" strokeLinecap="round" />
    <path d={toSmoothPath(pts.map((q) => ({x: q.x - 0.8, y: q.y - 1.6})))} stroke="#7FC0CB" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.8} />
    {/* wtyczka */}
    <g transform={`translate(${pts[0].x} ${pts[0].y}) rotate(${(Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI + 180})`}>
      <rect x={-2} y={-6} width={26} height={12} rx={4} fill="#E9E2D6" />
      <rect x={22} y={-2.2} width={16} height={4.4} rx={2} fill="#B9B4AA" />
    </g>
  </g>
);

// --- notes: otwarty, w lekkiej perspektywie; dwie strony + grzbiet (z nich na końcu powstanie motyl)
export const NOTEBOOK = {
  spineTop: {x: 560, y: 1640},
  spineBottom: {x: 560, y: 1892},
  left: [
    {x: 334, y: 1648},
    {x: 560, y: 1640},
    {x: 560, y: 1892},
    {x: 282, y: 1898},
  ],
  right: [
    {x: 560, y: 1640},
    {x: 788, y: 1648},
    {x: 840, y: 1898},
    {x: 560, y: 1892},
  ],
};

// notes jest mniejszy i leży bliżej krawędzi stołu (skala wokół grzbietu)
export const NB = {s: 0.8, ox: 560, oy: 1640, dx: 10, dy: 120};
const NB_TRANSFORM = `translate(${NB.ox + NB.dx} ${NB.oy + NB.dy}) scale(${NB.s}) translate(${-NB.ox} ${-NB.oy})`;
/** punkt notesu (współrzędne rysunku) → warstwa stołu */
export const nbPt = (q: Pt): Pt => ({x: NB.ox + NB.dx + (q.x - NB.ox) * NB.s, y: NB.oy + NB.dy + (q.y - NB.oy) * NB.s});

const Notebook: React.FC = () => {
  const L = NOTEBOOK.left;
  const R = NOTEBOOK.right;
  // linie w perspektywie: od góry do dołu strony
  const rows = [...Array(9)].map((_, i) => (i + 1) / 10);
  const lerp = (a: Pt, b: Pt, t: number) => ({x: mix(a.x, b.x, t), y: mix(a.y, b.y, t)});
  return (
    <g transform={NB_TRANSFORM}>
      <path d="M 272 1660 L 850 1660 L 900 1940 L 222 1950 Z" fill={C.shadow} opacity={0.18} filter="url(#t-blur14)" />
      {/* okładka */}
      <path d="M 322 1638 Q 560 1626 800 1638 L 856 1910 Q 560 1902 266 1912 Z" fill={C.peachDeep} />
      <path d="M 322 1638 Q 560 1626 800 1638 L 802 1646 Q 560 1634 324 1646 Z" fill="#FFFFFF" opacity={0.25} />
      {/* strony z lekkim wybrzuszeniem przy grzbiecie */}
      <path d={`M ${L[0].x} ${L[0].y} Q 450 1636 ${L[1].x} ${L[1].y + 8} L ${L[2].x} ${L[2].y} Q 420 1886 ${L[3].x} ${L[3].y} Z`} fill="url(#t-pageL)" />
      <path d={`M ${R[0].x} ${R[0].y + 8} Q 670 1636 ${R[1].x} ${R[1].y} L ${R[2].x} ${R[2].y} Q 700 1886 ${R[3].x} ${R[3].y} Z`} fill="url(#t-pageR)" />
      {rows.map((t) => {
        const a = lerp(L[0], L[3], t);
        const b = lerp(L[1], L[2], t);
        const c = lerp(R[0], R[3], t);
        const d = lerp(R[1], R[2], t);
        return (
          <g key={t} stroke="#D8CFBF" strokeWidth={1.2}>
            <line x1={a.x + 10} y1={a.y} x2={b.x - 14} y2={b.y} />
            <line x1={c.x + 14} y1={c.y} x2={d.x - 10} y2={d.y} />
          </g>
        );
      })}
      {/* odręczne zapiski (bez treści — tylko rytm pisma) */}
      <g stroke={C.tealDeep} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.75}>
        <path d="M 372 1684 c 10 -8 14 6 24 -2 s 12 6 22 -1 s 14 5 26 -2 s 10 6 20 0 s 14 4 26 -2 s 12 5 24 -1" />
        <path d="M 366 1710 c 12 -7 14 6 26 -1 s 12 5 22 -1 s 16 6 28 -2 s 10 4 22 -1" />
        <path d="M 360 1736 c 10 -6 16 6 26 -1 s 12 6 24 -1 s 14 4 26 -2 s 12 6 24 0 s 10 4 18 -1" />
        <path d="M 354 1762 c 12 -7 14 6 24 -1 s 14 5 24 -1" />
      </g>
      {/* grzbiet: miękki cień zgięcia */}
      <path d="M 548 1640 L 572 1640 L 574 1892 L 546 1892 Z" fill="url(#t-spine)" />
      {/* zakładka-wstążka */}
      <path d="M 566 1890 L 578 1890 L 584 1948 L 572 1940 L 562 1950 Z" fill={C.teal} />
      {/* ołówek */}
      <g transform="translate(640 1790) rotate(-24)">
        <rect x={-120} y={-7} width={210} height={14} rx={2} fill={C.apricot} />
        <rect x={-120} y={-7} width={210} height={4.5} fill="#FFFFFF" opacity={0.35} />
        <rect x={-142} y={-7} width={22} height={14} rx={3} fill={C.peachDeep} />
        <rect x={-122} y={-7} width={8} height={14} fill="#C9C3B8" />
        <path d="M 90 -7 L 122 0 L 90 7 Z" fill="#EBD2B0" />
        <path d="M 112 -2.2 L 122 0 L 112 2.2 Z" fill={C.ink} />
      </g>
    </g>
  );
};

/** plama światła z okna na blacie: miękkie krawędzie, w środku cień szprosów */
const TableLight: React.FC<{f: number; sweep: number}> = ({f, sweep}) => {
  const breathe = Math.sin(f / 50) * 5;
  const dx = sweep;
  // światło z okna po lewej: szeroki skos przez kubek, w środku cienie szprosów
  return (
    <g>
      <path d={`M ${-160 + dx} ${1336} L ${560 + dx + breathe} ${1336} L ${980 + dx} ${2000} L ${80 + dx} ${2000} Z`} fill={C.sunlight} opacity={0.42} filter="url(#t-blur18)" />
      <path d={`M ${150 + dx} ${1336} L ${186 + dx} ${1336} L ${470 + dx} ${2000} L ${420 + dx} ${2000} Z`} fill="#B98D62" opacity={0.18} filter="url(#t-blur10)" />
      <path d={`M ${-160 + dx} ${1590} L ${700 + dx} ${1590} L ${716 + dx} ${1626} L ${-150 + dx} ${1626} Z`} fill="#B98D62" opacity={0.14} filter="url(#t-blur10)" />
    </g>
  );
};

export const Table: React.FC<{fEff: number; cableOpacity: number; sweep: number}> = ({fEff, cableOpacity, sweep}) => {
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <filter id="t-blur4" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
        <filter id="t-blur6" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
        <filter id="t-blur14" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={14} />
        </filter>
        <filter id="t-blur10" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={10} />
        </filter>
        <filter id="t-blur18" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={18} />
        </filter>
        <linearGradient id="t-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9A37A" />
          <stop offset="0.1" stopColor={C.wood} />
          <stop offset="0.6" stopColor={C.woodLight} />
          <stop offset="1" stopColor="#D2AE85" />
        </linearGradient>
        <linearGradient id="t-glaze" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A6C8B0" />
          <stop offset="0.45" stopColor="#8DB59B" />
          <stop offset="1" stopColor="#6C977E" />
        </linearGradient>
        <linearGradient id="t-clay" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F1E6D5" />
          <stop offset="0.55" stopColor={C.clay} />
          <stop offset="1" stopColor="#CDB99D" />
        </linearGradient>
        <radialGradient id="t-drop" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#E7B57A" />
          <stop offset="1" stopColor="#A9692F" />
        </radialGradient>
        <radialGradient id="t-tea" cx="0.42" cy="0.4" r="0.7">
          <stop offset="0" stopColor={C.teaLight} />
          <stop offset="0.6" stopColor={C.tea} />
          <stop offset="1" stopColor="#8E5527" />
        </radialGradient>
        <linearGradient id="t-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FAF6EF" />
          <stop offset="0.6" stopColor="#EAE2D4" />
          <stop offset="1" stopColor="#CFC5B5" />
        </linearGradient>
        <linearGradient id="t-pageL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FBF7F0" />
          <stop offset="0.85" stopColor="#F4EEE3" />
          <stop offset="1" stopColor="#E4DACA" />
        </linearGradient>
        <linearGradient id="t-pageR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E7DDCD" />
          <stop offset="0.12" stopColor="#F7F2EA" />
          <stop offset="1" stopColor="#FCF9F3" />
        </linearGradient>
        <linearGradient id="t-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#D9CDB9" stopOpacity={0} />
          <stop offset="0.5" stopColor="#CDBFA8" />
          <stop offset="1" stopColor="#D9CDB9" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* blat */}
      <rect x={-1400} y={TABLE_EDGE} width={3900} height={1500} fill="url(#t-wood)" />
      {/* słoje drewna */}
      <g stroke="#B88E66" strokeWidth={1.6} fill="none" opacity={0.28}>
        {[...Array(14)].map((_, i) => {
          const y0 = TABLE_EDGE + 40 + i * 52 + (i % 3) * 9;
          return <path key={i} d={`M -600 ${y0} C -100 ${y0 - 14} 200 ${y0 + 18} 560 ${y0 + 4} S 1300 ${y0 - 10} 1800 ${y0 + 8}`} />;
        })}
      </g>
      {/* styk blatu ze ścianą */}
      <rect x={-1400} y={TABLE_EDGE - 2} width={3900} height={10} fill="#9C7752" opacity={0.55} />
      <rect x={-1400} y={TABLE_EDGE + 8} width={3900} height={40} fill="#8A6A48" opacity={0.18} filter="url(#t-blur6)" />

      <TableLight f={fEff} sweep={sweep} />

      <Notebook />
      <Headphones />
      <Cable pts={cableAt(fEff)} opacity={cableOpacity} />
      <Cup fEff={fEff} />
      <Steam fEff={fEff} amount={fEff < T.cupDown ? 0 : Math.min(1, (fEff - T.cupDown) / 30)} />
      <Splash fEff={fEff} />
    </svg>
  );
};
