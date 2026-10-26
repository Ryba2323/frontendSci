declare module 'opentype.js' {
  export type Font = any;
  export function parse(buf: ArrayBuffer): Font;
}
declare module 'flubber' {
  export function interpolate(a: string, b: string, opts?: { maxSegmentLength?: number; string?: boolean }): (t: number) => string;
}
