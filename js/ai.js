// AstroOS — vrstva mezi aplikacemi a AI (ukázková verze)
//
// V plné verzi tu je napojení na lokální jazykový model. Ukázka ho nemá: každá AI funkce
// (Písmo, Tabulky, Prezentace, Pošta, Editor, Nova, Astro 3D…) dostane místo odpovědi
// hlášku z js/demo.js. Aplikace s vlastním místním pomocníkem (Tabulky, Prezentace) ho použijí.

import { DEMO_AI } from './demo.js';

/** Hláška, kterou aplikace ukážou, když AI nejde. */
export const NEBEZI = DEMO_AI;

/** Ukázka nemá model → vždy „místní“ režim. */
export async function aktivniRezim() {
  return { rezim: 'mistni', chyba: DEMO_AI };
}

/** Místo odpovědi modelu jen hláška o ukázkové verzi. */
export async function send(zpravy, { onToken } = {}) {
  onToken?.(DEMO_AI);
  return { text: DEMO_AI, myslenky: '', zdroje: [], rezim: 'mistni' };
}

/** JSON odpověď (Astro 3D) — v ukázce není. */
export async function jsonOdpoved() {
  throw new Error(DEMO_AI);
}
