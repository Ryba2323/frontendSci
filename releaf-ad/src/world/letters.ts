// Bryły liter „DZI / SIA / J?” z konturów Plus Jakarta Sans ExtraBold.
// Kropka „?” nie jest literą — to stos płyt dni (jej miejsce i rozmiar wyznaczają skalę całego napisu).
import * as THREE from 'three';
import type { Font } from 'opentype.js';

export type LetterDef = { ch: string; geo: THREE.ExtrudeGeometry; center: THREE.Vector3 };

const toShapes = (commands: any[], skip?: (c: number) => boolean) => {
  // podział na kontury
  const contours: any[][] = [];
  let cur: any[] = [];
  for (const c of commands) {
    if (c.type === 'M' && cur.length) { contours.push(cur); cur = []; }
    cur.push(c);
  }
  if (cur.length) contours.push(cur);
  const sp = new THREE.ShapePath();
  contours.forEach((cs, ci) => {
    if (skip?.(ci)) return;
    for (const c of cs) {
      if (c.type === 'M') sp.moveTo(c.x, c.y);
      else if (c.type === 'L') sp.lineTo(c.x, c.y);
      else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
      else if (c.type === 'C') sp.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    }
  });
  return { shapes: (sp as any).toShapes(false) as THREE.Shape[], contours };
};

const bbox = (cs: any[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cs) if (c.x !== undefined) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
  return { x0, y0, x1, y1 };
};

export const DEPTH = 0.6;
export const buildLetters = (font: Font) => {
  const lines = ['DZI', 'SIA', 'J?'];
  const upm = font.unitsPerEm;
  // kropka znaku zapytania: kontur leżący najniżej
  const q = font.charToGlyph('?');
  const qc = toShapes(q.path.commands).contours;
  const qb = qc.map(bbox);
  const dotIdx = qb.reduce((m: number, b: any, i: number) => (b.y1 < qb[m].y1 ? i : m), 0);
  const dot = qb[dotIdx];
  const s = 1 / (dot.x1 - dot.x0); // skala: kropka = 1 jednostka = płyta dnia
  const capH = font.tables.os2.sCapHeight || 0.7 * upm;
  const lead = capH * 1.17;
  const tracking = -0.02 * upm;
  const placed: { ch: string; x: number; y: number }[] = [];
  lines.forEach((line, li) => {
    let x = 0;
    for (let k = 0; k < line.length; k++) {
      const g = font.charToGlyph(line[k]);
      placed.push({ ch: line[k], x, y: -li * lead });
      const next = k < line.length - 1 ? font.charToGlyph(line[k + 1]) : null;
      x += g.advanceWidth + tracking + (next ? font.getKerningValue(g, next) : 0);
    }
  });
  const qPlaced = placed.find((p) => p.ch === '?')!;
  // początek układu = środek kropki
  const ox = qPlaced.x + (dot.x0 + dot.x1) / 2, oy = qPlaced.y + (dot.y0 + dot.y1) / 2;
  const defs: LetterDef[] = placed.map((p) => {
    const g = font.charToGlyph(p.ch);
    const { shapes } = toShapes(g.path.commands, p.ch === '?' ? (ci) => ci === dotIdx : undefined);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: DEPTH / s, bevelEnabled: true, bevelThickness: 0.035 / s, bevelSize: 0.022 / s, bevelSegments: 3, curveSegments: 14,
    });
    geo.scale(s, s, s);
    geo.translate((p.x - ox) * s, (p.y - oy) * s, 0);
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    return { ch: p.ch, geo, center };
  });
  return { defs, capH: capH * s, lead: lead * s };
};
