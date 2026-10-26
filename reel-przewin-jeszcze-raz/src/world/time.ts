/*
 * Czas świata (klatka „wewnątrz” sceny), inny niż czas filmu:
 * płynie normalnie, staje w miejscu (freeze), cofa się (przewijanie), a po powrocie do pokoju znów płynie.
 */
import {T} from '../timeline';
import {E, k} from '../lib/anim';

export const REWOUND_TO = T.cupDown + 1; // kropla z powrotem w herbacie, kubek dalej na stole

export const worldTime = (f: number) => {
  if (f < T.freeze) return f;
  if (f < T.rewind) return T.freeze;
  if (f < T.pullBack) return k(f, T.rewind, T.rewind + 32, T.freeze, REWOUND_TO, E.in);
  // po powrocie do pokoju czas płynie dalej — herbata dawno się uspokoiła
  return 260 + (f - T.pullBack);
};
