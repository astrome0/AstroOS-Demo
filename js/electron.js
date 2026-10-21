// AstroOS — napojení na aplikaci v Electronu (AstroOS/app). V prohlížeči se nic z toho nespustí.
//
// Hlavní proces zachytí zkratky, které by jinak spolkly Windows nebo rám s webem, a pošle je sem:
//   alt+f4 → stejná událost jako klávesa (os.js zavře okno), ostatní → bus 'zkratka' (Nova).

import { bus } from './util.js';

export const vElectronu = !!window.astroElectron;

if (vElectronu) {
  window.astroElectron.naKlavesu((k) => {
    if (k === 'alt+f4') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', code: 'F4', altKey: true, bubbles: true, cancelable: true }));
      return;
    }
    bus.emit('zkratka', k);
  });
  // Odkaz, který chtěl nové okno → panel v Nově
  window.astroElectron.naOdkaz((url) => import('./apps.js').then(({ openApp }) => openApp('browser', { url })));
}

/** Vypnutí AstroOS v aplikaci = zavřít aplikaci. Vrací false v prohlížeči. */
export function vypniAplikaci() {
  if (!vElectronu) return false;
  window.astroElectron.vypnout();
  return true;
}
