// Scena 4–5 w 2D: prawdziwa karta wniosku z aplikacji → jej elementy składają się w oryginalne logo → plakat.
import { Img, staticFile } from 'remotion';
import { useMemo } from 'react';
import { interpolate as flubber } from 'flubber';
import { C } from '../brand/palette';
import { FAMILY } from '../lib/fonts';
import { bezier, inCubic, lerp, outCubic, seg, smooth, swift } from '../lib/math';
import { useT } from '../lib/time';
import { T } from '../timing';
import {
  CARD_EL, CARD_RECT, CARD_SCALE as S, LOGO, LOGO_FRAME, MOON_PATH, POSTER, WORDMARK, WORDMARK_PNG, cardX, cardY, roundRect,
} from './geometry';

const easeOut = bezier(0.2, 0.8, 0.2, 1); // --ease-out z tokens.css
const mixHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, k) => Math.round(lerp(v, pb[k], t))).join(',')})`;
};
const font = (w: number, px: number) => ({ fontFamily: `"${FAMILY}"`, fontWeight: w, fontSize: px });

// wejście jak animacja soft-in z app.css (przesunięcie 12 px CSS + krycie), przyspieszone do tempa filmu
const softIn = (t: number, at: number, dur = 26) => {
  const p = seg(t, at, at + dur, easeOut);
  return { opacity: p, transform: `translateY(${(1 - p) * 12 * S}px)` };
};
// wyjście w dół za maską (bez znikania przez krycie)
const MaskOut = ({ t, at, x, y, w, h, children }: { t: number; at: number; x: number; y: number; w: number; h: number; children: React.ReactNode }) => {
  const p = seg(t, at, at + 13, inCubic);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${p * 112}%)` }}>{children}</div>
    </div>
  );
};

