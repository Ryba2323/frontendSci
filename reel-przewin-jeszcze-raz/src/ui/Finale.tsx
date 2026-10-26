/*
 * 15–20 s — notes → aplikacja → logo.
 *   1. Prawa strona notesu (rzut kamery) zmienia kształt w pole notatki prawdziwego ekranu aplikacji,
 *      a wokół niego wyrasta reszta ekranu „Chcesz coś dopisać?”. Notatka pisze się na żywo.
 *   2. „Podlej roślinkę” — ekran rozchyla się wzdłuż środka jak notes: lewa połowa staje się
 *      turkusowym skrzydłem, prawa brzoskwiniowym, a szew (grzbiet) — tułowiem motyla.
 *      Kształty kończą dokładnie na konturach wyciętych z oficjalnego logo (src/logo/logoShapes.json),
 *      po czym na ich miejscu zostaje sam oryginalny plik PNG z przezroczystym tłem.
 */
import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, SANS} from '../theme';
import {T} from '../timeline';
import {E, mix, mixColor, p} from '../lib/anim';
import {alignClosed, lerpPt, Pt, roundRectPts, toPath} from '../lib/path';
import {Cam, project, Z} from '../world/camera';
import {nbPt, NOTEBOOK} from '../world/Table';
import {appBackground, NOTE_TEXT, NoteScreenChrome, NoteText, SCREEN_H, SCREEN_W, TEXTAREA} from './NoteScreen';
import shapes from '../logo/logoShapes.json';

// ekran aplikacji na ekranie filmu
export const UI = {s: 2.2, x: 111, y: 32};
const ui = (x: number, y: number): Pt => ({x: UI.x + x * UI.s, y: UI.y + y * UI.s});
const SCREEN_RECT = {x: UI.x, y: UI.y, w: SCREEN_W * UI.s, h: SCREEN_H * UI.s, r: 30 * UI.s};
const TA = {...ui(TEXTAREA.x, TEXTAREA.y), w: TEXTAREA.w * UI.s, h: TEXTAREA.h * UI.s, r: 16 * UI.s};

// logo na końcu: cały znak + napis ma 640 px szerokości, wyśrodkowany razem z hasłem
const LOGO_SIZE = shapes.size;
const [bx0, by0, bx1, by1] = shapes.all.bbox;
export const LOGO = {s: 640 / (bx1 - bx0), x: 0, y: 0};
LOGO.x = 540 - ((bx0 + bx1) / 2) * LOGO.s;
LOGO.y = 537 - by0 * LOGO.s;
const logoPt = (q: number[]): Pt => ({x: LOGO.x + q[0] * LOGO.s, y: LOGO.y + q[1] * LOGO.s});
const WORDMARK_TOP = shapes.wordmark.bbox[1];

const N = 240;
const WING_L = shapes.wingL.pts.map(logoPt);
const WING_R = shapes.wingR.pts.map(logoPt);
const BODY = shapes.body.pts.map(logoPt);
// skąd startują: połowy ekranu i szew pośrodku
const HALF_L = alignClosed(WING_L, roundRectPts(SCREEN_RECT.x, SCREEN_RECT.y, SCREEN_RECT.w / 2, SCREEN_RECT.h, SCREEN_RECT.r, N));
const HALF_R = alignClosed(WING_R, roundRectPts(540, SCREEN_RECT.y, SCREEN_RECT.w / 2, SCREEN_RECT.h, SCREEN_RECT.r, N));
const SEAM = alignClosed(BODY, roundRectPts(536, SCREEN_RECT.y + 40, 8, SCREEN_RECT.h - 80, 4, N));

const morphPts = (a: Pt[], b: Pt[], t: number) => a.map((q, i) => lerpPt(q, b[i], t));

/** ścieżka czworoboku z zaokrąglonymi rogami (promień r) */
const roundedQuad = (q: Pt[], r: number) => {
  const pt = (a: Pt, b: Pt, d: number) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return {x: a.x + ((b.x - a.x) / L) * d, y: a.y + ((b.y - a.y) / L) * d};
  };
  let d = '';
  for (let i = 0; i < 4; i++) {
    const prev = q[(i + 3) % 4];
    const cur = q[i];
    const next = q[(i + 1) % 4];
    const a = pt(cur, prev, r);
    const b = pt(cur, next, r);
    d += `${i ? 'L' : 'M'}${a.x.toFixed(2)} ${a.y.toFixed(2)} Q${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)} `;
  }
  return d + 'Z';
};

