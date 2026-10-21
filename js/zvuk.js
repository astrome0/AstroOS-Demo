// AstroOS — systémové zvuky (skládané za běhu, žádné soubory)

import { State } from './state.js';

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const hlasitost = () => (State.get('zvuky') === false ? 0 : (State.get('volume') ?? 62) / 100);

/** Jeden tón: frekvence v Hz, délka v sekundách. */
function ton(f, delka, { typ = 'sine', hlasitostiPomer = 1, zpozdeni = 0, doF = null } = {}) {
  const a = audio();
  if (!a) return;
  const hl = hlasitost() * 0.16 * hlasitostiPomer;
  if (hl <= 0) return;

  const t0 = a.currentTime + zpozdeni;
  const osc = a.createOscillator();
  const zesil = a.createGain();
  osc.type = typ;
  osc.frequency.setValueAtTime(f, t0);
  if (doF) osc.frequency.exponentialRampToValueAtTime(doF, t0 + delka);

  // měkký náběh i doznění, ať to necvaká
  zesil.gain.setValueAtTime(0.0001, t0);
  zesil.gain.exponentialRampToValueAtTime(hl, t0 + 0.012);
  zesil.gain.exponentialRampToValueAtTime(0.0001, t0 + delka);

  osc.connect(zesil).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + delka + 0.05);
}

export const ZVUKY = {
  prihlaseni: () => { ton(523.25, 0.26, { hlasitostiPomer: 0.9 }); ton(659.25, 0.3, { zpozdeni: 0.1 }); ton(783.99, 0.5, { zpozdeni: 0.2 }); },
  oznameni: () => { ton(880, 0.14); ton(1174.66, 0.22, { zpozdeni: 0.09 }); },
  chyba: () => { ton(320, 0.18, { typ: 'triangle' }); ton(220, 0.28, { typ: 'triangle', zpozdeni: 0.12 }); },
  klik: () => ton(1600, 0.035, { typ: 'square', hlasitostiPomer: 0.28 }),
  zamek: () => { ton(660, 0.1); ton(440, 0.22, { zpozdeni: 0.08 }); },
  vypnuti: () => ton(660, 0.6, { doF: 180, typ: 'sine' }),
  koš: () => ton(300, 0.16, { typ: 'sawtooth', hlasitostiPomer: 0.4, doF: 140 }),
  // jemné cvaknutí pro tlačítka v instalaci (OOBE)
  jemny: () => { ton(1318.5, 0.05, { hlasitostiPomer: 0.3 }); ton(1975.5, 0.06, { hlasitostiPomer: 0.18, zpozdeni: 0.03 }); },
};

// Legrační varianty, když je systém „nakažený“ MP3 Turbo Stahovačem (nakaza.js).
const LEGRACE = {
  prihlaseni: () => { ton(200, 0.3, { typ: 'square', doF: 900, hlasitostiPomer: 0.5 }); ton(900, 0.4, { typ: 'square', doF: 150, zpozdeni: 0.3, hlasitostiPomer: 0.5 }); },
  oznameni: () => { ton(260, 0.12, { typ: 'square', doF: 520, hlasitostiPomer: 0.5 }); ton(520, 0.18, { typ: 'square', doF: 180, zpozdeni: 0.13, hlasitostiPomer: 0.5 }); },
  chyba: () => { ton(180, 0.5, { typ: 'sawtooth', doF: 60, hlasitostiPomer: 0.5 }); },
  klik: () => ton(900, 0.06, { typ: 'square', doF: 1800, hlasitostiPomer: 0.3 }),
  zamek: () => ton(700, 0.3, { typ: 'square', doF: 200, hlasitostiPomer: 0.5 }),
  vypnuti: () => ton(400, 0.9, { typ: 'square', doF: 60, hlasitostiPomer: 0.5 }),
  koš: () => ton(150, 0.25, { typ: 'square', doF: 600, hlasitostiPomer: 0.4 }),
};
let legrace = false;
export const nastavLegraci = (zap) => { legrace = zap; };

/** Přehraje zvuk podle názvu; neznámý název nic neudělá. */
export function zvuk(jmeno) {
  try { (legrace ? LEGRACE : ZVUKY)[jmeno]?.(); } catch { /* prohlížeč zvuk nedovolil */ }
}
