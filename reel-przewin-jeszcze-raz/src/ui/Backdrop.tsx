/*
 * Tło końcowego plakatu: kremowy papier (strona notesu z bliska) i miękka plama słońca z cieniem szprosów —
 * to samo światło, które padało na stół i ścianę na początku. Leży pod ekranem aplikacji,
 * więc widać je dopiero, gdy ekran rozchyla się w motyla.
 */
import React from 'react';
import {T} from '../timeline';
import {mix, p} from '../lib/anim';

export const Backdrop: React.FC<{f: number}> = ({f}) => {
  const o = p(f, T.typing, T.typing + 40);
  if (o <= 0) return null;
  const drift = mix(0, 40, p(f, T.typing, 1200));
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: o}}>
      <defs>
        <linearGradient id="bd-paper" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#F8F2E8" />
          <stop offset="1" stopColor="#F1E7D8" />
        </linearGradient>
        <filter id="bd-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={26} />
        </filter>
        <filter id="bd-soft2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={12} />
        </filter>
      </defs>
      <rect width={1080} height={1920} fill="url(#bd-paper)" />
      <g transform={`translate(${drift} ${drift * 0.4})`}>
        <path d="M -260 -120 L 640 -120 L 1340 1500 L 440 1500 Z" fill="#FFF8EC" opacity={0.75} filter="url(#bd-soft)" />
        <path d="M 170 -120 L 214 -120 L 914 1500 L 870 1500 Z" fill="#E5D6BF" opacity={0.45} filter="url(#bd-soft2)" />
        <path d="M -260 620 L 940 620 L 960 664 L -240 664 Z" fill="#E5D6BF" opacity={0.3} filter="url(#bd-soft2)" />
      </g>
    </svg>
  );
};