const bbox = (pts: Pt[]) => {
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return {x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0};
};
/** morf w dwóch tempach: najpierw rozmiar i położenie (szybko), kształt dochodzi spokojniej */
const morph2 = (a: Pt[], b: Pt[], t: number) => {
  const A = bbox(a);
  const B = bbox(b);
  const tb = E.outSoft(t);
  const ts = E.inOut(Math.min(1, t * 1.25));
  const box = {x0: mix(A.x0, B.x0, tb), y0: mix(A.y0, B.y0, tb), w: mix(A.w, B.w, tb), h: mix(A.h, B.h, tb)};
  return a.map((q, i) => {
    const na = {x: (q.x - A.x0) / A.w, y: (q.y - A.y0) / A.h};
    const nb = {x: (b[i].x - B.x0) / B.w, y: (b[i].y - B.y0) / B.h};
    return {x: box.x0 + mix(na.x, nb.x, ts) * box.w, y: box.y0 + mix(na.y, nb.y, ts) * box.h};
  });
};

export const Finale: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
  if (f < T.pageToUi) return null;

  // --- 1. strona notesu → pole notatki
  const m = p(f, T.pageToUi, T.pageToUi + 38, E.inOut);
  const page = NOTEBOOK.right.map((q) => {
    const w = nbPt(q);
    const s = project(cam, Z.table, w.x, w.y);
    return {x: s.x, y: s.y};
  });
  // narożniki strony jadą prosto do narożników pola notatki, a zaokrąglenie rośnie — bez „falowania” krawędzi
  const target = [
    {x: TA.x, y: TA.y},
    {x: TA.x + TA.w, y: TA.y},
    {x: TA.x + TA.w, y: TA.y + TA.h},
    {x: TA.x, y: TA.y + TA.h},
  ];
  const corners = page.map((q, i) => lerpPt(q, target[i], m));
  const field = roundedQuad(corners, mix(3, TA.r, m));

  const grow = p(f, T.pageToUi + 16, T.pageToUi + 56, E.inOut);
  const head = p(f, T.pageToUi + 34, T.pageToUi + 68, E.out);
  const foot = p(f, T.pageToUi + 44, T.pageToUi + 78, E.out);
  const chars = mix(0, NOTE_TEXT.length, p(f, T.typing + 12, T.typing + 70, E.linear));
  const caret = f > T.typing && f < T.fold - 4 && Math.floor(f / 18) % 2 === 0;
  const press = Math.sin(Math.PI * p(f, T.fold - 14, T.fold + 2, E.linear));

  // --- 2. ekran → motyl
  const uiOut = p(f, T.fold - 2, T.fold + 12, E.inOut);
  const mL = p(f, T.fold, T.wingsSet - 4, E.linear);
  const mR = p(f, T.fold + 4, T.wingsSet, E.linear);
  const mB = p(f, T.fold + 6, T.wingsSet - 6, E.inOutSoft);
  const tint = p(f, T.fold + 4, T.fold + 34, E.inOut);
  const seamIn = p(f, T.fold - 2, T.fold + 8, E.out);
  // jedno spokojne „otwarcie” skrzydeł na końcu (skrzydła trochę zwinięte → pełne)
  // skrzydła lekko się przymykają i otwierają — płynnie, bez skoku
  const flap = 1 - 0.16 * Math.sin(Math.PI * p(f, T.wingsSet - 22, T.wingsSet + 12, E.inOut));
  const pngIn = p(f, T.wingsSet + 10, T.wingsSet + 22, E.inOut);
  const word = p(f, T.wordmark, T.wordmark + 34, E.out);
  const tag1 = p(f, T.tagline, T.tagline + 36, E.out);
  const tag2 = p(f, T.tagline + 10, T.tagline + 46, E.out);
  const axis = LOGO.x + 648 * LOGO.s; // oś symetrii motyla (środek tułowia)
  const flapT = (pts: Pt[]) => pts.map((q) => ({x: axis + (q.x - axis) * flap, y: q.y}));

  const screenRect = {
    x: mix(TA.x - 20, SCREEN_RECT.x, grow),
    y: mix(TA.y - 20, SCREEN_RECT.y, grow),
    w: mix(TA.w + 40, SCREEN_RECT.w, grow),
    h: mix(TA.h + 40, SCREEN_RECT.h, grow),
    r: mix(TA.r + 10, SCREEN_RECT.r, grow),
  };
  const folding = f >= T.fold;

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {!folding && (
        <>
          {/* ekran aplikacji wyrasta wokół pola notatki */}
          <div
            style={{
              position: 'absolute',
              left: screenRect.x,
              top: screenRect.y,
              width: screenRect.w,
              height: screenRect.h,
              borderRadius: screenRect.r,
              overflow: 'hidden',
              opacity: Math.min(1, grow * 3),
              boxShadow: `0 60px 120px -60px rgba(60, 45, 30, ${0.5 * grow})`,
            }}
          >
            <div style={{position: 'absolute', left: UI.x - screenRect.x, top: UI.y - screenRect.y, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', scale: `${UI.s}`, background: appBackground}}>
              <NoteScreenChrome head={head} foot={foot} press={press} />
            </div>
          </div>
          {/* pole notatki = strona notesu */}
          <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
            <path d={field} fill={`rgba(58, 141, 158, ${0.18 * m})`} stroke={`rgba(58, 141, 158, ${0.18 * m})`} strokeWidth={8.8 * 2 * m} strokeLinejoin="round" />
            <path d={field} fill={mixColor('#F8F3EA', '#FFFFFF', m)} stroke={`rgba(58, 141, 158, ${m})`} strokeWidth={3.3 * m} />
          </svg>
          <div style={{position: 'absolute', left: UI.x, top: UI.y, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', scale: `${UI.s}`}}>
            <NoteText chars={chars} caret={caret} opacity={p(f, T.pageToUi + 26, T.pageToUi + 44)} />
          </div>
        </>
      )}

      {folding && (
        <>
          {/* przez pierwsze klatki w połówkach widać jeszcze ekran aplikacji */}
          <div style={{position: 'absolute', inset: 0, opacity: 1 - uiOut}}>
            <div style={{position: 'absolute', left: SCREEN_RECT.x, top: SCREEN_RECT.y, width: SCREEN_RECT.w, height: SCREEN_RECT.h, borderRadius: SCREEN_RECT.r, overflow: 'hidden', boxShadow: '0 60px 120px -60px rgba(60, 45, 30, 0.5)'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, transformOrigin: '0 0', scale: `${UI.s}`, background: appBackground}}>
                <NoteScreenChrome head={1} foot={1} press={press} />
                <div style={{position: 'absolute', left: TEXTAREA.x, top: TEXTAREA.y, width: TEXTAREA.w, height: TEXTAREA.h, borderRadius: 16, background: '#FFFFFF', border: `1.5px solid ${C.teal}`, boxSizing: 'border-box', boxShadow: '0 0 0 4px rgba(58, 141, 158, .18)'}} />
                <NoteText chars={NOTE_TEXT.length} caret={false} opacity={1} />
              </div>
            </div>
          </div>
          <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: 1 - pngIn}}>
            <path d={toPath(flapT(morph2(HALF_L, WING_L, mL)), true)} fill={mixColor('#EEF7F8', shapes.wingL.color, tint)} opacity={Math.min(1, uiOut * 1.4)} />
            <path d={toPath(flapT(morph2(HALF_R, WING_R, mR)), true)} fill={mixColor('#EAF4F5', shapes.wingR.color, tint)} opacity={Math.min(1, uiOut * 1.4)} />
            {/* szew rośnie od środka, potem zwija się w tułów */}
            <path d={toPath(morphPts(SEAM, BODY, mB).map((q) => ({x: q.x, y: 960 + (q.y - 960) * (mB > 0 ? 1 : seamIn)})), true)} fill={shapes.body.color} opacity={Math.min(1, seamIn * 2)} />
          </svg>
          {/* oficjalne logo: ten sam plik PNG z przezroczystym tłem — znak i (osobno odsłaniany) napis */}
          <Img
            src={staticFile('logo/releaf-logo.png')}
            style={{position: 'absolute', left: LOGO.x, top: LOGO.y, width: LOGO_SIZE * LOGO.s, height: LOGO_SIZE * LOGO.s, opacity: pngIn, clipPath: `inset(0 0 ${(LOGO_SIZE - WORDMARK_TOP + 10) * LOGO.s}px 0)`}}
          />
          <Img
            src={staticFile('logo/releaf-logo.png')}
            style={{
              position: 'absolute',
              left: LOGO.x,
              top: LOGO.y + mix(26, 0, word),
              width: LOGO_SIZE * LOGO.s,
              height: LOGO_SIZE * LOGO.s,
              opacity: word,
              clipPath: `inset(${(WORDMARK_TOP - 10) * LOGO.s}px 0 0 0)`,
            }}
          />
          <div style={{position: 'absolute', left: 0, width: 1080, top: 537 + (by1 - by0) * LOGO.s + 82, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 54, lineHeight: 1.22, letterSpacing: '-0.02em'}}>
            <div style={{opacity: tag1, translate: `0 ${mix(24, 0, tag1)}px`, color: C.ink}}>Poznaj swój dzień.</div>
            <div style={{opacity: tag2, translate: `0 ${mix(24, 0, tag2)}px`, color: C.tealDark}}>Poznaj siebie.</div>
          </div>
        </>
      )}
    </div>
  );
};
