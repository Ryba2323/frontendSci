/*
 * Prawdziwy ekran z aplikacji: ostatnie pytanie codziennego podlewania „Chcesz coś dopisać?”
 * (Main_Front-End/js/checkin.js → stepNote, style z css/checkin.css i css/app.css).
 * Odtworzony 1:1 w pikselach CSS telefonu 390 × 844 — pozycje zmierzone z aplikacji (Playwright,
 * getBoundingClientRect), kolory z tokens.css. Pole notatki rysuje osobno NoteUI (wyrasta ze strony notesu).
 * Wpisany tekst to przykład do filmu, nie dane użytkownika.
 */
import React from 'react';
import {C, SANS} from '../theme';
import {mix, mixColor} from '../lib/anim';

export const SCREEN_W = 390;
export const SCREEN_H = 844;
export const TEXTAREA = {x: 20, y: 192.6, w: 350, h: 163};
export const NOTE_TEXT = 'Herbata w słońcu. Ta piosenka w tramwaju. Spotkanie przed kawiarnią.';

const Icon: React.FC<{paths: string; size: number; color: string; strokeWidth?: number}> = ({paths, size, color, strokeWidth = 2}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html: paths}} />
);

export const appBackground = `radial-gradient(900px 560px at 50% 30%, rgba(184, 227, 211, .55), transparent 62%), radial-gradient(800px 520px at 95% -10%, rgba(183, 220, 229, .6), transparent 60%), linear-gradient(180deg, ${C.bg} 0%, ${C.bg2} 100%)`;

/** wszystko poza polem notatki; `head` i `foot` sterują wejściem elementów */
export const NoteScreenChrome: React.FC<{head: number; foot: number; press: number}> = ({head, foot, press}) => {
  const rise = (t: number) => ({opacity: t, translate: `0 ${mix(10, 0, t)}px`});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, fontFamily: SANS, color: C.ink}}>
      <div style={{position: 'absolute', inset: 0, ...rise(head)}}>
        <div style={{position: 'absolute', left: 20, top: 12, width: 40, height: 40, boxSizing: 'border-box', borderRadius: 20, background: C.surface, border: `1.5px solid ${C.line}`, display: 'grid', placeItems: 'center'}}>
          <Icon paths='<path d="M6 6l12 12M18 6L6 18"/>' size={18} color={C.inkMuted} />
        </div>
        <div style={{position: 'absolute', left: 72, top: 24.5, height: 15, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.52, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.teal, whiteSpace: 'nowrap'}}>
          <svg width={13} height={13} viewBox="0 0 24 24">
            <path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z" fill={C.teal} />
          </svg>
          Codzienne podlewanie
        </div>
        <div style={{position: 'absolute', right: 20, top: 24, height: 16, fontSize: 12.8, fontWeight: 700, color: C.inkMuted, fontVariantNumeric: 'tabular-nums'}}>4 z 4</div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{position: 'absolute', left: 20 + i * 89, top: 66, width: 83, height: 5, borderRadius: 5, background: C.teal}} />
        ))}
        <div style={{position: 'absolute', left: 20, top: 91, width: 350, fontSize: 25.6, lineHeight: '32px', fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>Chcesz coś dopisać?</div>
        <div style={{position: 'absolute', left: 20, top: 129, width: 350, fontSize: 15.2, lineHeight: '22.8px', color: C.inkMuted}}>Kilka słów o dniu — co pomogło, co było trudne. Widzisz to tylko Ty.</div>
      </div>
      <div style={{position: 'absolute', inset: 0, ...rise(foot)}}>
        {/* „Schowaj tę notatkę także w Skrytce myśli” */}
        <div style={{position: 'absolute', left: 20, top: 373.6, width: 26, height: 26, boxSizing: 'border-box', border: '2px solid #C3D8DD', borderRadius: 9, background: C.surface}} />
        <div style={{position: 'absolute', left: 58, top: 377.6, fontSize: 14.72, lineHeight: '18px', whiteSpace: 'nowrap'}}>
          Schowaj tę notatkę także w <b>Skrytce myśli</b>
        </div>
        {/* dolne przyciski */}
        <div style={{position: 'absolute', left: 0, top: 758, width: SCREEN_W, height: 86, background: `linear-gradient(to top, ${C.bg2} 72%, rgba(183, 220, 229, 0))`}}>
          <div style={{position: 'absolute', left: 20, top: 14, width: 112.6, height: 56, boxSizing: 'border-box', border: `1.5px solid ${C.line}`, borderRadius: 16, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15.2, fontWeight: 700, color: C.inkMuted}}>
            <Icon paths='<path d="M19 12H5M11 6l-6 6 6 6"/>' size={18} color={C.inkMuted} />
            Wstecz
          </div>
          <div
            style={{
              position: 'absolute',
              left: 142.6,
              top: 14,
              width: 227.4,
              height: 56,
              borderRadius: 16,
              background: mixColor(C.teal, '#337F8F', press),
              boxShadow: `0 12px 26px -12px rgba(58, 141, 158, .85)`,
              color: '#fff',
              fontSize: 16.32,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              scale: `${1 - 0.025 * press}`,
            }}
          >
            Podlej roślinkę
            <svg width={20} height={20} viewBox="0 0 24 24">
              <path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z" fill="#fff" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

/** treść pola notatki (tekst pisany na żywo + licznik znaków) we współrzędnych CSS ekranu */
export const NoteText: React.FC<{chars: number; caret: boolean; opacity: number}> = ({chars, caret, opacity}) => {
  const n = Math.round(chars);
  const text = NOTE_TEXT.slice(0, n);
  return (
    <div style={{position: 'absolute', left: TEXTAREA.x, top: TEXTAREA.y, width: TEXTAREA.w, height: TEXTAREA.h, fontFamily: SANS, opacity}}>
      <div style={{position: 'absolute', left: 16, top: 13, right: 16, fontSize: 16, lineHeight: '24px', color: n ? C.ink : C.inkSoft}}>
        {n ? text : 'Dziś…'}
        {caret && <span style={{display: 'inline-block', width: 1.6, height: 19, marginLeft: 1, background: C.teal, verticalAlign: '-3px'}} />}
      </div>
      <div style={{position: 'absolute', right: 14, bottom: 10, fontSize: 11.52, fontWeight: 600, color: C.inkSoft}}>{n}/500</div>
    </div>
  );
};