export const Product = () => {
  const t = useT();
  const morph = useMemo(() => {
    const [r1, r2] = CARD_EL.rows;
    const bar = (b: { x: number; y: number; w: number; h: number }) => roundRect(cardX(b.x), cardY(b.y), b.w * S, b.h * S, 6 * S);
    const iconK = (CARD_EL.tagSvg.w / 24) * S;
    // łuk A → ścieżka wielokątna (flubber woli proste segmenty): próbkujemy ikonę w przeglądarce
    const sample = (d: string, k: number, ox: number, oy: number) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      const L = el.getTotalLength();
      const pts: string[] = [];
      for (let s = 0; s < 120; s++) {
        const p = el.getPointAtLength((s / 120) * L);
        pts.push(`${(ox + p.x * k).toFixed(2)} ${(oy + p.y * k).toFixed(2)}`);
      }
      return `M${pts.join('L')}Z`;
    };
    const moonFrame = sample(MOON_PATH, iconK, cardX(CARD_EL.tagSvg.x), cardY(CARD_EL.tagSvg.y));
    return {
      teal: flubber(bar(r2.bar), LOGO_FRAME.wingL, { maxSegmentLength: 5 }),
      peach: flubber(bar(r1.bar), LOGO_FRAME.wingR, { maxSegmentLength: 5 }),
      body: flubber(moonFrame, LOGO_FRAME.body, { maxSegmentLength: 3 }),
      moonFrame,
    };
  }, []);

  if (t < T.card - 0.5 || t >= T.loop) return null;

  // ---------- fazy ----------
  const tc = T.card;
  const corner = seg(t, tc, tc + 12, outCubic);                  // płyta → zaokrąglona karta
  const exitAt = T.morph;                                        // napisy wychodzą
  const m = seg(t, T.morph + 6, T.morph + 50, swift);            // tło karty → kafel plakatu
  const w = seg(t, T.morph + 10, T.logo - 2, bezier(0.62, 0, 0.1, 1)); // paski i ikona → logo
  const done = t >= T.logo;                                      // podmiana na oryginalny PNG
  const punch = t >= T.logo ? Math.exp(-(t - T.logo) / 7) * Math.sin(((t - T.logo) / 60) * 2 * Math.PI * 4.5) : 0;

  // tło: prostokąt karty → kwadrat plakatu
  const bx = lerp(CARD_RECT.x, POSTER.x, m), by = lerp(CARD_RECT.y, POSTER.y, m);
  const bw = lerp(CARD_RECT.w, POSTER.size, m), bh = lerp(CARD_RECT.h, POSTER.size, m);
  const radius = CARD_EL.radius * S * corner * (1 - m);
  const bg = mixHex(C.surface, C.ivory, smooth(seg(t, T.morph + 24, T.morph + 31)));
  // przestrzenny obrót całej kompozycji w trakcie przemiany
  const swing = Math.sin(Math.PI * m);
  const rotY = -16 * swing, rotX = 7 * swing;
  const scale = 1 + punch * 0.018;

  const [r1, r2] = CARD_EL.rows;
  const barsSvg = t >= T.morph + 10;
  const grow = (row: number) => seg(t, tc + 18 + row * 4, tc + 18 + row * 4 + 46, easeOut);

  // nagłówek karty → napis z logo
  const hp = seg(t, T.morph + 14, T.logo - 20, bezier(0.6, 0, 0.15, 1));
  const h3 = CARD_EL.h3;
  const h3x = cardX(h3.x), h3y = cardY(h3.y), h3w = 189 * S, h3h = h3.h * S; // 189 px CSS — szerokość tekstu (zrzut z aplikacji)
  const sx = lerp(1, WORDMARK.w / h3w, hp), sy = lerp(1, WORDMARK.h / h3h, hp);
  const tx = lerp(h3x, WORDMARK.x, hp), ty = lerp(h3y, WORDMARK.y, hp);
  // podmiana tytułu na napis z logo: tytuł zjeżdża w dół za maską, napis wjeżdża z góry
  const roll = seg(t, T.logo - 19, T.logo - 3, bezier(0.7, 0, 0.2, 1));
  const wordFade = roll > 0 ? 1 : 0;
  const inkCol = mixHex(C.text, C.logoInk, smooth(seg(t, T.morph + 24, T.morph + 31)));

  // kolory kształtów
  const tealFill = w < 0.55 ? 'url(#hl)' : mixHex('#5AAAB8', C.logoTeal, seg(w, 0.55, 1));
  const peachA = lerp(0.22, 1, smooth(seg(w, 0.1, 0.7)));
  const peachCol = mixHex(C.primary, C.logoPeach, smooth(seg(w, 0.1, 0.75)));

  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2200, perspectiveOrigin: '50% 45%' }}>
      <div
        style={{
          position: 'absolute', inset: 0, transformOrigin: '540px 860px',
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scale})`,
        }}
      >
        {/* „Co zauważyliśmy” — tytuł sekcji z zakładki Tracker */}
        <MaskOut t={t} at={exitAt} x={CARD_RECT.x + 4 * S} y={CARD_RECT.y - 42 * S} w={500} h={30 * S}>
          <div style={{ ...font(800, 18.4 * S), color: C.text, letterSpacing: -0.184 * S, lineHeight: `${30 * S}px`, ...softIn(t, tc + 2) }}>
            Co zauważyliśmy
          </div>
        </MaskOut>

        {/* tło karty / kafla */}
        <div
          style={{
            position: 'absolute', left: bx, top: by, width: bw, height: bh, borderRadius: radius, background: bg,
            boxShadow: m > 0 ? `0 ${40 * m}px ${90 * m}px rgba(0,0,0,${0.35 * m})` : 'none',
          }}
        />

        {/* zawartość karty */}
        <MaskOut t={t} at={exitAt + 2} x={cardX(CARD_EL.tag.x)} y={cardY(CARD_EL.tag.y)} w={120 * S} h={CARD_EL.tag.h * S}>
          <div style={{ ...font(800, 14.72 * S), color: C.textMuted, letterSpacing: 1.472 * S, lineHeight: `${CARD_EL.tag.h * S}px`, ...softIn(t, tc + 4) }}>
            SEN
          </div>
        </MaskOut>
        {!done && (
          <div
            style={{
              position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', whiteSpace: 'nowrap',
              transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
              ...font(800, 17.92 * S), color: inkCol, letterSpacing: -0.1792 * S, lineHeight: `${h3h}px`,
              opacity: seg(t, tc + 6, tc + 30, easeOut),
              clipPath: roll > 0 ? 'inset(-4px -4px -4px -4px)' : undefined,
            }}
          >
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - seg(t, tc + 6, tc + 32, easeOut)) * 12 * S + roll * h3h * 1.15}px)` }}>
              Sen poprawia Ci dzień
            </span>
          </div>
        )}
        {[r1, r2].map((r, k) => (
          <div key={k}>
            <MaskOut t={t} at={exitAt + 4 + k * 2} x={cardX(r.small.x)} y={cardY(r.small.y) - 4} w={r.small.w * S} h={r.small.h * S + 10}>
              <div style={{ ...font(700, 12.8 * S), color: C.textMuted, lineHeight: `${r.small.h * S + 8}px`, ...softIn(t, tc + 10 + k * 4) }}>{r.label}</div>
            </MaskOut>
            <MaskOut t={t} at={exitAt + 5 + k * 2} x={cardX(r.val.x)} y={cardY(r.val.y) - 4} w={r.val.w * S} h={r.val.h * S + 10}>
              <div style={{ ...font(700, 13.76 * S), color: C.text, textAlign: 'right', lineHeight: `${r.val.h * S + 8}px`, ...softIn(t, tc + 10 + k * 4) }}>{r.value}</div>
            </MaskOut>
            {!barsSvg && (
              <div
                style={{
                  position: 'absolute', left: cardX(r.bar.x), top: cardY(r.bar.y), width: r.bar.w * S, height: r.bar.h * S, borderRadius: 12 * S,
                  background: k === 1 ? `linear-gradient(90deg, ${C.accentLight}, ${C.primary})` : 'rgba(58, 141, 158, .22)',
                  transformOrigin: 'left', transform: `scaleX(${grow(k)})`,
                }}
              />
            )}
          </div>
        ))}
        <MaskOut t={t} at={exitAt + 8} x={cardX(CARD_EL.p.x)} y={cardY(CARD_EL.p.y)} w={CARD_EL.p.w * S} h={CARD_EL.p.h * S + 4}>
          <div style={{ ...font(500, 14.72 * S), color: C.textMuted, lineHeight: `${CARD_EL.p.h * S}px`, ...softIn(t, tc + 18) }}>
            Po 7 h snu i więcej średnio o <b style={{ color: C.text, fontWeight: 800 }}>1,4</b> lepiej.
          </div>
        </MaskOut>
        <MaskOut t={t} at={exitAt + 10} x={cardX(CARD_EL.summary.x)} y={cardY(CARD_EL.summary.y)} w={CARD_EL.summary.w * S + 20} h={CARD_EL.summary.h * S}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 * S, height: '100%', ...font(700, 13.76 * S), color: C.accentLight, ...softIn(t, tc + 22) }}>
            Skąd to może się brać?
            <i style={{ width: 7 * S, height: 7 * S, marginTop: -3 * S, borderRight: `${2 * S}px solid currentColor`, borderBottom: `${2 * S}px solid currentColor`, transform: 'rotate(45deg)' }} />
          </div>
        </MaskOut>

        {/* kształty: ikona snu i paski → skrzydła i tułów logo (wektory z obrysu oryginalnego PNG) */}
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="hl" x1={cardX(r2.bar.x)} x2={cardX(r2.bar.x) + r2.bar.w * S} y1={0} y2={0} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={C.accentLight} />
              <stop offset="1" stopColor={C.primary} />
            </linearGradient>
          </defs>
          {!done && (
            <path
              d={t < T.morph + 10 ? morph.moonFrame : morph.body(w)}
              fill={C.logoTeal}
              fillOpacity={smooth(seg(w, 0.05, 0.45))}
              stroke={mixHex(C.textMuted, C.logoTeal, smooth(seg(w, 0, 0.5)))}
              strokeWidth={(2 * CARD_EL.tagSvg.w * S) / 24 * (1 - smooth(seg(w, 0.3, 0.7)))}
              strokeLinejoin="round"
              opacity={seg(t, tc + 4, tc + 26, easeOut)}
            />
          )}
          {barsSvg && !done && (
            <>
              <path d={morph.peach(w)} fill={peachCol} fillOpacity={peachA} />
              <path d={morph.teal(w)} fill={tealFill} />
            </>
          )}
        </svg>

        {/* napis „ReLeaf” — prawdziwe piksele PNG, odsłaniane pod ściskanym nagłówkiem */}
        {!done && wordFade > 0 && (
          <div style={{ position: 'absolute', left: WORDMARK.x - 4, top: WORDMARK.y - 4, width: WORDMARK.w + 8, height: WORDMARK.h + 8, overflow: 'hidden' }}>
            <Img
              src={staticFile('brand/releaf-logo.png')}
              style={{
                position: 'absolute', left: -WORDMARK_PNG.x0 * LOGO.k + 4, top: -WORDMARK_PNG.y0 * LOGO.k + 4 - (1 - roll) * (WORDMARK.h + 8) * 1.1,
                width: LOGO.size, height: LOGO.size, maxWidth: 'none',
              }}
            />
          </div>
        )}
        {/* logo kompletne: oryginalny plik */}
        {done && (
          <Img src={staticFile('brand/releaf-logo.png')} style={{ position: 'absolute', left: LOGO.x, top: LOGO.y, width: LOGO.size, height: LOGO.size, maxWidth: 'none' }} />
        )}
      </div>
      <PosterText t={t} />
    </div>
  );
};

