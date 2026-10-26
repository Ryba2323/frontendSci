/*
 * Prawdziwy ekran z aplikacji: trzecie pytanie codziennego podlewania „Co dziś miało znaczenie?”
 * (Main_Front-End/js/checkin.js → stepAreas, style z css/checkin.css i css/app.css).
 * Odtworzony 1:1 w pikselach CSS telefonu 390 × 844 — pozycje zmierzone z aplikacji (Playwright,
 * getBoundingClientRect), kolory z tokens.css. Rodzic skaluje go do rozmiaru filmu.
 *
 * Warstwy są rozdzielone, żeby kartki z filmu mogły „wjechać” w wiersze:
 *   layer="base"    — tło, górny pasek, pytanie, wiersze niezmapowane, dolne przyciski
 *   layer="mapped"  — sama zawartość wierszy, w które zamieniają się kartki (bez ramki)
 */
import React from 'react';
import {C, SANS} from '../theme';
import {mix} from '../lib/anim';

export const SCREEN_W = 390;
export const SCREEN_H = 844;

export type AreaId = 'food' | 'family' | 'friends' | 'love' | 'nature' | 'study';

// z checkin.js (AREAS) — nazwy i ikony bez zmian
const AREAS: {id: AreaId; name: string; icon: string}[] = [
  {id: 'food', name: 'Jedzenie', icon: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7.5c0-1.5 1-2 1-3.5M13.5 7.5c0-1.5 1-2 1-3.5"/>'},
  {id: 'family', name: 'Rodzina', icon: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'},
  {id: 'friends', name: 'Przyjaciele', icon: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>'},
  {id: 'love', name: 'Miłość', icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'},
  {id: 'nature', name: 'Natura', icon: '<path d="M12 21v-7"/><path d="M12 14c-4 0-7-2.7-7-6.5C5 4.5 8 3 12 3s7 1.5 7 4.5C19 11.3 16 14 12 14z"/>'},
  {id: 'study', name: 'Nauka', icon: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v14H5.5A1.5 1.5 0 0 0 4 18.5zM4 18.5A1.5 1.5 0 0 0 5.5 20H20"/>'},
];

// zmierzone w aplikacji (390 × 844, krok 3 z 4)
export const ROW = {x: 20, w: 350, h: 58, y0: 196.6, step: 66};
export const rowRect = (id: AreaId) => {
  const i = AREAS.findIndex((a) => a.id === id);
  return {x: ROW.x, y: ROW.y0 + i * ROW.step, w: ROW.w, h: ROW.h};
};
const SEG = [
  {label: 'Ciężko', x: 176.1 - 20, w: 66.9},
  {label: 'Ok', x: 245 - 20, w: 41.6},
  {label: 'Dobrze', x: 288.5 - 20, w: 69.5},
];

const Icon: React.FC<{paths: string; size: number; color: string; strokeWidth?: number; style?: React.CSSProperties}> = ({paths, size, color, strokeWidth = 2, style}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    dangerouslySetInnerHTML={{__html: paths}}
  />
);

/** zawartość wiersza: ikona + nazwa po lewej, przełącznik Ciężko / Ok / Dobrze po prawej (współrzędne względem wiersza) */
export const AreaRowContent: React.FC<{id: AreaId; picked: number}> = ({id, picked}) => {
  const a = AREAS.find((x) => x.id === id)!;
  return (
    <>
      <div style={{position: 'absolute', left: 15, top: 19, height: 20, display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, fontSize: 15.2, fontWeight: 700, color: C.text, whiteSpace: 'nowrap'}}>
        <Icon paths={a.icon} size={20} color={C.primary} />
        {a.name}
      </div>
      <div style={{position: 'absolute', left: 173.1 - 20, top: 9, width: 187.9, height: 40, borderRadius: 999, background: C.track}} />
      {/* wciśnięte „Dobrze”: białe tło przycisku z cieniem (app.css .ci-seg button[aria-pressed="true"]) */}
      <div
        style={{
          position: 'absolute',
          left: SEG[2].x,
          top: 12,
          width: SEG[2].w,
          height: 34,
          borderRadius: 999,
          background: C.surface,
          boxShadow: '0 4px 10px -6px rgba(30, 42, 50, .4)',
          opacity: picked,
          scale: `${mix(0.82, 1, picked)}`,
        }}
      />
      {SEG.map((s, i) => (
        <div
          key={s.label}
          style={{
            position: 'absolute',
            left: s.x,
            top: 12,
            width: s.w,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontSize: 13.44,
            fontWeight: 700,
            color: i === 2 && picked > 0.5 ? C.primaryDark : C.textMuted,
          }}
        >
          {s.label}
        </div>
      ))}
    </>
  );
};

export const RowFrame: React.FC<{children?: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', boxSizing: 'border-box', border: `1.5px solid ${C.line}`, borderRadius: 18, background: C.surface, ...style}}>{children}</div>
);

export const CheckinAreasScreen: React.FC<{
  layer: 'base' | 'mapped';
  mapped: AreaId[];
  picks: Partial<Record<AreaId, number>>;
  /** 0 → „Pomiń”, 1 → „Dalej” (po pierwszej odpowiedzi, jak w checkin.js) */
  answered: number;
  contentOpacity?: number;
  headOpacity?: number;
  /** osobna widoczność każdego zmapowanego wiersza (layer="mapped") */
  rowOpacity?: Partial<Record<AreaId, number>>;
}> = ({layer, mapped, picks, answered, contentOpacity = 1, headOpacity = 1, rowOpacity = {}}) => {
  if (layer === 'mapped') {
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, opacity: contentOpacity}}>
        {mapped.map((id) => {
          const r = rowRect(id);
          return (
            <div key={id} style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, opacity: rowOpacity[id] ?? 1}}>
              <AreaRowContent id={id} picked={picks[id] ?? 0} />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: SCREEN_W,
        height: SCREEN_H,
        overflow: 'hidden',
        // tło nakładki pytań (app.css .ci-overlay)
        background: `radial-gradient(900px 560px at 50% 30%, rgba(184, 227, 211, .55), transparent 62%), radial-gradient(800px 520px at 95% -10%, rgba(183, 220, 229, .6), transparent 60%), linear-gradient(180deg, ${C.bg} 0%, ${C.bg2} 100%)`,
        fontFamily: SANS,
        color: C.text,
      }}
    >
      <div style={{position: 'absolute', inset: 0, opacity: headOpacity}}>
        {/* górny pasek */}
        <div style={{position: 'absolute', left: 20, top: 12, width: 40, height: 40, boxSizing: 'border-box', borderRadius: 20, background: C.surface, border: `1.5px solid ${C.line}`, display: 'grid', placeItems: 'center'}}>
          <Icon paths='<path d="M6 6l12 12M18 6L6 18"/>' size={18} color={C.textMuted} />
        </div>
        <div style={{position: 'absolute', left: 72, top: 24.5, height: 15, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.52, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.primary, whiteSpace: 'nowrap'}}>
          <svg width={13} height={13} viewBox="0 0 24 24">
            <path d="M12 3.2c3.4 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.6-6.5 6-10.6z" fill={C.primary} />
          </svg>
          Codzienne podlewanie
        </div>
        <div style={{position: 'absolute', right: 20, top: 24, height: 16, fontSize: 12.8, fontWeight: 700, color: C.textMuted, fontVariantNumeric: 'tabular-nums'}}>3 z 4</div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 20 + i * 89,
              top: 66,
              width: 83,
              height: 5,
              borderRadius: 5,
              background: i < 2 ? C.primary : i === 2 ? `rgba(${C.primaryRgb}, .4)` : C.track,
            }}
          />
        ))}
        {/* pytanie */}
        <div style={{position: 'absolute', left: 20, top: 91, width: 350, fontSize: 25.6, lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>Co dziś miało znaczenie?</div>
        <div style={{position: 'absolute', left: 20, top: 129, width: 350, fontSize: 15.2, lineHeight: 1.5, color: C.textMuted}}>Zaznacz tylko to, co chcesz. Reszta może zostać pusta.</div>
      </div>

      {/* wiersze, które nie są kartkami z filmu */}
      <div style={{position: 'absolute', inset: 0, opacity: contentOpacity}}>
        {AREAS.filter((a) => !mapped.includes(a.id)).map((a) => {
          const r = rowRect(a.id);
          return (
            <RowFrame key={a.id} style={{left: r.x, top: r.y, width: r.w, height: r.h}}>
              <div style={{position: 'absolute', left: -1.5, top: -1.5, width: r.w, height: r.h}}>
                <AreaRowContent id={a.id} picked={picks[a.id] ?? 0} />
              </div>
            </RowFrame>
          );
        })}
      </div>

      {/* dolne przyciski (.ci-actions) */}
      <div style={{position: 'absolute', left: 0, top: 758, width: SCREEN_W, height: 86, background: `linear-gradient(to top, ${C.bg2} 72%, rgba(183, 220, 229, 0))`, opacity: headOpacity}}>
        <div style={{position: 'absolute', left: 20, top: 14, width: 112.6, height: 56, boxSizing: 'border-box', border: `1.5px solid ${C.line}`, borderRadius: 16, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15.2, fontWeight: 700, color: C.textMuted}}>
          <Icon paths='<path d="M19 12H5M11 6l-6 6 6 6"/>' size={18} color={C.textMuted} />
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
            background: C.primary,
            boxShadow: `0 12px 26px -12px rgba(${C.primaryRgb}, .85)`,
            color: '#fff',
            fontSize: 16.32,
            fontWeight: 700,
          }}
        >
          {[
            {label: 'Pomiń', o: 1 - answered, dy: -8 * answered},
            {label: 'Dalej', o: answered, dy: 8 * (1 - answered)},
          ].map((b) => (
            <div key={b.label} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: b.o, translate: `0 ${b.dy}px`}}>
              {b.label}
              <Icon paths='<path d="M5 12h14M13 6l6 6-6 6"/>' size={20} color="#fff" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