// Hasło i drobna typografia plakatu
const Line = ({ t, at, out, children, style }: { t: number; at: number; out: number; children: React.ReactNode; style: React.CSSProperties }) => {
  const pin = seg(t, at, at + 22, bezier(0.2, 0.8, 0.2, 1));
  const pout = seg(t, out, out + 12, inCubic);
  return (
    <div style={{ overflow: 'hidden', ...style }}>
      <div style={{ transform: `translateY(${(1 - pin) * 105 + pout * 105}%)` }}>{children}</div>
    </div>
  );
};
const PosterText = ({ t }: { t: number }) => {
  if (t < T.logo) return null;
  const tagY = POSTER.y + POSTER.size + 74;
  const k = (px: number) => ({ ...font(800, px), color: C.ivory, letterSpacing: -0.025 * px, lineHeight: `${px * 1.16}px`, whiteSpace: 'nowrap' as const });
  const small = { ...font(800, 25), letterSpacing: 25 * 0.22, color: C.accentLight, lineHeight: '34px' };
  return (
    <>
      <Line t={t} at={T.logo + 6} out={T.loop - 20} style={{ position: 'absolute', left: POSTER.x, top: POSTER.y - 74 }}>
        <div style={small}>30 DNI</div>
      </Line>
      <Line t={t} at={T.logo + 9} out={T.loop - 19} style={{ position: 'absolute', right: 1080 - POSTER.x - POSTER.size, top: POSTER.y - 74 }}>
        <div style={{ ...small, textAlign: 'right' }}>NOWA PERSPEKTYWA</div>
      </Line>
      <Line t={t} at={T.logo + 8} out={T.loop - 18} style={{ position: 'absolute', left: POSTER.x - 4, top: tagY }}>
        <div style={k(76)}>Poznaj swój dzień.</div>
      </Line>
      <Line t={t} at={T.logo + 14} out={T.loop - 15} style={{ position: 'absolute', left: POSTER.x - 4, top: tagY + 88 }}>
        <div style={k(76)}>
          Poznaj siebie<span style={{ color: C.peach }}>.</span>
        </div>
      </Line>
    </>
  );
};
